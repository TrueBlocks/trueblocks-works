package fts

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode"
)

func ExtractDocx(path string) (string, error) {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return "", fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == "word/document.xml" {
			rc, err := file.Open()
			if err != nil {
				return "", fmt.Errorf("open document.xml: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return "", fmt.Errorf("read document.xml: %w", err)
			}

			return parseDocumentXML(content)
		}
	}

	return "", fmt.Errorf("document.xml not found in docx")
}

func parseDocumentXML(content []byte) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(content))

	var result strings.Builder
	var inParagraph bool
	var inTextRun bool
	var paragraphContent strings.Builder

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse xml: %w", err)
		}

		switch elem := token.(type) {
		case xml.StartElement:
			switch elem.Name.Local {
			case "p":
				inParagraph = true
				paragraphContent.Reset()
			case "t":
				if inParagraph {
					inTextRun = true
				}
			case "br":
				if inParagraph {
					paragraphContent.WriteString("\n")
				}
			}

		case xml.EndElement:
			switch elem.Name.Local {
			case "t":
				inTextRun = false
			case "p":
				if inParagraph {
					text := strings.TrimSpace(paragraphContent.String())
					if text != "" {
						if result.Len() > 0 {
							result.WriteString("\n\n")
						}
						result.WriteString(text)
					}
					inParagraph = false
				}
			}

		case xml.CharData:
			if inParagraph && inTextRun {
				paragraphContent.WriteString(string(elem))
			}
		}
	}

	return normalizeWhitespace(result.String()), nil
}

func ExtractMarkdown(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read markdown: %w", err)
	}
	return string(content), nil
}

func ExtractPlainText(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read text: %w", err)
	}
	return string(content), nil
}

func ExtractByType(path, docType string) (string, error) {
	switch strings.ToLower(docType) {
	case "docx":
		return ExtractDocx(path)
	case "md":
		return ExtractMarkdown(path)
	case "txt":
		return ExtractPlainText(path)
	default:
		return "", fmt.Errorf("unsupported document type: %s", docType)
	}
}

func CountWords(text string) int {
	if text == "" {
		return 0
	}

	wordRegex := regexp.MustCompile(`[\p{L}\p{N}]+`)
	words := wordRegex.FindAllString(text, -1)
	return len(words)
}

func normalizeWhitespace(text string) string {
	var result strings.Builder
	var lastWasSpace bool

	for _, r := range text {
		if unicode.IsSpace(r) {
			if r == '\n' {
				result.WriteRune('\n')
				lastWasSpace = false
			} else if !lastWasSpace {
				result.WriteRune(' ')
				lastWasSpace = true
			}
		} else {
			result.WriteRune(r)
			lastWasSpace = false
		}
	}

	return strings.TrimSpace(result.String())
}

var defaultHeadingLevels = map[string]int{
	"Title":    0,
	"Heading1": 1, "heading 1": 1,
	"Heading2": 2, "heading 2": 2,
	"Heading3": 3, "heading 3": 3,
	"Heading4": 4, "heading 4": 4,
	"Heading5": 5, "heading 5": 5,
	"Heading6": 6, "heading 6": 6,
}

func ExtractHeadings(path string, validStyles map[string]bool) (*HeadingsResult, error) {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == "word/document.xml" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}

			return parseHeadings(content, validStyles)
		}
	}

	return nil, fmt.Errorf("document.xml not found in docx")
}

func parseHeadings(content []byte, validStyles map[string]bool) (*HeadingsResult, error) {
	decoder := xml.NewDecoder(bytes.NewReader(content))

	result := &HeadingsResult{
		Headings:      []HeadingInfo{},
		UnknownStyles: []string{},
	}
	unknownSet := make(map[string]bool)

	var inParagraph bool
	var currentStyle string
	var paragraphContent strings.Builder
	headingPos := 0

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("parse xml: %w", err)
		}

		switch elem := token.(type) {
		case xml.StartElement:
			switch elem.Name.Local {
			case "p":
				inParagraph = true
				currentStyle = ""
				paragraphContent.Reset()
			case "pStyle":
				if inParagraph {
					for _, attr := range elem.Attr {
						if attr.Name.Local == "val" {
							currentStyle = attr.Value
						}
					}
				}
			case "br":
				if inParagraph {
					paragraphContent.WriteString(" ")
				}
			}

		case xml.EndElement:
			if elem.Name.Local == "p" && inParagraph {
				text := strings.TrimSpace(paragraphContent.String())
				if currentStyle != "" && text != "" {
					if !validStyles[currentStyle] {
						if !unknownSet[currentStyle] {
							unknownSet[currentStyle] = true
							result.UnknownStyles = append(result.UnknownStyles, currentStyle)
						}
					} else if currentStyle == "Dateline" {
						result.Dateline = text
					} else if level, isHeading := defaultHeadingLevels[currentStyle]; isHeading {
						result.Headings = append(result.Headings, HeadingInfo{
							Pos:   headingPos,
							Level: level,
							Style: currentStyle,
							Text:  text,
						})
						headingPos++
					}
				}
				inParagraph = false
			}

		case xml.CharData:
			if inParagraph {
				paragraphContent.WriteString(string(elem))
			}
		}
	}

	return result, nil
}

func LoadTemplateStyles(templatePath string) (map[string]bool, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == "word/styles.xml" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open styles.xml: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("read styles.xml: %w", err)
			}

			return parseStyles(content)
		}
	}

	return nil, fmt.Errorf("styles.xml not found in template")
}

func parseStyles(content []byte) (map[string]bool, error) {
	type StyleName struct {
		Val string `xml:"val,attr"`
	}
	type Style struct {
		StyleID string    `xml:"styleId,attr"`
		Name    StyleName `xml:"name"`
	}
	type Styles struct {
		Styles []Style `xml:"style"`
	}

	var styles Styles
	if err := xml.Unmarshal(content, &styles); err != nil {
		return nil, fmt.Errorf("parse styles.xml: %w", err)
	}

	result := make(map[string]bool)
	for _, s := range styles.Styles {
		if s.StyleID != "" {
			result[s.StyleID] = true
		}
		if s.Name.Val != "" {
			result[s.Name.Val] = true
		}
	}

	return result, nil
}
