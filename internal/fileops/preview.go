package fileops

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

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

func (f *FileOps) GeneratePDF(docPath string, workID int64) (string, error) {
	pdfPath := filepath.Join(f.Config.PDFPreviewPath, fmt.Sprintf("%d.pdf", workID))

	if err := os.MkdirAll(f.Config.PDFPreviewPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create previews directory: %w", err)
	}

	soffice := f.GetSofficePath()
	cmd := exec.Command(soffice,
		"--headless",
		"--convert-to", "pdf",
		"--outdir", f.Config.PDFPreviewPath,
		docPath,
	)

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("PDF conversion failed: %w", err)
	}

	baseName := filepath.Base(docPath)
	baseName = baseName[:len(baseName)-len(filepath.Ext(baseName))] + ".pdf"
	tempPath := filepath.Join(f.Config.PDFPreviewPath, baseName)

	if tempPath != pdfPath {
		if err := os.Rename(tempPath, pdfPath); err != nil {
			return "", fmt.Errorf("failed to rename PDF: %w", err)
		}
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
