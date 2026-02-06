package bookbuild

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Typography struct {
	HeaderFont     string `json:"headerFont"`
	HeaderSize     int    `json:"headerSize"`
	PageNumberFont string `json:"pageNumberFont"`
	PageNumberSize int    `json:"pageNumberSize"`
}

type FrontMatterItem struct {
	Type        string `json:"type"`
	PDF         string `json:"pdf,omitempty"`
	Placeholder bool   `json:"placeholder,omitempty"`
}

type BackMatterItem struct {
	Type string `json:"type"`
	PDF  string `json:"pdf"`
}

type Work struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	PDF   string `json:"pdf"`
}

type Part struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	PDF       string `json:"pdf"`
	Works     []Work `json:"works"`
	NoDivider bool   `json:"noDivider,omitempty"`
}

type Manifest struct {
	Title               string            `json:"title"`
	Author              string            `json:"author"`
	OutputPath          string            `json:"outputPath"`
	TemplatePath        string            `json:"templatePath,omitempty"`
	Typography          Typography        `json:"typography"`
	PageNumberPosition  string            `json:"pageNumberPosition,omitempty"`  // centered, outer, none
	SuppressPageNumbers string            `json:"suppressPageNumbers,omitempty"` // never, section_starts, essay_starts, both
	WorksStartRecto     bool              `json:"worksStartRecto,omitempty"`
	VersoHeader         string            `json:"versoHeader,omitempty"` // book_title, section_title, essay_title, none
	RectoHeader         string            `json:"rectoHeader,omitempty"` // book_title, section_title, essay_title, none
	FrontMatter         []FrontMatterItem `json:"frontMatter"`
	Parts               []Part            `json:"parts,omitempty"`
	Works               []Work            `json:"works,omitempty"`
	BackMatter          []BackMatterItem  `json:"backMatter"`
}

func DefaultTypography() Typography {
	return Typography{
		HeaderFont:     "Times New Roman",
		HeaderSize:     10,
		PageNumberFont: "Times New Roman",
		PageNumberSize: 10,
	}
}

func LoadManifest(path string) (*Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest: %w", err)
	}

	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}

	if err := m.Validate(); err != nil {
		return nil, err
	}

	return &m, nil
}

func (m *Manifest) Validate() error {
	if m.Title == "" {
		return fmt.Errorf("manifest: title is required")
	}
	if m.OutputPath == "" {
		return fmt.Errorf("manifest: outputPath is required")
	}

	if len(m.Parts) == 0 && len(m.Works) == 0 {
		return fmt.Errorf("manifest: either parts or works must be provided")
	}

	if len(m.Parts) > 0 && len(m.Works) > 0 {
		return fmt.Errorf("manifest: cannot specify both parts and works at top level")
	}

	for i, fm := range m.FrontMatter {
		if fm.Type == "" {
			return fmt.Errorf("manifest: frontMatter[%d] type is required", i)
		}
		if !fm.Placeholder && fm.PDF == "" {
			return fmt.Errorf("manifest: frontMatter[%d] pdf is required unless placeholder", i)
		}
		if !fm.Placeholder {
			if err := validatePDFPath(fm.PDF); err != nil {
				return fmt.Errorf("manifest: frontMatter[%d]: %w", i, err)
			}
		}
	}

	for i, part := range m.Parts {
		if part.Title == "" {
			return fmt.Errorf("manifest: parts[%d] title is required", i)
		}
		if part.PDF != "" {
			if err := validatePDFPath(part.PDF); err != nil {
				return fmt.Errorf("manifest: parts[%d]: %w", i, err)
			}
		}
		for j, work := range part.Works {
			if err := validateWork(work); err != nil {
				return fmt.Errorf("manifest: parts[%d].works[%d]: %w", i, j, err)
			}
		}
	}

	for i, work := range m.Works {
		if err := validateWork(work); err != nil {
			return fmt.Errorf("manifest: works[%d]: %w", i, err)
		}
	}

	for i, bm := range m.BackMatter {
		if bm.Type == "" {
			return fmt.Errorf("manifest: backMatter[%d] type is required", i)
		}
		if err := validatePDFPath(bm.PDF); err != nil {
			return fmt.Errorf("manifest: backMatter[%d]: %w", i, err)
		}
	}

	return nil
}

func (m *Manifest) AllWorks() []Work {
	if len(m.Works) > 0 {
		return m.Works
	}
	var all []Work
	for _, part := range m.Parts {
		all = append(all, part.Works...)
	}
	return all
}

func (m *Manifest) HasParts() bool {
	return len(m.Parts) > 0
}

func validateWork(w Work) error {
	if w.Title == "" {
		return fmt.Errorf("title is required")
	}
	if w.PDF == "" {
		return fmt.Errorf("pdf is required")
	}
	return validatePDFPath(w.PDF)
}

func validatePDFPath(path string) error {
	expanded := ExpandPath(path)
	if _, err := os.Stat(expanded); os.IsNotExist(err) {
		return fmt.Errorf("pdf not found: %s", path)
	}
	return nil
}

func ExpandPath(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[2:])
	}
	return path
}
