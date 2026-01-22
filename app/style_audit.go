package app

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const wordDocumentXML = "word/document.xml"

// StyleAuditResult represents the style audit for a single work
type StyleAuditResult struct {
	WorkID             int64    `json:"workID"`
	Title              string   `json:"title"`
	TemplateStylesUsed []string `json:"templateStylesUsed"`
	UnknownStyles      []string `json:"unknownStyles"`
	DirectFormatting   int      `json:"directFormattingCount"`
	IsClean            bool     `json:"isClean"`
	Error              string   `json:"error,omitempty"`
}

// CollectionAuditSummary provides a summary of style audit for a collection
type CollectionAuditSummary struct {
	TotalWorks   int                `json:"totalWorks"`
	CleanWorks   int                `json:"cleanWorks"`
	DirtyWorks   int                `json:"dirtyWorks"`
	MissingFiles int                `json:"missingFiles"`
	Results      []StyleAuditResult `json:"results"`
}

// ApplyTemplateResult contains the result of applying template to a collection
type ApplyTemplateResult struct {
	Success int `json:"success"`
	Failed  int `json:"failed"`
}

// AuditWorkStyles audits the styles used in a single work's DOCX file
func (a *App) AuditWorkStyles(workID int64, templatePath string) (*StyleAuditResult, error) {
	work, err := a.db.GetWork(workID)
	if err != nil || work == nil {
		return nil, fmt.Errorf("work not found: %d", workID)
	}

	result := &StyleAuditResult{
		WorkID:             workID,
		Title:              work.Title,
		TemplateStylesUsed: []string{},
		UnknownStyles:      []string{},
	}

	if work.Path == nil || *work.Path == "" {
		result.Error = "No file path"
		return result, nil
	}

	basePath := a.settings.Get().BaseFolderPath
	fullPath := filepath.Join(basePath, *work.Path)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		result.Error = "File not found"
		return result, nil
	}

	if !strings.HasSuffix(strings.ToLower(*work.Path), ".docx") {
		result.Error = "Not a DOCX file"
		return result, nil
	}

	// Get template styles if template provided
	templateStyles := make(map[string]bool)
	if templatePath != "" {
		styles, err := extractDOCXStyles(templatePath)
		if err == nil {
			for _, s := range styles {
				templateStyles[s.Name] = true
				templateStyles[s.StyleID] = true
			}
		}
	}

	// Extract styles from the work
	workStyles, err := extractDOCXStyles(fullPath)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to parse: %v", err)
		return result, nil
	}

	// Count paragraphs with each style
	styleCounts, directFormatting, err := countStyleUsage(fullPath)
	if err != nil {
		result.DirectFormatting = 0
	} else {
		result.DirectFormatting = directFormatting
	}

	// Categorize styles
	for _, s := range workStyles {
		if s.Name == "" {
			continue
		}
		// Skip pandoc syntax highlighting token styles - these are legitimate
		if isPandocSyntaxStyle(s.Name) {
			continue
		}
		inTemplate := templateStyles[s.Name] || templateStyles[s.StyleID]
		if len(templateStyles) == 0 {
			// No template - just list all styles
			result.TemplateStylesUsed = append(result.TemplateStylesUsed, formatStyleCount(s.Name, styleCounts))
		} else if inTemplate {
			result.TemplateStylesUsed = append(result.TemplateStylesUsed, formatStyleCount(s.Name, styleCounts))
		} else {
			result.UnknownStyles = append(result.UnknownStyles, formatStyleCount(s.Name, styleCounts))
		}
	}

	// Determine if clean
	result.IsClean = len(result.UnknownStyles) == 0 && result.DirectFormatting == 0

	return result, nil
}

// isPandocSyntaxStyle returns true if the style is a pandoc syntax highlighting token style
func isPandocSyntaxStyle(name string) bool {
	// Pandoc syntax highlighting styles end in "Tok" or are common code styles
	if strings.HasSuffix(name, "Tok") {
		return true
	}
	// Other common pandoc/Word styles that are safe to ignore
	switch name {
	case "Source Code", "List Number", "List Paragraph", "Strong", "Emphasis":
		return true
	}
	return false
}

// AuditCollectionStyles audits all works in a collection
func (a *App) AuditCollectionStyles(collID int64) (*CollectionAuditSummary, error) {
	// Get book for template path
	book, _ := a.db.GetBookByCollection(collID)
	templatePath := ""
	if book != nil && book.TemplatePath != nil {
		templatePath = *book.TemplatePath
	}

	// Get collection works
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	summary := &CollectionAuditSummary{
		TotalWorks: len(works),
		Results:    []StyleAuditResult{},
	}

	for _, w := range works {
		result, err := a.AuditWorkStyles(w.WorkID, templatePath)
		if err != nil {
			summary.MissingFiles++
			continue
		}
		if result.Error != "" {
			summary.MissingFiles++
		} else if result.IsClean {
			summary.CleanWorks++
		} else {
			summary.DirtyWorks++
		}
		summary.Results = append(summary.Results, *result)
	}

	return summary, nil
}

// SetWorkTemplateClean marks a work as having clean template styles
func (a *App) SetWorkTemplateClean(workID int64, isClean bool) error {
	cleanVal := 0
	if isClean {
		cleanVal = 1
	}
	_, err := a.db.Conn().Exec("UPDATE Works SET is_template_clean = ? WHERE workID = ?", cleanVal, workID)
	return err
}

// GetWorkTemplateClean checks if a work is marked as template clean
func (a *App) GetWorkTemplateClean(workID int64) (bool, error) {
	var isClean int
	err := a.db.Conn().QueryRow("SELECT COALESCE(is_template_clean, 0) FROM Works WHERE workID = ?", workID).Scan(&isClean)
	if err != nil {
		return false, err
	}
	return isClean == 1, nil
}

// WorkBookAuditStatus contains audit info for a work if it's in a book
type WorkBookAuditStatus struct {
	IsInBook          bool     `json:"isInBook"`
	UnknownStyles     int      `json:"unknownStyles"`
	UnknownStyleNames []string `json:"unknownStyleNames"`
	DirectFormatting  int      `json:"directFormatting"`
	IsClean           bool     `json:"isClean"`
	Error             string   `json:"error,omitempty"`
}

// GetWorkBookAuditStatus returns audit status for a work if it's in a book collection
func (a *App) GetWorkBookAuditStatus(workID int64) (*WorkBookAuditStatus, error) {
	result := &WorkBookAuditStatus{}

	// Get collections for this work
	collectionDetails, err := a.db.GetWorkCollections(workID)
	if err != nil {
		return result, nil
	}

	// Find a collection that is a book with a template
	var templatePath string
	for _, cd := range collectionDetails {
		// Check if this collection is a book (query the is_book column directly)
		var isBook int
		err := a.db.Conn().QueryRow("SELECT COALESCE(is_book, 0) FROM Collections WHERE collID = ?", cd.CollID).Scan(&isBook)
		if err != nil || isBook != 1 {
			continue
		}

		book, err := a.db.GetBookByCollection(cd.CollID)
		if err != nil || book == nil {
			continue
		}
		if book.TemplatePath != nil && *book.TemplatePath != "" {
			templatePath = *book.TemplatePath
			result.IsInBook = true
			break
		}
	}

	if !result.IsInBook {
		return result, nil
	}

	// Run audit on this work
	auditResult, err := a.AuditWorkStyles(workID, templatePath)
	if err != nil {
		result.Error = err.Error()
		return result, nil
	}

	if auditResult.Error != "" {
		result.Error = auditResult.Error
		return result, nil
	}

	result.UnknownStyles = len(auditResult.UnknownStyles)
	result.UnknownStyleNames = auditResult.UnknownStyles
	result.DirectFormatting = auditResult.DirectFormatting
	result.IsClean = auditResult.IsClean

	return result, nil
}

// countStyleUsage counts how many paragraphs use each style and detects direct formatting
func countStyleUsage(docxPath string) (map[string]int, int, error) {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, 0, err
	}
	defer r.Close()

	var documentFile *zip.File
	for _, f := range r.File {
		if f.Name == wordDocumentXML {
			documentFile = f
			break
		}
	}

	if documentFile == nil {
		return nil, 0, fmt.Errorf("no document.xml found")
	}

	rc, err := documentFile.Open()
	if err != nil {
		return nil, 0, err
	}
	defer rc.Close()

	// Simple counting - look for paragraph style references
	styleCounts := make(map[string]int)
	directFormatting := 0

	// Parse XML looking for w:pStyle and w:rPr (direct formatting)
	decoder := xml.NewDecoder(rc)
	inParagraph := false
	inRun := false
	inRunProps := false
	runHasDirectFormat := false
	runText := ""
	paragraphHasRealDirectFormat := false

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}

		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "p":
				inParagraph = true
				paragraphHasRealDirectFormat = false
			case "r":
				inRun = true
				inRunProps = false
				runHasDirectFormat = false
				runText = ""
			case "pStyle":
				for _, attr := range t.Attr {
					if attr.Name.Local == "val" {
						styleCounts[attr.Value]++
					}
				}
			case "rPr":
				if inRun && inParagraph {
					inRunProps = true
				}
			case "rStyle":
				// Character style reference - this is NOT direct formatting
				// Do nothing - we only flag actual formatting elements
			case "b", "i", "u", "sz", "color", "rFonts", "highlight", "strike", "dstrike", "vertAlign", "spacing":
				// These are actual direct formatting elements
				if inRun && inRunProps {
					runHasDirectFormat = true
				}
			case "t":
				// Text element - will capture content in CharData
			}
		case xml.CharData:
			if inRun {
				runText += string(t)
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "rPr":
				inRunProps = false
			case "r":
				// End of run - check if it's real direct formatting or just em-dash
				if runHasDirectFormat && !isOnlyEmDash(runText) {
					paragraphHasRealDirectFormat = true
				}
				inRun = false
				runText = ""
				runHasDirectFormat = false
			case "p":
				if paragraphHasRealDirectFormat {
					directFormatting++
				}
				inParagraph = false
			}
		}
	}

	return styleCounts, directFormatting, nil
}

// isOnlyEmDash returns true if the text contains only em-dashes, en-dashes, or is empty
func isOnlyEmDash(text string) bool {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return true
	}
	// Em-dash (—), en-dash (–), and hyphen-minus (-)
	for _, r := range trimmed {
		if r != '—' && r != '–' && r != '-' && r != ' ' {
			return false
		}
	}
	return true
}

// formatStyleCount formats a style name with its usage count
func formatStyleCount(styleName string, counts map[string]int) string {
	if count, ok := counts[styleName]; ok && count > 0 {
		return fmt.Sprintf("%s (%d)", styleName, count)
	}
	return styleName
}

// extractParagraphs extracts plain text paragraphs from a DOCX file
func extractParagraphs(docxPath string) ([]string, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}

			return parseParagraphs(content)
		}
	}

	return nil, fmt.Errorf("document.xml not found in docx")
}

// parseParagraphs parses document.xml and returns paragraphs as a slice
func parseParagraphs(content []byte) ([]string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(content))

	var paragraphs []string
	var inParagraph bool
	var paragraphContent strings.Builder

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
				paragraphContent.Reset()
			case "br":
				if inParagraph {
					paragraphContent.WriteString("\n")
				}
			}

		case xml.EndElement:
			if elem.Name.Local == "p" && inParagraph {
				text := strings.TrimSpace(paragraphContent.String())
				paragraphs = append(paragraphs, text)
				inParagraph = false
			}

		case xml.CharData:
			if inParagraph {
				paragraphContent.WriteString(string(elem))
			}
		}
	}

	return paragraphs, nil
}

// buildDocumentXML reads template's document.xml and replaces body content with new paragraphs
func buildDocumentXML(templatePath string, paragraphs []string) ([]byte, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	var templateDocXML []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
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

	for _, para := range paragraphs {
		escaped := escapeXML(para)
		buf.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
		buf.WriteString(escaped)
		buf.WriteString(`</w:t></w:r></w:p>`)
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

// escapeXML escapes special XML characters
func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

const contentTypesXML = "[Content_Types].xml"
const dotmContentType = "application/vnd.ms-word.template.macroEnabledTemplate.main+xml"
const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"

// replaceDocumentXML copies a DOCX/DOTM and replaces its document.xml
func replaceDocumentXML(templatePath, outputPath string, newDocXML []byte) error {
	templateReader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer templateReader.Close()

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	zipWriter := zip.NewWriter(outputFile)

	for _, file := range templateReader.File {
		switch file.Name {
		case wordDocumentXML:
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
			if _, err := w.Write(newDocXML); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write document.xml: %w", err)
			}
		case contentTypesXML:
			if err := copyZipFileWithContentTypeFix(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		default:
			if err := copyZipFile(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		}
	}

	if err := zipWriter.Close(); err != nil {
		outputFile.Close()
		return fmt.Errorf("close zip writer: %w", err)
	}
	if err := outputFile.Close(); err != nil {
		return fmt.Errorf("close output file: %w", err)
	}

	return nil
}

// copyZipFile copies a file from one zip archive to another
func copyZipFile(zw *zip.Writer, file *zip.File) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()

	header := file.FileHeader
	writer, err := zw.CreateHeader(&header)
	if err != nil {
		return err
	}

	_, err = io.Copy(writer, reader)
	return err
}

func copyZipFileWithContentTypeFix(zw *zip.Writer, file *zip.File) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()

	content, err := io.ReadAll(reader)
	if err != nil {
		return err
	}

	fixed := strings.ReplaceAll(string(content), dotmContentType, docxContentType)

	header := file.FileHeader
	writer, err := zw.CreateHeader(&header)
	if err != nil {
		return err
	}

	_, err = writer.Write([]byte(fixed))
	return err
}

// ApplyTemplateToWork strips all formatting from a work's DOCX and applies the template
func (a *App) ApplyTemplateToWork(workID int64, templatePath string) error {
	work, err := a.db.GetWork(workID)
	if err != nil || work == nil {
		return fmt.Errorf("work not found: %d", workID)
	}

	if work.Path == nil || *work.Path == "" {
		return fmt.Errorf("work has no file path")
	}

	basePath := a.settings.Get().BaseFolderPath
	fullPath := filepath.Join(basePath, *work.Path)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return fmt.Errorf("file not found: %s", fullPath)
	}

	if !strings.HasSuffix(strings.ToLower(fullPath), ".docx") {
		return fmt.Errorf("not a DOCX file")
	}

	if templatePath == "" {
		return fmt.Errorf("no template specified")
	}

	if _, err := os.Stat(templatePath); os.IsNotExist(err) {
		return fmt.Errorf("template not found: %s", templatePath)
	}

	// Step 1: Extract paragraphs from source
	paragraphs, err := extractParagraphs(fullPath)
	if err != nil {
		return fmt.Errorf("extract paragraphs: %w", err)
	}

	// Step 2: Create backup in same folder (file.docx → file.bak.docx)
	ext := filepath.Ext(fullPath)
	backupPath := strings.TrimSuffix(fullPath, ext) + ".bak" + ext
	if err := copyFile(fullPath, backupPath); err != nil {
		return fmt.Errorf("create backup: %w", err)
	}

	// Step 3: Build new document.xml with plain paragraphs
	newDocXML, err := buildDocumentXML(templatePath, paragraphs)
	if err != nil {
		return fmt.Errorf("build document.xml: %w", err)
	}

	// Step 4: Create new file from template with new content
	tempPath := fullPath + ".tmp"
	if err := replaceDocumentXML(templatePath, tempPath, newDocXML); err != nil {
		return fmt.Errorf("create new document: %w", err)
	}

	// Step 5: Replace original with new file
	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("remove original: %w", err)
	}
	if err := os.Rename(tempPath, fullPath); err != nil {
		return fmt.Errorf("rename temp to original: %w", err)
	}

	// Mark as template clean
	_ = a.SetWorkTemplateClean(workID, true)

	return nil
}

// ApplyTemplateToCollection applies template to all works in a collection
func (a *App) ApplyTemplateToCollection(collID int64) (*ApplyTemplateResult, error) {
	// Get book for template path
	book, err := a.db.GetBookByCollection(collID)
	if err != nil || book == nil {
		return nil, fmt.Errorf("no book configuration found")
	}

	if book.TemplatePath == nil || *book.TemplatePath == "" {
		return nil, fmt.Errorf("no template selected for this book")
	}

	// Get collection works
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	result := &ApplyTemplateResult{}

	for _, w := range works {
		if w.Path == nil || *w.Path == "" {
			result.Failed++
			continue
		}
		if !strings.HasSuffix(strings.ToLower(*w.Path), ".docx") {
			result.Failed++
			continue
		}

		err := a.ApplyTemplateToWork(w.WorkID, *book.TemplatePath)
		if err != nil {
			result.Failed++
		} else {
			result.Success++
		}
	}

	return result, nil
}
