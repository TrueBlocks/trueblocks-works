package bookbuild

import (
	"embed"
	"os"
	"path/filepath"
	"sync"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/font"
)

//go:embed fonts/EBGaramond-Regular.ttf
var embeddedFonts embed.FS

// EBGaramondFontName is the PostScript name used in watermarks
const EBGaramondFontName = "EBGaramond-Regular"

var (
	fontsInstalled bool
	fontsOnce      sync.Once
)

// EnsureFontsInstalled installs embedded fonts to pdfcpu's font directory if not already installed
func EnsureFontsInstalled() error {
	var installErr error

	fontsOnce.Do(func() {
		// Check if font is already installed
		if font.IsUserFont(EBGaramondFontName) {
			fontsInstalled = true
			return
		}

		// Extract embedded font to temp file
		fontData, err := embeddedFonts.ReadFile("fonts/EBGaramond-Regular.ttf")
		if err != nil {
			installErr = err
			return
		}

		// Create temp file
		tempDir := os.TempDir()
		tempPath := filepath.Join(tempDir, "EBGaramond-Regular.ttf")

		if err := os.WriteFile(tempPath, fontData, 0644); err != nil {
			installErr = err
			return
		}
		defer os.Remove(tempPath)

		// Install the font
		if err := api.InstallFonts([]string{tempPath}); err != nil {
			installErr = err
			return
		}

		fontsInstalled = true
	})

	return installErr
}

// GetHeaderFontName returns the font name to use for headers/footers
func GetHeaderFontName() string {
	if fontsInstalled {
		return EBGaramondFontName
	}
	// Fallback to core font if installation failed
	return "Times-Roman"
}
