package bookbuild

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// CreateTOCDocx creates a Table of Contents DOTM file from TOC entries.
// It uses the book template for consistent styling.
func CreateTOCDocx(entries []TOCEntry, templatePath, outputPath string) error {
	docXML, err := buildTOCDocumentXML(entries, templatePath)
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

func copyZipFileToWriter(zw *zip.Writer, src *zip.File) error {
	rc, err := src.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	header := &zip.FileHeader{
		Name:     src.Name,
		Method:   src.Method,
		Modified: src.Modified,
	}

	w, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = io.Copy(w, rc)
	return err
}

func buildTOCDocumentXML(entries []TOCEntry, templatePath string) ([]byte, error) {
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

	buf.WriteString(`<w:p>`)
	buf.WriteString(`<w:pPr><w:pStyle w:val="Title"/></w:pPr>`)
	buf.WriteString(`<w:r><w:t>Contents</w:t></w:r>`)
	buf.WriteString(`</w:p>`)

	buf.WriteString(`<w:p/>`)

	for _, entry := range entries {
		if entry.IsBackMatter || entry.IsPart {
			continue
		}
		if !entry.IsPrologue {
			continue
		}
		buf.WriteString(buildTOCEntryParagraph(entry.Title, entry.PageNumber, false))
	}

	for _, entry := range entries {
		if entry.IsBackMatter || entry.IsPrologue {
			continue
		}

		if entry.IsPart {
			buf.WriteString(`<w:p>`)
			buf.WriteString(`<w:pPr><w:pStyle w:val="Normal"/></w:pPr>`)
			buf.WriteString(`<w:r><w:t>`)
			buf.WriteString(escapeXMLString(entry.Title))
			buf.WriteString(`</w:t></w:r>`)
			buf.WriteString(`</w:p>`)
			continue
		}

		buf.WriteString(buildTOCEntryParagraph(entry.Title, entry.PageNumber, true))
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

func buildTOCEntryParagraph(title string, pageNum int, indented bool) string {
	var buf bytes.Buffer

	buf.WriteString(`<w:p>`)
	buf.WriteString(`<w:pPr><w:pStyle w:val="Normal"/>`)
	if indented {
		buf.WriteString(`<w:ind w:left="720"/>`)
	}
	buf.WriteString(`<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9360"/></w:tabs>`)
	buf.WriteString(`</w:pPr>`)
	buf.WriteString(`<w:r><w:t>`)
	buf.WriteString(escapeXMLString(title))
	buf.WriteString(`</w:t></w:r>`)
	buf.WriteString(`<w:r><w:tab/></w:r>`)
	buf.WriteString(`<w:r><w:t>`)
	buf.WriteString(fmt.Sprintf("%d", pageNum))
	buf.WriteString(`</w:t></w:r>`)
	buf.WriteString(`</w:p>`)

	return buf.String()
}

func escapeXMLString(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

// ConvertDocxToPDF converts a DOCX/DOTM file to PDF using Microsoft Word via AppleScript.
func ConvertDocxToPDF(docxPath, pdfPath string) error {
	absDocx, err := filepath.Abs(docxPath)
	if err != nil {
		return fmt.Errorf("abs docx path: %w", err)
	}

	absPDF, err := filepath.Abs(pdfPath)
	if err != nil {
		return fmt.Errorf("abs pdf path: %w", err)
	}

	script := fmt.Sprintf(`tell application "System Events"
	set wasRunning to (name of processes) contains "Microsoft Word"
end tell

tell application "Microsoft Word"
	set docsBefore to count of documents
	open POSIX file "%s"
	
	-- Wait for the new document to appear
	repeat 20 times
		if (count of documents) > docsBefore then exit repeat
		delay 0.25
	end repeat
	
	set theDoc to active document
	save as theDoc file name (POSIX file "%s" as text) file format format PDF
	close theDoc saving no
end tell

if not wasRunning then
	tell application "Microsoft Word" to quit
end if`, absDocx, absPDF)

	// 30 second timeout to prevent indefinite hangs
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return fmt.Errorf("word conversion timed out - Word may have a dialog open")
	}
	if err != nil {
		return fmt.Errorf("word conversion failed: %w: %s", err, string(output))
	}

	return nil
}

// CreateTOCPDFViaDocx creates a TOC PDF by first generating a DOTM, converting
// it to PDF via Word, then deleting the temp file.
func CreateTOCPDFViaDocx(entries []TOCEntry, templatePath, outputPath string) error {
	tempDir := filepath.Dir(outputPath)
	tempDotm := filepath.Join(tempDir, "toc_temp.dotm")

	if err := CreateTOCDocx(entries, templatePath, tempDotm); err != nil {
		return fmt.Errorf("create toc dotm: %w", err)
	}

	if err := ConvertDocxToPDF(tempDotm, outputPath); err != nil {
		os.Remove(tempDotm)
		return fmt.Errorf("convert to pdf: %w", err)
	}

	os.Remove(tempDotm)
	return nil
}
