package app

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

// SetWorkMarked marks or unmarks a work
func (a *App) SetWorkMarked(workID int64, marked bool) error {
	markedVal := 0
	if marked {
		markedVal = 1
	}
	_, err := a.db.Conn().Exec("UPDATE Works SET is_marked = ? WHERE workID = ?", markedVal, workID)
	return err
}

// GetWorkMarked checks if a work is marked
func (a *App) GetWorkMarked(workID int64) (bool, error) {
	var isMarked int
	err := a.db.Conn().QueryRow("SELECT COALESCE(is_marked, 0) FROM Works WHERE workID = ?", workID).Scan(&isMarked)
	if err != nil {
		return false, err
	}
	return isMarked == 1, nil
}

// SetWorkSuppressed sets or clears the suppressed flag for a work in a collection
func (a *App) SetWorkSuppressed(collID, workID int64, suppressed bool) error {
	return a.db.SetWorkSuppressed(collID, workID, suppressed)
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
