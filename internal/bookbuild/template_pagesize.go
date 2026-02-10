package bookbuild

import (
	"archive/zip"
	"fmt"
	"io"
	"regexp"
	"strconv"
)

var pgSzRegex = regexp.MustCompile(`<w:pgSz[^/]*w:w="(\d+)"[^/]*w:h="(\d+)"`)

func ExtractTemplatePageSize(templatePath string) (width, height float64, err error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return 0, 0, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name != documentXMLPath {
			continue
		}

		rc, err := file.Open()
		if err != nil {
			return 0, 0, fmt.Errorf("open document.xml: %w", err)
		}
		defer rc.Close()

		data, err := io.ReadAll(rc)
		if err != nil {
			return 0, 0, fmt.Errorf("read document.xml: %w", err)
		}

		matches := pgSzRegex.FindSubmatch(data)
		if matches == nil {
			return 0, 0, fmt.Errorf("no w:pgSz element found in template")
		}

		wTwips, err := strconv.Atoi(string(matches[1]))
		if err != nil {
			return 0, 0, fmt.Errorf("parse page width: %w", err)
		}

		hTwips, err := strconv.Atoi(string(matches[2]))
		if err != nil {
			return 0, 0, fmt.Errorf("parse page height: %w", err)
		}

		width = float64(wTwips) / 20.0
		height = float64(hTwips) / 20.0
		return width, height, nil
	}

	return 0, 0, fmt.Errorf("document.xml not found in template")
}
