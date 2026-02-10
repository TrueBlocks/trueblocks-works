package analysis

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
)

// ExtractedText contains text extracted from a document with structure preserved
type ExtractedText struct {
	Paragraphs []string `json:"paragraphs"`
	FullText   string   `json:"fullText"`
}

// ExtractFromDocx extracts text from a .docx file preserving paragraph structure
func ExtractFromDocx(filePath string) (*ExtractedText, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}

	return extractFromDocxReader(f, stat.Size())
}

func extractFromDocxReader(r io.ReaderAt, size int64) (*ExtractedText, error) {
	reader, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

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

			return parseDocumentXML(content)
		}
	}

	return nil, fmt.Errorf("document.xml not found in docx")
}

type docxDocument struct {
	Body docxBody `xml:"body"`
}

type docxBody struct {
	Paragraphs []docxParagraph `xml:"p"`
}

type docxParagraph struct {
	Runs []docxRun `xml:"r"`
}

type docxRun struct {
	Text []docxText `xml:"t"`
}

type docxText struct {
	Content string `xml:",chardata"`
}

func parseDocumentXML(content []byte) (*ExtractedText, error) {
	// Strip namespace prefixes for easier parsing
	content = bytes.ReplaceAll(content, []byte("w:"), []byte(""))

	var doc docxDocument
	if err := xml.Unmarshal(content, &doc); err != nil {
		return nil, fmt.Errorf("parse XML: %w", err)
	}

	var paragraphs []string
	var fullText strings.Builder

	for _, p := range doc.Body.Paragraphs {
		var paraText strings.Builder
		for _, r := range p.Runs {
			for _, t := range r.Text {
				paraText.WriteString(t.Content)
			}
		}
		text := strings.TrimSpace(paraText.String())
		if text != "" {
			paragraphs = append(paragraphs, text)
			if fullText.Len() > 0 {
				fullText.WriteString("\n\n")
			}
			fullText.WriteString(text)
		}
	}

	return &ExtractedText{
		Paragraphs: paragraphs,
		FullText:   fullText.String(),
	}, nil
}

// GetPreview returns the first n words of text
func GetPreview(text string, wordCount int) string {
	words := strings.Fields(text)
	if len(words) <= wordCount {
		return text
	}
	return strings.Join(words[:wordCount], " ") + "..."
}
