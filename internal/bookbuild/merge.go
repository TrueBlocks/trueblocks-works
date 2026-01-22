package bookbuild

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func CreateBlankPage(outputPath string, width, height float64) error {
	pdfContent := fmt.Sprintf(`%%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
264
%%%%EOF
`, width, height)

	return os.WriteFile(outputPath, []byte(pdfContent), 0644)
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
	if err := api.MergeCreateFile(pdfPaths, outputPath, false, conf); err != nil {
		return fmt.Errorf("failed to merge PDFs: %w", err)
	}

	return nil
}

type MergeResult struct {
	OutputPath   string
	TotalPages   int
	PageMappings []PageMapping
}

type PageMapping struct {
	PhysicalPage int
	ContentItem  *ContentItem
	PageInItem   int
}

func MergePDFsWithTracking(analysis *AnalysisResult, buildDir, outputPath string) (*MergeResult, error) {
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create build directory: %w", err)
	}

	pdfPaths := make([]string, 0, len(analysis.Items))
	var mappings []PageMapping
	physicalPage := 1

	blankPagePath := filepath.Join(buildDir, "blank.pdf")
	blankCreated := false

	for i := range analysis.Items {
		item := &analysis.Items[i]

		if item.Type == ContentTypeBlank {
			if !blankCreated {
				width, height := 612.0, 792.0
				for j := i - 1; j >= 0; j-- {
					if analysis.Items[j].PDF != "" {
						w, h, err := GetPDFPageSize(analysis.Items[j].PDF)
						if err == nil {
							width, height = w, h
							break
						}
					}
				}
				if err := CreateBlankPage(blankPagePath, width, height); err != nil {
					return nil, fmt.Errorf("failed to create blank page: %w", err)
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

		expanded := ExpandPath(item.PDF)
		pdfPaths = append(pdfPaths, expanded)

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
	if err := api.MergeCreateFile(pdfPaths, outputPath, false, conf); err != nil {
		return nil, fmt.Errorf("failed to merge PDFs: %w", err)
	}

	return &MergeResult{
		OutputPath:   outputPath,
		TotalPages:   physicalPage - 1,
		PageMappings: mappings,
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
	if m.ContentItem.Type == ContentTypeFrontMatter && m.PageInItem == 1 {
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
