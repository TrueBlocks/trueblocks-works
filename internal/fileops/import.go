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

func ParseImportFilename(filename string, validTypes []string) ParsedFilename {
	result := ParsedFilename{
		Valid:  true,
		Errors: []string{},
	}

	base := filepath.Base(filename)
	ext := filepath.Ext(base)
	result.Extension = strings.ToLower(strings.TrimPrefix(ext, "."))
	nameWithoutExt := strings.TrimSuffix(base, ext)

	// Extension validation is done at the import layer against database values,
	// not here. This function just extracts the extension.

	// Try the full pattern: {mark}{type} - {year} - {title}
	pattern := regexp.MustCompile(`^([a-z]{1,2})([^-]+)\s*-\s*(\d{4})\s*-\s*(.+)$`)
	matches := pattern.FindStringSubmatch(nameWithoutExt)

	if len(matches) == 5 {
		potentialMark := matches[1]
		potentialQuality := GetQualityFromMark(potentialMark)
		potentialType := strings.TrimSpace(matches[2])

		// Check if quality mark is valid AND the resulting type is known
		if potentialQuality != "" && isValidWorkType(potentialType, validTypes) {
			// Valid quality mark and known type
			result.QualityMark = potentialMark
			result.Type = potentialType
			result.Year = matches[3]
			result.Title = strings.TrimSpace(matches[4])
			result.Quality = potentialQuality
		} else {
			// Either invalid quality mark OR unknown type - try without quality mark prefix
			noMarkPattern := regexp.MustCompile(`^([^-]+)\s*-\s*(\d{4})\s*-\s*(.+)$`)
			noMarkMatches := noMarkPattern.FindStringSubmatch(nameWithoutExt)
			if len(noMarkMatches) == 4 {
				result.QualityMark = ""
				result.Type = strings.TrimSpace(noMarkMatches[1])
				result.Year = noMarkMatches[2]
				result.Title = strings.TrimSpace(noMarkMatches[3])
				result.Quality = "Okay" // Default quality when mark is missing
			} else {
				result.Title = nameWithoutExt
				result.Type = ""
				result.Year = ""
				result.Quality = ""
				result.Errors = append(result.Errors, "Missing type, year, or quality - please fill in")
			}
		}

		year, err := strconv.Atoi(result.Year)
		if err != nil || year < 1900 || year > 2100 {
			result.Errors = append(result.Errors, fmt.Sprintf("Invalid year: %s", result.Year))
		}
	} else {
		// Pattern didn't match - try without quality mark prefix
		noMarkPattern := regexp.MustCompile(`^([^-]+)\s*-\s*(\d{4})\s*-\s*(.+)$`)
		noMarkMatches := noMarkPattern.FindStringSubmatch(nameWithoutExt)
		if len(noMarkMatches) == 4 {
			result.QualityMark = ""
			result.Type = strings.TrimSpace(noMarkMatches[1])
			result.Year = noMarkMatches[2]
			result.Title = strings.TrimSpace(noMarkMatches[3])
			result.Quality = "Okay" // Default quality when mark is missing

			year, err := strconv.Atoi(result.Year)
			if err != nil || year < 1900 || year > 2100 {
				result.Errors = append(result.Errors, fmt.Sprintf("Invalid year: %s", result.Year))
			}
		} else {
			// Pattern didn't match at all - use filename as title
			result.Title = nameWithoutExt
			result.Type = ""
			result.Year = ""
			result.Quality = ""
			result.Errors = append(result.Errors, "Missing type, year, or quality - please fill in")
		}
	}

	// Only invalid if extension is unsupported (already handled above)
	// Missing metadata fields are warnings, not blockers
	if result.Type == "" || result.Year == "" || result.Quality == "" {
		result.Valid = false
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

func isValidWorkType(workType string, validTypes []string) bool {
	for _, t := range validTypes {
		if t == workType {
			return true
		}
	}
	return false
}
