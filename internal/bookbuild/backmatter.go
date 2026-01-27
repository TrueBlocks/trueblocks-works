package bookbuild

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

// CreateBackMatterDocx creates back matter (acknowledgements, about author) as a DOCX file.
func CreateBackMatterDocx(book *models.Book, templatePath, outputPath string) error {
	docXML, err := buildBackMatterDocumentXML(book, templatePath)
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

// CreateBackMatterPDF creates back matter as a PDF via Word conversion.
func CreateBackMatterPDF(book *models.Book, templatePath, outputPath string) error {
	tempDocx := strings.TrimSuffix(outputPath, ".pdf") + "_temp.docx"

	if err := CreateBackMatterDocx(book, templatePath, tempDocx); err != nil {
		return fmt.Errorf("create backmatter docx: %w", err)
	}

	if err := ConvertDocxToPDF(tempDocx, outputPath); err != nil {
		os.Remove(tempDocx)
		return fmt.Errorf("convert to pdf: %w", err)
	}

	os.Remove(tempDocx)
	return nil
}

func buildBackMatterDocumentXML(book *models.Book, templatePath string) ([]byte, error) {
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

	hasContent := false

	// Acknowledgements page
	if book.Acknowledgements != nil && *book.Acknowledgements != "" {
		buf.WriteString(buildAcknowledgementsPage(book))
		hasContent = true
	}

	// About the Author page
	if book.AboutAuthor != nil && *book.AboutAuthor != "" {
		if hasContent {
			buf.WriteString(buildPageBreak())
		}
		buf.WriteString(buildAboutAuthorPage(book))
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

func buildAcknowledgementsPage(book *models.Book) string {
	var buf bytes.Buffer

	// Title
	buf.WriteString(buildCenteredParagraph("Acknowledgements", defaultFont, 24))

	// Spacing
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)

	// Content - justified paragraphs
	if book.Acknowledgements != nil && *book.Acknowledgements != "" {
		paragraphs := strings.Split(*book.Acknowledgements, "\n\n")
		for _, para := range paragraphs {
			para = strings.TrimSpace(para)
			if para != "" {
				buf.WriteString(buildJustifiedParagraph(para, defaultFont, 12))
			}
		}
	}

	return buf.String()
}

func buildAboutAuthorPage(book *models.Book) string {
	var buf bytes.Buffer

	// Title
	buf.WriteString(buildCenteredParagraph("About the Author", defaultFont, 24))

	// Spacing
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)

	// Content - justified paragraphs
	if book.AboutAuthor != nil && *book.AboutAuthor != "" {
		paragraphs := strings.Split(*book.AboutAuthor, "\n\n")
		for _, para := range paragraphs {
			para = strings.TrimSpace(para)
			if para != "" {
				buf.WriteString(buildJustifiedParagraph(para, defaultFont, 12))
			}
		}
	}

	return buf.String()
}

func buildJustifiedParagraph(text, fontName string, fontSize int) string {
	sizeHalfPts := fontSize * 2
	return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s"/><w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr><w:t>%s</w:t></w:r></w:p>`,
		fontName, fontName, sizeHalfPts, sizeHalfPts, escapeXMLString(text))
}
