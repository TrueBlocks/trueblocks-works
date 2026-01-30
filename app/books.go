package app

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetBook(id int64) (*models.Book, error) {
	return a.db.GetBook(id)
}

func (a *App) GetBookByCollection(collID int64) (*models.Book, error) {
	return a.db.GetBookByCollection(collID)
}

func (a *App) CreateBook(book *models.Book) error {
	return a.db.CreateBook(book)
}

func (a *App) UpdateBook(book *models.Book) error {
	return a.db.UpdateBook(book)
}

func (a *App) DeleteBook(id int64) error {
	return a.db.DeleteBook(id)
}

func (a *App) SetCollectionIsBook(collID int64, isBook bool) error {
	return a.db.SetCollectionIsBook(collID, isBook)
}

func (a *App) GetCollectionIsBook(collID int64) (bool, error) {
	return a.db.GetCollectionIsBook(collID)
}

// SelectCoverImage opens a file dialog to select a cover image (PNG, JPG, PDF)
func (a *App) SelectCoverImage(coverType string) (string, error) {
	title := "Select Front Cover Image"
	if coverType == "back" {
		title = "Select Back Cover Image"
	}

	selected, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Images",
				Pattern:     "*.png;*.jpg;*.jpeg;*.pdf",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}
	return selected, nil
}

// GetCoverImageData reads a cover image and returns it as base64
func (a *App) GetCoverImageData(path string) (string, error) {
	if path == "" {
		return "", nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read cover image: %w", err)
	}

	// Determine MIME type
	ext := strings.ToLower(filepath.Ext(path))
	var mimeType string
	switch ext {
	case ".png":
		mimeType = "image/png"
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".pdf":
		mimeType = "application/pdf"
	default:
		mimeType = "application/octet-stream"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

// SaveCoverFromBytes saves base64 image data to a file in the covers directory
func (a *App) SaveCoverFromBytes(collID int64, coverType string, base64Data string, filename string) (string, error) {
	// Get covers directory
	coversDir := a.GetCoversDir()
	if err := os.MkdirAll(coversDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create covers directory: %w", err)
	}

	// Extract base64 data (remove data URL prefix if present)
	data := base64Data
	if idx := strings.Index(data, ","); idx != -1 {
		data = data[idx+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 data: %w", err)
	}

	// Create filename: collID-coverType-originalname
	ext := filepath.Ext(filename)
	safeName := fmt.Sprintf("%d-%s%s", collID, coverType, ext)
	destPath := filepath.Join(coversDir, safeName)

	if err := os.WriteFile(destPath, decoded, 0644); err != nil {
		return "", fmt.Errorf("failed to write cover file: %w", err)
	}

	return destPath, nil
}

// GetCoversDir returns the path to the covers directory
func (a *App) GetCoversDir() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".works", "covers")
}

// GalleyInfo contains information about the galley PDF
type GalleyInfo struct {
	Exists    bool    `json:"exists"`
	Path      string  `json:"path"`
	PageCount int     `json:"pageCount"`
	SpineMM   float64 `json:"spineMM"`
	WidthMM   float64 `json:"widthMM"`
	HeightMM  float64 `json:"heightMM"`
	ModTime   int64   `json:"modTime"` // Unix timestamp
}

// KDP cover dimension constants
const (
	kdpFrontCoverWidthMM = 152.4  // 6 inches
	kdpBackCoverWidthMM  = 152.4  // 6 inches
	kdpCoverHeightMM     = 234.95 // 9.25 inches
	kdpBleedMM           = 3.17   // 0.125 inches
	kdpWhitePaperSpinePP = 0.0572 // mm per page for white paper
)

// GetGalleyInfo returns information about the galley PDF including page count and calculated cover dimensions
func (a *App) GetGalleyInfo(collID int64) (*GalleyInfo, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return &GalleyInfo{Exists: false}, nil
	}

	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return &GalleyInfo{Exists: false}, nil
	}

	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	filename := sanitizeFilename(bookTitle) + ".pdf"

	homeDir, _ := os.UserHomeDir()
	pdfPath := filepath.Join(homeDir, "Desktop", filename)

	info, err := os.Stat(pdfPath)
	if os.IsNotExist(err) {
		return &GalleyInfo{Exists: false, Path: pdfPath}, nil
	}
	if err != nil {
		return &GalleyInfo{Exists: false}, nil
	}

	pageCount, err := bookbuild.GetPageCount(pdfPath)
	if err != nil {
		return &GalleyInfo{Exists: true, Path: pdfPath, ModTime: info.ModTime().Unix()}, nil
	}

	// Calculate spine width: page count * mm per page
	spineMM := float64(pageCount) * kdpWhitePaperSpinePP

	// Calculate total cover width: back + spine + front + bleed on both sides
	widthMM := kdpBackCoverWidthMM + spineMM + kdpFrontCoverWidthMM + (kdpBleedMM * 2)

	return &GalleyInfo{
		Exists:    true,
		Path:      pdfPath,
		PageCount: pageCount,
		SpineMM:   spineMM,
		WidthMM:   widthMM,
		HeightMM:  kdpCoverHeightMM,
		ModTime:   info.ModTime().Unix(),
	}, nil
}

// CopyCoverToClipboard copies the cover image bytes to the system clipboard
func (a *App) CopyCoverToClipboard(path string) error {
	if path == "" {
		return fmt.Errorf("no cover path provided")
	}

	// For now, we'll copy the file path to clipboard
	// Full image clipboard support would require platform-specific code
	return runtime.ClipboardSetText(a.ctx, path)
}

// CoverExportResult contains the result of a cover export operation
type CoverExportResult struct {
	Success    bool   `json:"success"`
	OutputPath string `json:"outputPath,omitempty"`
	Error      string `json:"error,omitempty"`
}

// ExportCoverPDF exports a wraparound cover as a PDF using HTML-to-PDF conversion
func (a *App) ExportCoverPDF(collID int64, coverHTML string) (*CoverExportResult, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return &CoverExportResult{
			Success: false,
			Error:   "No book configuration found for collection",
		}, nil
	}

	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return &CoverExportResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to get collection: %v", err),
		}, nil
	}

	// Get galley info to calculate correct cover dimensions
	galleyInfo, err := a.GetGalleyInfo(collID)
	if err != nil || !galleyInfo.Exists || galleyInfo.PageCount == 0 {
		return &CoverExportResult{
			Success: false,
			Error:   "Galley PDF must be generated first to determine cover dimensions",
		}, nil
	}

	bookTitle := book.Title
	if bookTitle == "" {
		bookTitle = coll.CollectionName
	}
	defaultFilename := sanitizeFilename(bookTitle) + "-cover.pdf"

	// Use the same persisted export directory as galley export
	defaultDir := ""
	if book.ExportPath != nil && *book.ExportPath != "" {
		defaultDir = *book.ExportPath
	} else {
		homeDir, _ := os.UserHomeDir()
		defaultDir = filepath.Join(homeDir, "Desktop")
	}

	outputPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:            "Export Cover as PDF",
		DefaultDirectory: defaultDir,
		DefaultFilename:  defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files", Pattern: "*.pdf"},
		},
	})
	if err != nil {
		return &CoverExportResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to open save dialog: %v", err),
		}, nil
	}
	if outputPath == "" {
		// User cancelled
		return nil, nil
	}

	// Persist the chosen directory (same as galley export uses)
	newExportDir := filepath.Dir(outputPath)
	if book.ExportPath == nil || *book.ExportPath != newExportDir {
		book.ExportPath = &newExportDir
		_ = a.db.UpdateBook(book)
	}

	// Convert mm to inches for PDF generation
	coverWidthInches := galleyInfo.WidthMM / 25.4
	coverHeightInches := galleyInfo.HeightMM / 25.4

	if err := bookbuild.HTMLToPDFFileWithSize(coverHTML, outputPath, coverWidthInches, coverHeightInches); err != nil {
		return &CoverExportResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to generate cover PDF: %v", err),
		}, nil
	}

	// Update book with cover path
	book.CoverPath = &outputPath
	_ = a.db.UpdateBook(book)

	// Open the generated PDF
	_ = exec.Command("open", outputPath).Start()

	return &CoverExportResult{
		Success:    true,
		OutputPath: outputPath,
	}, nil
}

// OpenCoverPDF opens the generated cover PDF in the default application
func (a *App) OpenCoverPDF(collID int64) (*CoverExportResult, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return &CoverExportResult{
			Success: false,
			Error:   "No book configuration found",
		}, nil
	}

	if book.CoverPath == nil || *book.CoverPath == "" {
		return &CoverExportResult{
			Success: false,
			Error:   "No cover PDF has been generated yet",
		}, nil
	}

	coverPath := *book.CoverPath
	if _, err := os.Stat(coverPath); os.IsNotExist(err) {
		return &CoverExportResult{
			Success: false,
			Error:   "Cover PDF file not found",
		}, nil
	}

	cmd := exec.Command("open", coverPath)
	if err := cmd.Start(); err != nil {
		return &CoverExportResult{
			Success: false,
			Error:   fmt.Sprintf("Failed to open cover: %v", err),
		}, nil
	}

	return &CoverExportResult{
		Success:    true,
		OutputPath: coverPath,
	}, nil
}

// GetCoverPDFPath returns the path to the cover PDF if it exists
func (a *App) GetCoverPDFPath(collID int64) (string, error) {
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return "", nil
	}

	if book.CoverPath == nil || *book.CoverPath == "" {
		return "", nil
	}

	coverPath := *book.CoverPath
	if _, err := os.Stat(coverPath); os.IsNotExist(err) {
		return "", nil
	}

	return coverPath, nil
}
