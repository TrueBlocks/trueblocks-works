package main

import (
	"archive/zip"
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const (
	templatePath = "/Users/jrush/Documents/Home/99 Templates/Template.docx"
	outputDir    = "/Users/jrush/Documents/Home/NEWSHIT"
	stylesPath   = "word/styles.xml"
)

func main() {
	filePath := flag.String("file", "", "Path to the .docx file to restyle")
	flag.Parse()

	if *filePath == "" {
		fmt.Println("Usage: go run ./cmd/restyle --file <path-to-docx>")
		os.Exit(1)
	}

	if err := run(*filePath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run(sourcePath string) error {
	templateStyles, err := extractStyles(templatePath)
	if err != nil {
		return fmt.Errorf("extracting template styles: %w", err)
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("creating output directory: %w", err)
	}

	outputPath := filepath.Join(outputDir, filepath.Base(sourcePath))

	if err := restyleDocument(sourcePath, outputPath, templateStyles); err != nil {
		return fmt.Errorf("restyling document: %w", err)
	}

	fmt.Printf("Created: %s\n", outputPath)
	return nil
}

func extractStyles(docxPath string) ([]byte, error) {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == stylesPath {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}

	return nil, fmt.Errorf("styles.xml not found in %s", docxPath)
}

func restyleDocument(sourcePath, outputPath string, templateStyles []byte) error {
	r, err := zip.OpenReader(sourcePath)
	if err != nil {
		return err
	}
	defer r.Close()

	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	for _, f := range r.File {
		var content []byte

		if f.Name == stylesPath {
			content = templateStyles
		} else {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			content, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
		}

		header := &zip.FileHeader{
			Name:     f.Name,
			Method:   f.Method,
			Modified: f.Modified,
		}

		writer, err := w.CreateHeader(header)
		if err != nil {
			return err
		}

		if _, err := writer.Write(content); err != nil {
			return err
		}
	}

	if err := w.Close(); err != nil {
		return err
	}

	return os.WriteFile(outputPath, buf.Bytes(), 0644)
}
