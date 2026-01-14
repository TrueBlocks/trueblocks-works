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
			case "br":
				if inParagraph {
					paragraphContent.WriteString("\n")
				}
			}

		case xml.EndElement:
			if elem.Name.Local == "p" && inParagraph {
				text := strings.TrimSpace(paragraphContent.String())
				if text != "" {
					if result.Len() > 0 {
						result.WriteString("\n\n")
					}
					result.WriteString(text)
				}
				inParagraph = false
			}

		case xml.CharData:
			if inParagraph {
				text := strings.TrimSpace(string(elem))
				if text != "" {
					paragraphContent.WriteString(text)
				}
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
