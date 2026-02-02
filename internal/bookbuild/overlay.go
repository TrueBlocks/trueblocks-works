package bookbuild

import (
	"fmt"
	"os"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

type OverlayConfig struct {
	Typography              Typography
	BookTitle               string
	PageWidth               float64
	PageHeight              float64
	MarginBottom            float64
	MarginTop               float64
	MarginInner             float64 // Binding side margin
	MarginOuter             float64 // Outside edge margin
	HeaderYPosition         float64
	PageNumbersFlushOutside bool // When true, page numbers flush to outside edge instead of centered
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

func AddPageNumbers(pdfPath string, mappings []PageMapping, config OverlayConfig) error {
	frontMatterNum := 1
	bodyNum := 1
	backMatterNum := 1

	for _, m := range mappings {
		if !m.ShouldShowPageNumber() {
			if m.ContentItem != nil {
				switch m.ContentItem.Type {
				case ContentTypeFrontMatter, ContentTypeTOC:
					frontMatterNum++
				case ContentTypeBlank, ContentTypePartDivider, ContentTypeWork:
					bodyNum++
				case ContentTypeBackMatter:
					backMatterNum++
				}
			}
			continue
		}

		var pageNumStr string
		switch m.GetNumberStyle() {
		case NumberStyleRoman:
			pageNumStr = ToRoman(frontMatterNum)
			frontMatterNum++
		case NumberStyleArabic:
			if m.ContentItem != nil && m.ContentItem.Type == ContentTypeBackMatter {
				pageNumStr = fmt.Sprintf("%d", backMatterNum)
				backMatterNum++
			} else {
				pageNumStr = fmt.Sprintf("%d", bodyNum)
				bodyNum++
			}
		default:
			continue
		}

		// fmt.Printf("  [%d/%d] Adding page number '%s' to page %d\n", i+1, len(mappings), pageNumStr, m.PhysicalPage)
		var position string
		if config.PageNumbersFlushOutside {
			if m.IsVerso() {
				position = PositionBottomLeftVerso
			} else {
				position = PositionBottomRightRecto
			}
		} else {
			if m.IsVerso() {
				position = PositionBottomCenterVerso
			} else {
				position = PositionBottomCenterRecto
			}
		}
		if err := addTextToPage(pdfPath, m.PhysicalPage, pageNumStr, config, position); err != nil {
			return fmt.Errorf("failed to add page number to page %d: %w", m.PhysicalPage, err)
		}
	}

	return nil
}

func AddRunningHeaders(pdfPath string, mappings []PageMapping, config OverlayConfig) error {
	for _, m := range mappings {
		if !m.ShouldShowHeader() {
			continue
		}

		var headerText string
		var position string

		if m.IsVerso() {
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

		// fmt.Printf("  [%d/%d] Adding header '%s' to page %d (%s)\n", i+1, len(mappings), headerText, m.PhysicalPage, position)
		if err := addTextToPage(pdfPath, m.PhysicalPage, headerText, config, position); err != nil {
			return fmt.Errorf("failed to add header to page %d: %w", m.PhysicalPage, err)
		}
	}

	return nil
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

func AddOverlays(pdfPath string, mappings []PageMapping, config OverlayConfig) error {
	if err := AddPageNumbers(pdfPath, mappings, config); err != nil {
		return err
	}
	return AddRunningHeaders(pdfPath, mappings, config)
}
