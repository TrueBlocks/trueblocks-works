package bookbuild

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func CreateBlankPage(outputPath string, width, height float64) error {
	// Create a minimal valid PDF with a blank page
	// Using a more complete PDF structure for better compatibility
	var buf bytes.Buffer

	// Header with binary marker
	buf.WriteString("%PDF-1.7\n%\x80\x81\x82\x83\n")

	// Object 1: Catalog
	obj1Offset := buf.Len()
	buf.WriteString("1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n")

	// Object 2: Pages
	obj2Offset := buf.Len()
	buf.WriteString("2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n")

	// Object 3: Page
	obj3Offset := buf.Len()
	fmt.Fprintf(&buf, "3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 %.0f %.0f]/Resources<<>>>>\nendobj\n", width, height)

	// xref table
	xrefOffset := buf.Len()
	buf.WriteString("xref\n0 4\n")
	fmt.Fprintf(&buf, "0000000000 65535 f \n")
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj1Offset)
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj2Offset)
	fmt.Fprintf(&buf, "%010d 00000 n \n", obj3Offset)

	// Trailer
	fmt.Fprintf(&buf, "trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n", xrefOffset)

	return os.WriteFile(outputPath, buf.Bytes(), 0644)
}

func MergePDFs(analysis *AnalysisResult, buildDir, outputPath string) error {
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return fmt.Errorf("failed to create build directory: %w", err)
	}

	pdfPaths := make([]string, 0, len(analysis.Items))
	blankPagePath := filepath.Join(buildDir, "blank.pdf")
	blankCreated := false

	for i, item := range analysis.Items {
		if item.Type == ContentTypeBlank {
			if !blankCreated {
				width, height := 612.0, 792.0
				if i > 0 {
					for j := i - 1; j >= 0; j-- {
						if analysis.Items[j].PDF != "" {
							w, h, err := GetPDFPageSize(analysis.Items[j].PDF)
							if err == nil {
								width, height = w, h
								break
							}
						}
					}
				}
				if err := CreateBlankPage(blankPagePath, width, height); err != nil {
					return fmt.Errorf("failed to create blank page: %w", err)
				}
				blankCreated = true
			}
			pdfPaths = append(pdfPaths, blankPagePath)
			continue
		}

		if item.Type == ContentTypeTOC {
			continue
		}

		if item.PDF == "" {
			continue
		}

		expanded := ExpandPath(item.PDF)
		pdfPaths = append(pdfPaths, expanded)
	}

	if len(pdfPaths) == 0 {
		return fmt.Errorf("no PDFs to merge")
	}

	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	if err := api.MergeCreateFile(pdfPaths, outputPath, false, conf); err != nil {
		return fmt.Errorf("failed to merge PDFs: %w", err)
	}

	return nil
}

type MergeResult struct {
	OutputPath   string
	TotalPages   int
	PageMappings []PageMapping
	RotationLog  []RotationLogEntry
}

type RotationLogEntry struct {
	ItemTitle    string
	ItemType     ContentType
	RotatedPages []int
}

type PageMapping struct {
	PhysicalPage int
	ContentItem  *ContentItem
	PageInItem   int
}

func MergePDFsWithTracking(analysis *AnalysisResult, buildDir, outputPath, templatePath string) (*MergeResult, error) {
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create build directory: %w", err)
	}

	pdfPaths := make([]string, 0, len(analysis.Items))
	var mappings []PageMapping
	var rotationLog []RotationLogEntry
	physicalPage := 1

	blankPagePath := filepath.Join(buildDir, "blank.pdf")
	blankCreated := false

	for i := range analysis.Items {
		item := &analysis.Items[i]

		if item.Type == ContentTypeBlank {
			if !blankCreated {
				if templatePath != "" {
					if err := CreateBlankPageFromTemplate(templatePath, blankPagePath); err != nil {
						return nil, fmt.Errorf("failed to create blank page from template: %w", err)
					}
				} else {
					width, height := 432.0, 648.0 // 6x9 inches in points
					if err := CreateBlankPage(blankPagePath, width, height); err != nil {
						return nil, fmt.Errorf("failed to create blank page: %w", err)
					}
				}
				blankCreated = true
			}
			pdfPaths = append(pdfPaths, blankPagePath)
			mappings = append(mappings, PageMapping{
				PhysicalPage: physicalPage,
				ContentItem:  item,
				PageInItem:   1,
			})
			physicalPage++
			continue
		}

		if item.Type == ContentTypeTOC {
			if item.PDF != "" {
				expanded := ExpandPath(item.PDF)
				pdfPaths = append(pdfPaths, expanded)
			}
			for p := 1; p <= item.PageCount; p++ {
				mappings = append(mappings, PageMapping{
					PhysicalPage: physicalPage,
					ContentItem:  item,
					PageInItem:   p,
				})
				physicalPage++
			}
			continue
		}

		if item.PDF == "" {
			continue
		}

		rotResult, err := PrepareRotatedPDF(item.PDF, buildDir, physicalPage, i)
		if err != nil {
			return nil, fmt.Errorf("failed to prepare PDF for %s: %w", item.Title, err)
		}

		pdfPaths = append(pdfPaths, rotResult.OutputPath)

		if rotResult.WasRotated {
			rotationLog = append(rotationLog, RotationLogEntry{
				ItemTitle:    item.Title,
				ItemType:     item.Type,
				RotatedPages: rotResult.RotatedPages,
			})
		}

		for p := 1; p <= item.PageCount; p++ {
			mappings = append(mappings, PageMapping{
				PhysicalPage: physicalPage,
				ContentItem:  item,
				PageInItem:   p,
			})
			physicalPage++
		}
	}

	if len(pdfPaths) == 0 {
		return nil, fmt.Errorf("no PDFs to merge")
	}

	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	if err := api.MergeCreateFile(pdfPaths, outputPath, false, conf); err != nil {
		return nil, fmt.Errorf("failed to merge PDFs: %w", err)
	}

	return &MergeResult{
		OutputPath:   outputPath,
		TotalPages:   physicalPage - 1,
		PageMappings: mappings,
		RotationLog:  rotationLog,
	}, nil
}

func (m *PageMapping) IsFirstPageOfWork() bool {
	if m.ContentItem == nil {
		return false
	}
	return m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1
}

func (m *PageMapping) ShouldShowHeader() bool {
	if m.ContentItem == nil {
		return false
	}
	switch m.ContentItem.Type {
	case ContentTypeBlank, ContentTypeFrontMatter, ContentTypeTOC,
		ContentTypePartDivider, ContentTypeBackMatter:
		return false
	case ContentTypeWork:
		return m.PageInItem > 1
	}
	return false
}

func (m *PageMapping) ShouldShowPageNumber() bool {
	if m.ContentItem == nil {
		return false
	}
	if m.ContentItem.Type == ContentTypeBlank {
		return false
	}
	if m.ContentItem.Type == ContentTypeFrontMatter {
		return false
	}
	if m.ContentItem.Type == ContentTypePartDivider {
		return false
	}
	if m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1 {
		return false
	}
	return true
}

func (m *PageMapping) GetNumberStyle() NumberStyle {
	if m.ContentItem == nil {
		return NumberStyleNone
	}
	switch m.ContentItem.Type {
	case ContentTypeFrontMatter, ContentTypeTOC:
		return NumberStyleRoman
	case ContentTypePartDivider, ContentTypeWork, ContentTypeBackMatter:
		return NumberStyleArabic
	}
	return NumberStyleNone
}

func (m *PageMapping) IsVerso() bool {
	return m.PhysicalPage%2 == 0
}

func (m *PageMapping) IsRecto() bool {
	return m.PhysicalPage%2 == 1
}
