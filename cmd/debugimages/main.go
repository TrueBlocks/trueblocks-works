package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
)

const wordDocumentXML = "word/document.xml"
const wordRelsPath = "word/_rels/document.xml.rels"
const imageRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <docx-file>")
		os.Exit(1)
	}

	docxPath := os.Args[1]

	fmt.Println("=== Checking relationships ===")
	rels, err := parseRelationships(docxPath)
	if err != nil {
		fmt.Printf("Error parsing relationships: %v\n", err)
	} else {
		fmt.Printf("Found %d image relationships:\n", len(rels))
		for id, path := range rels {
			fmt.Printf("  %s -> %s\n", id, path)
		}
	}

	fmt.Println("\n=== Checking media files ===")
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		fmt.Printf("Error opening docx: %v\n", err)
		os.Exit(1)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if strings.HasPrefix(file.Name, "word/media/") {
			fmt.Printf("  Found: %s (%d bytes)\n", file.Name, file.UncompressedSize64)
		}
	}

	fmt.Println("\n=== Checking for drawings in document.xml ===")
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, _ := file.Open()
			content, _ := io.ReadAll(rc)
			rc.Close()

			contentStr := string(content)

			drawingCount := strings.Count(contentStr, "<w:drawing")
			pictCount := strings.Count(contentStr, "<w:pict")
			blipCount := strings.Count(contentStr, "r:embed=")

			fmt.Printf("  <w:drawing> elements: %d\n", drawingCount)
			fmt.Printf("  <w:pict> elements: %d\n", pictCount)
			fmt.Printf("  r:embed references: %d\n", blipCount)

			if drawingCount > 0 || blipCount > 0 {
				idx := strings.Index(contentStr, "<w:drawing")
				if idx == -1 {
					idx = strings.Index(contentStr, "r:embed=")
				}
				if idx != -1 {
					start := idx
					if start > 100 {
						start = idx - 100
					}
					end := idx + 500
					if end > len(contentStr) {
						end = len(contentStr)
					}
					fmt.Printf("\n  Sample drawing context:\n  ...%s...\n", contentStr[start:end])
				}
			}
		}
	}
}

func parseRelationships(docxPath string) (map[string]string, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == wordRelsPath {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open rels: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("read rels: %w", err)
			}

			return parseRelsXML(content)
		}
	}

	return make(map[string]string), nil
}

func parseRelsXML(content []byte) (map[string]string, error) {
	type Relationship struct {
		ID     string `xml:"Id,attr"`
		Type   string `xml:"Type,attr"`
		Target string `xml:"Target,attr"`
	}
	type Relationships struct {
		Rels []Relationship `xml:"Relationship"`
	}

	var rels Relationships
	if err := xml.Unmarshal(content, &rels); err != nil {
		return nil, fmt.Errorf("parse rels xml: %w", err)
	}

	result := make(map[string]string)
	for _, rel := range rels.Rels {
		if rel.Type == imageRelType {
			result[rel.ID] = rel.Target
		}
	}
	return result, nil
}
