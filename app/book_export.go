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

// PartInfo describes a part/section for the part selection modal
type PartInfo struct {
	Index     int    `json:"index"`
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

	var parts []PartInfo
	var currentPart *PartInfo
	partIndex := 0

	for _, w := range works {
		if w.Type == workTypeSection {
			if currentPart != nil {
				parts = append(parts, *currentPart)
			}
			currentPart = &PartInfo{
				Index:     partIndex,
				Title:     w.Title,
				WorkCount: 0,
				PageCount: 1,
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

// GetSavedPartSelection returns the previously saved part selection for a collection
func (a *App) GetSavedPartSelection(collID int64) ([]int, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return nil, nil
	}

	if book.SelectedParts == nil || *book.SelectedParts == "" {
		return nil, nil
	}

	return bookbuild.ParseSelectedParts(*book.SelectedParts), nil
}

// GetPartCacheStatus returns a map of part index -> cached status
func (a *App) GetPartCacheStatus(collID int64) (map[int]bool, error) {
	homeDir, _ := os.UserHomeDir()
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

	homeDir, _ := os.UserHomeDir()
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

// ExportBookPDF exports a collection as a PDF using the bookbuild pipeline
func (a *App) ExportBookPDF(collID int64) (*BookExportResult, error) {
	startTime := time.Now()

	a.EmitStatus("progress", "Starting PDF export...")

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

	// TEMPORARY: Skip save dialog, use Desktop directly
	homeDir, _ := os.UserHomeDir()
	outputPath := filepath.Join(homeDir, "Desktop", defaultFilename)

	/*
		defaultDir := ""
		if book.ExportPath != nil && *book.ExportPath != "" {
			defaultDir = *book.ExportPath
		} else {
			homeDir, _ := os.UserHomeDir()
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
	*/

	newExportDir := filepath.Dir(outputPath)
	if book.ExportPath == nil || *book.ExportPath != newExportDir {
		book.ExportPath = &newExportDir
		_ = a.db.UpdateBook(book)
	}

	buildDir := filepath.Join(homeDir, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))

	a.emitExportProgress("Preparing", 1, 6, "Generating front/back matter...")

	_, _ = a.generateFrontMatterPDF(book, buildDir)
	_, _ = a.generateBackMatterPDF(book, buildDir)

	manifest, err := a.buildManifestFromCollection(collID, book, coll, buildDir, outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build manifest: %w", err)
	}

	buildResult, err := bookbuild.Build(bookbuild.BuildOptions{
		Manifest:   manifest,
		BuildDir:   buildDir,
		OutputPath: outputPath,
		MaxEssays:  10, // Limit overlays to first 10 essays for testing
		OnProgress: func(stage string, current, total int, message string) {
			a.emitExportProgress(stage, current, total, message)
			a.EmitStatus("progress", message)
		},
	})

	if err != nil {
		a.EmitStatus("error", fmt.Sprintf("Build failed: %v", err))
		return nil, fmt.Errorf("build failed: %w", err)
	}

	a.EmitStatus("success", fmt.Sprintf("PDF exported: %s", filepath.Base(outputPath)))

	_ = exec.Command("open", outputPath).Start()

	return &BookExportResult{
		Success:    buildResult.Success,
		OutputPath: buildResult.OutputPath,
		WorkCount:  buildResult.WorkCount,
		Warnings:   buildResult.Warnings,
		Duration:   time.Since(startTime).Round(time.Millisecond).String(),
	}, nil
}

func (a *App) buildManifestFromCollection(collID int64, book *models.Book, coll *models.Collection, buildDir, outputPath string) (*bookbuild.Manifest, error) {
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works")
	}

	pdfPreviewPath := a.fileOps.Config.PDFPreviewPath

	typography := bookbuild.DefaultTypography()
	if book.HeaderFont != nil && *book.HeaderFont != "" {
		typography.HeaderFont = *book.HeaderFont
	}
	if book.HeaderSize != nil && *book.HeaderSize > 0 {
		typography.HeaderSize = *book.HeaderSize
	}
	if book.PageNumFont != nil && *book.PageNumFont != "" {
		typography.PageNumberFont = *book.PageNumFont
	}
	if book.PageNumSize != nil && *book.PageNumSize > 0 {
		typography.PageNumberSize = *book.PageNumSize
	}

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		OutputPath: outputPath,
		Typography: typography,
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	frontMatterPDF := filepath.Join(buildDir, "front-matter.pdf")
	if fileExists(frontMatterPDF) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "front-matter", PDF: frontMatterPDF})
	}

	manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	for _, w := range works {
		pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
		manifest.Works = append(manifest.Works, bookbuild.Work{
			ID:    w.WorkID,
			Title: w.Title,
			PDF:   pdfPath,
		})
	}

	backMatterPDF := filepath.Join(buildDir, "back-matter.pdf")
	if fileExists(backMatterPDF) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "back-matter", PDF: backMatterPDF})
	}

	return manifest, nil
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
	if book.HeaderFont != nil && *book.HeaderFont != "" {
		typography.HeaderFont = *book.HeaderFont
	}
	if book.HeaderSize != nil && *book.HeaderSize > 0 {
		typography.HeaderSize = *book.HeaderSize
	}
	if book.PageNumFont != nil && *book.PageNumFont != "" {
		typography.PageNumberFont = *book.PageNumFont
	}
	if book.PageNumSize != nil && *book.PageNumSize > 0 {
		typography.PageNumberSize = *book.PageNumSize
	}

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		OutputPath: outputPath,
		Typography: typography,
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	frontMatterPDF := filepath.Join(buildDir, "front-matter.pdf")
	if fileExists(frontMatterPDF) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "front-matter", PDF: frontMatterPDF})
	}

	manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	var currentPart *bookbuild.Part
	var prologueWorks []bookbuild.Work
	hasParts := false

	for _, w := range works {
		if w.Type == workTypeSection {
			hasParts = true
			if currentPart != nil {
				manifest.Parts = append(manifest.Parts, *currentPart)
			}
			partDividerPDF := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			currentPart = &bookbuild.Part{
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

	if len(prologueWorks) > 0 && hasParts {
		prologuePart := bookbuild.Part{
			Title: "Prologue",
			Works: prologueWorks,
		}
		manifest.Parts = append([]bookbuild.Part{prologuePart}, manifest.Parts...)
	} else if len(prologueWorks) > 0 {
		manifest.Works = prologueWorks
	}

	if !hasParts && len(manifest.Works) == 0 {
		return nil, fmt.Errorf("collection has no parts (no Section type works)")
	}

	backMatterPDF := filepath.Join(buildDir, "back-matter.pdf")
	if fileExists(backMatterPDF) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "back-matter", PDF: backMatterPDF})
	}

	return manifest, nil
}

// ExportBookPDFWithParts exports a collection using the part-based pipeline
func (a *App) ExportBookPDFWithParts(collID int64, selectedParts []int, rebuildAll bool) (*BookExportResult, error) {
	startTime := time.Now()

	a.EmitStatus("progress", "Starting PDF export...")

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
		homeDir, _ := os.UserHomeDir()
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

	_, _ = a.generateFrontMatterPDF(book, cacheDir)
	_, _ = a.generateBackMatterPDF(book, cacheDir)

	manifest, err := a.buildManifestWithParts(collID, book, coll, cacheDir, outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build manifest: %w", err)
	}

	if book.SelectedParts != nil && *book.SelectedParts != "" {
		newSelection := bookbuild.FormatSelectedParts(selectedParts)
		if newSelection != *book.SelectedParts {
			book.SelectedParts = &newSelection
			_ = a.db.UpdateBook(book)
		}
	} else if len(selectedParts) > 0 {
		newSelection := bookbuild.FormatSelectedParts(selectedParts)
		book.SelectedParts = &newSelection
		_ = a.db.UpdateBook(book)
	}

	pipelineResult, err := bookbuild.BuildWithParts(bookbuild.PipelineOptions{
		Manifest:      manifest,
		CollectionID:  collID,
		CacheDir:      cacheDir,
		OutputPath:    outputPath,
		SelectedParts: selectedParts,
		RebuildAll:    rebuildAll,
		OnProgress: func(stage string, current, total int, message string) {
			a.emitExportProgress(stage, current, total, message)
			a.EmitStatus("progress", message)
		},
	})

	if err != nil {
		a.EmitStatus("error", fmt.Sprintf("Build failed: %v", err))
		return nil, fmt.Errorf("build failed: %w", err)
	}

	a.EmitStatus("success", fmt.Sprintf("PDF exported: %s", filepath.Base(outputPath)))

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
func (a *App) ClearPartCache(collID int64, partIndices []int) error {
	cacheDir := bookbuild.GetCacheDir(collID)

	if len(partIndices) == 0 {
		return bookbuild.ClearAllPartsCache(cacheDir)
	}

	for _, idx := range partIndices {
		_ = bookbuild.ClearPartCache(cacheDir, idx)
	}
	return nil
}

// HasCollectionParts returns whether the collection has parts (Section works)
func (a *App) HasCollectionParts(collID int64) (bool, error) {
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return false, err
	}

	for _, w := range works {
		if w.Type == workTypeSection {
			return true, nil
		}
	}
	return false, nil
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

// generateFrontMatterPDF creates a PDF with title page, copyright, dedication
func (a *App) generateFrontMatterPDF(book *models.Book, buildDir string) (string, error) {
	// Always generate front matter with at least the title page
	var content strings.Builder

	// Title page
	title := book.Title
	if title == "" {
		title = "Untitled"
	}
	content.WriteString(fmt.Sprintf("# %s\n\n", title))

	if book.Subtitle != nil && *book.Subtitle != "" {
		content.WriteString(fmt.Sprintf("## %s\n\n", *book.Subtitle))
	}

	if book.Author != "" {
		content.WriteString(fmt.Sprintf("### %s\n\n", book.Author))
	}

	content.WriteString("\\newpage\n\n")

	// Copyright page
	if book.Copyright != nil && *book.Copyright != "" {
		content.WriteString(*book.Copyright)
		content.WriteString("\n\n\\newpage\n\n")
	}

	// Dedication
	if book.Dedication != nil && *book.Dedication != "" {
		content.WriteString(fmt.Sprintf("*%s*\n\n", *book.Dedication))
		content.WriteString("\\newpage\n\n")
	}

	// Write markdown file
	mdPath := filepath.Join(buildDir, "front-matter.md")
	if err := os.WriteFile(mdPath, []byte(content.String()), 0644); err != nil {
		return "", fmt.Errorf("failed to write front matter: %w", err)
	}

	// Convert to PDF using pandoc with xelatex
	pdfPath := filepath.Join(buildDir, "front-matter.pdf")
	cmd := exec.Command("pandoc", "-o", pdfPath, "--pdf-engine=xelatex", mdPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc PDF conversion failed: %v\n%s", err, string(output))
	}

	return pdfPath, nil
}

// generateBackMatterPDF creates a PDF with acknowledgements and about author
func (a *App) generateBackMatterPDF(book *models.Book, buildDir string) (string, error) {
	hasAcknowledgements := book.Acknowledgements != nil && *book.Acknowledgements != ""
	hasAboutAuthor := book.AboutAuthor != nil && *book.AboutAuthor != ""

	if !hasAcknowledgements && !hasAboutAuthor {
		return "", nil
	}

	var content strings.Builder

	if hasAcknowledgements {
		content.WriteString("# Acknowledgements\n\n")
		content.WriteString(*book.Acknowledgements)
		content.WriteString("\n\n")
	}

	if hasAboutAuthor {
		content.WriteString("# About the Author\n\n")
		content.WriteString(*book.AboutAuthor)
		content.WriteString("\n\n")
	}

	// Write markdown file
	mdPath := filepath.Join(buildDir, "back-matter.md")
	if err := os.WriteFile(mdPath, []byte(content.String()), 0644); err != nil {
		return "", fmt.Errorf("failed to write back matter: %w", err)
	}

	// Convert to PDF using pandoc with xelatex
	pdfPath := filepath.Join(buildDir, "back-matter.pdf")
	cmd := exec.Command("pandoc", "-o", pdfPath, "--pdf-engine=xelatex", mdPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc PDF conversion failed: %v\n%s", err, string(output))
	}

	return pdfPath, nil
}
