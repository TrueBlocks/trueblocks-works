package bookbuild

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

type PartBuildOptions struct {
	Manifest       *Manifest
	Analysis       *AnalysisResult
	PartIndex      int
	CacheDir       string
	BlankPagePath  string
	Config         OverlayConfig
	OnProgress     ProgressFunc
	SkipOverlays   bool
	PageNumTracker *PageNumberTracker
}

type PartBuildResult struct {
	PartIndex    int
	PartTitle    string
	OutputPath   string
	TotalPages   int
	WorkCount    int
	FromCache    bool
	Warnings     []string
	FinalBodyNum int
}

type PageNumberTracker struct {
	FrontMatterNum int
	BodyNum        int
	BackMatterNum  int
}

func NewPageNumberTracker() *PageNumberTracker {
	return &PageNumberTracker{
		FrontMatterNum: 1,
		BodyNum:        1,
		BackMatterNum:  1,
	}
}

func PartCachePath(cacheDir string, partID int64) string {
	return filepath.Join(cacheDir, fmt.Sprintf("part-%d-overlaid.pdf", partID))
}

func PartMergedPath(cacheDir string, partID int64) string {
	return filepath.Join(cacheDir, fmt.Sprintf("part-%d-merged.pdf", partID))
}

func IsPartCached(cacheDir string, partID int64) bool {
	cachePath := PartCachePath(cacheDir, partID)
	_, err := os.Stat(cachePath)
	return err == nil
}

func BuildPart(opts PartBuildOptions) (*PartBuildResult, error) {
	result := &PartBuildResult{
		PartIndex: opts.PartIndex,
		Warnings:  []string{},
	}

	if opts.PartIndex < 0 || opts.PartIndex >= len(opts.Analysis.PartAnalyses) {
		return nil, fmt.Errorf("invalid part index %d", opts.PartIndex)
	}

	pa := opts.Analysis.PartAnalyses[opts.PartIndex]
	result.PartTitle = pa.PartTitle
	result.WorkCount = pa.WorkCount
	result.TotalPages = pa.PageCount

	if err := os.MkdirAll(opts.CacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	cachePath := PartCachePath(opts.CacheDir, pa.PartID)
	mergedPath := PartMergedPath(opts.CacheDir, pa.PartID)

	progress := func(stage string, current, total int, message string) {
		if opts.OnProgress != nil {
			opts.OnProgress(stage, current, total, message)
		}
	}

	progress("Part", opts.PartIndex+1, len(opts.Analysis.PartAnalyses),
		fmt.Sprintf("Building part %d: %s", opts.PartIndex+1, pa.PartTitle))

	partItems := opts.Analysis.GetPartItems(opts.PartIndex)
	if len(partItems) == 0 {
		return nil, fmt.Errorf("no items in part %d", opts.PartIndex)
	}

	pdfPaths := make([]string, 0, len(partItems))
	var partMappings []PageMapping

	physicalPage := pa.StartPage

	workIndex := 0
	for i := range partItems {
		item := &partItems[i]

		if item.Type == ContentTypeBlank {
			if opts.BlankPagePath == "" {
				return nil, fmt.Errorf("blank page required but BlankPagePath not set")
			}
			pdfPaths = append(pdfPaths, opts.BlankPagePath)
			partMappings = append(partMappings, PageMapping{
				PhysicalPage: physicalPage,
				ContentItem:  item,
				PageInItem:   1,
			})
			physicalPage++
			continue
		}

		if item.PDF == "" {
			continue
		}

		if item.Type == ContentTypeWork {
			workIndex++
			progress("Work", workIndex, pa.WorkCount,
				fmt.Sprintf("Processing: %s", item.Title))
		}

		expanded := ExpandPath(item.PDF)
		pdfPaths = append(pdfPaths, expanded)

		for p := 1; p <= item.PageCount; p++ {
			partMappings = append(partMappings, PageMapping{
				PhysicalPage: physicalPage,
				ContentItem:  item,
				PageInItem:   p,
			})
			physicalPage++
		}
	}

	if len(pdfPaths) == 0 {
		return nil, fmt.Errorf("no PDFs in part %d", opts.PartIndex)
	}

	// Use MergeRaw to avoid filename tracking issues
	if err := mergeFilesRaw(pdfPaths, mergedPath); err != nil {
		return nil, fmt.Errorf("failed to merge part %d PDFs: %w", opts.PartIndex, err)
	}

	if !opts.SkipOverlays {
		adjustedMappings := adjustMappingsForPartPDF(partMappings, pa.StartPage)

		progress("Part", opts.PartIndex+1, len(opts.Analysis.PartAnalyses),
			fmt.Sprintf("Adding page numbers to part %d...", opts.PartIndex+1))

		tracker := opts.PageNumTracker
		if tracker == nil {
			tracker = NewPageNumberTracker()
			tracker.BodyNum = pa.StartPage - opts.Analysis.FrontMatterPages
		}

		if err := addPartPageNumbers(mergedPath, adjustedMappings, opts.Config, tracker); err != nil {
			return nil, fmt.Errorf("page numbers failed for part %d: %w", opts.PartIndex, err)
		}

		result.FinalBodyNum = tracker.BodyNum

		progress("Part", opts.PartIndex+1, len(opts.Analysis.PartAnalyses),
			fmt.Sprintf("Adding headers to part %d...", opts.PartIndex+1))

		if err := addPartHeaders(mergedPath, adjustedMappings, opts.Config); err != nil {
			return nil, fmt.Errorf("headers failed for part %d: %w", opts.PartIndex, err)
		}
	}

	if err := copyFile(mergedPath, cachePath); err != nil {
		return nil, fmt.Errorf("failed to save part to cache: %w", err)
	}

	result.OutputPath = cachePath
	result.FromCache = false

	return result, nil
}

func adjustMappingsForPartPDF(mappings []PageMapping, partStartPage int) []PageMapping {
	adjusted := make([]PageMapping, len(mappings))
	for i, m := range mappings {
		adjusted[i] = PageMapping{
			PhysicalPage: m.PhysicalPage - partStartPage + 1,
			ContentItem:  m.ContentItem,
			PageInItem:   m.PageInItem,
		}
	}
	return adjusted
}

func addPartPageNumbers(pdfPath string, mappings []PageMapping, config OverlayConfig, tracker *PageNumberTracker) error {
	for _, m := range mappings {
		if !m.ShouldShowPageNumber() {
			if m.ContentItem != nil {
				switch m.ContentItem.Type {
				case ContentTypeFrontMatter, ContentTypeTOC:
					tracker.FrontMatterNum++
				case ContentTypeBlank, ContentTypePartDivider, ContentTypeWork:
					tracker.BodyNum++
				case ContentTypeBackMatter:
					tracker.BackMatterNum++
				}
			}
			continue
		}

		var pageNumStr string
		switch m.GetNumberStyle() {
		case NumberStyleRoman:
			pageNumStr = ToRoman(tracker.FrontMatterNum)
			tracker.FrontMatterNum++
		case NumberStyleArabic:
			if m.ContentItem != nil && m.ContentItem.Type == ContentTypeBackMatter {
				pageNumStr = fmt.Sprintf("%d", tracker.BackMatterNum)
				tracker.BackMatterNum++
			} else {
				pageNumStr = fmt.Sprintf("%d", tracker.BodyNum)
				tracker.BodyNum++
			}
		default:
			continue
		}

		// Calculate the original book page number from ContentItem.StartPage + page within item
		origPhysical := m.ContentItem.StartPage + m.PageInItem - 1
		position := PositionBottomCenterVerso
		if origPhysical%2 == 1 { // odd = recto
			position = PositionBottomCenterRecto
		}

		if err := addTextToPage(pdfPath, m.PhysicalPage, pageNumStr, config, position); err != nil {
			return fmt.Errorf("failed to add page number to page %d: %w", m.PhysicalPage, err)
		}
	}

	return nil
}

func addPartHeaders(pdfPath string, mappings []PageMapping, config OverlayConfig) error {
	for _, m := range mappings {
		if !m.ShouldShowHeader() {
			continue
		}

		var headerText string
		var position string

		// Calculate the original book page number from ContentItem.StartPage + page within item
		origPhysical := m.ContentItem.StartPage + m.PageInItem - 1
		isVerso := origPhysical%2 == 0

		if isVerso {
			// Left pages (verso): book title
			headerText = config.BookTitle
			position = PositionTopLeft
		} else {
			// Right pages (recto): essay/chapter title
			if m.ContentItem != nil {
				headerText = m.ContentItem.Title
			}
			position = PositionTopRight
		}

		if headerText == "" {
			continue
		}

		if err := addTextToPage(pdfPath, m.PhysicalPage, headerText, config, position); err != nil {
			return fmt.Errorf("failed to add header to page %d: %w", m.PhysicalPage, err)
		}
	}

	return nil
}

func LoadCachedPart(cacheDir string, partID int64, partTitle string, partIndex int) (*PartBuildResult, error) {
	cachePath := PartCachePath(cacheDir, partID)

	if _, err := os.Stat(cachePath); err != nil {
		return nil, fmt.Errorf("cached part %s not found: %w", partTitle, err)
	}

	pageCount, err := GetPageCount(cachePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read cached part: %w", err)
	}

	return &PartBuildResult{
		PartIndex:  partIndex,
		PartTitle:  partTitle,
		OutputPath: cachePath,
		TotalPages: pageCount,
		FromCache:  true,
		Warnings:   []string{},
	}, nil
}

func ClearPartCache(cacheDir string, partID int64) error {
	cachePath := PartCachePath(cacheDir, partID)
	mergedPath := PartMergedPath(cacheDir, partID)

	_ = os.Remove(cachePath)
	_ = os.Remove(mergedPath)

	return nil
}

func ClearAllPartsCache(cacheDir string) error {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			// Remove part caches and stitched.pdf (which depends on parts)
			if (len(name) > 5 && name[:5] == "part-") || name == "stitched.pdf" {
				_ = os.Remove(filepath.Join(cacheDir, name))
			}
		}
	}

	return nil
}

// mergeFilesRaw merges PDFs using stream-based API to avoid filename tracking
func mergeFilesRaw(inFiles []string, outFile string) error {
	if len(inFiles) == 0 {
		return fmt.Errorf("no files to merge")
	}

	// Open all input files
	readers := make([]io.ReadSeeker, len(inFiles))
	files := make([]*os.File, len(inFiles))
	for i, path := range inFiles {
		f, err := os.Open(path)
		if err != nil {
			// Close any already opened files
			for j := 0; j < i; j++ {
				files[j].Close()
			}
			return fmt.Errorf("failed to open %s: %w", path, err)
		}
		files[i] = f
		readers[i] = f
	}
	defer func() {
		for _, f := range files {
			if f != nil {
				f.Close()
			}
		}
	}()

	// Create output file
	out, err := os.Create(outFile)
	if err != nil {
		return fmt.Errorf("failed to create output: %w", err)
	}
	defer out.Close()

	// Merge using stream API (uses numeric indices instead of filenames)
	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	if err := api.MergeRaw(readers, out, false, conf); err != nil {
		return fmt.Errorf("merge failed: %w", err)
	}

	return nil
}
