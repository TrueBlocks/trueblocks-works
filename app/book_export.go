package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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

// ExportBook exports a collection as a formatted book DOCX
func (a *App) ExportBook(collID int64) (*BookExportResult, error) {
	return a.exportBookFormat(collID, "docx")
}

// ExportBookEPUB exports a collection as an EPUB ebook
func (a *App) ExportBookEPUB(collID int64) (*BookExportResult, error) {
	return a.exportBookFormat(collID, "epub")
}

// ExportBookPDF exports a collection as a PDF by concatenating preview PDFs
func (a *App) ExportBookPDF(collID int64) (*BookExportResult, error) {
	return a.exportBookPDFConcat(collID)
}

// exportBookPDFConcat concatenates existing preview PDFs using pdfunite
func (a *App) exportBookPDFConcat(collID int64) (*BookExportResult, error) {
	startTime := time.Now()
	result := &BookExportResult{
		Warnings: []string{},
	}

	// Get the book record
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return nil, fmt.Errorf("no book configuration found for collection")
	}

	// Get the collection
	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection: %w", err)
	}

	// Build default filename from book title
	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	defaultFilename := sanitizeFilename(bookTitle) + ".pdf"

	// Determine default directory
	defaultDir := ""
	if book.ExportPath != nil && *book.ExportPath != "" {
		defaultDir = *book.ExportPath
	} else {
		homeDir, _ := os.UserHomeDir()
		defaultDir = filepath.Join(homeDir, "Desktop")
	}

	// Prompt user for save location
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
		return nil, nil // User cancelled
	}

	// Save export directory for next time
	newExportDir := filepath.Dir(outputPath)
	if book.ExportPath == nil || *book.ExportPath != newExportDir {
		book.ExportPath = &newExportDir
		_ = a.db.UpdateBook(book)
	}

	// Create build directory for generated files
	homeDir, _ := os.UserHomeDir()
	buildDir := filepath.Join(homeDir, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create build directory: %w", err)
	}

	a.emitExportProgress("Preparing", 0, 5, "Gathering collection works...")

	// Get collection works in order
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}
	result.WorkCount = len(works)

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works to export")
	}

	// Build list of preview PDF files
	pdfPreviewPath := a.fileOps.Config.PDFPreviewPath
	pdfFiles := []string{}

	a.emitExportProgress("Validating", 1, 5, "Checking preview PDFs...")

	for _, w := range works {
		pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
		if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("No preview PDF for: %s", w.Title))
			continue
		}
		pdfFiles = append(pdfFiles, pdfPath)
	}

	if len(pdfFiles) == 0 {
		return nil, fmt.Errorf("no preview PDFs found - generate previews first")
	}

	// Generate front matter PDF
	a.emitExportProgress("Building", 2, 5, "Generating front matter...")
	frontMatterPDF, err := a.generateFrontMatterPDF(book, buildDir)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Front matter generation failed: %v", err))
	} else if frontMatterPDF != "" {
		pdfFiles = append([]string{frontMatterPDF}, pdfFiles...)
	}

	// Generate back matter PDF
	a.emitExportProgress("Building", 3, 5, "Generating back matter...")
	backMatterPDF, err := a.generateBackMatterPDF(book, buildDir)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Back matter generation failed: %v", err))
	} else if backMatterPDF != "" {
		pdfFiles = append(pdfFiles, backMatterPDF)
	}

	a.emitExportProgress("Exporting", 4, 5, "Concatenating PDFs...")

	// Use pdfunite to concatenate PDFs
	args := append(pdfFiles, outputPath)
	cmd := exec.Command("pdfunite", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("pdfunite failed: %v\n%s", err, string(output))
	}

	a.emitExportProgress("Complete", 5, 5, "Export finished!")

	// Open the exported file
	_ = exec.Command("open", outputPath).Start()

	result.Success = true
	result.OutputPath = outputPath
	result.Duration = time.Since(startTime).Round(time.Millisecond).String()

	return result, nil
}

// exportBookFormat is the internal export function supporting multiple formats
func (a *App) exportBookFormat(collID int64, format string) (*BookExportResult, error) {
	startTime := time.Now()
	result := &BookExportResult{
		Warnings: []string{},
	}

	// Get the book record
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return nil, fmt.Errorf("no book configuration found for collection")
	}

	// Get the collection
	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection: %w", err)
	}

	// Build default filename from book title (or collection name)
	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	defaultFilename := sanitizeFilename(bookTitle) + "." + format

	// Set up format-specific dialog options
	var dialogTitle, filterDisplay, filterPattern string
	switch format {
	case "epub":
		dialogTitle = "Export Book as EPUB"
		filterDisplay = "EPUB Files"
		filterPattern = "*.epub"
	case "pdf":
		dialogTitle = "Export Book as PDF"
		filterDisplay = "PDF Files"
		filterPattern = "*.pdf"
	default: // docx
		dialogTitle = "Export Book"
		filterDisplay = "Word Documents"
		filterPattern = "*.docx"
	}

	// Determine default directory (use saved export path or Desktop)
	defaultDir := ""
	if book.ExportPath != nil && *book.ExportPath != "" {
		defaultDir = *book.ExportPath
	} else {
		homeDir, _ := os.UserHomeDir()
		defaultDir = filepath.Join(homeDir, "Desktop")
	}

	// Prompt user for save location (dialog handles overwrite confirmation)
	outputPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:            dialogTitle,
		DefaultDirectory: defaultDir,
		DefaultFilename:  defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: filterDisplay, Pattern: filterPattern},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open save dialog: %w", err)
	}
	if outputPath == "" {
		// User cancelled
		return nil, nil
	}

	// Save the new export directory for next time
	newExportDir := filepath.Dir(outputPath)
	if book.ExportPath == nil || *book.ExportPath != newExportDir {
		book.ExportPath = &newExportDir
		_ = a.db.UpdateBook(book)
	}

	// Create build directory
	homeDir, _ := os.UserHomeDir()
	buildDir := filepath.Join(homeDir, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))
	if err := os.MkdirAll(buildDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create build directory: %w", err)
	}

	// Emit progress
	a.emitExportProgress("Preparing", 0, 5, "Gathering collection works...")

	// Get collection works in order
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}
	result.WorkCount = len(works)

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works to export")
	}

	// Build list of input files
	basePath := a.settings.Get().BaseFolderPath
	inputFiles := []string{}

	a.emitExportProgress("Validating", 1, 5, "Checking work files...")

	for _, w := range works {
		if w.Path == nil || *w.Path == "" {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Work '%s' has no file path", w.Title))
			continue
		}

		fullPath := filepath.Join(basePath, *w.Path)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			result.Warnings = append(result.Warnings, fmt.Sprintf("File not found: %s", w.Title))
			continue
		}

		// Only include DOCX files
		if !strings.HasSuffix(strings.ToLower(*w.Path), ".docx") {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Skipping non-DOCX: %s", w.Title))
			continue
		}

		inputFiles = append(inputFiles, fullPath)
	}

	if len(inputFiles) == 0 {
		return nil, fmt.Errorf("no valid DOCX files found in collection")
	}

	// Generate page break file for inserting between works
	pageBreakPath, err := a.generatePageBreak(buildDir)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Page break generation failed: %v", err))
	}

	// Interleave page breaks between content files
	if pageBreakPath != "" {
		filesWithBreaks := []string{}
		for i, f := range inputFiles {
			filesWithBreaks = append(filesWithBreaks, f)
			// Add page break after each file except the last
			if i < len(inputFiles)-1 {
				filesWithBreaks = append(filesWithBreaks, pageBreakPath)
			}
		}
		inputFiles = filesWithBreaks
	}

	// Generate front matter if configured
	a.emitExportProgress("Building", 2, 5, "Generating front matter...")
	frontMatterPath, err := a.generateFrontMatter(book, buildDir)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Front matter generation failed: %v", err))
	} else if frontMatterPath != "" {
		inputFiles = append([]string{frontMatterPath}, inputFiles...)
	}

	// Generate back matter if configured
	a.emitExportProgress("Building", 3, 5, "Generating back matter...")
	backMatterPath, err := a.generateBackMatter(book, buildDir)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Back matter generation failed: %v", err))
	} else if backMatterPath != "" {
		inputFiles = append(inputFiles, backMatterPath)
	}

	// Build pandoc command
	a.emitExportProgress("Exporting", 4, 5, "Running pandoc merge...")

	args := []string{
		"-o", outputPath,
	}

	// Add format-specific options
	switch format {
	case "epub":
		// EPUB uses CSS for styling, can optionally add --epub-cover-image
		// For now, just basic conversion
		if book.Title != "" {
			args = append(args, "--metadata", fmt.Sprintf("title=%s", book.Title))
		}
		if book.Author != "" {
			args = append(args, "--metadata", fmt.Sprintf("author=%s", book.Author))
		}
	case "pdf":
		// PDF requires a LaTeX engine (pdflatex, xelatex, etc.)
		args = append(args, "--pdf-engine=xelatex")
		if book.Title != "" {
			args = append(args, "--metadata", fmt.Sprintf("title=%s", book.Title))
		}
		if book.Author != "" {
			args = append(args, "--metadata", fmt.Sprintf("author=%s", book.Author))
		}
	default: // docx
		// Add reference document if template is configured
		if book.TemplatePath != nil && *book.TemplatePath != "" {
			if _, err := os.Stat(*book.TemplatePath); err == nil {
				args = append(args, "--reference-doc", *book.TemplatePath)
			} else {
				result.Warnings = append(result.Warnings, "Template file not found, using default styles")
			}
		}
	}

	// Add all input files
	args = append(args, inputFiles...)

	cmd := exec.Command("pandoc", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("pandoc failed: %v\n%s", err, string(output))
	}

	a.emitExportProgress("Complete", 5, 5, "Export finished!")

	// Open the exported file in default application (Word)
	_ = exec.Command("open", outputPath).Start()

	result.Success = true
	result.OutputPath = outputPath
	result.Duration = time.Since(startTime).Round(time.Millisecond).String()

	return result, nil
}

// generateFrontMatter creates a DOCX with title page, copyright, dedication
func (a *App) generateFrontMatter(book *models.Book, buildDir string) (string, error) {
	// Check if we have any front matter content
	hasCopyright := book.Copyright != nil && *book.Copyright != ""
	hasDedication := book.Dedication != nil && *book.Dedication != ""

	if !hasCopyright && !hasDedication {
		return "", nil
	}

	// Create markdown content
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
	if hasCopyright {
		content.WriteString(*book.Copyright)
		content.WriteString("\n\n\\newpage\n\n")
	}

	// Dedication
	if hasDedication {
		content.WriteString(fmt.Sprintf("*%s*\n\n", *book.Dedication))
		content.WriteString("\\newpage\n\n")
	}

	// Write markdown file
	mdPath := filepath.Join(buildDir, "front-matter.md")
	if err := os.WriteFile(mdPath, []byte(content.String()), 0644); err != nil {
		return "", fmt.Errorf("failed to write front matter: %w", err)
	}

	// Convert to DOCX
	docxPath := filepath.Join(buildDir, "front-matter.docx")
	cmd := exec.Command("pandoc", "-o", docxPath, mdPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc conversion failed: %v\n%s", err, string(output))
	}

	return docxPath, nil
}

// generateBackMatter creates a DOCX with acknowledgements and about author
func (a *App) generateBackMatter(book *models.Book, buildDir string) (string, error) {
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

	// Convert to DOCX
	docxPath := filepath.Join(buildDir, "back-matter.docx")
	cmd := exec.Command("pandoc", "-o", docxPath, mdPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc conversion failed: %v\n%s", err, string(output))
	}

	return docxPath, nil
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

// generatePageBreak creates a DOCX file containing only a page break
func (a *App) generatePageBreak(buildDir string) (string, error) {
	// Create markdown with page break
	content := "\\newpage\n"

	mdPath := filepath.Join(buildDir, "page-break.md")
	if err := os.WriteFile(mdPath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write page break markdown: %w", err)
	}

	docxPath := filepath.Join(buildDir, "page-break.docx")
	cmd := exec.Command("pandoc", "-o", docxPath, mdPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc page break conversion failed: %v\n%s", err, string(output))
	}

	return docxPath, nil
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
