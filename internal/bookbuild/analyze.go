package bookbuild

import (
	"fmt"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

func GetPageCount(pdfPath string) (int, error) {
	expanded := ExpandPath(pdfPath)
	ctx, err := api.ReadContextFile(expanded)
	if err != nil {
		return 0, fmt.Errorf("failed to read PDF %s: %w", pdfPath, err)
	}
	return ctx.PageCount, nil
}

type PDFInfo struct {
	Path      string
	PageCount int
}

type ContentItem struct {
	Type       ContentType
	Title      string
	PDF        string
	PageCount  int
	StartPage  int
	EndPage    int
	PartTitle  string
	WorkID     int64
	NeedsBlank bool
}

type ContentType int

const (
	ContentTypeFrontMatter ContentType = iota
	ContentTypeTOC
	ContentTypePartDivider
	ContentTypeWork
	ContentTypeBackMatter
	ContentTypeBlank
)

const (
	PlaceholderTOC            = "toc"
	PositionTopLeft           = "top-left"
	PositionTopRight          = "top-right"
	PositionBottomCenter      = "bottom-center"
	PositionBottomCenterVerso = "bottom-center-verso"
	PositionBottomCenterRecto = "bottom-center-recto"
)

type AnalysisResult struct {
	Items            []ContentItem
	FrontMatterPages int
	BodyPages        int
	BackMatterPages  int
	TotalPages       int
	TOCIndex         int
	TOCPageEstimate  int
	PartAnalyses     []PartAnalysis
}

type PartAnalysis struct {
	PartIndex      int
	PartID         int64
	PartTitle      string
	StartPage      int
	EndPage        int
	PageCount      int
	WorkCount      int
	ItemStartIndex int
	ItemEndIndex   int
}

func AnalyzeManifest(m *Manifest) (*AnalysisResult, error) {
	result := &AnalysisResult{
		Items:           []ContentItem{},
		TOCIndex:        -1,
		TOCPageEstimate: 2,
	}

	currentPage := 1

	for _, fm := range m.FrontMatter {
		if fm.Placeholder && fm.Type == PlaceholderTOC {
			if needsBlankForRecto(currentPage) {
				result.Items = append(result.Items, ContentItem{
					Type:       ContentTypeBlank,
					PageCount:  1,
					StartPage:  currentPage,
					EndPage:    currentPage,
					NeedsBlank: true,
				})
				currentPage++
				result.FrontMatterPages++
			}
			result.TOCIndex = len(result.Items)
			result.Items = append(result.Items, ContentItem{
				Type:      ContentTypeTOC,
				Title:     "Table of Contents",
				PageCount: result.TOCPageEstimate,
				StartPage: currentPage,
				EndPage:   currentPage + result.TOCPageEstimate - 1,
			})
			currentPage += result.TOCPageEstimate
			result.FrontMatterPages += result.TOCPageEstimate
			continue
		}

		pageCount, err := GetPageCount(fm.PDF)
		if err != nil {
			return nil, err
		}

		result.Items = append(result.Items, ContentItem{
			Type:      ContentTypeFrontMatter,
			Title:     fm.Type,
			PDF:       fm.PDF,
			PageCount: pageCount,
			StartPage: currentPage,
			EndPage:   currentPage + pageCount - 1,
		})
		currentPage += pageCount
		result.FrontMatterPages += pageCount
	}

	bodyStartPage := currentPage

	if m.HasParts() {
		for partIdx, part := range m.Parts {
			partStartPage := currentPage
			itemStartIdx := len(result.Items)
			currentPage, result = addPartContent(currentPage, part, result)
			itemEndIdx := len(result.Items) - 1

			result.PartAnalyses = append(result.PartAnalyses, PartAnalysis{
				PartIndex:      partIdx,
				PartID:         part.ID,
				PartTitle:      part.Title,
				StartPage:      partStartPage,
				EndPage:        currentPage - 1,
				PageCount:      currentPage - partStartPage,
				WorkCount:      len(part.Works),
				ItemStartIndex: itemStartIdx,
				ItemEndIndex:   itemEndIdx,
			})
		}
	} else {
		for _, work := range m.Works {
			currentPage, result = addWorkContent(currentPage, work, "", result)
		}
	}

	result.BodyPages = currentPage - bodyStartPage

	backMatterStartPage := currentPage
	for _, bm := range m.BackMatter {
		if needsBlankForRecto(currentPage) {
			result.Items = append(result.Items, ContentItem{
				Type:       ContentTypeBlank,
				PageCount:  1,
				StartPage:  currentPage,
				EndPage:    currentPage,
				NeedsBlank: true,
			})
			currentPage++
		}

		pageCount, err := GetPageCount(bm.PDF)
		if err != nil {
			return nil, err
		}

		result.Items = append(result.Items, ContentItem{
			Type:      ContentTypeBackMatter,
			Title:     bm.Type,
			PDF:       bm.PDF,
			PageCount: pageCount,
			StartPage: currentPage,
			EndPage:   currentPage + pageCount - 1,
		})
		currentPage += pageCount
	}
	result.BackMatterPages = currentPage - backMatterStartPage

	result.TotalPages = currentPage - 1

	return result, nil
}

func AnalyzeByParts(m *Manifest) ([]PartAnalysis, error) {
	result, err := AnalyzeManifest(m)
	if err != nil {
		return nil, err
	}
	return result.PartAnalyses, nil
}

func (r *AnalysisResult) GetPartItems(partIdx int) []ContentItem {
	if partIdx < 0 || partIdx >= len(r.PartAnalyses) {
		return nil
	}
	pa := r.PartAnalyses[partIdx]
	return r.Items[pa.ItemStartIndex : pa.ItemEndIndex+1]
}

func addPartContent(currentPage int, part Part, result *AnalysisResult) (int, *AnalysisResult) {
	if needsBlankForRecto(currentPage) {
		result.Items = append(result.Items, ContentItem{
			Type:       ContentTypeBlank,
			PageCount:  1,
			StartPage:  currentPage,
			EndPage:    currentPage,
			NeedsBlank: true,
		})
		currentPage++
	}

	if part.PDF != "" {
		pageCount, err := GetPageCount(part.PDF)
		if err != nil {
			pageCount = 1
		}
		result.Items = append(result.Items, ContentItem{
			Type:      ContentTypePartDivider,
			Title:     part.Title,
			PDF:       part.PDF,
			PageCount: pageCount,
			StartPage: currentPage,
			EndPage:   currentPage + pageCount - 1,
		})
		currentPage += pageCount
	}

	for _, work := range part.Works {
		currentPage, result = addWorkContent(currentPage, work, part.Title, result)
	}

	return currentPage, result
}

func addWorkContent(currentPage int, work Work, partTitle string, result *AnalysisResult) (int, *AnalysisResult) {
	if needsBlankForRecto(currentPage) {
		result.Items = append(result.Items, ContentItem{
			Type:       ContentTypeBlank,
			PageCount:  1,
			StartPage:  currentPage,
			EndPage:    currentPage,
			NeedsBlank: true,
			PartTitle:  partTitle,
		})
		currentPage++
	}

	pageCount, err := GetPageCount(work.PDF)
	if err != nil {
		return currentPage, result
	}

	result.Items = append(result.Items, ContentItem{
		Type:      ContentTypeWork,
		Title:     work.Title,
		PDF:       work.PDF,
		PageCount: pageCount,
		StartPage: currentPage,
		EndPage:   currentPage + pageCount - 1,
		PartTitle: partTitle,
		WorkID:    work.ID,
	})
	currentPage += pageCount

	return currentPage, result
}

func needsBlankForRecto(currentPage int) bool {
	return currentPage%2 == 0
}

func GetPDFPageSize(pdfPath string) (float64, float64, error) {
	expanded := ExpandPath(pdfPath)
	ctx, err := api.ReadContextFile(expanded)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read PDF: %w", err)
	}

	if ctx.PageCount == 0 {
		return 612, 792, nil
	}

	pageDict, _, _, err := ctx.PageDict(1, false)
	if err != nil {
		return 612, 792, nil
	}

	mediaBox := pageDict.ArrayEntry("MediaBox")
	if len(mediaBox) < 4 {
		return 612, 792, nil
	}

	getFloat := func(v any) float64 {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		case int64:
			return float64(n)
		default:
			return 0
		}
	}

	x0 := getFloat(mediaBox[0])
	y0 := getFloat(mediaBox[1])
	x1 := getFloat(mediaBox[2])
	y1 := getFloat(mediaBox[3])

	width := x1 - x0
	height := y1 - y0

	if width <= 0 || height <= 0 {
		return 612, 792, nil
	}

	return width, height, nil
}
