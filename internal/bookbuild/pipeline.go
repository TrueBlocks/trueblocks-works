package bookbuild

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type PipelineOptions struct {
	Manifest      *Manifest
	CollectionID  int64
	CacheDir      string
	OutputPath    string
	SelectedParts []int
	RebuildAll    bool
	OnProgress    ProgressFunc
}

type PipelineResult struct {
	Success     bool
	OutputPath  string
	TotalPages  int
	WorkCount   int
	PartsBuilt  int
	PartsCached int
	Duration    string
	Warnings    []string
}

func GetCacheDir(collectionID int64) string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".works", "book-builds", fmt.Sprintf("coll-%d", collectionID))
}

func ParseSelectedParts(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			result = append(result, n)
		}
	}
	return result
}

func FormatSelectedParts(parts []int) string {
	if len(parts) == 0 {
		return ""
	}
	strs := make([]string, len(parts))
	for i, p := range parts {
		strs[i] = strconv.Itoa(p)
	}
	return strings.Join(strs, ",")
}

func isPartSelected(partIndex int, selected []int) bool {
	if len(selected) == 0 {
		return true
	}
	for _, s := range selected {
		if s == partIndex {
			return true
		}
	}
	return false
}

func BuildWithParts(opts PipelineOptions) (*PipelineResult, error) {
	result := &PipelineResult{
		Warnings: []string{},
	}

	if opts.Manifest == nil {
		return nil, fmt.Errorf("manifest is required")
	}

	if opts.CacheDir == "" {
		opts.CacheDir = GetCacheDir(opts.CollectionID)
	}

	if err := os.MkdirAll(opts.CacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	progress := func(stage string, current, total int, message string) {
		if opts.OnProgress != nil {
			opts.OnProgress(stage, current, total, message)
		}
	}

	progress("Analyzing", 1, 5, "Analyzing manifest...")

	analysis, err := AnalyzeManifest(opts.Manifest)
	if err != nil {
		return nil, fmt.Errorf("analysis failed: %w", err)
	}

	if len(analysis.PartAnalyses) == 0 {
		return nil, fmt.Errorf("manifest has no parts - use standard Build() instead")
	}

	config := DefaultOverlayConfig(opts.Manifest.Title)
	if opts.Manifest.Typography.HeaderFont != "" {
		config.Typography = opts.Manifest.Typography
	}

	progress("TOC", 2, 5, "Generating table of contents...")

	tocEntries, err := GenerateTOC(analysis, config)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("TOC generation warning: %v", err))
	}

	var tocPDFPath string
	var frontMatterPDFs []string

	for i, fm := range opts.Manifest.FrontMatter {
		if fm.Placeholder && fm.Type == "toc" {
			if len(tocEntries) > 0 {
				tocPDFPath = filepath.Join(opts.CacheDir, "toc.pdf")
				if err := CreateTOCPDF(tocEntries, tocPDFPath, config); err != nil {
					result.Warnings = append(result.Warnings, fmt.Sprintf("TOC PDF creation failed: %v", err))
				} else {
					actualTOCPages, _ := GetPageCount(tocPDFPath)
					if actualTOCPages > 0 && actualTOCPages != analysis.TOCPageEstimate {
						analysis, err = reanalyzeWithTOC(opts.Manifest, actualTOCPages)
						if err != nil {
							result.Warnings = append(result.Warnings, fmt.Sprintf("Re-analysis failed: %v", err))
						}
						tocEntries, _ = GenerateTOC(analysis, config)
						_ = CreateTOCPDF(tocEntries, tocPDFPath, config)
					}
					frontMatterPDFs = append(frontMatterPDFs, tocPDFPath)
				}
			}
		} else {
			if analysis.Items[i].PDF != "" {
				frontMatterPDFs = append(frontMatterPDFs, ExpandPath(analysis.Items[i].PDF))
			}
		}
	}

	progress("Parts", 3, 5, fmt.Sprintf("Building %d parts...", len(analysis.PartAnalyses)))

	partPDFs := make([]string, len(analysis.PartAnalyses))
	tracker := NewPageNumberTracker()
	tracker.BodyNum = 1

	for partIdx := range analysis.PartAnalyses {
		pa := analysis.PartAnalyses[partIdx]
		isSelected := opts.RebuildAll || isPartSelected(partIdx, opts.SelectedParts)
		isCached := IsPartCached(opts.CacheDir, partIdx)

		progress("Parts", 3, 5, fmt.Sprintf("Part %d (%s): selected=%v, cached=%v", partIdx, pa.PartTitle, isSelected, isCached))

		if isSelected {
			// Selected: rebuild with overlays and cache the result
			partResult, err := BuildPart(PartBuildOptions{
				Manifest:       opts.Manifest,
				Analysis:       analysis,
				PartIndex:      partIdx,
				CacheDir:       opts.CacheDir,
				Config:         config,
				OnProgress:     opts.OnProgress,
				SkipOverlays:   false,
				PageNumTracker: tracker,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to build part %d: %w", partIdx, err)
			}
			partPDFs[partIdx] = partResult.OutputPath
			result.PartsBuilt++
			result.Warnings = append(result.Warnings, partResult.Warnings...)
		} else if isCached {
			// Not selected but cached: use cached version (already has overlays)
			cached, err := LoadCachedPart(opts.CacheDir, partIdx)
			if err != nil {
				// Cache load failed, build without overlays
				partResult, err := BuildPart(PartBuildOptions{
					Manifest:       opts.Manifest,
					Analysis:       analysis,
					PartIndex:      partIdx,
					CacheDir:       opts.CacheDir,
					Config:         config,
					OnProgress:     opts.OnProgress,
					SkipOverlays:   true,
					PageNumTracker: tracker,
				})
				if err != nil {
					return nil, fmt.Errorf("failed to build part %d: %w", partIdx, err)
				}
				partPDFs[partIdx] = partResult.OutputPath
				result.Warnings = append(result.Warnings, fmt.Sprintf("Part %d cache load failed, built without overlays", partIdx))
			} else {
				partPDFs[partIdx] = cached.OutputPath
				result.PartsCached++
				// Advance tracker to keep page numbers in sync
				for _, item := range analysis.GetPartItems(partIdx) {
					if item.Type == ContentTypePartDivider || item.Type == ContentTypeWork {
						tracker.BodyNum += item.PageCount
					}
				}
			}
		} else {
			// Not selected and not cached: build without overlays (fast)
			partResult, err := BuildPart(PartBuildOptions{
				Manifest:       opts.Manifest,
				Analysis:       analysis,
				PartIndex:      partIdx,
				CacheDir:       opts.CacheDir,
				Config:         config,
				OnProgress:     opts.OnProgress,
				SkipOverlays:   true,
				PageNumTracker: tracker,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to build part %d: %w", partIdx, err)
			}
			partPDFs[partIdx] = partResult.OutputPath
			result.Warnings = append(result.Warnings, fmt.Sprintf("Part %d (%s) has no overlays", partIdx+1, pa.PartTitle))
		}
	}

	var backMatterPDFs []string
	for _, bm := range opts.Manifest.BackMatter {
		if bm.PDF != "" {
			backMatterPDFs = append(backMatterPDFs, ExpandPath(bm.PDF))
		}
	}

	progress("Stitching", 4, 5, "Stitching final book...")

	allPDFs := make([]string, 0, len(frontMatterPDFs)+len(partPDFs)+len(backMatterPDFs))
	allPDFs = append(allPDFs, frontMatterPDFs...)
	for _, p := range partPDFs {
		if p != "" {
			allPDFs = append(allPDFs, p)
		}
	}
	allPDFs = append(allPDFs, backMatterPDFs...)

	if len(allPDFs) == 0 {
		return nil, fmt.Errorf("no PDFs to stitch")
	}

	// Debug: log what we're stitching
	for i, pdf := range allPDFs {
		progress("Stitching", 4, 5, fmt.Sprintf("PDF %d: %s", i, pdf))
	}

	stitchedPath := filepath.Join(opts.CacheDir, "stitched.pdf")
	// Use stream-based merge to avoid filename tracking issues
	if err := mergeFilesRaw(allPDFs, stitchedPath); err != nil {
		return nil, fmt.Errorf("failed to stitch book: %w", err)
	}

	progress("Finalizing", 5, 5, "Writing final PDF...")

	if opts.OutputPath == "" {
		opts.OutputPath = opts.Manifest.OutputPath
	}

	outputDir := filepath.Dir(opts.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	if err := copyFile(stitchedPath, opts.OutputPath); err != nil {
		return nil, fmt.Errorf("failed to write output: %w", err)
	}

	totalPages, _ := GetPageCount(opts.OutputPath)
	result.TotalPages = totalPages
	result.WorkCount = len(opts.Manifest.AllWorks())
	result.Success = true
	result.OutputPath = opts.OutputPath

	return result, nil
}
