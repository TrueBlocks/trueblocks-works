package bookbuild

import (
	"fmt"
	"os"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

// Header content constants
const (
	HeaderNone         = "none"
	HeaderBookTitle    = "book_title"
	HeaderSectionTitle = "section_title"
	HeaderEssayTitle   = "essay_title"
)

// Page number position constants
const (
	PageNumberCentered = "centered"
	PageNumberOuter    = "outer"
	PageNumberNone     = "none"
)

// Suppress page numbers constants
const (
	SuppressNever         = "never"
	SuppressSectionStarts = "section_starts"
	SuppressEssayStarts   = "essay_starts"
	SuppressBoth          = "both"
)

type OverlayConfig struct {
	Typography          Typography
	BookTitle           string
	PageWidth           float64
	PageHeight          float64
	MarginBottom        float64
	MarginTop           float64
	MarginInner         float64 // Binding side margin
	MarginOuter         float64 // Outside edge margin
	HeaderYPosition     float64
	VersoHeader         string // book_title, section_title, essay_title, none
	RectoHeader         string // book_title, section_title, essay_title, none
	PageNumberPosition  string // centered, outer, none
	SuppressPageNumbers string // never, section_starts, essay_starts, both
}

func DefaultOverlayConfig(bookTitle string) OverlayConfig {
	return OverlayConfig{
		Typography:      DefaultTypography(),
		BookTitle:       bookTitle,
		PageWidth:       432,  // 6 inches
		PageHeight:      648,  // 9 inches
		MarginBottom:    36,   // 0.5 inches from page edge for footer
		MarginTop:       57.6, // 0.8 inches
		MarginInner:     54,   // 0.75 inches (binding side)
		MarginOuter:     46.8, // 0.65 inches (outside edge)
		HeaderYPosition: 36,   // 0.5 inches from top edge
	}
}

func addTextToPage(pdfPath string, pageNum int, text string, config OverlayConfig, position string) error {
	// Ensure embedded fonts are installed
	if err := EnsureFontsInstalled(); err != nil {
		return fmt.Errorf("failed to install fonts: %w", err)
	}

	var dx, dy float64
	var anchor string

	// Calculate body text center offset from page center
	// Body center offset = (MarginInner - MarginOuter) / 2
	// Verso: body center is LEFT of page center (negative offset)
	// Recto: body center is RIGHT of page center (positive offset)
	bodyCenterOffset := (config.MarginInner - config.MarginOuter) / 2

	switch position {
	case PositionBottomCenterVerso:
		dx = -bodyCenterOffset // shift left toward outside margin
		dy = config.MarginBottom
		anchor = "bc"
	case PositionBottomCenterRecto:
		dx = bodyCenterOffset // shift right toward outside margin
		dy = config.MarginBottom
		anchor = "bc"
	case PositionBottomLeftVerso:
		dx = config.MarginOuter
		dy = config.MarginBottom
		anchor = "bl"
	case PositionBottomRightRecto:
		dx = -config.MarginOuter
		dy = config.MarginBottom
		anchor = "br"
	case "top-left":
		dx = config.MarginOuter
		dy = -config.HeaderYPosition
		anchor = "tl"
	case "top-right":
		dx = -config.MarginOuter
		dy = -config.HeaderYPosition
		anchor = "tr"
	default:
		return fmt.Errorf("unknown position: %s", position)
	}

	fontSize := config.Typography.PageNumberSize
	if !strings.HasPrefix(position, "bottom") {
		fontSize = config.Typography.HeaderSize
	}

	fontName := GetHeaderFontName()
	wmSpec := fmt.Sprintf(
		"font:%s, points:%d, position:%s, offset:%.1f %.1f, scale:1 abs, rotation:0, opacity:1",
		fontName, fontSize, anchor, dx, dy,
	)

	wm, err := api.TextWatermark(text, wmSpec, true, false, types.POINTS)
	if err != nil {
		return fmt.Errorf("failed to create watermark: %w", err)
	}

	conf := model.NewDefaultConfiguration()
	pages := []string{fmt.Sprintf("%d", pageNum)}

	// Use a temp file to avoid in-place write issues with pdfcpu
	tempPath := pdfPath + ".tmp"
	fmt.Printf("DEBUG: Adding watermark to page %d, text='%s', src=%s, dst=%s\n", pageNum, text, pdfPath, tempPath)
	if err := api.AddWatermarksFile(pdfPath, tempPath, pages, wm, conf); err != nil {
		os.Remove(tempPath)
		fmt.Printf("DEBUG: AddWatermarksFile FAILED: %v\n", err)
		return fmt.Errorf("failed to add watermark: %w", err)
	}

	// Check if temp file was created
	if info, err := os.Stat(tempPath); err != nil {
		fmt.Printf("DEBUG: Temp file not created: %v\n", err)
		return fmt.Errorf("temp file not created: %w", err)
	} else {
		fmt.Printf("DEBUG: Temp file created, size=%d\n", info.Size())
	}

	// Replace original with watermarked version
	if err := os.Rename(tempPath, pdfPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	return nil
}
