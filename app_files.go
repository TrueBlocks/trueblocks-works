package main

import (
	"fmt"
	"path/filepath"

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
	exists := fileops.FileExists(fullPath) ||
		fileops.FileExists(fullPath+".rtf") ||
		fileops.FileExists(fullPath+".docx") ||
		fileops.FileExists(fullPath+".txt")

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

func (a *App) UpdateWorkPathToGenerated(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}

	generatedPath := a.fileOps.GeneratePath(work)
	work.Path = &generatedPath
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

	docPath, err := fileops.FindFileWithExtension(a.fileOps.GetFilename(derefPath(work.Path)))
	if err != nil {
		return "", fmt.Errorf("file not found: %w", err)
	}

	pdfPath, err := a.fileOps.GetPreviewPath(work.WorkID, docPath)
	if err != nil {
		return "", err
	}

	filename := filepath.Base(pdfPath)
	return fmt.Sprintf("http://127.0.0.1:%d/pdf/%s", a.fileServer.Port(), filename), nil
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
	return fmt.Sprintf("http://127.0.0.1:%d/pdf/%s", a.fileServer.Port(), filename), nil
}
