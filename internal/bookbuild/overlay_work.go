package bookbuild

import (
	"fmt"
	"os"
	"path/filepath"
)

type WorkOverlayOptions struct {
	PDFPath             string
	CacheDir            string
	Item                *ContentItem
	Config              OverlayConfig
	SuppressPageNumbers string
	StartBodyNum        int
}

type WorkOverlayResult struct {
	OutputPath string
	ItemIndex  int
}

func OverlayWork(opts WorkOverlayOptions) (string, error) {
	if opts.Item == nil {
		return "", fmt.Errorf("item is required")
	}

	if opts.Item.PageCount == 0 {
		return opts.PDFPath, nil
	}

	outputPath := filepath.Join(opts.CacheDir,
		fmt.Sprintf("overlaid-work-%d.pdf", opts.Item.WorkID))
	if opts.Item.Type == ContentTypePartDivider {
		outputPath = filepath.Join(opts.CacheDir,
			fmt.Sprintf("overlaid-divider-%s.pdf", sanitizeFilename(opts.Item.Title)))
	}

	if err := copyFile(opts.PDFPath, outputPath); err != nil {
		return "", fmt.Errorf("failed to copy PDF for overlay: %w", err)
	}

	bodyNum := opts.StartBodyNum

	for p := 1; p <= opts.Item.PageCount; p++ {
		bookPage := opts.Item.StartPage + p - 1
		mapping := PageMapping{
			PhysicalPage: p,
			ContentItem:  opts.Item,
			PageInItem:   p,
		}

		showPageNum := shouldShowPageNumberWithConfig(mapping, opts.SuppressPageNumbers)

		if showPageNum && opts.Config.PageNumberPosition != PageNumberNone {
			pageNumStr := fmt.Sprintf("%d", bodyNum)

			var position string
			if opts.Config.PageNumberPosition == PageNumberOuter {
				if bookPage%2 == 0 {
					position = PositionBottomLeftVerso
				} else {
					position = PositionBottomRightRecto
				}
			} else {
				if bookPage%2 == 0 {
					position = PositionBottomCenterVerso
				} else {
					position = PositionBottomCenterRecto
				}
			}

			if err := addTextToPage(outputPath, p, pageNumStr, opts.Config, position); err != nil {
				return "", fmt.Errorf("failed to add page number to page %d of %s: %w",
					p, opts.Item.Title, err)
			}
		}

		bodyNum++

		if !shouldShowHeader(opts.Item, p) {
			continue
		}

		isVerso := bookPage%2 == 0
		if isVerso {
			if opts.Config.VersoHeader == HeaderNone {
				continue
			}
			headerText := getHeaderText(opts.Config.VersoHeader, opts.Config.BookTitle, opts.Item)
			if headerText != "" {
				if err := addTextToPage(outputPath, p, headerText, opts.Config, PositionTopLeft); err != nil {
					return "", fmt.Errorf("failed to add header to page %d of %s: %w",
						p, opts.Item.Title, err)
				}
			}
		} else {
			if opts.Config.RectoHeader == HeaderNone {
				continue
			}
			headerText := getHeaderText(opts.Config.RectoHeader, opts.Config.BookTitle, opts.Item)
			if headerText != "" {
				if err := addTextToPage(outputPath, p, headerText, opts.Config, PositionTopRight); err != nil {
					return "", fmt.Errorf("failed to add header to page %d of %s: %w",
						p, opts.Item.Title, err)
				}
			}
		}
	}

	return outputPath, nil
}

func shouldShowHeader(item *ContentItem, pageInItem int) bool {
	if item == nil {
		return false
	}
	switch item.Type {
	case ContentTypeBlank, ContentTypeFrontMatter, ContentTypeTOC,
		ContentTypePartDivider, ContentTypeBackMatter:
		return false
	case ContentTypeWork:
		return pageInItem > 1
	}
	return false
}

func PrepareAndOverlayWork(opts WorkOverlayOptions) (string, error) {
	if opts.Item == nil {
		return "", fmt.Errorf("item is required")
	}
	if opts.Item.PDF == "" {
		return "", fmt.Errorf("item has no PDF path")
	}

	rotResult, err := PrepareRotatedPDF(opts.Item.PDF, opts.CacheDir,
		opts.Item.StartPage, int(opts.Item.WorkID))
	if err != nil {
		return "", fmt.Errorf("failed to prepare PDF for %s: %w", opts.Item.Title, err)
	}

	opts.PDFPath = rotResult.OutputPath
	return OverlayWork(opts)
}

func sanitizeFilename(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result = append(result, c)
		} else if c == ' ' {
			result = append(result, '_')
		}
	}
	return string(result)
}

func WorkCachePath(cacheDir string, workID int64) string {
	return filepath.Join(cacheDir, fmt.Sprintf("work-%d-overlaid.pdf", workID))
}

func IsWorkCached(cacheDir string, workID int64) bool {
	_, err := os.Stat(WorkCachePath(cacheDir, workID))
	return err == nil
}
