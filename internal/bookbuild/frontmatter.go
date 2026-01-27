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

// CreateFrontMatterDocx creates front matter (title page, copyright, dedication) as a DOCX file.
func CreateFrontMatterDocx(book *models.Book, templatePath, outputPath string) error {
	docXML, err := buildFrontMatterDocumentXML(book, templatePath)
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

// CreateFrontMatterPDF creates front matter as a PDF via Word conversion.
func CreateFrontMatterPDF(book *models.Book, templatePath, outputPath string) error {
	tempDocx := strings.TrimSuffix(outputPath, ".pdf") + "_temp.docx"

	if err := CreateFrontMatterDocx(book, templatePath, tempDocx); err != nil {
		return fmt.Errorf("create frontmatter docx: %w", err)
	}

	if err := ConvertDocxToPDF(tempDocx, outputPath); err != nil {
		os.Remove(tempDocx)
		return fmt.Errorf("convert to pdf: %w", err)
	}

	os.Remove(tempDocx)
	return nil
}

func buildFrontMatterDocumentXML(book *models.Book, templatePath string) ([]byte, error) {
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

	// Title page (recto - page 1)
	buf.WriteString(buildTitlePage(book))

	// Page break to copyright page (verso - page 2)
	buf.WriteString(buildPageBreak())
	buf.WriteString(buildCopyrightPage(book))

	// Dedication page (recto - page 3) - only if dedication exists
	if book.Dedication != nil && *book.Dedication != "" {
		buf.WriteString(buildPageBreak())
		buf.WriteString(buildDedicationPage(book))
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

func buildTitlePage(book *models.Book) string {
	var buf bytes.Buffer

	// Vertical spacing to push title down (approximately 1/3 of page)
	for i := 0; i < 8; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Title - centered, using book's title font/size
	titleFont := defaultFont
	if book.TitleFont != nil && *book.TitleFont != "" {
		titleFont = *book.TitleFont
	}
	titleSize := 36
	if book.TitleSize != nil && *book.TitleSize > 0 {
		titleSize = *book.TitleSize
	}
	buf.WriteString(buildCenteredParagraph(book.Title, titleFont, titleSize))

	// Spacing
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)

	// Subtitle - centered, using book's subtitle font/size
	if book.Subtitle != nil && *book.Subtitle != "" {
		subtitleFont := defaultFont
		if book.SubtitleFont != nil && *book.SubtitleFont != "" {
			subtitleFont = *book.SubtitleFont
		}
		subtitleSize := 24
		if book.SubtitleSize != nil && *book.SubtitleSize > 0 {
			subtitleSize = *book.SubtitleSize
		}
		buf.WriteString(buildCenteredParagraph(*book.Subtitle, subtitleFont, subtitleSize))
	}

	// Spacing before author
	for i := 0; i < 4; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Author - centered, using book's author font/size
	authorFont := defaultFont
	if book.AuthorFont != nil && *book.AuthorFont != "" {
		authorFont = *book.AuthorFont
	}
	authorSize := 18
	if book.AuthorSize != nil && *book.AuthorSize > 0 {
		authorSize = *book.AuthorSize
	}
	buf.WriteString(buildCenteredParagraph(book.Author, authorFont, authorSize))

	return buf.String()
}

func buildCopyrightPage(book *models.Book) string {
	var buf bytes.Buffer

	// Same vertical spacing as title page (approximately 1/3 of page)
	for i := 0; i < 8; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Copyright text - small font, centered
	if book.Copyright != nil && *book.Copyright != "" {
		lines := strings.Split(*book.Copyright, "\n")
		for _, line := range lines {
			buf.WriteString(buildCenteredParagraph(line, defaultFont, 10))
		}
	}

	return buf.String()
}

func buildDedicationPage(book *models.Book) string {
	var buf bytes.Buffer

	// Vertical spacing
	for i := 0; i < 8; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Dedication - centered, italic
	if book.Dedication != nil && *book.Dedication != "" {
		lines := strings.Split(*book.Dedication, "\n")
		for _, line := range lines {
			buf.WriteString(buildCenteredItalicParagraph(line, defaultFont, 14))
		}
	}

	return buf.String()
}

func buildCenteredParagraph(text, fontName string, fontSize int) string {
	// fontSize is in points, Word XML uses half-points
	sizeHalfPts := fontSize * 2
	return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s"/><w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr><w:t>%s</w:t></w:r></w:p>`,
		fontName, fontName, sizeHalfPts, sizeHalfPts, escapeXMLString(text))
}

func buildCenteredItalicParagraph(text, fontName string, fontSize int) string {
	sizeHalfPts := fontSize * 2
	return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s"/><w:sz w:val="%d"/><w:szCs w:val="%d"/><w:i/></w:rPr><w:t>%s</w:t></w:r></w:p>`,
		fontName, fontName, sizeHalfPts, sizeHalfPts, escapeXMLString(text))
}

func buildPageBreak() string {
	return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`
}

func copyAndFixContentTypes(zipWriter *zip.Writer, file *zip.File) error {
	rc, err := file.Open()
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	contentStr := string(content)
	contentStr = strings.ReplaceAll(contentStr,
		"application/vnd.ms-word.template.macroEnabledTemplate.main+xml",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")

	header := &zip.FileHeader{
		Name:     file.Name,
		Method:   zip.Deflate,
		Modified: file.Modified,
	}
	w, err := zipWriter.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("create header: %w", err)
	}
	if _, err := w.Write([]byte(contentStr)); err != nil {
		return fmt.Errorf("write content: %w", err)
	}
	return nil
}

func copyAndFixAppXML(zipWriter *zip.Writer, file *zip.File) error {
	rc, err := file.Open()
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	contentStr := string(content)
	contentStr = strings.ReplaceAll(contentStr,
		"<Template>book-template.dotm</Template>",
		"<Template>Normal.dotm</Template>")

	header := &zip.FileHeader{
		Name:     file.Name,
		Method:   zip.Deflate,
		Modified: file.Modified,
	}
	w, err := zipWriter.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("create header: %w", err)
	}
	if _, err := w.Write([]byte(contentStr)); err != nil {
		return fmt.Errorf("write content: %w", err)
	}
	return nil
}
