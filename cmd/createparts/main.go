package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	templatePath = "/Users/jrush/Documents/Home/99 Templates/Template.docx"
	sectionsDir  = "/Users/jrush/Documents/Home/100 Sections"
	documentPath = "word/document.xml"
)

type Part struct {
	WorkID int
	Title  string
	Year   string
	Body   string
}

var parts = []Part{
	{
		WorkID: 23925,
		Title:  "Part I: The DAO Awakening",
		Year:   "2016",
		Body:   "The founding trauma — when sixty million dollars disappeared and three experts could not agree on basic facts. Ten essays written in real-time as The DAO rose, fell, and was autopsied. This is where TrueBlocks was born: not from inspiration, but from frustration.",
	},
	{
		WorkID: 23926,
		Title:  "Part II: Building QuickBlocks",
		Year:   "2017",
		Body:   "The quiet years of construction. A project gets its first name. Essays about difficulty bombs, block production, the Byzantium fork — technical, exploratory, optimistic. The gangly, enthusiastic phase where everything seemed possible.",
	},
	{
		WorkID: 23927,
		Title:  "Part III: The Decentralization Manifesto",
		Year:   "2018",
		Body:   "The philosophical stakes crystallize. The RPC is not enough. Eight essays that shift from pure technical exploration to advocacy. This is where the thesis becomes clear: centralized APIs are a betrayal, and the data should be accessible to everyone.",
	},
	{
		WorkID: 23928,
		Title:  "Part IV: The Unchained Index",
		Year:   "2019",
		Body:   "The technical breakthrough. Indexing what the node forgot. Seven essays documenting the core innovation: address appearances, bloom filters, the architecture that would become the Unchained Index. QuickBlocks becomes TrueBlocks. The identity is forming, the real work is being done.",
	},
	{
		WorkID: 23929,
		Title:  "Part V: The Long Grind",
		Year:   "2020",
		Body:   "Pandemic years. Grant reports and growing doubts. The tools work — where are the users? Fifteen essays across two strange years. More recipes, more comparisons to competitors, more quarterly updates. The tone shifts: exhausted, occasionally bitter, still hopeful.",
	},
	{
		WorkID: 23930,
		Title:  "Part VI: The Specification",
		Year:   "2022",
		Body:   "The index is formalized. The grants continue. Recipes for a world that is not cooking. The Unchained Index specification is published. The technical problems are solved. The adoption problem remains.",
	},
	{
		WorkID: 23931,
		Title:  "Part VII: The Prisoner's Dilemma",
		Year:   "2023",
		Body:   "The machines learn to talk. The humans keep defecting. ChatGPT conversations, philosophical essays about cooperation and trust, explorations of L2s. The market has voted. Convenience won. TrueBlocks maintained philosophical purity and got: grant funding and an empty island.",
	},
	{
		WorkID: 23932,
		Title:  "Part VIII: The Island",
		Year:   "2025",
		Body:   "The view from the end. Looking back at what was built. The final grant reports, the miniDapps framework, the retrospectives. By December 2025, nearly a decade after it started, the author finds himself on a lovely island where all the flowers grow. The trouble is, he is there alone.",
	},
	{
		WorkID: 23933,
		Title:  "Appendices",
		Year:   "2025",
		Body:   "Supporting materials: the technical papers that document TrueBlocks architecture in formal detail, and the cartoons that capture the absurdity of building decentralized tools in a world that keeps choosing convenience over sovereignty.",
	},
}

func main() {
	if err := os.MkdirAll(sectionsDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating sections directory: %v\n", err)
		os.Exit(1)
	}

	for _, part := range parts {
		if err := createPartDoc(part); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating %s: %v\n", part.Title, err)
			os.Exit(1)
		}
	}

	fmt.Println("\nAll section documents created successfully!")
	fmt.Println("\nSQL to update paths:")
	for _, part := range parts {
		filename := fmt.Sprintf("bSection - %s - %s.docx", part.Year, part.Title)
		path := filepath.Join("100 Sections", filename)
		fmt.Printf("UPDATE Works SET path = '%s' WHERE workID = %d;\n", path, part.WorkID)
	}
}

func createPartDoc(part Part) error {
	filename := fmt.Sprintf("bSection - %s - %s.docx", part.Year, part.Title)
	outputPath := filepath.Join(sectionsDir, filename)

	documentXML := createDocumentXML(part.Title, part.Body)

	if err := createDocxFromTemplate(templatePath, outputPath, documentXML); err != nil {
		return err
	}

	fmt.Printf("Created: %s\n", outputPath)
	return nil
}

func createDocumentXML(title, body string) []byte {
	title = escapeXML(title)
	body = escapeXML(body)

	xml := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:t>` + title + `</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Normal"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Normal"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>` + body + `</w:t>
      </w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>`
	return []byte(xml)
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func createDocxFromTemplate(templatePath, outputPath string, documentXML []byte) error {
	r, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("opening template: %w", err)
	}
	defer r.Close()

	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("creating output file: %w", err)
	}
	defer outFile.Close()

	w := zip.NewWriter(outFile)
	defer w.Close()

	for _, f := range r.File {
		if f.Name == documentPath {
			fw, err := w.Create(f.Name)
			if err != nil {
				return fmt.Errorf("creating document.xml: %w", err)
			}
			if _, err := io.Copy(fw, bytes.NewReader(documentXML)); err != nil {
				return fmt.Errorf("writing document.xml: %w", err)
			}
		} else {
			if err := copyZipFile(w, f); err != nil {
				return fmt.Errorf("copying %s: %w", f.Name, err)
			}
		}
	}

	return nil
}

func copyZipFile(w *zip.Writer, f *zip.File) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	fw, err := w.Create(f.Name)
	if err != nil {
		return err
	}

	_, err = io.Copy(fw, rc)
	return err
}
