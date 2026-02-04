package main

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Cell represents a single cell in the Genji grid
type Cell struct {
	Color        color.RGBA
	TopBorder    bool
	BottomBorder bool
	LeftBorder   bool
	RightBorder  bool
	Text         string // For pattern row (A, B, C, etc.)
}

// GenjiGrid represents the color grid plus pattern row
type GenjiGrid struct {
	ColorRows  [][]Cell // Variable number of color rows (typically 4-5)
	PatternRow []Cell   // The last row with pattern letters (A, B, C, etc.)
}

// Poem represents extracted poem data
type Poem struct {
	Number int
	Lines  []string
	Grid   GenjiGrid
}

func main() {
	poemsDir := filepath.Join(os.Getenv("HOME"), "Documents/Home/100 Poems")
	outputDir := filepath.Join(os.Getenv("HOME"), "Desktop/Genji")
	templatePath := filepath.Join(os.Getenv("HOME"), ".works/templates/poetry-template.dotm")

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating output dir: %v\n", err)
		os.Exit(1)
	}

	// Find all Genji Sequence files
	files, err := filepath.Glob(filepath.Join(poemsDir, "*Genji Sequence*.docx"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error finding files: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d Genji Sequence files\n", len(files))

	var allPoems []Poem
	for _, file := range files {
		fmt.Printf("\nProcessing: %s\n", filepath.Base(file))
		poems, err := extractPoems(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error extracting poems from %s: %v\n", file, err)
			continue
		}
		allPoems = append(allPoems, poems...)
	}

	fmt.Printf("\nTotal poems found: %d\n", len(allPoems))
	// Assign sequential numbers to all poems
	for i := range allPoems {
		allPoems[i].Number = i + 1
	}

	// Group poems by 3
	for i := 0; i < len(allPoems); i += 3 {
		end := i + 3
		if end > len(allPoems) {
			end = len(allPoems)
		}
		group := allPoems[i:end]

		fmt.Printf("\n=== Group starting at Poem %02d ===\n", group[0].Number)
		for _, poem := range group {
			fmt.Printf("  Poem %02d\n", poem.Number)
			for _, line := range poem.Lines {
				fmt.Printf("    %s\n", line)
			}
		}

		// Render all grids for this group
		var imageDataList [][]byte
		for _, poem := range group {
			imgData, err := renderGenjiGrid(poem.Grid)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error rendering Genji grid for poem %d: %v\n", poem.Number, err)
				continue
			}
			imageDataList = append(imageDataList, imgData)
		}

		lastNum := group[len(group)-1].Number
		docPath := filepath.Join(outputDir, fmt.Sprintf("Genji %02d-%02d.docx", group[0].Number, lastNum))
		if err := createMultiPoemDoc(templatePath, docPath, group, imageDataList); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating doc: %v\n", err)
			continue
		}
		fmt.Printf("Created: %s\n", docPath)
	}
}

func extractPoems(docxPath string) ([]Poem, error) {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	defer r.Close()

	var docXML []byte
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			docXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if docXML == nil {
		return nil, fmt.Errorf("document.xml not found")
	}

	return parseDocument(docXML)
}

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
	Props      CellProps   `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tcPr"`
	Paragraphs []Paragraph `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main p"`
	NestedTbl  *Table      `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tbl"`
}

type CellProps struct {
	Shading Shading     `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main shd"`
	Borders CellBorders `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main tcBorders"`
}

type Shading struct {
	Fill string `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main fill,attr"`
}

type CellBorders struct {
	Top    Border `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main top"`
	Bottom Border `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main bottom"`
	Left   Border `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main left"`
	Right  Border `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main right"`
}

type Border struct {
	Val string `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main val,attr"`
}

type Paragraph struct {
	Runs []Run `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main r"`
}

type Run struct {
	Text string `xml:"http://schemas.openxmlformats.org/wordprocessingml/2006/main t"`
}

func parseDocument(data []byte) ([]Poem, error) {
	var doc Document
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	var poems []Poem
	poemNumber := 0

	for _, tbl := range doc.Body.Tables {
		// The main table has 2 columns - each ROW is a poem
		if len(tbl.Grid.Cols) != 2 {
			continue
		}

		// Each row in this table is a poem
		for _, row := range tbl.Rows {
			if len(row.Cells) != 2 {
				continue
			}

			poemNumber++
			poem := Poem{Number: poemNumber}

			// First cell contains poem text
			for _, para := range row.Cells[0].Paragraphs {
				line := extractText(para)
				if strings.TrimSpace(line) != "" {
					poem.Lines = append(poem.Lines, line)
				}
			}

			// Second cell contains nested Genji table
			if row.Cells[1].NestedTbl != nil {
				poem.Grid = parseGenjiGrid(row.Cells[1].NestedTbl)
			}

			if len(poem.Lines) > 0 {
				poems = append(poems, poem)
			}
		}
	}

	return poems, nil
}

func extractText(para Paragraph) string {
	var sb strings.Builder
	for _, run := range para.Runs {
		sb.WriteString(run.Text)
	}
	return sb.String()
}

func parseGenjiGrid(tbl *Table) GenjiGrid {
	var grid GenjiGrid

	numRows := len(tbl.Rows)
	if numRows == 0 {
		return grid
	}

	// Parse all rows
	for rowIdx, row := range tbl.Rows {
		var rowCells []Cell
		for _, cell := range row.Cells {
			// Extract text from paragraphs
			var cellText string
			for _, para := range cell.Paragraphs {
				cellText += extractText(para)
			}
			rowCells = append(rowCells, Cell{
				Color:        parseColor(cell.Props.Shading.Fill),
				TopBorder:    cell.Props.Borders.Top.Val == "single",
				BottomBorder: cell.Props.Borders.Bottom.Val == "single",
				LeftBorder:   cell.Props.Borders.Left.Val == "single",
				RightBorder:  cell.Props.Borders.Right.Val == "single",
				Text:         strings.TrimSpace(cellText),
			})
		}

		// Last row is the pattern row
		if rowIdx == numRows-1 {
			grid.PatternRow = rowCells
		} else {
			grid.ColorRows = append(grid.ColorRows, rowCells)
		}
	}

	return grid
}

func parseColor(hex string) color.RGBA {
	if hex == "" || hex == "auto" {
		return color.RGBA{255, 255, 255, 255}
	}

	if len(hex) == 6 {
		r, _ := strconv.ParseUint(hex[0:2], 16, 8)
		g, _ := strconv.ParseUint(hex[2:4], 16, 8)
		b, _ := strconv.ParseUint(hex[4:6], 16, 8)
		return color.RGBA{uint8(r), uint8(g), uint8(b), 255}
	}

	return color.RGBA{255, 255, 255, 255}
}

func renderGenjiGrid(grid GenjiGrid) ([]byte, error) {
	cellSize := 40
	borderWidth := 2
	textRowHeight := 20 // Smaller height for the pattern row

	// Determine grid dimensions from actual data
	numColorRows := len(grid.ColorRows)
	numCols := 5 // Default to 5 columns
	if numColorRows > 0 && len(grid.ColorRows[0]) > 0 {
		numCols = len(grid.ColorRows[0])
	}

	imgWidth := cellSize*numCols + borderWidth*2
	imgHeight := cellSize*numColorRows + textRowHeight + borderWidth*2

	img := image.NewRGBA(image.Rect(0, 0, imgWidth, imgHeight))

	// Fill with white background
	for y := 0; y < imgHeight; y++ {
		for x := 0; x < imgWidth; x++ {
			img.Set(x, y, color.White)
		}
	}

	// Draw the color rows
	for row := 0; row < numColorRows; row++ {
		for col := 0; col < len(grid.ColorRows[row]); col++ {
			cell := grid.ColorRows[row][col]
			x0 := borderWidth + col*cellSize
			y0 := borderWidth + row*cellSize
			x1 := x0 + cellSize
			y1 := y0 + cellSize

			for y := y0; y < y1; y++ {
				for x := x0; x < x1; x++ {
					img.Set(x, y, cell.Color)
				}
			}

			borderColor := color.RGBA{0, 0, 0, 255}

			if cell.TopBorder {
				for x := x0; x < x1; x++ {
					for b := 0; b < borderWidth; b++ {
						img.Set(x, y0+b, borderColor)
					}
				}
			}
			if cell.BottomBorder {
				for x := x0; x < x1; x++ {
					for b := 0; b < borderWidth; b++ {
						img.Set(x, y1-1-b, borderColor)
					}
				}
			}
			if cell.LeftBorder {
				for y := y0; y < y1; y++ {
					for b := 0; b < borderWidth; b++ {
						img.Set(x0+b, y, borderColor)
					}
				}
			}
			if cell.RightBorder {
				for y := y0; y < y1; y++ {
					for b := 0; b < borderWidth; b++ {
						img.Set(x1-1-b, y, borderColor)
					}
				}
			}
		}
	}

	// Draw the pattern row with text
	patternY := borderWidth + numColorRows*cellSize
	for col := 0; col < len(grid.PatternRow); col++ {
		cell := grid.PatternRow[col]
		x0 := borderWidth + col*cellSize
		// Draw the pattern letter
		if cell.Text != "" {
			drawLetter(img, cell.Text, x0+cellSize/2, patternY+textRowHeight/2)
		}
	}

	// Draw outer border around the color grid only
	borderColor := color.RGBA{0, 0, 0, 255}
	gridBottom := borderWidth + numColorRows*cellSize
	for x := 0; x < imgWidth; x++ {
		for b := 0; b < borderWidth; b++ {
			img.Set(x, b, borderColor)
			img.Set(x, gridBottom-1+b, borderColor)
		}
	}
	for y := 0; y < gridBottom; y++ {
		for b := 0; b < borderWidth; b++ {
			img.Set(b, y, borderColor)
			img.Set(imgWidth-1-b, y, borderColor)
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// drawLetter draws a simple letter at the given center position
func drawLetter(img *image.RGBA, letter string, cx, cy int) {
	textColor := color.RGBA{0, 0, 0, 255}

	// Simple 5x7 bitmap font for A, B, C, D, E
	patterns := map[string][]string{
		"A": {
			" ### ",
			"#   #",
			"#   #",
			"#####",
			"#   #",
			"#   #",
			"#   #",
		},
		"B": {
			"#### ",
			"#   #",
			"#   #",
			"#### ",
			"#   #",
			"#   #",
			"#### ",
		},
		"C": {
			" ####",
			"#    ",
			"#    ",
			"#    ",
			"#    ",
			"#    ",
			" ####",
		},
		"D": {
			"#### ",
			"#   #",
			"#   #",
			"#   #",
			"#   #",
			"#   #",
			"#### ",
		},
		"E": {
			"#####",
			"#    ",
			"#    ",
			"#### ",
			"#    ",
			"#    ",
			"#####",
		},
	}

	pattern, ok := patterns[letter]
	if !ok {
		// For unknown patterns like "Random", draw the text centered
		drawText(img, letter, cx, cy, textColor)
		return
	}

	// Scale factor
	scale := 2
	h := len(pattern) * scale
	w := len(pattern[0]) * scale
	startX := cx - w/2
	startY := cy - h/2

	for row, line := range pattern {
		for col, ch := range line {
			if ch == '#' {
				for sy := 0; sy < scale; sy++ {
					for sx := 0; sx < scale; sx++ {
						img.Set(startX+col*scale+sx, startY+row*scale+sy, textColor)
					}
				}
			}
		}
	}
}

// drawText draws arbitrary text using bitmap letters
func drawText(img *image.RGBA, text string, cx, cy int, textColor color.RGBA) {
	// Simple 5x7 bitmap font for common letters
	patterns := map[rune][]string{
		'R': {
			"#### ",
			"#   #",
			"#   #",
			"#### ",
			"# #  ",
			"#  # ",
			"#   #",
		},
		'a': {
			"     ",
			"     ",
			" ### ",
			"    #",
			" ####",
			"#   #",
			" ####",
		},
		'n': {
			"     ",
			"     ",
			"#### ",
			"#   #",
			"#   #",
			"#   #",
			"#   #",
		},
		'd': {
			"    #",
			"    #",
			" ####",
			"#   #",
			"#   #",
			"#   #",
			" ####",
		},
		'o': {
			"     ",
			"     ",
			" ### ",
			"#   #",
			"#   #",
			"#   #",
			" ### ",
		},
		'm': {
			"     ",
			"     ",
			"## # ",
			"# # #",
			"# # #",
			"#   #",
			"#   #",
		},
	}

	scale := 1
	charWidth := 6 * scale
	totalWidth := len(text) * charWidth
	startX := cx - totalWidth/2

	for i, ch := range text {
		pattern, ok := patterns[ch]
		if !ok {
			continue
		}
		charX := startX + i*charWidth
		charY := cy - (7*scale)/2

		for row, line := range pattern {
			for col, c := range line {
				if c == '#' {
					for sy := 0; sy < scale; sy++ {
						for sx := 0; sx < scale; sx++ {
							img.Set(charX+col*scale+sx, charY+row*scale+sy, textColor)
						}
					}
				}
			}
		}
	}
}

func createMultiPoemDoc(templatePath, outputPath string, poems []Poem, imageDataList [][]byte) error {
	templateReader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer templateReader.Close()

	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer outFile.Close()

	zipWriter := zip.NewWriter(outFile)
	defer zipWriter.Close()

	for _, f := range templateReader.File {
		if f.Name == "word/document.xml" {
			newDoc := generateMultiPoemDocumentXML(poems)
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newDoc)); err != nil {
				return err
			}
		} else if f.Name == "word/_rels/document.xml.rels" {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			newRels := addMultiImageRelationships(string(data), len(imageDataList))
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newRels)); err != nil {
				return err
			}
		} else if f.Name == "[Content_Types].xml" {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			newTypes := addPNGContentType(string(data))
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newTypes)); err != nil {
				return err
			}
		} else {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				rc.Close()
				return err
			}
			if _, err := io.Copy(w, rc); err != nil {
				rc.Close()
				return err
			}
			rc.Close()
		}
	}

	// Add all images
	for i, imgData := range imageDataList {
		imgWriter, err := zipWriter.Create(fmt.Sprintf("word/media/image%d.png", i+1))
		if err != nil {
			return err
		}
		if _, err := io.Copy(imgWriter, bytes.NewReader(imgData)); err != nil {
			return err
		}
	}

	return nil
}

func generateMultiPoemDocumentXML(poems []Poem) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
`)

	// Two blank lines at the top of the file
	sb.WriteString(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
`)

	// Image size at 60%
	imgSize := 1166400 // 1944000 * 0.6

	for i, poem := range poems {
		rId := fmt.Sprintf("rId%d", 10+i)

		// Poem number heading - bold, centered
		sb.WriteString(fmt.Sprintf(`<w:p>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>%02d</w:t></w:r>
</w:p>
`, poem.Number))

		// Image, centered
		sb.WriteString(fmt.Sprintf(`<w:p>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:r>
<w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="%d" cy="%d"/>
<wp:docPr id="%d" name="Genji%d"/>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr>
<pic:cNvPr id="%d" name="genji%d.png"/>
<pic:cNvPicPr/>
</pic:nvPicPr>
<pic:blipFill>
<a:blip r:embed="%s"/>
<a:stretch><a:fillRect/></a:stretch>
</pic:blipFill>
<pic:spPr>
<a:xfrm>
<a:off x="0" y="0"/>
<a:ext cx="%d" cy="%d"/>
</a:xfrm>
<a:prstGeom prst="rect"/>
</pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:inline>
</w:drawing>
</w:r>
</w:p>
`, imgSize, imgSize, i+1, i+1, i+1, i+1, rId, imgSize, imgSize))

		// Blank line after image
		sb.WriteString(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
`)

		// Poem text
		for _, line := range poem.Lines {
			escaped := escapeXML(line)
			sb.WriteString(fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>
`, escaped))
		}

		// Add spacing between poems (except after the last one)
		if i < len(poems)-1 {
			sb.WriteString(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
`)
		}
	}

	sb.WriteString(`<w:sectPr/>
</w:body>
</w:document>`)

	return sb.String()
}

func addMultiImageRelationships(rels string, count int) string {
	var imgRels strings.Builder
	for i := 0; i < count; i++ {
		imgRels.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image%d.png"/>`, 10+i, i+1))
	}
	return strings.Replace(rels, "</Relationships>", imgRels.String()+"</Relationships>", 1)
}

func createPoemDoc(templatePath, outputPath string, poem Poem, imageData []byte) error {
	templateReader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer templateReader.Close()

	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	defer outFile.Close()

	zipWriter := zip.NewWriter(outFile)
	defer zipWriter.Close()

	for _, f := range templateReader.File {
		if f.Name == "word/document.xml" {
			newDoc := generateDocumentXML(poem)
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newDoc)); err != nil {
				return err
			}
		} else if f.Name == "word/_rels/document.xml.rels" {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			newRels := addImageRelationship(string(data))
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newRels)); err != nil {
				return err
			}
		} else if f.Name == "[Content_Types].xml" {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return err
			}
			newTypes := addPNGContentType(string(data))
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				return err
			}
			if _, err := w.Write([]byte(newTypes)); err != nil {
				return err
			}
		} else {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			w, err := zipWriter.Create(f.Name)
			if err != nil {
				rc.Close()
				return err
			}
			if _, err := io.Copy(w, rc); err != nil {
				rc.Close()
				return err
			}
			rc.Close()
		}
	}

	imgWriter, err := zipWriter.Create("word/media/image1.png")
	if err != nil {
		return err
	}
	if _, err := io.Copy(imgWriter, bytes.NewReader(imageData)); err != nil {
		return err
	}

	return nil
}

func generateDocumentXML(poem Poem) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
`)

	// Image first, centered, at 60% size
	imgSize := 1166400 // 1944000 * 0.6
	sb.WriteString(fmt.Sprintf(`<w:p>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:r>
<w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="%d" cy="%d"/>
<wp:docPr id="1" name="Genji"/>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr>
<pic:cNvPr id="1" name="genji.png"/>
<pic:cNvPicPr/>
</pic:nvPicPr>
<pic:blipFill>
<a:blip r:embed="rId10"/>
<a:stretch><a:fillRect/></a:stretch>
</pic:blipFill>
<pic:spPr>
<a:xfrm>
<a:off x="0" y="0"/>
<a:ext cx="%d" cy="%d"/>
</a:xfrm>
<a:prstGeom prst="rect"/>
</pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:inline>
</w:drawing>
</w:r>
</w:p>
`, imgSize, imgSize, imgSize, imgSize))

	// Blank line after image
	sb.WriteString(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr></w:p>
`)

	// Poem text
	for _, line := range poem.Lines {
		escaped := escapeXML(line)
		sb.WriteString(fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="PoetryNormal"/></w:pPr><w:r><w:t>%s</w:t></w:r></w:p>
`, escaped))
	}

	sb.WriteString(`<w:sectPr/>
</w:body>
</w:document>`)

	return sb.String()
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func addImageRelationship(rels string) string {
	imgRel := `<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>`
	return strings.Replace(rels, "</Relationships>", imgRel+"</Relationships>", 1)
}

func addPNGContentType(types string) string {
	// Add PNG content type
	if !strings.Contains(types, "image/png") {
		pngType := `<Default Extension="png" ContentType="image/png"/>`
		types = strings.Replace(types, "</Types>", pngType+"</Types>", 1)
	}
	// Change template content type to document content type
	types = strings.Replace(types,
		"application/vnd.ms-word.template.macroEnabledTemplate.main+xml",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", 1)
	return types
}
