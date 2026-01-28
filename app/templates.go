package app

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// TemplateStyle represents a style found in a DOCX template
type TemplateStyle struct {
	StyleID   string  `json:"styleId"`
	Name      string  `json:"name"`
	Type      string  `json:"type"` // paragraph, character, table
	IsCustom  bool    `json:"isCustom"`
	IsBuiltIn bool    `json:"isBuiltIn"`
	FontName  *string `json:"fontName,omitempty"`
	FontSize  *int    `json:"fontSize,omitempty"`  // in points
	FontColor *string `json:"fontColor,omitempty"` // hex color without #
}

// TemplateValidation represents the result of validating a DOCX template
type TemplateValidation struct {
	IsValid       bool            `json:"isValid"`
	Path          string          `json:"path"`
	Styles        []TemplateStyle `json:"styles"`
	RequiredFound []string        `json:"requiredFound"`
	RequiredMiss  []string        `json:"requiredMissing"`
	Errors        []string        `json:"errors"`
}

// GetTemplatesDir returns the path to the templates directory
func (a *App) GetTemplatesDir() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".works", "templates")
}

// EnsureTemplatesDir creates the templates directory if it doesn't exist
func (a *App) EnsureTemplatesDir() error {
	dir := a.GetTemplatesDir()
	return os.MkdirAll(dir, 0755)
}

// GetDefaultTemplatePath returns the path to the default template if it exists
func (a *App) GetDefaultTemplatePath() string {
	dir := a.GetTemplatesDir()
	defaultPath := filepath.Join(dir, "default-template.docx")
	if _, err := os.Stat(defaultPath); err == nil {
		return defaultPath
	}
	return ""
}

// SelectBookTemplate opens a file dialog to select a DOCX/DOTM template
func (a *App) SelectBookTemplate() (string, error) {
	selected, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Book Template",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Word Templates",
				Pattern:     "*.dotm",
			},
		},
		DefaultDirectory: a.GetTemplatesDir(),
	})
	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}
	return selected, nil
}

// ValidateTemplate checks if a DOCX file exists and is a valid template file
func (a *App) ValidateTemplate(path string) (*TemplateValidation, error) {
	result := &TemplateValidation{
		Path:          path,
		Styles:        []TemplateStyle{},
		RequiredFound: []string{},
		RequiredMiss:  []string{},
		Errors:        []string{},
	}

	if path == "" {
		result.Errors = append(result.Errors, "No template path provided")
		return result, nil
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		result.Errors = append(result.Errors, "Template file does not exist")
		return result, nil
	}

	lowerPath := strings.ToLower(path)
	if !strings.HasSuffix(lowerPath, ".dotm") {
		result.Errors = append(result.Errors, "Template must be a .dotm file")
		return result, nil
	}

	// Extract and validate styles
	styles, err := extractDOCXStyles(path)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Failed to read styles: %v", err))
		return result, nil
	}
	result.Styles = styles

	// Check for required styles
	requiredStyles := []string{"BookTitle", "BookSubtitle", "BookAuthor"}
	styleNames := make(map[string]bool)
	for _, s := range styles {
		styleNames[s.Name] = true
	}

	for _, req := range requiredStyles {
		if styleNames[req] {
			result.RequiredFound = append(result.RequiredFound, req)
		} else {
			result.RequiredMiss = append(result.RequiredMiss, req)
		}
	}

	// Template is valid if it exists, has correct extension, and has all required styles
	result.IsValid = len(result.Errors) == 0 && len(result.RequiredMiss) == 0

	return result, nil
}

// CopyTemplateToLibrary copies a template to the ~/.works/templates directory
func (a *App) CopyTemplateToLibrary(sourcePath string, newName string) (string, error) {
	if err := a.EnsureTemplatesDir(); err != nil {
		return "", fmt.Errorf("failed to create templates directory: %w", err)
	}

	if newName == "" {
		newName = filepath.Base(sourcePath)
	}
	lowerName := strings.ToLower(newName)
	if !strings.HasSuffix(lowerName, ".dotm") {
		newName += ".dotm"
	}

	destPath := filepath.Join(a.GetTemplatesDir(), newName)

	source, err := os.ReadFile(sourcePath)
	if err != nil {
		return "", fmt.Errorf("failed to read source template: %w", err)
	}

	if err := os.WriteFile(destPath, source, 0644); err != nil {
		return "", fmt.Errorf("failed to write template: %w", err)
	}

	return destPath, nil
}

// ListTemplates returns all templates in the templates directory
func (a *App) ListTemplates() ([]string, error) {
	dir := a.GetTemplatesDir()
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return []string{}, nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read templates directory: %w", err)
	}

	templates := []string{}
	for _, entry := range entries {
		lowerName := strings.ToLower(entry.Name())
		if !entry.IsDir() && strings.HasSuffix(lowerName, ".dotm") {
			templates = append(templates, filepath.Join(dir, entry.Name()))
		}
	}
	return templates, nil
}

// extractDOCXStyles reads styles from a DOCX file's styles.xml
func extractDOCXStyles(path string) ([]TemplateStyle, error) {
	r, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open docx: %w", err)
	}
	defer r.Close()

	var stylesFile *zip.File
	for _, f := range r.File {
		if f.Name == "word/styles.xml" {
			stylesFile = f
			break
		}
	}

	if stylesFile == nil {
		return nil, fmt.Errorf("no styles.xml found in document")
	}

	rc, err := stylesFile.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open styles.xml: %w", err)
	}
	defer rc.Close()

	// Parse the styles XML with font and size info
	type FontAttr struct {
		Ascii string `xml:"ascii,attr"`
		HAnsi string `xml:"hAnsi,attr"`
	}
	type SizeAttr struct {
		Val string `xml:"val,attr"`
	}
	type ColorAttr struct {
		Val string `xml:"val,attr"`
	}
	type RunProps struct {
		Fonts *FontAttr  `xml:"rFonts"`
		Size  *SizeAttr  `xml:"sz"`
		Color *ColorAttr `xml:"color"`
	}
	type ParaProps struct {
		RunProps *RunProps `xml:"rPr"`
	}
	type StyleName struct {
		Val string `xml:"val,attr"`
	}
	type Style struct {
		StyleID   string     `xml:"styleId,attr"`
		Type      string     `xml:"type,attr"`
		Default   string     `xml:"default,attr"`
		CustomStl string     `xml:"customStyle,attr"`
		Name      StyleName  `xml:"name"`
		ParaProps *ParaProps `xml:"pPr"`
		RunProps  *RunProps  `xml:"rPr"`
	}
	type Styles struct {
		Styles []Style `xml:"style"`
	}

	var styles Styles
	if err := xml.NewDecoder(rc).Decode(&styles); err != nil {
		return nil, fmt.Errorf("failed to parse styles.xml: %w", err)
	}

	result := make([]TemplateStyle, 0, len(styles.Styles))
	for _, s := range styles.Styles {
		ts := TemplateStyle{
			StyleID:   s.StyleID,
			Name:      s.Name.Val,
			Type:      s.Type,
			IsCustom:  s.CustomStl == "1",
			IsBuiltIn: s.CustomStl != "1",
		}

		// Extract font name (check both direct rPr and pPr/rPr)
		if s.RunProps != nil && s.RunProps.Fonts != nil && s.RunProps.Fonts.Ascii != "" {
			fontName := s.RunProps.Fonts.Ascii
			ts.FontName = &fontName
		} else if s.ParaProps != nil && s.ParaProps.RunProps != nil && s.ParaProps.RunProps.Fonts != nil {
			fontName := s.ParaProps.RunProps.Fonts.Ascii
			ts.FontName = &fontName
		}

		// Extract font size (in half-points in XML, convert to points)
		if s.RunProps != nil && s.RunProps.Size != nil && s.RunProps.Size.Val != "" {
			if sizeHalfPts, err := strconv.Atoi(s.RunProps.Size.Val); err == nil {
				sizePts := sizeHalfPts / 2
				ts.FontSize = &sizePts
			}
		} else if s.ParaProps != nil && s.ParaProps.RunProps != nil && s.ParaProps.RunProps.Size != nil {
			if sizeHalfPts, err := strconv.Atoi(s.ParaProps.RunProps.Size.Val); err == nil {
				sizePts := sizeHalfPts / 2
				ts.FontSize = &sizePts
			}
		}

		// Extract font color (hex value without #)
		if s.RunProps != nil && s.RunProps.Color != nil && s.RunProps.Color.Val != "" {
			color := s.RunProps.Color.Val
			ts.FontColor = &color
		} else if s.ParaProps != nil && s.ParaProps.RunProps != nil && s.ParaProps.RunProps.Color != nil {
			color := s.ParaProps.RunProps.Color.Val
			ts.FontColor = &color
		}

		result = append(result, ts)
	}

	return result, nil
}

// OpenTemplate reveals the template in Finder (Word requires File→Open to edit .dotm files)
func (a *App) OpenTemplate(path string) error {
	if path == "" {
		return fmt.Errorf("no template path provided")
	}
	// Reveal the file in Finder - user must use Word's File→Open to edit .dotm templates
	return exec.Command("open", "-R", path).Run()
}

// GetWorkTemplatePath returns the template path for a work (via its collection's book)
func (a *App) GetWorkTemplatePath(workID int64) (string, error) {
	// Get collections for this work
	collections, err := a.db.GetWorkCollections(workID)
	if err != nil {
		return "", err
	}

	// Find a collection that is a book with a template
	for _, coll := range collections {
		book, err := a.db.GetBookByCollection(coll.CollID)
		if err != nil || book == nil {
			continue
		}
		if book.TemplatePath != nil && *book.TemplatePath != "" {
			return *book.TemplatePath, nil
		}
	}

	return "", nil
}

// TitlePageStyleInfo contains style information for rendering the title page
type TitlePageStyleInfo struct {
	TitleFont     string `json:"titleFont"`
	TitleSize     int    `json:"titleSize"`
	TitleColor    string `json:"titleColor"`
	SubtitleFont  string `json:"subtitleFont"`
	SubtitleSize  int    `json:"subtitleSize"`
	SubtitleColor string `json:"subtitleColor"`
	AuthorFont    string `json:"authorFont"`
	AuthorSize    int    `json:"authorSize"`
	AuthorColor   string `json:"authorColor"`
}

// GetTitlePageStyles extracts style info from a template for rendering the title page preview
func (a *App) GetTitlePageStyles(templatePath string) (*TitlePageStyleInfo, error) {
	result := &TitlePageStyleInfo{
		TitleFont:     "Garamond",
		TitleSize:     36,
		TitleColor:    "000000",
		SubtitleFont:  "Garamond",
		SubtitleSize:  24,
		SubtitleColor: "000000",
		AuthorFont:    "Garamond",
		AuthorSize:    18,
		AuthorColor:   "000000",
	}

	if templatePath == "" {
		return result, nil
	}

	styles, err := extractDOCXStyles(templatePath)
	if err != nil {
		return result, nil // Return defaults on error
	}

	for _, s := range styles {
		switch s.Name {
		case "BookTitle":
			if s.FontName != nil {
				result.TitleFont = *s.FontName
			}
			if s.FontSize != nil {
				result.TitleSize = *s.FontSize
			}
			if s.FontColor != nil {
				result.TitleColor = *s.FontColor
			}
		case "BookSubtitle":
			if s.FontName != nil {
				result.SubtitleFont = *s.FontName
			}
			if s.FontSize != nil {
				result.SubtitleSize = *s.FontSize
			}
			if s.FontColor != nil {
				result.SubtitleColor = *s.FontColor
			}
		case "BookAuthor":
			if s.FontName != nil {
				result.AuthorFont = *s.FontName
			}
			if s.FontSize != nil {
				result.AuthorSize = *s.FontSize
			}
			if s.FontColor != nil {
				result.AuthorColor = *s.FontColor
			}
		}
	}

	return result, nil
}
