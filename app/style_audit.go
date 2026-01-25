package app

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const wordDocumentXML = "word/document.xml"

// StyleAuditResult represents the style audit for a single work
type StyleAuditResult struct {
	WorkID                int64    `json:"workID"`
	Title                 string   `json:"title"`
	TemplateStylesUsed    []string `json:"templateStylesUsed"`
	UnknownStyles         []string `json:"unknownStyles"`
	DirectFormatting      int      `json:"directFormattingCount"`
	DirectFormattingTypes []string `json:"directFormattingTypes"`
	IsClean               bool     `json:"isClean"`
	Error                 string   `json:"error,omitempty"`
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
	styleCounts, directFormatting, directFormattingTypes, err := countStyleUsage(fullPath)
	if err != nil {
		result.DirectFormatting = 0
		result.DirectFormattingTypes = []string{}
	} else {
		result.DirectFormatting = directFormatting
		result.DirectFormattingTypes = directFormattingTypes
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
	IsInBook              bool     `json:"isInBook"`
	UnknownStyles         int      `json:"unknownStyles"`
	UnknownStyleNames     []string `json:"unknownStyleNames"`
	DirectFormatting      int      `json:"directFormatting"`
	DirectFormattingTypes []string `json:"directFormattingTypes"`
	IsClean               bool     `json:"isClean"`
	Error                 string   `json:"error,omitempty"`
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
	result.DirectFormattingTypes = auditResult.DirectFormattingTypes
	result.IsClean = auditResult.IsClean

	return result, nil
}

// directFormattingLabel maps XML element names to human-readable labels
var directFormattingLabel = map[string]string{
	"b":         "bold",
	"i":         "italic",
	"u":         "underline",
	"sz":        "font size",
	"color":     "text color",
	"rFonts":    "font family",
	"highlight": "highlight",
	"strike":    "strikethrough",
	"dstrike":   "double-strike",
	"vertAlign": "superscript/subscript",
	"spacing":   "character spacing",
}

// countStyleUsage counts how many paragraphs use each style and detects direct formatting
func countStyleUsage(docxPath string) (map[string]int, int, []string, error) {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, 0, nil, err
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
		return nil, 0, nil, fmt.Errorf("no document.xml found")
	}

	rc, err := documentFile.Open()
	if err != nil {
		return nil, 0, nil, err
	}
	defer rc.Close()

	styleCounts := make(map[string]int)
	directFormatting := 0
	directFormattingExamples := make(map[string]string)

	decoder := xml.NewDecoder(rc)
	inParagraph := false
	inRun := false
	inRunProps := false
	inMath := false // Track if we're inside a math element
	mathDepth := 0  // Handle nested math elements
	runHasDirectFormat := false
	runDirectTypes := make(map[string]bool)
	runText := ""
	paragraphHasRealDirectFormat := false

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}

		switch t := tok.(type) {
		case xml.StartElement:
			// Track math elements (namespace m: for Office Math)
			if t.Name.Local == "oMath" || t.Name.Local == "oMathPara" {
				inMath = true
				mathDepth++
			}

			switch t.Name.Local {
			case "p":
				inParagraph = true
				paragraphHasRealDirectFormat = false
			case "r":
				inRun = true
				inRunProps = false
				runHasDirectFormat = false
				runDirectTypes = make(map[string]bool)
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
			case "b", "i", "u", "sz", "color", "highlight", "strike", "dstrike", "vertAlign", "spacing":
				// Only count as direct formatting if NOT inside a math element
				if inRun && inRunProps && !inMath {
					runHasDirectFormat = true
					runDirectTypes[t.Name.Local] = true
				}
			case "rFonts":
				// Only count rFonts as direct formatting if it has non-theme font attributes
				if inRun && inRunProps && !inMath {
					hasRealFont := false
					for _, attr := range t.Attr {
						// Theme references are automatic, not manual formatting
						if strings.HasSuffix(attr.Name.Local, "Theme") {
							continue
						}
						// ascii, hAnsi, eastAsia, cs with actual font names = real formatting
						if attr.Name.Local == "ascii" || attr.Name.Local == "hAnsi" ||
							attr.Name.Local == "eastAsia" || attr.Name.Local == "cs" {
							hasRealFont = true
							break
						}
					}
					if hasRealFont {
						runHasDirectFormat = true
						runDirectTypes[t.Name.Local] = true
					}
				}
			case "t":
			}
		case xml.CharData:
			if inRun {
				runText += string(t)
			}
		case xml.EndElement:
			// Track exiting math elements
			if t.Name.Local == "oMath" || t.Name.Local == "oMathPara" {
				mathDepth--
				if mathDepth <= 0 {
					inMath = false
					mathDepth = 0
				}
			}

			switch t.Name.Local {
			case "rPr":
				inRunProps = false
			case "r":
				if runHasDirectFormat && !isOnlyEmDash(runText) {
					paragraphHasRealDirectFormat = true
					for k := range runDirectTypes {
						if _, exists := directFormattingExamples[k]; !exists {
							sample := strings.TrimSpace(runText)
							if len(sample) > 30 {
								sample = sample[:30] + "..."
							}
							if sample != "" {
								directFormattingExamples[k] = sample
							}
						}
					}
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

	var types []string
	for k, sample := range directFormattingExamples {
		label := k
		if l, ok := directFormattingLabel[k]; ok {
			label = l
		}
		if sample != "" {
			types = append(types, fmt.Sprintf("%s: \"%s\"", label, sample))
		} else {
			types = append(types, label)
		}
	}

	return styleCounts, directFormatting, types, nil
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

// HyperlinkRef represents a hyperlink reference within a drawing
type HyperlinkRef struct {
	SourceRelID string
	OutputRelID string
	Target      string
}

type ImageRef struct {
	SourceRelID string
	OutputRelID string
	MediaPath   string
	LocalPath   string
	DrawingXML  string
	IsLinked    bool
	Hyperlinks  []HyperlinkRef // Hyperlinks within this drawing
}

type ParagraphContent struct {
	Text   string
	Images []ImageRef
}

const wordRelsPath = "word/_rels/document.xml.rels"
const imageRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
const hyperlinkRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
const contentTypesXML = "[Content_Types].xml"

const (
	extPNG  = ".png"
	extJPG  = ".jpg"
	extGIF  = ".gif"
	extWebP = ".webp"
)

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
		if rel.Type == imageRelType || rel.Type == hyperlinkRelType {
			result[rel.ID] = rel.Target
		}
	}
	return result, nil
}

func extractParagraphsWithImages(docxPath string) ([]ParagraphContent, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	var docContent []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			docContent, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if docContent == nil {
		return nil, fmt.Errorf("document.xml not found in docx")
	}

	rels, err := parseRelationships(docxPath)
	if err != nil {
		return nil, fmt.Errorf("parse relationships: %w", err)
	}

	return parseParagraphsWithImages(docContent, rels)
}

func parseParagraphsWithImages(content []byte, rels map[string]string) ([]ParagraphContent, error) {
	contentStr := string(content)
	var paragraphs []ParagraphContent

	pStart := 0
	for {
		openTag := strings.Index(contentStr[pStart:], "<w:p>")
		if openTag == -1 {
			openTag = strings.Index(contentStr[pStart:], "<w:p ")
		}
		if openTag == -1 {
			break
		}
		openTag += pStart

		closeTag := strings.Index(contentStr[openTag:], "</w:p>")
		if closeTag == -1 {
			break
		}
		closeTag += openTag + 6

		paraXML := contentStr[openTag:closeTag]
		para := parseSingleParagraph(paraXML, rels)
		paragraphs = append(paragraphs, para)

		pStart = closeTag
	}

	return paragraphs, nil
}

func parseSingleParagraph(paraXML string, rels map[string]string) ParagraphContent {
	var result ParagraphContent
	var textBuilder strings.Builder

	remaining := paraXML
	for len(remaining) > 0 {
		drawingStart := strings.Index(remaining, "<w:drawing>")
		if drawingStart == -1 {
			drawingStart = strings.Index(remaining, "<w:drawing ")
		}

		if drawingStart == -1 {
			textBuilder.WriteString(extractTextFromXML(remaining))
			break
		}

		textBuilder.WriteString(extractTextFromXML(remaining[:drawingStart]))

		drawingEnd := strings.Index(remaining[drawingStart:], "</w:drawing>")
		if drawingEnd == -1 {
			break
		}
		drawingEnd += drawingStart + 12

		drawingXML := remaining[drawingStart:drawingEnd]
		img := extractImageRef(drawingXML, rels)
		if img.DrawingXML != "" {
			result.Images = append(result.Images, img)
		}

		remaining = remaining[drawingEnd:]
	}

	result.Text = strings.TrimSpace(textBuilder.String())
	return result
}

func extractTextFromXML(xmlStr string) string {
	var result strings.Builder
	decoder := xml.NewDecoder(strings.NewReader(xmlStr))

	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		if charData, ok := token.(xml.CharData); ok {
			result.WriteString(string(charData))
		}
	}
	return result.String()
}

func extractImageRef(drawingXML string, rels map[string]string) ImageRef {
	var relID string
	var isLinked bool

	embedStart := strings.Index(drawingXML, "r:embed=\"")
	if embedStart != -1 {
		embedStart += 9
		embedEnd := strings.Index(drawingXML[embedStart:], "\"")
		if embedEnd != -1 {
			relID = drawingXML[embedStart : embedStart+embedEnd]
		}
	}

	if relID == "" {
		linkStart := strings.Index(drawingXML, "r:link=\"")
		if linkStart != -1 {
			linkStart += 8
			linkEnd := strings.Index(drawingXML[linkStart:], "\"")
			if linkEnd != -1 {
				relID = drawingXML[linkStart : linkStart+linkEnd]
				isLinked = true
			}
		}
	}

	if relID == "" {
		return ImageRef{}
	}

	mediaPath := rels[relID]

	// Extract hyperlink references from drawing (r:id attributes in hlinkClick elements)
	var hyperlinks []HyperlinkRef
	remaining := drawingXML
	for {
		// Look for r:id=" pattern (used by hyperlinks in drawings)
		ridStart := strings.Index(remaining, "r:id=\"")
		if ridStart == -1 {
			break
		}
		ridStart += 6
		ridEnd := strings.Index(remaining[ridStart:], "\"")
		if ridEnd == -1 {
			break
		}
		hrefRelID := remaining[ridStart : ridStart+ridEnd]
		// Only add if it's a hyperlink (has a URL target) and not already tracked
		if target, ok := rels[hrefRelID]; ok && strings.HasPrefix(target, "http") {
			// Check if we already have this hyperlink
			found := false
			for _, h := range hyperlinks {
				if h.SourceRelID == hrefRelID {
					found = true
					break
				}
			}
			if !found {
				hyperlinks = append(hyperlinks, HyperlinkRef{
					SourceRelID: hrefRelID,
					Target:      target,
				})
			}
		}
		remaining = remaining[ridStart+ridEnd:]
	}

	return ImageRef{
		SourceRelID: relID,
		MediaPath:   mediaPath,
		DrawingXML:  drawingXML,
		IsLinked:    isLinked,
		Hyperlinks:  hyperlinks,
	}
}
func getMaxRelationshipID(templatePath string) (int, error) {
	rels, err := parseRelationships(templatePath)
	if err != nil {
		return 0, err
	}

	maxID := 0
	for relID := range rels {
		if strings.HasPrefix(relID, "rId") {
			numStr := strings.TrimPrefix(relID, "rId")
			if num, err := strconv.Atoi(numStr); err == nil && num > maxID {
				maxID = num
			}
		}
	}

	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return maxID, nil
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == wordRelsPath {
			rc, err := file.Open()
			if err != nil {
				continue
			}
			content, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}

			re := regexp.MustCompile(`Id="rId(\d+)"`)
			matches := re.FindAllStringSubmatch(string(content), -1)
			for _, m := range matches {
				if num, err := strconv.Atoi(m[1]); err == nil && num > maxID {
					maxID = num
				}
			}
		}
	}

	return maxID, nil
}

func downloadLinkedImages(paragraphs []ParagraphContent, workPath string) []ParagraphContent {
	dir := filepath.Dir(workPath)
	base := filepath.Base(workPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	supportingDir := filepath.Join(dir, "Supporting", name)

	existingImages := findExistingImages(supportingDir)
	nextImageNum := len(existingImages) + 1

	result := make([]ParagraphContent, len(paragraphs))
	imageNum := 1
	downloadedURLs := make(map[string]string)

	for i, para := range paragraphs {
		result[i].Text = para.Text
		for _, img := range para.Images {
			if !img.IsLinked || img.MediaPath == "" {
				result[i].Images = append(result[i].Images, img)
				continue
			}

			if localPath, exists := downloadedURLs[img.MediaPath]; exists {
				newImg := img
				newImg.LocalPath = localPath
				newImg.IsLinked = false
				newImg.DrawingXML = strings.Replace(img.DrawingXML, "r:link=", "r:embed=", 1)
				result[i].Images = append(result[i].Images, newImg)
				continue
			}

			if localPath, exists := existingImages[imageNum]; exists {
				newImg := img
				newImg.LocalPath = localPath
				newImg.IsLinked = false
				newImg.DrawingXML = strings.Replace(img.DrawingXML, "r:link=", "r:embed=", 1)
				result[i].Images = append(result[i].Images, newImg)
				downloadedURLs[img.MediaPath] = localPath
				imageNum++
				continue
			}

			localPath, err := downloadImage(img.MediaPath, supportingDir, nextImageNum)
			if err != nil {
				result[i].Images = append(result[i].Images, img)
				imageNum++
				continue
			}

			downloadedURLs[img.MediaPath] = localPath
			nextImageNum++
			imageNum++

			newImg := img
			newImg.LocalPath = localPath
			newImg.IsLinked = false
			newImg.DrawingXML = strings.Replace(img.DrawingXML, "r:link=", "r:embed=", 1)
			result[i].Images = append(result[i].Images, newImg)
		}
	}

	return result
}

func findExistingImages(supportingDir string) map[int]string {
	result := make(map[int]string)
	entries, err := os.ReadDir(supportingDir)
	if err != nil {
		return result
	}

	imagePattern := regexp.MustCompile(`^image(\d+)\.(png|jpg|jpeg|gif|webp)$`)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		matches := imagePattern.FindStringSubmatch(entry.Name())
		if len(matches) == 3 {
			num, _ := strconv.Atoi(matches[1])
			result[num] = filepath.Join(supportingDir, entry.Name())
		}
	}
	return result
}

func downloadImage(url, supportingDir string, imageNum int) (string, error) {
	if err := os.MkdirAll(supportingDir, 0755); err != nil {
		return "", fmt.Errorf("create supporting dir: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("http status: %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	ext := detectImageExtension(data, resp.Header.Get("Content-Type"))
	filename := fmt.Sprintf("image%d%s", imageNum, ext)
	localPath := filepath.Join(supportingDir, filename)

	if err := os.WriteFile(localPath, data, 0644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	return localPath, nil
}

func detectImageExtension(data []byte, contentType string) string {
	if len(data) >= 8 {
		if data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G' {
			return extPNG
		}
		if data[0] == 0xFF && data[1] == 0xD8 {
			return extJPG
		}
		if data[0] == 'G' && data[1] == 'I' && data[2] == 'F' {
			return extGIF
		}
		if data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' {
			if len(data) >= 12 && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P' {
				return extWebP
			}
		}
	}

	switch {
	case strings.Contains(contentType, "png"):
		return extPNG
	case strings.Contains(contentType, "jpeg"), strings.Contains(contentType, "jpg"):
		return extJPG
	case strings.Contains(contentType, "gif"):
		return extGIF
	case strings.Contains(contentType, "webp"):
		return extWebP
	}

	return extPNG
}

func remapImageRelationships(paragraphs []ParagraphContent, startID int) ([]ParagraphContent, map[string]string) {
	idMap := make(map[string]string)
	nextID := startID + 1

	result := make([]ParagraphContent, len(paragraphs))
	for i, para := range paragraphs {
		result[i].Text = para.Text
		for _, img := range para.Images {
			if img.SourceRelID == "" {
				continue
			}
			newRelID, exists := idMap[img.SourceRelID]
			if !exists {
				newRelID = fmt.Sprintf("rId%d", nextID)
				idMap[img.SourceRelID] = newRelID
				nextID++
			}

			oldEmbedAttr := fmt.Sprintf(`r:embed="%s"`, img.SourceRelID)
			oldLinkAttr := fmt.Sprintf(`r:link="%s"`, img.SourceRelID)
			newEmbedAttr := fmt.Sprintf(`r:embed="%s"`, newRelID)

			newDrawingXML := strings.Replace(img.DrawingXML, oldEmbedAttr, newEmbedAttr, 1)
			newDrawingXML = strings.Replace(newDrawingXML, oldLinkAttr, newEmbedAttr, 1)

			// Also remap any hyperlinks within the drawing
			var remappedHyperlinks []HyperlinkRef
			for _, hl := range img.Hyperlinks {
				newHLRelID, hlExists := idMap[hl.SourceRelID]
				if !hlExists {
					newHLRelID = fmt.Sprintf("rId%d", nextID)
					idMap[hl.SourceRelID] = newHLRelID
					nextID++
				}
				// Replace the r:id reference in the drawing XML
				oldHLAttr := fmt.Sprintf(`r:id="%s"`, hl.SourceRelID)
				newHLAttr := fmt.Sprintf(`r:id="%s"`, newHLRelID)
				newDrawingXML = strings.ReplaceAll(newDrawingXML, oldHLAttr, newHLAttr)

				remappedHyperlinks = append(remappedHyperlinks, HyperlinkRef{
					SourceRelID: hl.SourceRelID,
					OutputRelID: newHLRelID,
					Target:      hl.Target,
				})
			}

			newImg := ImageRef{
				SourceRelID: img.SourceRelID,
				OutputRelID: newRelID,
				MediaPath:   img.MediaPath,
				LocalPath:   img.LocalPath,
				DrawingXML:  newDrawingXML,
				IsLinked:    img.IsLinked,
				Hyperlinks:  remappedHyperlinks,
			}
			result[i].Images = append(result[i].Images, newImg)
		}
	}

	return result, idMap
}

func buildDocumentXMLWithImages(templatePath string, paragraphs []ParagraphContent) ([]byte, error) {
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
		escaped := escapeXML(para.Text)
		buf.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
		buf.WriteString(escaped)
		buf.WriteString(`</w:t></w:r>`)
		for _, img := range para.Images {
			buf.WriteString(`<w:r>`)
			buf.WriteString(img.DrawingXML)
			buf.WriteString(`</w:r>`)
		}
		buf.WriteString(`</w:p>`)
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

const dotmContentType = "application/vnd.ms-word.template.macroEnabledTemplate.main+xml"
const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"

func replaceDocumentXMLWithImages(templatePath, sourcePath, outputPath string, newDocXML []byte, paragraphs []ParagraphContent) error {
	templateReader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer templateReader.Close()

	sourceReader, err := zip.OpenReader(sourcePath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer sourceReader.Close()

	sourceMedia := make(map[string]*zip.File)
	for _, file := range sourceReader.File {
		if strings.HasPrefix(file.Name, "word/media/") {
			sourceMedia[file.Name] = file
		}
	}

	type mediaEntry struct {
		localPath string
		zipFile   *zip.File
	}
	neededMedia := make(map[string]mediaEntry)
	neededExtensions := make(map[string]bool)
	mediaCounter := 1

	for _, para := range paragraphs {
		for _, img := range para.Images {
			// Skip linked (external) images - they don't need media files embedded
			if img.IsLinked {
				continue
			}
			if img.LocalPath != "" {
				ext := filepath.Ext(img.LocalPath)
				mediaName := fmt.Sprintf("word/media/image%d%s", mediaCounter, ext)
				neededMedia[mediaName] = mediaEntry{localPath: img.LocalPath}
				neededExtensions[strings.ToLower(strings.TrimPrefix(ext, "."))] = true
				mediaCounter++
			} else if img.MediaPath != "" {
				mediaPath := img.MediaPath
				if !strings.HasPrefix(mediaPath, "word/") {
					mediaPath = "word/" + mediaPath
				}
				if srcFile, ok := sourceMedia[mediaPath]; ok {
					neededMedia[mediaPath] = mediaEntry{zipFile: srcFile}
					ext := filepath.Ext(mediaPath)
					neededExtensions[strings.ToLower(strings.TrimPrefix(ext, "."))] = true
				}
			}
		}
	}

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
		case wordRelsPath:
			mergedRels, err := mergeRelationships(file, paragraphs)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("merge relationships: %w", err)
			}
			header := &zip.FileHeader{
				Name:     file.Name,
				Method:   zip.Deflate,
				Modified: file.Modified,
			}
			w, err := zipWriter.CreateHeader(header)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create rels: %w", err)
			}
			if _, err := w.Write(mergedRels); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write rels: %w", err)
			}
		case contentTypesXML:
			if err := copyZipFileWithContentTypeFix(zipWriter, file, neededExtensions); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		default:
			if strings.HasPrefix(file.Name, "word/media/") {
				continue
			}
			if err := copyZipFile(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		}
	}

	for mediaPath, entry := range neededMedia {
		if entry.localPath != "" {
			data, err := os.ReadFile(entry.localPath)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("read local media %s: %w", entry.localPath, err)
			}
			w, err := zipWriter.Create(mediaPath)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create media %s: %w", mediaPath, err)
			}
			if _, err := w.Write(data); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write media %s: %w", mediaPath, err)
			}
		} else if entry.zipFile != nil {
			if err := copyZipFile(zipWriter, entry.zipFile); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy media %s: %w", mediaPath, err)
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

func mergeRelationships(templateRelsFile *zip.File, paragraphs []ParagraphContent) ([]byte, error) {
	rc, err := templateRelsFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open template rels: %w", err)
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("read template rels: %w", err)
	}

	relsStr := string(content)

	imageRelPattern := regexp.MustCompile(`<Relationship[^>]*Type="` + regexp.QuoteMeta(imageRelType) + `"[^>]*/?>`)
	relsStr = imageRelPattern.ReplaceAllString(relsStr, "")

	closeTag := strings.LastIndex(relsStr, "</Relationships>")
	if closeTag == -1 {
		return content, nil
	}

	var newRels strings.Builder
	newRels.WriteString(relsStr[:closeTag])

	addedRels := make(map[string]bool)
	mediaCounter := 1

	for _, para := range paragraphs {
		for _, img := range para.Images {
			// Add image relationship
			if img.OutputRelID != "" && !addedRels[img.OutputRelID] {
				addedRels[img.OutputRelID] = true

				// Handle linked (external) images - they need TargetMode="External"
				if img.IsLinked && img.MediaPath != "" {
					newRels.WriteString(fmt.Sprintf(
						`<Relationship Id="%s" Type="%s" Target="%s" TargetMode="External"/>`,
						img.OutputRelID,
						imageRelType,
						img.MediaPath,
					))
					continue
				}

				var mediaTarget string
				if img.LocalPath != "" {
					ext := filepath.Ext(img.LocalPath)
					mediaTarget = fmt.Sprintf("media/image%d%s", mediaCounter, ext)
					mediaCounter++
				} else if img.MediaPath != "" {
					mediaTarget = strings.TrimPrefix(img.MediaPath, "word/")
				} else {
					continue
				}

				newRels.WriteString(fmt.Sprintf(
					`<Relationship Id="%s" Type="%s" Target="%s"/>`,
					img.OutputRelID,
					imageRelType,
					mediaTarget,
				))
			}

			// Add hyperlink relationships from this image's drawings
			for _, hl := range img.Hyperlinks {
				if hl.OutputRelID != "" && !addedRels[hl.OutputRelID] {
					addedRels[hl.OutputRelID] = true
					newRels.WriteString(fmt.Sprintf(
						`<Relationship Id="%s" Type="%s" Target="%s" TargetMode="External"/>`,
						hl.OutputRelID,
						hyperlinkRelType,
						hl.Target,
					))
				}
			}
		}
	}

	newRels.WriteString("</Relationships>")
	return []byte(newRels.String()), nil
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

func copyZipFileWithContentTypeFix(zw *zip.Writer, file *zip.File, neededExtensions map[string]bool) error {
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

	closeTag := "</Types>"
	if idx := strings.LastIndex(fixed, closeTag); idx != -1 {
		var additions strings.Builder
		extensionContentTypes := map[string]string{
			"png":  "image/png",
			"jpeg": "image/jpeg",
			"jpg":  "image/jpeg",
			"gif":  "image/gif",
			"bmp":  "image/bmp",
			"tiff": "image/tiff",
			"emf":  "image/x-emf",
			"wmf":  "image/x-wmf",
		}
		for ext := range neededExtensions {
			ext = strings.TrimPrefix(ext, ".")
			ext = strings.ToLower(ext)
			if contentType, ok := extensionContentTypes[ext]; ok {
				if !strings.Contains(fixed, fmt.Sprintf(`Extension="%s"`, ext)) {
					additions.WriteString(fmt.Sprintf(`<Default Extension="%s" ContentType="%s"/>`, ext, contentType))
				}
			}
		}
		if additions.Len() > 0 {
			fixed = fixed[:idx] + additions.String() + closeTag
		}
	}

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

	paragraphs, err := extractParagraphsWithImages(fullPath)
	if err != nil {
		return fmt.Errorf("extract paragraphs: %w", err)
	}

	paragraphs = downloadLinkedImages(paragraphs, fullPath)

	maxRelID, err := getMaxRelationshipID(templatePath)
	if err != nil {
		return fmt.Errorf("get max rel id: %w", err)
	}

	remappedParagraphs, _ := remapImageRelationships(paragraphs, maxRelID)

	ext := filepath.Ext(fullPath)
	backupPath := strings.TrimSuffix(fullPath, ext) + ".bak" + ext
	if err := copyFile(fullPath, backupPath); err != nil {
		return fmt.Errorf("create backup: %w", err)
	}

	newDocXML, err := buildDocumentXMLWithImages(templatePath, remappedParagraphs)
	if err != nil {
		return fmt.Errorf("build document.xml: %w", err)
	}

	// Build the new file in a temp directory (outside the watched folder)
	// to avoid triggering file watcher on incomplete files
	tempDir, err := os.MkdirTemp("", "works-template-*")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	tempPath := filepath.Join(tempDir, filepath.Base(fullPath))
	if err := replaceDocumentXMLWithImages(templatePath, fullPath, tempPath, newDocXML, remappedParagraphs); err != nil {
		return fmt.Errorf("create new document: %w", err)
	}

	if err := validateDocxFile(tempPath); err != nil {
		return fmt.Errorf("validation failed - original preserved: %w", err)
	}

	// Atomic replacement: remove original then rename in quick succession
	// Use a staging path in the same directory for atomic rename on same filesystem
	stagingPath := fullPath + ".new"
	if err := copyFile(tempPath, stagingPath); err != nil {
		return fmt.Errorf("copy to staging: %w", err)
	}

	if err := os.Remove(fullPath); err != nil {
		os.Remove(stagingPath)
		return fmt.Errorf("remove original: %w", err)
	}
	if err := os.Rename(stagingPath, fullPath); err != nil {
		if copyErr := copyFile(backupPath, fullPath); copyErr != nil {
			return fmt.Errorf("rename failed AND restore failed: %w (restore: %v)", err, copyErr)
		}
		return fmt.Errorf("rename staging to original: %w", err)
	}

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

// validateDocxFile checks that a DOCX file is structurally valid
func validateDocxFile(path string) error {
	r, err := zip.OpenReader(path)
	if err != nil {
		return fmt.Errorf("invalid zip structure: %w", err)
	}
	defer r.Close()

	requiredFiles := map[string]bool{
		"[Content_Types].xml":          false,
		"word/document.xml":            false,
		"word/_rels/document.xml.rels": false,
	}

	for _, f := range r.File {
		if _, required := requiredFiles[f.Name]; required {
			requiredFiles[f.Name] = true
		}

		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return fmt.Errorf("cannot open document.xml: %w", err)
			}
			content, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return fmt.Errorf("cannot read document.xml: %w", err)
			}
			if !bytes.Contains(content, []byte("<w:document")) {
				return fmt.Errorf("document.xml missing <w:document> element")
			}
			if !bytes.Contains(content, []byte("</w:document>")) {
				return fmt.Errorf("document.xml missing closing </w:document> tag")
			}
			decoder := xml.NewDecoder(bytes.NewReader(content))
			for {
				_, err := decoder.Token()
				if err == io.EOF {
					break
				}
				if err != nil {
					return fmt.Errorf("document.xml has invalid XML: %w", err)
				}
			}
		}

		if f.Name == "word/_rels/document.xml.rels" {
			rc, err := f.Open()
			if err != nil {
				return fmt.Errorf("cannot open document.xml.rels: %w", err)
			}
			content, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return fmt.Errorf("cannot read document.xml.rels: %w", err)
			}
			decoder := xml.NewDecoder(bytes.NewReader(content))
			for {
				_, err := decoder.Token()
				if err == io.EOF {
					break
				}
				if err != nil {
					return fmt.Errorf("document.xml.rels has invalid XML: %w", err)
				}
			}
		}
	}

	for name, found := range requiredFiles {
		if !found {
			return fmt.Errorf("missing required file: %s", name)
		}
	}

	return nil
}
