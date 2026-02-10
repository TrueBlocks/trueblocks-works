package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type document struct {
	Body body `xml:"body"`
}

type body struct {
	Paragraphs []paragraph `xml:"p"`
}

type paragraph struct {
	Props *paraProps `xml:"pPr"`
	Runs  []run      `xml:"r"`
}

type paraProps struct {
	Style *styleRef `xml:"pStyle"`
}

type styleRef struct {
	Val string `xml:"val,attr"`
}

type run struct {
	Props *runProps `xml:"rPr"`
	Text  []text    `xml:"t"`
}

type runProps struct {
	Vanish *struct{} `xml:"vanish"`
}

type text struct {
	Content string `xml:",chardata"`
}

var tagPattern = regexp.MustCompile(`<\d{2}-\d{2}>|</\d{2}-\d{2}>`)

func main() {
	base := "/Users/jrush/Documents/Home/100 Chapters"
	entries, err := os.ReadDir(base)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read dir: %v\n", err)
		os.Exit(1)
	}

	styleCounts := map[string]int{}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".docx") {
			continue
		}
		path := filepath.Join(base, e.Name())
		styles, err := findTagStyles(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERROR: %s: %v\n", e.Name(), err)
			continue
		}
		for _, s := range styles {
			styleCounts[s]++
		}
	}

	fmt.Println("Tag paragraph styles found:")
	for style, count := range styleCounts {
		fmt.Printf("  %-20s %d occurrences\n", style, count)
	}
}

func findTagStyles(docxPath string) ([]string, error) {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		defer rc.Close()

		data, err := io.ReadAll(rc)
		if err != nil {
			return nil, err
		}

		cleaned := strings.ReplaceAll(string(data), "w:", "")
		var doc document
		if err := xml.Unmarshal([]byte(cleaned), &doc); err != nil {
			return nil, err
		}

		var styles []string
		for _, p := range doc.Body.Paragraphs {
			var paraText strings.Builder
			for _, run := range p.Runs {
				for _, t := range run.Text {
					paraText.WriteString(t.Content)
				}
			}
			text := strings.TrimSpace(paraText.String())
			if tagPattern.MatchString(text) {
				style := "(no style)"
				if p.Props != nil && p.Props.Style != nil {
					style = p.Props.Style.Val
				}

				hidden := false
				for _, run := range p.Runs {
					if run.Props != nil && run.Props.Vanish != nil {
						hidden = true
						break
					}
				}
				if hidden {
					style += " [HIDDEN]"
				}
				styles = append(styles, style)
			}
		}
		return styles, nil
	}
	return nil, fmt.Errorf("document.xml not found")
}
