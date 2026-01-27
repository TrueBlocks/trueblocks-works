package bookbuild

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
)

// CreateBlankPageFromTemplate creates a blank page PDF using the book template for correct page size.
func CreateBlankPageFromTemplate(templatePath, outputPath string) error {
	tempDocx := strings.TrimSuffix(outputPath, ".pdf") + "_temp.docx"

	if err := createBlankDocx(templatePath, tempDocx); err != nil {
		return fmt.Errorf("create blank docx: %w", err)
	}

	if err := ConvertDocxToPDF(tempDocx, outputPath); err != nil {
		os.Remove(tempDocx)
		return fmt.Errorf("convert to pdf: %w", err)
	}

	os.Remove(tempDocx)
	return nil
}

// createBlankDocx creates a DOCX with a single blank page using the template's page size.
func createBlankDocx(templatePath, outputPath string) error {
	docXML, err := buildBlankDocumentXML(templatePath)
	if err != nil {
		return fmt.Errorf("build document xml: %w", err)
	}

	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	zipWriter := zip.NewWriter(outputFile)

	for _, file := range reader.File {
		if file.Name == documentXMLPath {
			header := &zip.FileHeader{
				Name:     file.Name,
				Method:   zip.Deflate,
				Modified: file.Modified,
			}
			w, err := zipWriter.CreateHeader(header)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create document.xml: %w", err)
			}
			if _, err := w.Write(docXML); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write document.xml: %w", err)
			}
		} else if strings.HasPrefix(file.Name, "word/media/") {
			continue
		} else if file.Name == contentTypesPath {
			if err := copyAndFixContentTypes(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("fix content types: %w", err)
			}
		} else if file.Name == appXMLPath {
			if err := copyAndFixAppXML(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("fix app.xml: %w", err)
			}
		} else {
			if err := copyZipFileToWriter(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		}
	}

	if err := zipWriter.Close(); err != nil {
		outputFile.Close()
		return fmt.Errorf("close zip: %w", err)
	}

	return outputFile.Close()
}

// buildBlankDocumentXML creates a minimal document.xml with just an empty paragraph and sectPr for page size.
func buildBlankDocumentXML(templatePath string) ([]byte, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	var templateDocXML []byte
	for _, file := range reader.File {
		if file.Name == documentXMLPath {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			templateDocXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if templateDocXML == nil {
		return nil, fmt.Errorf("document.xml not found in template")
	}

	content := string(templateDocXML)

	bodyStart := strings.Index(content, "<w:body>")
	if bodyStart == -1 {
		bodyStart = strings.Index(content, "<w:body ")
	}
	if bodyStart == -1 {
		return nil, fmt.Errorf("no <w:body> found in template")
	}

	bodyEnd := strings.Index(content, "</w:body>")
	if bodyEnd == -1 {
		return nil, fmt.Errorf("no </w:body> found in template")
	}

	bodyTagEnd := strings.Index(content[bodyStart:], ">")
	if bodyTagEnd == -1 {
		return nil, fmt.Errorf("malformed <w:body> tag")
	}
	bodyTagEnd += bodyStart + 1

	sectPrStart := strings.LastIndex(content[:bodyEnd], "<w:sectPr")
	var sectPr string
	if sectPrStart != -1 {
		sectPr = content[sectPrStart:bodyEnd]
	}

	var buf bytes.Buffer
	buf.WriteString(content[:bodyTagEnd])

	// Single empty paragraph - this creates a blank page
	buf.WriteString(`<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr></w:p>`)

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}
