package bookbuild

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

func PartCachePath(cacheDir string, partID int64) string {
	return filepath.Join(cacheDir, fmt.Sprintf("part-%d-overlaid.pdf", partID))
}

func PartMergedPath(cacheDir string, partID int64) string {
	return filepath.Join(cacheDir, fmt.Sprintf("part-%d-merged.pdf", partID))
}

func IsPartCached(cacheDir string, partID int64) bool {
	cachePath := PartCachePath(cacheDir, partID)
	_, err := os.Stat(cachePath)
	return err == nil
}

func ClearPartCache(cacheDir string, partID int64) error {
	cachePath := PartCachePath(cacheDir, partID)
	mergedPath := PartMergedPath(cacheDir, partID)

	_ = os.Remove(cachePath)
	_ = os.Remove(mergedPath)

	return nil
}

func ClearAllPartsCache(cacheDir string) error {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			if (len(name) > 5 && name[:5] == "part-") || name == "stitched.pdf" {
				_ = os.Remove(filepath.Join(cacheDir, name))
			}
		}
	}

	return nil
}

func mergeFilesRaw(inFiles []string, outFile string) error {
	if len(inFiles) == 0 {
		return fmt.Errorf("no files to merge")
	}

	readers := make([]io.ReadSeeker, len(inFiles))
	files := make([]*os.File, len(inFiles))
	for i, path := range inFiles {
		f, err := os.Open(path)
		if err != nil {
			for j := 0; j < i; j++ {
				files[j].Close()
			}
			return fmt.Errorf("failed to open %s: %w", path, err)
		}
		files[i] = f
		readers[i] = f
	}
	defer func() {
		for _, f := range files {
			if f != nil {
				f.Close()
			}
		}
	}()

	out, err := os.Create(outFile)
	if err != nil {
		return fmt.Errorf("failed to create output: %w", err)
	}
	defer out.Close()

	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed
	if err := api.MergeRaw(readers, out, false, conf); err != nil {
		return fmt.Errorf("merge failed: %w", err)
	}

	return nil
}

func shouldShowPageNumberWithConfig(m PageMapping, suppressPageNumbers string) bool {
	if m.ContentItem == nil {
		return false
	}
	if m.ContentItem.Type == ContentTypeBlank {
		return false
	}
	if m.ContentItem.Type == ContentTypeFrontMatter {
		return false
	}

	if m.ContentItem.Type == ContentTypePartDivider {
		switch suppressPageNumbers {
		case SuppressSectionStarts, SuppressBoth:
			return false
		default:
			return true
		}
	}

	if m.ContentItem.Type == ContentTypeWork && m.PageInItem == 1 {
		switch suppressPageNumbers {
		case SuppressEssayStarts, SuppressBoth:
			return false
		default:
			return true
		}
	}

	return true
}

func getHeaderText(headerType, bookTitle string, item *ContentItem) string {
	switch headerType {
	case "book_title":
		return bookTitle
	case "section_title":
		if item != nil {
			return item.PartTitle
		}
		return ""
	case "essay_title":
		if item != nil {
			return item.Title
		}
		return ""
	default:
		return ""
	}
}
