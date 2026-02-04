package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Document struct {
	Body Body `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main body"`
}
type Body struct {
	Tables []Table `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tbl"`
}
type Table struct {
	Rows []TableRow `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tr"`
	Grid TableGrid  `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tblGrid"`
}
type TableGrid struct {
	Cols []GridCol `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main gridCol"`
}
type GridCol struct {
	Width string `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main w,attr"`
}
type TableRow struct {
	Cells []TableCell `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tc"`
}
type TableCell struct {
	Paragraphs []Paragraph `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main p"`
	NestedTbl  *Table      `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tbl"`
}
type Paragraph struct {
	Runs []Run `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main r"`
}
type Run struct {
	Text string `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main t"`
}

func main() {
	docxPath := filepath.Join(os.Getenv("HOME"), "Documents/Home/100 Poems/cPoem - 2016 - February 26 - Genji Sequence 01-05.docx")
	r, _ := zip.OpenReader(docxPath)
	defer r.Close()

	var docXML []byte
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, _ := f.Open()
			docXML, _ = io.ReadAll(rc)
			rc.Close()
			break
		}
	}

	var doc Document
	xml.Unmarshal(docXML, &doc)

	for _, tbl := range doc.Body.Tables {
		if len(tbl.Grid.Cols) == 2 && len(tbl.Rows) > 0 {
			row := tbl.Rows[0]
			if len(row.Cells) >= 2 && row.Cells[1].NestedTbl != nil {
				nestedTbl := row.Cells[1].NestedTbl
				fmt.Printf("Nested table has %d rows\n", len(nestedTbl.Rows))
				for rowIdx, r := range nestedTbl.Rows {
					fmt.Printf("Row %d has %d cells:\n", rowIdx, len(r.Cells))
					for colIdx, c := range r.Cells {
						var text string
						for _, p := range c.Paragraphs {
							for _, run := range p.Runs {
								text += run.Text
							}
						}
						fmt.Printf("  Cell[%d]: text='%s'\n", colIdx, strings.TrimSpace(text))
					}
				}
				break
			}
		}
	}
}
