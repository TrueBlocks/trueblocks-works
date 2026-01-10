package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"works/internal/fileops"
	"works/internal/models"
)

type PathCheckResult struct {
	GeneratedPath string `json:"generatedPath"`
	StoredPath    string `json:"storedPath"`
	Status        string `json:"status"`
	FileExists    bool   `json:"fileExists"`
}

func derefPath(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (a *App) GetWorkFullPath(workID int64) (string, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return "", err
	}
	return a.fileOps.GetFullPath(work), nil
}

func (a *App) GeneratePath(workID int64) (string, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return "", err
	}
	return a.fileOps.GeneratePath(work), nil
}

func (a *App) CheckWorkPath(workID int64) (PathCheckResult, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return PathCheckResult{}, err
	}

	generatedPath := a.fileOps.GeneratePath(work)
	status := a.fileOps.CheckPath(work)
	fullPath := a.fileOps.GetFilename(derefPath(work.Path))

	_, err = fileops.FindFileWithExtension(fullPath)
	exists := err == nil

	return PathCheckResult{
		GeneratedPath: generatedPath,
		StoredPath:    derefPath(work.Path),
		Status:        status,
		FileExists:    exists,
	}, nil
}

func (a *App) OpenDocument(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}
	return a.fileOps.OpenDocument(work)
}

func (a *App) MoveWorkFile(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}

	newPath, err := a.fileOps.MoveFile(work)
	if err != nil {
		return err
	}

	work.Path = &newPath
	return a.db.UpdateWork(work)
}

func (a *App) ExportToSubmissions(workID int64) (string, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return "", err
	}
	return a.fileOps.CopyToSubmissions(work)
}

func (a *App) PrintWork(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}
	return a.fileOps.PrintFile(work)
}

func (a *App) CreateNewWork(title, workType, year, quality, status string) (*models.Work, error) {
	work := &models.Work{
		Title:   title,
		Type:    workType,
		Year:    &year,
		Quality: quality,
		Status:  status,
	}

	path := a.fileOps.GeneratePath(work)
	work.Path = &path

	if err := a.db.CreateWork(work); err != nil {
		return nil, err
	}

	if err := a.fileOps.CreateWorkFile(work); err != nil {
		return work, err
	}

	docPath, err := fileops.FindFileWithExtension(a.fileOps.GetFullPath(work))
	if err == nil {
		_, _ = a.fileOps.GeneratePDF(docPath, work.WorkID)
	}

	defaultColl, err := a.db.GetOrCreateDefaultCollection()
	if err == nil && defaultColl != nil {
		_ = a.db.AddWorkToCollection(defaultColl.CollID, work.WorkID)
	}

	return work, nil
}

func (a *App) GetFileConfig() fileops.Config {
	return a.fileOps.Config
}

func (a *App) CheckLibreOffice() bool {
	return a.fileOps.CheckLibreOffice()
}

func (a *App) GetPreviewURL(workID int64) (string, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return "", err
	}

	pdfFilename := fmt.Sprintf("%d.pdf", workID)
	pdfPath := filepath.Join(a.fileOps.Config.PDFPreviewPath, pdfFilename)

	docPath, docErr := fileops.FindFileWithExtension(a.fileOps.GetFilename(derefPath(work.Path)))
	if docErr == nil {
		pdfPath, err = a.fileOps.GetPreviewPath(work.WorkID, docPath)
		if err != nil {
			existingPdf := filepath.Join(a.fileOps.Config.PDFPreviewPath, pdfFilename)
			if fileops.FileExists(existingPdf) {
				pdfPath = existingPdf
			} else {
				return "", err
			}
		}
	} else {
		if !fileops.FileExists(pdfPath) {
			return "", fmt.Errorf("file not found and no preview available")
		}
	}

	filename := filepath.Base(pdfPath)
	// Add timestamp to prevent browser caching
	fileInfo, _ := os.Stat(pdfPath)
	timestamp := time.Now().Unix()
	if fileInfo != nil {
		timestamp = fileInfo.ModTime().Unix()
	}
	return fmt.Sprintf("http://127.0.0.1:%d/pdf/%s?t=%d", a.fileServer.Port(), filename, timestamp), nil
}

func (a *App) RegeneratePDF(workID int64) (string, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return "", err
	}

	docPath, err := fileops.FindFileWithExtension(a.fileOps.GetFilename(derefPath(work.Path)))
	if err != nil {
		return "", err
	}

	pdfPath, err := a.fileOps.GeneratePDF(docPath, work.WorkID)
	if err != nil {
		return "", err
	}

	filename := filepath.Base(pdfPath)
	// Add current timestamp to force browser to reload the PDF
	return fmt.Sprintf("http://127.0.0.1:%d/pdf/%s?t=%d", a.fileServer.Port(), filename, time.Now().Unix()), nil
}

type FileModTimes struct {
	DocxPath    string `json:"docxPath"`
	DocxModTime string `json:"docxModTime"`
	PdfPath     string `json:"pdfPath"`
	PdfModTime  string `json:"pdfModTime"`
	DocxIsNewer bool   `json:"docxIsNewer"`
	DocxExists  bool   `json:"docxExists"`
	PdfExists   bool   `json:"pdfExists"`
}

func (a *App) GetFileModTimes(workID int64) (FileModTimes, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return FileModTimes{}, err
	}

	result := FileModTimes{}

	// Get docx file path and mod time
	docPath, docErr := fileops.FindFileWithExtension(a.fileOps.GetFilename(derefPath(work.Path)))
	if docErr == nil {
		result.DocxPath = docPath
		result.DocxExists = true
		if info, err := fileops.GetFileInfo(docPath); err == nil {
			result.DocxModTime = info.ModTime().Format("2006-01-02 15:04:05")
		}
	}

	// Get PDF file path and mod time
	pdfFilename := fmt.Sprintf("%d.pdf", workID)
	pdfPath := filepath.Join(a.fileOps.Config.PDFPreviewPath, pdfFilename)
	if fileops.FileExists(pdfPath) {
		result.PdfPath = pdfPath
		result.PdfExists = true
		if info, err := fileops.GetFileInfo(pdfPath); err == nil {
			result.PdfModTime = info.ModTime().Format("2006-01-02 15:04:05")
		}
	}

	// Compare modification times if both exist
	if result.DocxExists && result.PdfExists {
		docInfo, _ := fileops.GetFileInfo(docPath)
		pdfInfo, _ := fileops.GetFileInfo(pdfPath)
		result.DocxIsNewer = docInfo.ModTime().After(pdfInfo.ModTime())
	}

	return result, nil
}
