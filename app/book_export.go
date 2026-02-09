package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const workTypeSection = "Section"

// BookExportResult contains the result of a book export operation
type BookExportResult struct {
	Success    bool     `json:"success"`
	OutputPath string   `json:"outputPath,omitempty"`
	Error      string   `json:"error,omitempty"`
	Warnings   []string `json:"warnings,omitempty"`
	WorkCount  int      `json:"workCount"`
	Duration   string   `json:"duration"`
}

// BookExportProgress represents progress updates during export
type BookExportProgress struct {
	Stage   string `json:"stage"`
	Current int    `json:"current"`
	Total   int    `json:"total"`
	Message string `json:"message"`
}

// FrontBackMatterHTML contains all HTML content for front/back matter pages.
// Each field is optional - if empty, that page is skipped.
type FrontBackMatterHTML struct {
	TitlePage        string `json:"titlePage"`
	Copyright        string `json:"copyright"`
	Dedication       string `json:"dedication"`
	Afterword        string `json:"afterword"`
	Acknowledgements string `json:"acknowledgements"`
	AboutAuthor      string `json:"aboutAuthor"`
}

// PartInfo describes a part/section for the part selection modal
type PartInfo struct {
	Index     int    `json:"index"`
	PartID    int64  `json:"partId"`
	Title     string `json:"title"`
	WorkCount int    `json:"workCount"`
	PageCount int    `json:"pageCount"`
	IsCached  bool   `json:"isCached"`
}

// GetBookParts returns the parts/sections in a collection for the modal
func (a *App) GetBookParts(collID int64) ([]PartInfo, error) {
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, err
	}

	cacheDir := bookbuild.GetCacheDir(collID)

	var parts []PartInfo
	var currentPart *PartInfo
	partIndex := 0
	hasPrologue := len(works) > 0 && works[0].Type != workTypeSection

	if hasPrologue {
		currentPart = &PartInfo{
			Index:     0,
			PartID:    0,
			Title:     "Prologue",
			WorkCount: 0,
			PageCount: 0,
			IsCached:  bookbuild.IsPartCached(cacheDir, 0),
		}
		partIndex = 1
	}

	for _, w := range works {
		if w.Type == workTypeSection {
			if currentPart != nil {
				parts = append(parts, *currentPart)
			}
			currentPart = &PartInfo{
				Index:     partIndex,
				PartID:    w.WorkID,
				Title:     w.Title,
				WorkCount: 0,
				PageCount: 1,
				IsCached:  bookbuild.IsPartCached(cacheDir, w.WorkID),
			}
			partIndex++
		} else if currentPart != nil {
			currentPart.WorkCount++
			pc, _ := bookbuild.GetPageCount(
				filepath.Join(a.fileOps.Config.PDFPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID)),
			)
			currentPart.PageCount += pc
		}
	}

	if currentPart != nil {
		parts = append(parts, *currentPart)
	}

	return parts, nil
}

// GetPartCacheStatus returns a map of part index -> cached status
func (a *App) GetPartCacheStatus(collID int64) (map[int]bool, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}
	buildDir := filepath.Join(homeDir, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))

	result := make(map[int]bool)

	for i := 0; i < 20; i++ {
		cachePath := filepath.Join(buildDir, fmt.Sprintf("part-%d-overlaid.pdf", i))
		if _, err := os.Stat(cachePath); err == nil {
			result[i] = true
		}
	}

	return result, nil
}

// OpenBookPDFResult contains the result of opening a book PDF
type OpenBookPDFResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	Path    string `json:"path,omitempty"`
}

// OpenBookPDF opens the latest exported PDF for a collection
func (a *App) OpenBookPDF(collID int64) (*OpenBookPDFResult, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return &OpenBookPDFResult{
			Success: false,
			Error:   "No book configuration found for collection",
		}, nil
	}

	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return &OpenBookPDFResult{
			Success: false,
			Error:   "Failed to get collection",
		}, nil
	}

	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	filename := sanitizeFilename(bookTitle) + ".pdf"

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}
	pdfPath := filepath.Join(homeDir, "Desktop", filename)

	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		return &OpenBookPDFResult{
			Success: false,
			Error:   "PDF not found. Publish the book first.",
			Path:    pdfPath,
		}, nil
	}

	// Open the PDF using the default application
	cmd := exec.Command("open", pdfPath)
	if err := cmd.Start(); err != nil {
		return &OpenBookPDFResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to open PDF: %v", err),
			Path:    pdfPath,
		}, nil
	}

	return &OpenBookPDFResult{
		Success: true,
		Path:    pdfPath,
	}, nil
}

// CopyBookPDFTextResult contains the result of copying PDF text to clipboard
type CopyBookPDFTextResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// CopyBookPDFText extracts text from the merged part PDFs (body content only) and copies to clipboard
func (a *App) CopyBookPDFText(collID int64) (*CopyBookPDFTextResult, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	buildDir := filepath.Join(homeDir, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))

	// Get section works in order to process parts in correct sequence
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return &CopyBookPDFTextResult{
			Success: false,
			Error:   "Failed to get collection works",
		}, nil
	}

	// Find section workIDs (they have part-{workID}-merged.pdf files)
	var partPaths []string
	for _, w := range works {
		if w.Type == workTypeSection {
			partPath := filepath.Join(buildDir, fmt.Sprintf("part-%d-merged.pdf", w.WorkID))
			if fileExists(partPath) {
				partPaths = append(partPaths, partPath)
			}
		}
	}

	if len(partPaths) == 0 {
		return &CopyBookPDFTextResult{
			Success: false,
			Error:   "No cached parts found. Build the galley first.",
		}, nil
	}

	// Extract text from each part and concatenate
	var allText strings.Builder
	for _, pdfPath := range partPaths {
		cmd := exec.Command("pdftotext", pdfPath, "-")
		output, err := cmd.Output()
		if err != nil {
			continue // Skip failed extractions
		}
		allText.Write(output)
		allText.WriteString("\n")
	}

	// Copy concatenated text to clipboard
	cmd := exec.Command("pbcopy")
	cmd.Stdin = strings.NewReader(allText.String())
	if err := cmd.Run(); err != nil {
		return &CopyBookPDFTextResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to copy to clipboard: %v", err),
		}, nil
	}

	return &CopyBookPDFTextResult{
		Success: true,
	}, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (a *App) buildManifestWithParts(collID int64, book *models.Book, coll *models.Collection, buildDir, outputPath string) (*bookbuild.Manifest, error) {
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works")
	}

	pdfPreviewPath := a.fileOps.Config.PDFPreviewPath

	typography := bookbuild.DefaultTypography()

	templatePath := ""
	if book.TemplatePath != nil && *book.TemplatePath != "" {
		templatePath = *book.TemplatePath
	} else {
		templatePath = a.fileOps.GetBookTemplatePath()
	}

	manifest := &bookbuild.Manifest{
		Title:               book.Title,
		Author:              book.Author,
		OutputPath:          outputPath,
		TemplatePath:        templatePath,
		Typography:          typography,
		WorksStartRecto:     book.WorksStartRecto == nil || *book.WorksStartRecto,
		VersoHeader:         book.VersoHeader,
		RectoHeader:         book.RectoHeader,
		PageNumberPosition:  book.PageNumberPosition,
		SuppressPageNumbers: book.SuppressPageNumbers,
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	// Add individual front matter PDFs in order: titlepage, copyright, dedication
	if fileExists(filepath.Join(buildDir, "titlepage.pdf")) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "titlepage", PDF: filepath.Join(buildDir, "titlepage.pdf")})
	}
	if fileExists(filepath.Join(buildDir, "copyright.pdf")) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "copyright", PDF: filepath.Join(buildDir, "copyright.pdf")})
	}
	if fileExists(filepath.Join(buildDir, "dedication.pdf")) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "dedication", PDF: filepath.Join(buildDir, "dedication.pdf")})
	}

	manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	var currentPart *bookbuild.Part
	var prologueWorks []bookbuild.Work
	hasParts := false

	for _, w := range works {
		if w.IsSuppressed {
			continue
		}
		if w.Type == workTypeSection {
			hasParts = true
			if currentPart != nil {
				manifest.Parts = append(manifest.Parts, *currentPart)
			}
			partDividerPDF := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			currentPart = &bookbuild.Part{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   partDividerPDF,
				Works: []bookbuild.Work{},
			}
		} else if currentPart != nil {
			pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			currentPart.Works = append(currentPart.Works, bookbuild.Work{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   pdfPath,
			})
		} else {
			pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			prologueWorks = append(prologueWorks, bookbuild.Work{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   pdfPath,
			})
		}
	}

	if currentPart != nil {
		manifest.Parts = append(manifest.Parts, *currentPart)
	}

	// Always create a part for prologue works - use NoDivider for section-less books
	if len(prologueWorks) > 0 {
		prologuePart := bookbuild.Part{
			ID:        0,
			Works:     prologueWorks,
			NoDivider: !hasParts, // Skip divider page for section-less books
		}
		if hasParts {
			prologuePart.Title = "Prologue"
		}
		manifest.Parts = append([]bookbuild.Part{prologuePart}, manifest.Parts...)
	}

	if len(manifest.Parts) == 0 {
		return nil, fmt.Errorf("collection has no works")
	}

	// Add individual back matter PDFs in order: afterword, ack, about
	if fileExists(filepath.Join(buildDir, "afterword.pdf")) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "afterword", PDF: filepath.Join(buildDir, "afterword.pdf")})
	}
	if fileExists(filepath.Join(buildDir, "ack.pdf")) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "ack", PDF: filepath.Join(buildDir, "ack.pdf")})
	}
	if fileExists(filepath.Join(buildDir, "about.pdf")) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "about", PDF: filepath.Join(buildDir, "about.pdf")})
	}

	return manifest, nil
}

// ExportBookPDFWithParts exports a collection using the part-based pipeline
func (a *App) ExportBookPDFWithParts(collID int64, rebuildAll bool, htmlContent FrontBackMatterHTML) (*BookExportResult, error) {
	startTime := time.Now()

	a.OpenStatusBar()
	defer a.CloseStatusBar()
	a.EmitStatus("progress", "Making galley...")

	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		a.EmitStatus("error", "No book configuration found for collection")
		return nil, fmt.Errorf("no book configuration found for collection")
	}

	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection: %w", err)
	}

	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	defaultFilename := sanitizeFilename(bookTitle) + ".pdf"

	defaultDir := ""
	if book.ExportPath != nil && *book.ExportPath != "" {
		defaultDir = *book.ExportPath
	} else {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		defaultDir = filepath.Join(homeDir, "Desktop")
	}

	outputPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:            "Export Book as PDF",
		DefaultDirectory: defaultDir,
		DefaultFilename:  defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files", Pattern: "*.pdf"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open save dialog: %w", err)
	}
	if outputPath == "" {
		return nil, nil
	}

	newExportDir := filepath.Dir(outputPath)
	if book.ExportPath == nil || *book.ExportPath != newExportDir {
		book.ExportPath = &newExportDir
		_ = a.db.UpdateBook(book)
	}

	cacheDir := bookbuild.GetCacheDir(collID)

	a.emitExportProgress("Preparing", 1, 5, "Generating front/back matter...")

	if err := a.generateFrontBackMatterPDFs(cacheDir, htmlContent); err != nil {
		a.EmitStatus("error", fmt.Sprintf("Front/back matter generation failed: %v", err))
		return nil, fmt.Errorf("front/back matter generation failed: %w", err)
	}

	manifest, err := a.buildManifestWithParts(collID, book, coll, cacheDir, outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build manifest: %w", err)
	}

	// Fail if manifest has no parts - don't silently fall back
	if len(manifest.Parts) == 0 {
		a.EmitStatus("error", "Manifest has no parts - check that works are not all suppressed")
		return nil, fmt.Errorf("manifest has no parts - check that works are not all suppressed")
	}

	buildCtx := a.createBuildContext()
	defer func() { a.buildCancel = nil }()

	pipelineResult, err := bookbuild.BuildWithParts(bookbuild.PipelineOptions{
		Ctx:          buildCtx,
		Manifest:     manifest,
		CollectionID: collID,
		CacheDir:     cacheDir,
		OutputPath:   outputPath,
		RebuildAll:   rebuildAll,
		OnProgress: func(stage string, current, total int, message string) {
			a.emitExportProgress(stage, current, total, message)
			a.EmitStatus("progress", message)
		},
	})

	if err != nil {
		if buildCtx.Err() != nil {
			a.EmitStatus("cancelled", "Build cancelled")
			return nil, fmt.Errorf("build cancelled")
		}
		a.EmitStatus("error", fmt.Sprintf("Build failed: %v", err))
		return nil, fmt.Errorf("build failed: %w", err)
	}

	a.EmitStatus("success", "Galley created")

	_ = exec.Command("open", outputPath).Start()

	return &BookExportResult{
		Success:    pipelineResult.Success,
		OutputPath: pipelineResult.OutputPath,
		WorkCount:  pipelineResult.WorkCount,
		Warnings:   pipelineResult.Warnings,
		Duration:   time.Since(startTime).Round(time.Millisecond).String(),
	}, nil
}

// ClearPartCache clears cached PDFs for specific parts or all parts
func (a *App) ClearPartCache(collID int64, partIDs []int64) error {
	cacheDir := bookbuild.GetCacheDir(collID)

	if len(partIDs) == 0 {
		return bookbuild.ClearAllPartsCache(cacheDir)
	}

	for _, partID := range partIDs {
		_ = bookbuild.ClearPartCache(cacheDir, partID)
	}
	return nil
}

// emitExportProgress sends progress updates to the frontend
func (a *App) emitExportProgress(stage string, current, total int, message string) {
	runtime.EventsEmit(a.ctx, "book:export:progress", BookExportProgress{
		Stage:   stage,
		Current: current,
		Total:   total,
		Message: message,
	})
}

// sanitizeFilename removes or replaces characters not suitable for filenames
func sanitizeFilename(name string) string {
	// Replace " | " (newline marker from titles) with space first
	name = strings.ReplaceAll(name, " | ", " ")

	replacer := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
	)
	result := replacer.Replace(name)
	// Trim spaces and dots from ends
	result = strings.Trim(result, " .")
	if result == "" {
		result = "untitled"
	}
	return result
}

// generateFrontBackMatterPDFs creates individual PDFs from HTML for each front/back matter page.
// Empty HTML strings are skipped (no PDF generated for that page).
func (a *App) generateFrontBackMatterPDFs(buildDir string, html FrontBackMatterHTML) error {
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return fmt.Errorf("create build dir: %w", err)
	}

	// Generate individual PDFs only for non-empty content
	if html.TitlePage != "" {
		if err := bookbuild.HTMLToPDFFile(html.TitlePage, filepath.Join(buildDir, "titlepage.pdf")); err != nil {
			return fmt.Errorf("create titlepage pdf: %w", err)
		}
	}
	if html.Copyright != "" {
		if err := bookbuild.HTMLToPDFFile(html.Copyright, filepath.Join(buildDir, "copyright.pdf")); err != nil {
			return fmt.Errorf("create copyright pdf: %w", err)
		}
	}
	if html.Dedication != "" {
		if err := bookbuild.HTMLToPDFFile(html.Dedication, filepath.Join(buildDir, "dedication.pdf")); err != nil {
			return fmt.Errorf("create dedication pdf: %w", err)
		}
	}
	if html.Afterword != "" {
		if err := bookbuild.HTMLToPDFFile(html.Afterword, filepath.Join(buildDir, "afterword.pdf")); err != nil {
			return fmt.Errorf("create afterword pdf: %w", err)
		}
	}
	if html.Acknowledgements != "" {
		if err := bookbuild.HTMLToPDFFile(html.Acknowledgements, filepath.Join(buildDir, "ack.pdf")); err != nil {
			return fmt.Errorf("create ack pdf: %w", err)
		}
	}
	if html.AboutAuthor != "" {
		if err := bookbuild.HTMLToPDFFile(html.AboutAuthor, filepath.Join(buildDir, "about.pdf")); err != nil {
			return fmt.Errorf("create about pdf: %w", err)
		}
	}

	return nil
}
