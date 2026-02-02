package bookbuild

import (
	"fmt"
	"os"
	"path/filepath"
)

type BuildOptions struct {
	Manifest   *Manifest
	BuildDir   string
	OutputPath string
	MaxEssays  int // Limit overlays to first N essays (0 = skip overlays)
	OnProgress func(stage string, current, total int, message string)
}

type ProgressFunc func(stage string, current, total int, message string)

type BuildResult struct {
	Success    bool
	OutputPath string
	TotalPages int
	WorkCount  int
	Duration   string
	Warnings   []string
}

func Build(opts BuildOptions) (*BuildResult, error) {
	result := &BuildResult{
		Warnings: []string{},
	}

	if opts.Manifest == nil {
		return nil, fmt.Errorf("manifest is required")
	}

	if opts.OutputPath == "" {
		opts.OutputPath = opts.Manifest.OutputPath
	}

	if opts.BuildDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		opts.BuildDir = filepath.Join(home, ".works", "book-builds", "temp")
	}

	if err := os.MkdirAll(opts.BuildDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create build directory: %w", err)
	}

	progress := func(stage string, current, total int, message string) {
		if opts.OnProgress != nil {
			opts.OnProgress(stage, current, total, message)
		}
	}

	progress("Analyzing", 1, 6, "Analyzing manifest and counting pages...")

	workCount := len(opts.Manifest.AllWorks())
	for i, w := range opts.Manifest.AllWorks() {
		progress("Analyzing", 1, 6, fmt.Sprintf("Checking %d/%d: %s", i+1, workCount, w.Title))
	}

	analysis, err := AnalyzeManifest(opts.Manifest)
	if err != nil {
		return nil, fmt.Errorf("analysis failed: %w", err)
	}

	result.WorkCount = len(opts.Manifest.AllWorks())

	progress("TOC", 2, 6, "Generating table of contents...")

	config := DefaultOverlayConfig(opts.Manifest.Title)
	if opts.Manifest.Typography.HeaderFont != "" {
		config.Typography = opts.Manifest.Typography
	}
	config.PageNumbersFlushOutside = opts.Manifest.PageNumbersFlushOutside

	tocEntries, err := GenerateTOC(analysis, config)
	if err != nil {
		return nil, fmt.Errorf("TOC generation failed: %w", err)
	}

	var tocPDFPath string
	if analysis.TOCIndex >= 0 && len(tocEntries) > 0 {
		tocPDFPath = filepath.Join(opts.BuildDir, "toc.pdf")
		tocErr := createTOCPDFWithTemplate(tocEntries, tocPDFPath, opts.Manifest.TemplatePath, config)
		if tocErr != nil {
			return nil, fmt.Errorf("TOC PDF creation failed: %w", tocErr)
		}
		{
			actualTOCPages, err := GetPageCount(tocPDFPath)
			if err != nil {
				return nil, fmt.Errorf("failed to get TOC page count: %w", err)
			}
			if actualTOCPages > 0 && actualTOCPages != analysis.TOCPageEstimate {
				analysis, err = reanalyzeWithTOC(opts.Manifest, actualTOCPages)
				if err != nil {
					return nil, fmt.Errorf("TOC re-analysis failed: %w", err)
				}
				tocEntries, err = GenerateTOC(analysis, config)
				if err != nil {
					return nil, fmt.Errorf("TOC regeneration failed: %w", err)
				}
				if err := createTOCPDFWithTemplate(tocEntries, tocPDFPath, opts.Manifest.TemplatePath, config); err != nil {
					return nil, fmt.Errorf("TOC PDF recreation failed: %w", err)
				}
			}

			if analysis.TOCIndex >= 0 && analysis.TOCIndex < len(analysis.Items) {
				analysis.Items[analysis.TOCIndex].PDF = tocPDFPath
			}
		}
	}

	progress("Merging", 3, 6, fmt.Sprintf("Merging %d PDFs...", len(analysis.Items)))

	mergedPath := filepath.Join(opts.BuildDir, "merged.pdf")
	mergeResult, err := MergePDFsWithTracking(analysis, opts.BuildDir, mergedPath, opts.Manifest.TemplatePath)
	if err != nil {
		return nil, fmt.Errorf("merge failed: %w", err)
	}

	result.TotalPages = mergeResult.TotalPages

	progress("Page Numbers", 4, 6, "Adding page numbers...")

	if opts.MaxEssays > 0 {
		limitedMappings := limitMappingsToEssays(mergeResult.PageMappings, opts.MaxEssays)
		progress("Page Numbers", 4, 6, fmt.Sprintf("Adding page numbers to %d pages...", len(limitedMappings)))
		if err := AddPageNumbers(mergedPath, limitedMappings, config); err != nil {
			return nil, fmt.Errorf("page numbers failed: %w", err)
		}
	}

	progress("Headers", 5, 6, "Adding running headers...")

	if opts.MaxEssays > 0 {
		limitedMappings := limitMappingsToEssays(mergeResult.PageMappings, opts.MaxEssays)
		progress("Headers", 5, 6, fmt.Sprintf("Adding headers to %d pages...", len(limitedMappings)))
		if err := AddRunningHeaders(mergedPath, limitedMappings, config); err != nil {
			return nil, fmt.Errorf("running headers failed: %w", err)
		}
	}

	progress("Finalizing", 6, 6, "Writing final PDF...")

	outputDir := filepath.Dir(opts.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	if err := copyFile(mergedPath, opts.OutputPath); err != nil {
		return nil, fmt.Errorf("failed to write output: %w", err)
	}

	result.Success = true
	result.OutputPath = opts.OutputPath

	return result, nil
}

func reanalyzeWithTOC(m *Manifest, tocPages int) (*AnalysisResult, error) {
	result := &AnalysisResult{
		Items:           []ContentItem{},
		TOCIndex:        -1,
		TOCPageEstimate: tocPages,
	}

	currentPage := 1

	for _, fm := range m.FrontMatter {
		if fm.Placeholder && fm.Type == PlaceholderTOC {
			// Insert blank page if needed to ensure TOC starts on recto
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
				PageCount: tocPages,
				StartPage: currentPage,
				EndPage:   currentPage + tocPages - 1,
			})
			currentPage += tocPages
			result.FrontMatterPages += tocPages
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
			currentPage, result = addPartContentReanalysis(currentPage, part, result)
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
			currentPage, result = addWorkContentReanalysis(currentPage, work, "", result)
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

func addPartContentReanalysis(currentPage int, part Part, result *AnalysisResult) (int, *AnalysisResult) {
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
		currentPage, result = addWorkContentReanalysis(currentPage, work, part.Title, result)
	}

	return currentPage, result
}

func addWorkContentReanalysis(currentPage int, work Work, partTitle string, result *AnalysisResult) (int, *AnalysisResult) {
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

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func limitMappingsToEssays(mappings []PageMapping, maxEssays int) []PageMapping {
	if maxEssays <= 0 {
		return mappings
	}

	essayCount := 0
	lastPage := 0

	for _, m := range mappings {
		if m.ContentItem != nil && m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1 {
			essayCount++
			if essayCount > maxEssays {
				break
			}
		}
		lastPage = m.PhysicalPage
	}

	result := make([]PageMapping, 0, lastPage)
	for _, m := range mappings {
		if m.PhysicalPage > lastPage {
			break
		}
		result = append(result, m)
	}

	return result
}
