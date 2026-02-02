package bookbuild

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/font"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
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
		// Set up pdfcpu font directory if not set
		if font.UserFontDir == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				fontInstallErr = fmt.Errorf("get home dir: %w", err)
				return
			}
			font.UserFontDir = filepath.Join(home, ".config", "pdfcpu", "fonts")
		}

		// Create font directory if it doesn't exist
		if err := os.MkdirAll(font.UserFontDir, 0755); err != nil {
			fontInstallErr = fmt.Errorf("create font dir: %w", err)
			return
		}

		// Check if font is already installed
		if font.IsUserFont(EBGaramondFontName) {
			return
		}

		// Extract embedded font to the pdfcpu font directory directly
		fontData, err := embeddedFonts.ReadFile("fonts/EBGaramond-Regular.ttf")
		if err != nil {
			fontInstallErr = fmt.Errorf("read embedded font: %w", err)
			return
		}

		// Write font file to pdfcpu font directory
		fontPath := filepath.Join(font.UserFontDir, "EBGaramond-Regular.ttf")
		if err := os.WriteFile(fontPath, fontData, 0644); err != nil {
			fontInstallErr = fmt.Errorf("write font file: %w", err)
			return
		}

		// Install the font using pdfcpu
		if err := font.InstallTrueTypeFont(font.UserFontDir, fontPath); err != nil {
			fontInstallErr = fmt.Errorf("install font: %w", err)
			return
		}

		// Reload user fonts
		if err := font.LoadUserFonts(); err != nil {
			fontInstallErr = fmt.Errorf("load user fonts: %w", err)
			return
		}
	})

	return fontInstallErr
}

// GetHeaderFontName returns the font name to use for headers/footers
func GetHeaderFontName() string {
	// Use EBGaramond which is a user font that gets properly embedded.
	// Core fonts (Times-Roman, Helvetica, etc) are NOT embedded by pdfcpu
	// and will fail on RIPs like Amazon KDP's print pipeline.
	return EBGaramondFontName
}

// FontIssue represents a font embedding problem
type FontIssue struct {
	FontName string
	FontType string
}

// CheckFontsEmbedded checks if all fonts in a PDF are embedded
// Returns a list of non-embedded fonts, or nil if all fonts are embedded
func CheckFontsEmbedded(pdfPath string) ([]FontIssue, error) {
	conf := model.NewDefaultConfiguration()

	f, err := os.Open(pdfPath)
	if err != nil {
		return nil, fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	info, err := api.PDFInfo(f, pdfPath, nil, true, conf)
	if err != nil {
		return nil, fmt.Errorf("getting PDF info: %w", err)
	}

	var issues []FontIssue
	seen := make(map[string]bool)

	for _, font := range info.Fonts {
		if !font.Embedded {
			key := font.Name + "|" + font.Type
			if !seen[key] {
				issues = append(issues, FontIssue{
					FontName: font.Name,
					FontType: font.Type,
				})
				seen[key] = true
			}
		}
	}

	return issues, nil
}
