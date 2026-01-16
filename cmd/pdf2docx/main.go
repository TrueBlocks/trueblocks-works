package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	sourceDir := os.ExpandEnv("$HOME/Documents/Home/100 Articles/Supporting/cArticle - 2014 - J Presper Eckert")
	ocrDir := filepath.Join(sourceDir, "ocr")
	docsDir := filepath.Join(sourceDir, "docs")

	if err := os.MkdirAll(ocrDir, 0755); err != nil {
		fmt.Printf("Error creating ocr directory: %v\n", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(docsDir, 0755); err != nil {
		fmt.Printf("Error creating docs directory: %v\n", err)
		os.Exit(1)
	}

	entries, err := os.ReadDir(sourceDir)
	if err != nil {
		fmt.Printf("Error reading directory: %v\n", err)
		os.Exit(1)
	}

	var pdfFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".pdf") {
			pdfFiles = append(pdfFiles, filepath.Join(sourceDir, entry.Name()))
		}
	}

	fmt.Printf("Found %d PDF files to convert\n", len(pdfFiles))
	fmt.Printf("OCR output:  %s\n", ocrDir)
	fmt.Printf("DOCX output: %s\n\n", docsDir)

	reader := bufio.NewReader(os.Stdin)
	successCount := 0
	failCount := 0
	skipCount := 0
	batchRemaining := 0

	for i, pdfPath := range pdfFiles {
		baseName := strings.TrimSuffix(filepath.Base(pdfPath), ".pdf")
		docxPath := filepath.Join(docsDir, baseName+".docx")

		if _, err := os.Stat(docxPath); err == nil {
			fmt.Printf("[%d/%d] SKIP (exists): %s.docx\n", i+1, len(pdfFiles), baseName)
			skipCount++
			continue
		}

		fmt.Printf("[%d/%d] Converting: %s\n", i+1, len(pdfFiles), baseName)

		if err := convertPDF(pdfPath, docxPath, ocrDir); err != nil {
			fmt.Printf("         ERROR: %v\n", err)
			failCount++
		} else {
			fmt.Printf("         SUCCESS: %s.docx\n", baseName)
			successCount++
		}

		if batchRemaining > 0 {
			batchRemaining--
			continue
		}

		fmt.Print("\nPress Enter to continue, '5' for 5 more, or 'q' to quit: ")
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(strings.ToLower(input))
		if input == "q" {
			fmt.Println("\nQuitting...")
			break
		} else if input == "5" {
			batchRemaining = 4
		}
	}

	fmt.Printf("\n=== Summary ===\n")
	fmt.Printf("Converted: %d\n", successCount)
	fmt.Printf("Failed:    %d\n", failCount)
	fmt.Printf("Skipped:   %d\n", skipCount)
	fmt.Printf("\nDOCX files are in: %s\n", docsDir)
}

func convertPDF(pdfPath, docxPath, ocrDir string) error {
	baseName := filepath.Base(pdfPath)
	ocrPDF := filepath.Join(ocrDir, baseName)

	if _, err := os.Stat(ocrPDF); os.IsNotExist(err) {
		fmt.Printf("         Step 1: OCR...\n")
		cmd := exec.Command("ocrmypdf",
			"--force-ocr",
			"--optimize", "0",
			"--output-type", "pdf",
			pdfPath,
			ocrPDF,
		)
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("OCR failed: %v: %s", err, string(output))
		}
	} else {
		fmt.Printf("         Step 1: OCR (cached)\n")
	}

	txtFile := ocrPDF + ".txt"
	fmt.Printf("         Step 2: Extract text...\n")
	cmd := exec.Command("pdftotext", "-layout", ocrPDF, txtFile)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("text extraction failed: %v: %s", err, string(output))
	}

	fmt.Printf("         Step 3: Create DOCX...\n")
	cmd = exec.Command("pandoc", txtFile, "-o", docxPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		os.Remove(txtFile)
		return fmt.Errorf("pandoc failed: %v: %s", err, string(output))
	}

	os.Remove(txtFile)

	if _, err := os.Stat(docxPath); os.IsNotExist(err) {
		return fmt.Errorf("output file was not created")
	}

	return nil
}
