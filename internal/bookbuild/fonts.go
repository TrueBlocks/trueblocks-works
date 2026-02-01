package bookbuild

import (
	"embed"
	"fmt"
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
	fontsOnce      sync.Once
	fontInstallErr error
)

// EnsureFontsInstalled installs embedded fonts to pdfcpu's font directory if not already installed
func EnsureFontsInstalled() error {
	fontsOnce.Do(func() {
		// Check if font is already installed
		if font.IsUserFont(EBGaramondFontName) {
			return
		}

		// Extract embedded font to temp file
		fontData, err := embeddedFonts.ReadFile("fonts/EBGaramond-Regular.ttf")
		if err != nil {
			fontInstallErr = fmt.Errorf("read embedded font: %w", err)
			return
		}

		// Create temp file
		tempDir := os.TempDir()
		tempPath := filepath.Join(tempDir, "EBGaramond-Regular.ttf")

		if err := os.WriteFile(tempPath, fontData, 0644); err != nil {
			fontInstallErr = fmt.Errorf("write temp font: %w", err)
			return
		}

		// Install the font (do NOT defer remove until after install completes)
		if err := api.InstallFonts([]string{tempPath}); err != nil {
			os.Remove(tempPath)
			fontInstallErr = fmt.Errorf("install font: %w", err)
			return
		}

		os.Remove(tempPath)
	})

	return fontInstallErr
}

// GetHeaderFontName returns the font name to use for headers/footers
func GetHeaderFontName() string {
	// Always use Times-Roman (core font) - it's reliable and works without installation
	return "Times-Roman"
}
