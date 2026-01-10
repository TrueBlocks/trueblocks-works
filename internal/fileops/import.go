package fileops

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type ParsedFilename struct {
	QualityMark string
	Quality     string
	Type        string
	Year        string
	Title       string
	Extension   string
	Valid       bool
	Errors      []string
}

func ParseImportFilename(filename string) ParsedFilename {
	result := ParsedFilename{
		Valid:  true,
		Errors: []string{},
	}

	base := filepath.Base(filename)
	ext := filepath.Ext(base)
	result.Extension = strings.TrimPrefix(ext, ".")
	nameWithoutExt := strings.TrimSuffix(base, ext)

	pattern := regexp.MustCompile(`^([a-z]{1,2})([^-]+)\s*-\s*(\d{4})\s*-\s*(.+)$`)
	matches := pattern.FindStringSubmatch(nameWithoutExt)

	if matches == nil || len(matches) != 5 {
		result.Valid = false
		result.Errors = append(result.Errors, "Filename does not match pattern: {mark}{type} - {year} - {title}")
		return result
	}

	result.QualityMark = matches[1]
	result.Type = strings.TrimSpace(matches[2])
	result.Year = matches[3]
	result.Title = strings.TrimSpace(matches[4])

	result.Quality = GetQualityFromMark(result.QualityMark)
	if result.Quality == "" {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Invalid quality mark: '%s'", result.QualityMark))
	}

	if result.Type == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "Type is empty")
	}

	year, err := strconv.Atoi(result.Year)
	if err != nil || year < 1900 || year > 2100 {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Invalid year: %s", result.Year))
	}

	if result.Title == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "Title is empty")
	}

	supportedExts := map[string]bool{
		"rtf":  true,
		"docx": true,
		"txt":  true,
		"md":   true,
		"doc":  true,
	}
	if !supportedExts[result.Extension] {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Unsupported file extension: %s", result.Extension))
	}

	return result
}

func GetQualityFromMark(mark string) string {
	qualities := map[string]string{
		"aa": "Best",
		"a":  "Better",
		"b":  "Good",
		"c":  "Okay",
		"d":  "Poor",
		"e":  "Bad",
		"f":  "Worst",
		"z":  "Unknown",
	}

	if quality, ok := qualities[mark]; ok {
		return quality
	}
	return ""
}
