package bookbuild

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
)

// TemplateStyleInfo contains font and size information extracted from a template style
type TemplateStyleInfo struct {
	FontName string
	FontSize int // in points
}

// GetTemplateStyle extracts font and size information for a named style from a template
func GetTemplateStyle(templatePath, styleName string) (*TemplateStyleInfo, error) {
	r, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
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
		return nil, fmt.Errorf("styles.xml not found in template")
	}

	rc, err := stylesFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open styles.xml: %w", err)
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("read styles.xml: %w", err)
	}

	return parseStyleFromXML(content, styleName)
}

func parseStyleFromXML(content []byte, styleName string) (*TemplateStyleInfo, error) {
	type FontAttr struct {
		Ascii string `xml:"ascii,attr"`
		HAnsi string `xml:"hAnsi,attr"`
	}
	type SizeAttr struct {
		Val string `xml:"val,attr"`
	}
	type RunProps struct {
		Fonts *FontAttr `xml:"rFonts"`
		Size  *SizeAttr `xml:"sz"`
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
		Name      StyleName  `xml:"name"`
		ParaProps *ParaProps `xml:"pPr"`
		RunProps  *RunProps  `xml:"rPr"`
	}
	type Styles struct {
		Styles []Style `xml:"style"`
	}

	var styles Styles
	if err := xml.Unmarshal(content, &styles); err != nil {
		return nil, fmt.Errorf("parse styles.xml: %w", err)
	}

	for _, s := range styles.Styles {
		if s.Name.Val != styleName && s.StyleID != styleName {
			continue
		}

		info := &TemplateStyleInfo{
			FontName: defaultFont,
			FontSize: 12, // default
		}

		// Extract font name
		if s.RunProps != nil && s.RunProps.Fonts != nil && s.RunProps.Fonts.Ascii != "" {
			info.FontName = s.RunProps.Fonts.Ascii
		} else if s.ParaProps != nil && s.ParaProps.RunProps != nil && s.ParaProps.RunProps.Fonts != nil && s.ParaProps.RunProps.Fonts.Ascii != "" {
			info.FontName = s.ParaProps.RunProps.Fonts.Ascii
		}

		// Extract font size (XML stores half-points)
		if s.RunProps != nil && s.RunProps.Size != nil && s.RunProps.Size.Val != "" {
			if halfPts, err := strconv.Atoi(s.RunProps.Size.Val); err == nil {
				info.FontSize = halfPts / 2
			}
		} else if s.ParaProps != nil && s.ParaProps.RunProps != nil && s.ParaProps.RunProps.Size != nil && s.ParaProps.RunProps.Size.Val != "" {
			if halfPts, err := strconv.Atoi(s.ParaProps.RunProps.Size.Val); err == nil {
				info.FontSize = halfPts / 2
			}
		}

		return info, nil
	}

	return nil, fmt.Errorf("style %q not found in template", styleName)
}
