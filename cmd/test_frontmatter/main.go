package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

func main() {
	templatePath := os.ExpandEnv("$HOME/.works/templates/book-template.dotm")
	docxPath := "/tmp/test_frontmatter.docx"
	pdfPath := "/tmp/test_frontmatter.pdf"

	subtitle := "A Subtitle for Testing"
	copyright := "Copyright © 2026 Test Author\nAll rights reserved."
	dedication := "For everyone who tests their code"

	book := &models.Book{
		Title:      "Test Book Title",
		Subtitle:   &subtitle,
		Author:     "Test Author",
		Copyright:  &copyright,
		Dedication: &dedication,
	}

	fmt.Println("Creating front matter DOCX...")
	if err := bookbuild.CreateFrontMatterDocx(book, templatePath, docxPath); err != nil {
		fmt.Printf("Error creating docx: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Created: %s\n", docxPath)

	fmt.Println("Converting to PDF...")
	if err := bookbuild.ConvertDocxToPDF(docxPath, pdfPath); err != nil {
		fmt.Printf("Error converting to PDF: %v\n", err)
		fmt.Println("Opening DOCX to verify it was created correctly...")
		cmd := exec.Command("open", docxPath)
		_ = cmd.Run()
		os.Exit(1)
	}

	fmt.Printf("Success! Created: %s\n", pdfPath)
	fmt.Println("Opening PDF...")

	cmd := exec.Command("open", pdfPath)
	_ = cmd.Run()
}
