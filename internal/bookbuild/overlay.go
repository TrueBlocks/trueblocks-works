package bookbuild

import (
	"fmt"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

type OverlayConfig struct {
	Typography      Typography
	BookTitle       string
	PageWidth       float64
	PageHeight      float64
	MarginBottom    float64
	MarginTop       float64
	MarginOuter     float64
	HeaderYPosition float64
}

func DefaultOverlayConfig(bookTitle string) OverlayConfig {
	return OverlayConfig{
		Typography:      DefaultTypography(),
		BookTitle:       bookTitle,
		PageWidth:       612,
		PageHeight:      792,
		MarginBottom:    36,
		MarginTop:       36,
		MarginOuter:     54,
		HeaderYPosition: 36,
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
				case ContentTypePartDivider, ContentTypeWork:
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
		if err := addTextToPage(pdfPath, m.PhysicalPage, pageNumStr, config, "bottom-center"); err != nil {
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
	var dx, dy float64
	var anchor string

	switch position {
	case "bottom-center":
		dx = 0
		dy = config.MarginBottom
		anchor = "bc"
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
	if position != "bottom-center" {
		fontSize = config.Typography.HeaderSize
	}

	wm, err := api.TextWatermark(text, fmt.Sprintf(
		"font:Times-Roman, points:%d, position:%s, offset:%.0f %.0f, scale:1 abs, rotation:0, opacity:1",
		fontSize, anchor, dx, dy,
	), true, false, types.POINTS)
	if err != nil {
		return fmt.Errorf("failed to create watermark: %w", err)
	}

	conf := model.NewDefaultConfiguration()
	pages := []string{fmt.Sprintf("%d", pageNum)}

	return api.AddWatermarksFile(pdfPath, pdfPath, pages, wm, conf)
}

func AddOverlays(pdfPath string, mappings []PageMapping, config OverlayConfig) error {
	if err := AddPageNumbers(pdfPath, mappings, config); err != nil {
		return err
	}
	return AddRunningHeaders(pdfPath, mappings, config)
}
