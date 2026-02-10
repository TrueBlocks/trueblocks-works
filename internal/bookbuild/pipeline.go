package bookbuild

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"

	"golang.org/x/sync/errgroup"
)

// ProgressFunc is the signature for progress callback functions
type ProgressFunc func(stage string, current, total int, message string)

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// reanalyzeWithTOC re-runs analysis with the actual TOC page count
func reanalyzeWithTOC(m *Manifest, tocPages int) (*AnalysisResult, error) {
	return AnalyzeManifestWithTOCEstimate(m, tocPages)
}

// createTOCPDFWithTemplate uses the template-based DOCX approach if a template
// exists, otherwise falls back to the raw PDF generator.
func createTOCPDFWithTemplate(entries []TOCEntry, outputPath, templatePath string, config OverlayConfig) error {
	if templatePath != "" {
		if _, err := os.Stat(templatePath); err == nil {
			return CreateTOCPDFViaDocx(entries, templatePath, outputPath)
		}
	}
	return CreateTOCPDF(entries, outputPath, config)
}

type PipelineOptions struct {
	Ctx          context.Context
	Manifest     *Manifest
	CollectionID int64
	CacheDir     string
	OutputPath   string
	RebuildAll   bool
	OnProgress   ProgressFunc
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
	home, err := os.UserHomeDir()
	if err != nil {
		panic(fmt.Sprintf("failed to get home directory: %v", err))
	}
	return filepath.Join(home, ".works", "book-builds", fmt.Sprintf("coll-%d", collectionID))
}

func BuildWithParts(opts PipelineOptions) (*PipelineResult, error) {
	result := &PipelineResult{
		Warnings: []string{},
	}

	// Helper to check for cancellation
	checkCancelled := func() error {
		if opts.Ctx != nil && opts.Ctx.Err() != nil {
			return opts.Ctx.Err()
		}
		return nil
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

	// Create blank.pdf once at the start, matching the template page size
	blankPagePath := filepath.Join(opts.CacheDir, "blank.pdf")
	width, height := 432.0, 648.0 // default 6x9 inches in points
	if opts.Manifest.TemplatePath != "" {
		if w, h, err := ExtractTemplatePageSize(opts.Manifest.TemplatePath); err == nil {
			width, height = w, h
		}
	}
	if err := CreateBlankPage(blankPagePath, width, height); err != nil {
		return nil, fmt.Errorf("failed to create blank page: %w", err)
	}

	progress := func(stage string, current, total int, message string) {
		if opts.OnProgress != nil {
			opts.OnProgress(stage, current, total, message)
		}
	}

	if err := checkCancelled(); err != nil {
		return nil, err
	}

	progress("Analyzing", 1, 5, "Analyzing manifest...")

	analysis, err := AnalyzeManifest(opts.Manifest)
	if err != nil {
		return nil, fmt.Errorf("analysis failed: %w", err)
	}

	if len(analysis.PartAnalyses) == 0 {
		return nil, fmt.Errorf("manifest has no parts")
	}

	config := DefaultOverlayConfig(opts.Manifest.Title)
	if opts.Manifest.Typography.HeaderFont != "" {
		config.Typography = opts.Manifest.Typography
	}
	config.VersoHeader = opts.Manifest.VersoHeader
	config.RectoHeader = opts.Manifest.RectoHeader
	config.PageNumberPosition = opts.Manifest.PageNumberPosition
	config.SuppressPageNumbers = opts.Manifest.SuppressPageNumbers

	progress("TOC", 2, 5, "Generating table of contents...")

	tocEntries, err := GenerateTOC(analysis, config)
	if err != nil {
		return nil, fmt.Errorf("TOC generation failed: %w", err)
	}

	// Generate TOC PDF first to get actual page count
	var tocPDFPath string
	if analysis.TOCIndex >= 0 && len(tocEntries) > 0 {
		tocPDFPath = filepath.Join(opts.CacheDir, "toc.pdf")
		if err := createTOCPDFWithTemplate(tocEntries, tocPDFPath, opts.Manifest.TemplatePath, config); err != nil {
			return nil, fmt.Errorf("TOC PDF creation failed: %w", err)
		}

		// Reanalyze if actual TOC pages differ from estimate
		actualTOCPages, err := GetPageCount(tocPDFPath)
		if err != nil {
			return nil, fmt.Errorf("failed to get TOC page count: %w", err)
		}
		if actualTOCPages > 0 && actualTOCPages != analysis.TOCPageEstimate {
			analysis, err = reanalyzeWithTOC(opts.Manifest, actualTOCPages)
			if err != nil {
				return nil, fmt.Errorf("TOC re-analysis failed: %w", err)
			}
			// Regenerate TOC entries and PDF with correct page numbers
			tocEntries, err = GenerateTOC(analysis, config)
			if err != nil {
				return nil, fmt.Errorf("TOC regeneration failed: %w", err)
			}
			if err := createTOCPDFWithTemplate(tocEntries, tocPDFPath, opts.Manifest.TemplatePath, config); err != nil {
				return nil, fmt.Errorf("TOC PDF recreation failed: %w", err)
			}
		}
	}

	var frontMatterPDFs []string

	// Process analysis.Items for front matter (includes blank pages for recto positioning)
frontMatterLoop:
	for i := range analysis.Items {
		item := &analysis.Items[i]

		// Stop when we hit the first part (blank pages after TOC belong to the part)
		if item.Type == ContentTypePartDivider || item.Type == ContentTypeWork {
			break
		}

		switch item.Type {
		case ContentTypeBlank:
			frontMatterPDFs = append(frontMatterPDFs, blankPagePath)

		case ContentTypeTOC:
			if tocPDFPath != "" {
				frontMatterPDFs = append(frontMatterPDFs, tocPDFPath)
			}
			break frontMatterLoop

		case ContentTypeFrontMatter:
			if item.PDF != "" {
				frontMatterPDFs = append(frontMatterPDFs, ExpandPath(item.PDF))
			}
		}
	}

	progress("Parts", 3, 5, fmt.Sprintf("Building %d parts (%d works)...",
		len(analysis.PartAnalyses), len(analysis.Items)))

	type workItem struct {
		partIdx int
		itemIdx int
		item    *ContentItem
		bodyNum int
	}

	var workItems []workItem
	for partIdx, pa := range analysis.PartAnalyses {
		partItems := analysis.GetPartItems(partIdx)
		bodyNum := pa.StartPage - analysis.FrontMatterPages
		for itemIdx, item := range partItems {
			if item.Type == ContentTypeBlank {
				bodyNum++
				continue
			}
			if item.PDF == "" {
				continue
			}
			workItems = append(workItems, workItem{
				partIdx: partIdx,
				itemIdx: itemIdx,
				item:    &partItems[itemIdx],
				bodyNum: bodyNum,
			})
			bodyNum += item.PageCount
		}
	}

	type workResult struct {
		partIdx int
		itemIdx int
		pdfPath string
	}

	results := make([]workResult, len(workItems))
	var worksCompleted atomic.Int32
	var progressMu sync.Mutex

	safeProgress := func(stage string, current, total int, message string) {
		progressMu.Lock()
		defer progressMu.Unlock()
		progress(stage, current, total, message)
	}

	g, gCtx := errgroup.WithContext(opts.Ctx)
	g.SetLimit(runtime.NumCPU())

	for wi := range workItems {
		wi := wi
		w := workItems[wi]

		g.Go(func() error {
			if gCtx.Err() != nil {
				return gCtx.Err()
			}

			safeProgress("Parts", 3, 5, fmt.Sprintf("Processing: %s", w.item.Title))

			outputPath, err := PrepareAndOverlayWork(WorkOverlayOptions{
				CacheDir:            opts.CacheDir,
				Item:                w.item,
				Config:              config,
				SuppressPageNumbers: config.SuppressPageNumbers,
				StartBodyNum:        w.bodyNum,
			})
			if err != nil {
				return fmt.Errorf("failed to process %s: %w", w.item.Title, err)
			}

			results[wi] = workResult{
				partIdx: w.partIdx,
				itemIdx: w.itemIdx,
				pdfPath: outputPath,
			}

			completed := worksCompleted.Add(1)
			safeProgress("Parts", 3, 5,
				fmt.Sprintf("%d of %d works complete", completed, len(workItems)))
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	resultsByPart := make(map[int]map[int]string)
	for _, r := range results {
		if resultsByPart[r.partIdx] == nil {
			resultsByPart[r.partIdx] = make(map[int]string)
		}
		resultsByPart[r.partIdx][r.itemIdx] = r.pdfPath
	}

	partPDFs := make([]string, len(analysis.PartAnalyses))
	for partIdx := range analysis.PartAnalyses {
		pa := analysis.PartAnalyses[partIdx]
		partItems := analysis.GetPartItems(partIdx)

		var partFiles []string
		for itemIdx, item := range partItems {
			if item.Type == ContentTypeBlank {
				partFiles = append(partFiles, blankPagePath)
				continue
			}
			if pdfPath, ok := resultsByPart[partIdx][itemIdx]; ok {
				partFiles = append(partFiles, pdfPath)
			}
		}

		if len(partFiles) == 0 {
			continue
		}

		if len(partFiles) == 1 {
			cachePath := PartCachePath(opts.CacheDir, pa.PartID)
			if err := copyFile(partFiles[0], cachePath); err != nil {
				return nil, fmt.Errorf("failed to cache part %d: %w", partIdx, err)
			}
			partPDFs[partIdx] = cachePath
		} else {
			cachePath := PartCachePath(opts.CacheDir, pa.PartID)
			if err := mergeFilesRaw(partFiles, cachePath); err != nil {
				return nil, fmt.Errorf("failed to merge part %d: %w", partIdx, err)
			}
			partPDFs[partIdx] = cachePath
		}
	}

	result.PartsBuilt = int(worksCompleted.Load())
	result.PartsCached = 0

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

	totalPages, err := GetPageCount(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get final page count: %w", err)
	}
	result.TotalPages = totalPages
	result.WorkCount = len(opts.Manifest.AllWorks())
	result.Success = true
	result.OutputPath = opts.OutputPath

	return result, nil
}
