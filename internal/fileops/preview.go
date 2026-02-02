package fileops

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func (f *FileOps) CheckWord() bool {
	return FileExists("/Applications/Microsoft Word.app")
}

func (f *FileOps) CheckLibreOffice() bool {
	paths := []string{
		"/Applications/LibreOffice.app/Contents/MacOS/soffice",
		"/usr/local/bin/soffice",
		"/usr/bin/soffice",
	}
	for _, p := range paths {
		if FileExists(p) {
			return true
		}
	}

	_, err := exec.LookPath("soffice")
	return err == nil
}

func (f *FileOps) GetSofficePath() string {
	macPath := "/Applications/LibreOffice.app/Contents/MacOS/soffice"
	if FileExists(macPath) {
		return macPath
	}

	path, err := exec.LookPath("soffice")
	if err == nil {
		return path
	}

	return "soffice"
}

func (f *FileOps) NeedsRegeneration(docPath string, workID int64) bool {
	pdfPath := filepath.Join(f.Config.PDFPreviewPath, fmt.Sprintf("%d.pdf", workID))

	pdfInfo, err := os.Stat(pdfPath)
	if os.IsNotExist(err) {
		return true
	}

	docInfo, err := os.Stat(docPath)
	if err != nil {
		return false
	}

	return docInfo.ModTime().After(pdfInfo.ModTime())
}

func (f *FileOps) generatePDFWithWord(docPath string, pdfPath string) error {
	script := fmt.Sprintf(`
tell application "Microsoft Word"
	set wasRunning to running
	set docWasOpen to false
	
	-- Check if document is already open
	if wasRunning then
		try
			set docList to every document
			repeat with d in docList
				try
					set docPath to POSIX path of (get full name of d)
					if docPath is "%s" then
						set docWasOpen to true
						set theDoc to d
						exit repeat
					end if
				end try
			end repeat
		end try
	end if
	
	-- Only open if not already open
	if not docWasOpen then
		set theDoc to open POSIX file "%s"
	end if
	
	-- Save as PDF (uses current markup settings - All Markup with inline revisions)
	save as theDoc file name POSIX file "%s" file format format PDF
	
	-- Only close if we opened it
	if not docWasOpen then
		close theDoc saving no
	end if
	
	if not wasRunning then
		quit
	end if
end tell
`, docPath, docPath, pdfPath)

	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("PDF conversion failed: %w (output: %s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

// func (f *FileOps) generatePDFWithLibreOffice(docPath string, pdfPath string) error {
// 	soffice := f.GetSofficePath()
// 	cmd := exec.Command(soffice,
// 		"--headless",
// 		"--convert-to", "pdf",
// 		"--outdir", f.Config.PDFPreviewPath,
// 		docPath,
// 	)

// 	if err := cmd.Run(); err != nil {
// 		return fmt.Errorf("LibreOffice PDF conversion failed: %w", err)
// 	}

// 	baseName := filepath.Base(docPath)
// 	baseName = baseName[:len(baseName)-len(filepath.Ext(baseName))] + ".pdf"
// 	tempPath := filepath.Join(f.Config.PDFPreviewPath, baseName)

// 	if _, err := os.Stat(tempPath); err != nil {
// 		return fmt.Errorf("PDF conversion succeeded but output file not found at %s: %w", tempPath, err)
// 	}

// 	if tempPath != pdfPath {
// 		if err := os.Rename(tempPath, pdfPath); err != nil {
// 			return fmt.Errorf("failed to rename PDF from %s to %s: %w", tempPath, pdfPath, err)
// 		}
// 	}

// 	return nil
// }

func (f *FileOps) CheckExcel() bool {
	return FileExists("/Applications/Microsoft Excel.app")
}

func (f *FileOps) generatePDFWithExcel(docPath string, pdfPath string) error {
	script := fmt.Sprintf(`
tell application "Microsoft Excel"
	set wasRunning to running
	set docWasOpen to false
	
	-- Check if workbook is already open
	if wasRunning then
		try
			set wbList to every workbook
			repeat with wb in wbList
				try
					set wbPath to POSIX path of (get full name of wb)
					if wbPath is "%s" then
						set docWasOpen to true
						set theWorkbook to wb
						exit repeat
					end if
				end try
			end repeat
		end try
	end if
	
	-- Only open if not already open
	if not docWasOpen then
		set theWorkbook to open POSIX file "%s"
	end if
	
	-- Save as PDF
	save theWorkbook in POSIX file "%s" as PDF file format
	
	-- Only close if we opened it
	if not docWasOpen then
		close theWorkbook saving no
	end if
	
	if not wasRunning then
		quit
	end if
end tell
`, docPath, docPath, pdfPath)

	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("excel PDF conversion failed: %w (output: %s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

// isExcelFile returns true if the file is an Excel spreadsheet
func isExcelFile(docPath string) bool {
	ext := strings.ToLower(filepath.Ext(docPath))
	return ext == ".xls" || ext == ".xlsx"
}

// isWordFile returns true if the file can be opened by Word
func isWordFile(docPath string) bool {
	ext := strings.ToLower(filepath.Ext(docPath))
	wordExtensions := map[string]bool{
		".doc":  true,
		".docx": true,
		".rtf":  true,
		".txt":  true,
		".odt":  true,
	}
	return wordExtensions[ext]
}

// CanGeneratePDF returns true if the file type can be converted to PDF
func (f *FileOps) CanGeneratePDF(docPath string) bool {
	return isWordFile(docPath) || isExcelFile(docPath)
}

func (f *FileOps) GeneratePDF(docPath string, workID int64) (string, error) {
	// Check if this file type can be converted
	if !f.CanGeneratePDF(docPath) {
		ext := filepath.Ext(docPath)
		return "", fmt.Errorf("cannot generate PDF preview for %s files", ext)
	}

	pdfPath := filepath.Join(f.Config.PDFPreviewPath, fmt.Sprintf("%d.pdf", workID))

	if err := os.MkdirAll(f.Config.PDFPreviewPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create previews directory: %w", err)
	}

	_ = os.Remove(pdfPath)

	// Use Excel for spreadsheets
	if isExcelFile(docPath) {
		if !f.CheckExcel() {
			return "", fmt.Errorf("MS Excel not found at /Applications/Microsoft Excel.app")
		}
		if err := f.generatePDFWithExcel(docPath, pdfPath); err != nil {
			return "", err
		}
		return pdfPath, nil
	}

	// Use Word for documents
	if !f.CheckWord() {
		return "", fmt.Errorf("MS Word not found at /Applications/Microsoft Word.app")
	}

	if err := f.generatePDFWithWord(docPath, pdfPath); err != nil {
		return "", err
	}

	return pdfPath, nil
}

func (f *FileOps) GetPreviewPath(workID int64, docPath string) (string, error) {
	pdfPath := filepath.Join(f.Config.PDFPreviewPath, fmt.Sprintf("%d.pdf", workID))

	if f.NeedsRegeneration(docPath, workID) {
		generatedPath, err := f.GeneratePDF(docPath, workID)
		if err != nil {
			if FileExists(pdfPath) {
				return pdfPath, nil
			}
			return "", fmt.Errorf("no preview available")
		}
		return generatedPath, nil
	}

	if !FileExists(pdfPath) {
		return "", fmt.Errorf("no preview available")
	}

	return pdfPath, nil
}

func (f *FileOps) GetNoPreviewPath() string {
	return filepath.Join(f.Config.PDFPreviewPath, "0000 NoPreview.pdf")
}
