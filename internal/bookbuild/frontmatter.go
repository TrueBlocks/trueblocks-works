package bookbuild

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
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

// CreateFrontMatterPDF creates front matter as a PDF.
// Title page HTML is passed from frontend (single source of truth - same as preview).
// Copyright and dedication pages use Word XML → PDF (existing approach).
func CreateFrontMatterPDF(book *models.Book, templatePath, outputPath string, titlePageHTML string) error {
	tempDir := filepath.Dir(outputPath)

	// Step 1: Create title page from HTML passed by frontend
	titlePagePDF := filepath.Join(tempDir, "frontmatter_titlepage.pdf")
	if err := HTMLToPDFFile(titlePageHTML, titlePagePDF); err != nil {
		return fmt.Errorf("create title page pdf: %w", err)
	}
	defer os.Remove(titlePagePDF)

	// Step 2: Create copyright/dedication via Word XML → PDF
	copyrightPDF := filepath.Join(tempDir, "frontmatter_copyright.pdf")
	if err := createCopyrightDedicationPDF(book, templatePath, copyrightPDF); err != nil {
		os.Remove(titlePagePDF)
		return fmt.Errorf("create copyright pdf: %w", err)
	}
	defer os.Remove(copyrightPDF)

	// Step 3: Merge the PDFs
	if err := mergeFrontMatterPDFs(titlePagePDF, copyrightPDF, outputPath); err != nil {
		return fmt.Errorf("merge frontmatter pdfs: %w", err)
	}

	return nil
}

// createCopyrightDedicationPDF creates just the copyright and dedication pages via Word
func createCopyrightDedicationPDF(book *models.Book, templatePath, outputPath string) error {
	tempDocx := strings.TrimSuffix(outputPath, ".pdf") + "_temp.docx"

	docXML, err := buildCopyrightDedicationXML(book, templatePath)
	if err != nil {
		return fmt.Errorf("build copyright xml: %w", err)
	}

	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	outputFile, err := os.Create(tempDocx)
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

	if err := outputFile.Close(); err != nil {
		return fmt.Errorf("close output: %w", err)
	}

	if err := ConvertDocxToPDF(tempDocx, outputPath); err != nil {
		os.Remove(tempDocx)
		return fmt.Errorf("convert to pdf: %w", err)
	}

	os.Remove(tempDocx)
	return nil
}

// buildCopyrightDedicationXML creates document XML with just copyright and dedication pages
func buildCopyrightDedicationXML(book *models.Book, templatePath string) ([]byte, error) {
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

	// Copyright page (verso - page 2)
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

// mergeFrontMatterPDFs merges title page and copyright/dedication PDFs
func mergeFrontMatterPDFs(titlePagePDF, copyrightPDF, outputPath string) error {
	return mergeFilesRaw([]string{titlePagePDF, copyrightPDF}, outputPath)
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
	buf.WriteString(buildTitlePage(book, templatePath))

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

func buildTitlePage(book *models.Book, _ string) string {
	var buf bytes.Buffer

	// Vertical spacing to push title down (approximately 1/3 of page)
	for i := 0; i < 8; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Apply title offset if set
	if book.TitleOffsetY != nil && *book.TitleOffsetY != 0 {
		offsetLines := *book.TitleOffsetY / 12 // approximately 12pt per empty line
		for i := 0; i < offsetLines; i++ {
			buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
		}
	}

	// Title - use BookTitle style from template
	buf.WriteString(buildStyledParagraph(book.Title, "BookTitle"))

	// Spacing
	buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)

	// Apply subtitle offset if set
	if book.SubtitleOffsetY != nil && *book.SubtitleOffsetY != 0 {
		offsetLines := *book.SubtitleOffsetY / 12
		for i := 0; i < offsetLines; i++ {
			buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
		}
	}

	// Subtitle - use BookSubtitle style from template
	if book.Subtitle != nil && *book.Subtitle != "" {
		buf.WriteString(buildStyledParagraph(*book.Subtitle, "BookSubtitle"))
	}

	// Spacing before author (reduced from 4 to 2 for better vertical balance)
	for i := 0; i < 2; i++ {
		buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
	}

	// Apply author offset if set
	if book.AuthorOffsetY != nil && *book.AuthorOffsetY != 0 {
		offsetLines := *book.AuthorOffsetY / 12
		for i := 0; i < offsetLines; i++ {
			buf.WriteString(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`)
		}
	}

	// Author - use BookAuthor style from template
	buf.WriteString(buildStyledParagraph(book.Author, "BookAuthor"))

	return buf.String()
}

// buildStyledParagraph creates a centered paragraph using a named style from the template
func buildStyledParagraph(text, styleName string) string {
	// Handle " | " as line break convention
	parts := strings.Split(text, " | ")
	if len(parts) == 1 {
		return fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="%s"/><w:jc w:val="center"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>`,
			styleName, escapeXMLString(text))
	}

	// Multiple parts - join with line breaks
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="%s"/><w:jc w:val="center"/></w:pPr>`, styleName))
	for i, part := range parts {
		buf.WriteString(fmt.Sprintf(`<w:r><w:t>%s</w:t></w:r>`, escapeXMLString(part)))
		if i < len(parts)-1 {
			buf.WriteString(`<w:r><w:br/></w:r>`)
		}
	}
	buf.WriteString(`</w:p>`)
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

	// Handle " | " as line break convention
	parts := strings.Split(text, " | ")
	if len(parts) == 1 {
		return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s"/><w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr><w:t>%s</w:t></w:r></w:p>`,
			fontName, fontName, sizeHalfPts, sizeHalfPts, escapeXMLString(text))
	}

	// Multiple parts - join with line breaks
	var buf bytes.Buffer
	buf.WriteString(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>`)
	for i, part := range parts {
		buf.WriteString(fmt.Sprintf(`<w:r><w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s"/><w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr><w:t>%s</w:t></w:r>`,
			fontName, fontName, sizeHalfPts, sizeHalfPts, escapeXMLString(part)))
		if i < len(parts)-1 {
			buf.WriteString(`<w:r><w:br/></w:r>`)
		}
	}
	buf.WriteString(`</w:p>`)
	return buf.String()
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
