package app

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

// CopyCoverToClipboard copies the cover image bytes to the system clipboard
func (a *App) CopyCoverToClipboard(path string) error {
	if path == "" {
		return fmt.Errorf("no cover path provided")
	}

	// For now, we'll copy the file path to clipboard
	// Full image clipboard support would require platform-specific code
	return runtime.ClipboardSetText(a.ctx, path)
}
