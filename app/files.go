package app

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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
	runtime.LogDebugf(a.ctx, "OpenDocument called for workID: %d", workID)
	work, err := a.db.GetWork(workID)
	if err != nil {
		runtime.LogErrorf(a.ctx, "GetWork failed: %v", err)
		return err
	}
	runtime.LogInfof(a.ctx, "Opening document: %s (path: %s)", work.Title, *work.Path)
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
	if _, err := a.db.UpdateWork(work); err != nil {
		return err
	}
	return nil
}

func (a *App) GetSupportingInfo(workID int64) (fileops.SupportingInfo, error) {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return fileops.SupportingInfo{}, err
	}
	if work.Path == nil || *work.Path == "" {
		return fileops.SupportingInfo{Exists: false}, nil
	}
	return a.fileOps.GetSupportingInfo(*work.Path), nil
}

func (a *App) OpenSupportingItem(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}
	if work.Path == nil || *work.Path == "" {
		return fmt.Errorf("work has no path")
	}
	return a.fileOps.OpenSupportingItem(*work.Path)
}

func (a *App) BackupWork(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}
	if work.Path == nil || *work.Path == "" {
		return fmt.Errorf("work has no path")
	}
	return a.fileOps.BackupWork(*work.Path)
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
	runtime.LogDebugf(a.ctx, "CreateNewWork: title=%s type=%s year=%s", title, workType, year)

	work := &models.Work{
		Title:   title,
		Type:    workType,
		Year:    &year,
		Quality: quality,
		Status:  status,
	}

	path := a.fileOps.GeneratePath(work)
	work.Path = &path
	runtime.LogDebugf(a.ctx, "Generated path (without extension): %s", path)

	// Validate and create work in database
	validResult, err := a.db.CreateWork(work)
	if err != nil {
		runtime.LogErrorf(a.ctx, "CreateWork failed: %v", err)
		return nil, err
	}
	if !validResult.IsValid() {
		runtime.LogErrorf(a.ctx, "CreateWork validation failed: %v", validResult.Errors)
		return nil, fmt.Errorf("validation failed: %v", validResult.Errors)
	}
	runtime.LogDebugf(a.ctx, "Work created in database with ID: %d", work.WorkID)

	// Create the file
	runtime.LogDebugf(a.ctx, "Creating work file...")
	if err := a.fileOps.CreateWorkFile(work); err != nil {
		runtime.LogErrorf(a.ctx, "CreateWorkFile failed: %v", err)
		// Rollback: delete the work from database
		_ = a.DeleteWorkPermanent(work.WorkID, false)
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	runtime.LogDebugf(a.ctx, "Work file created successfully")

	// Verify file exists
	fullPath := a.fileOps.GetFullPath(work)
	if filepath.Ext(fullPath) == "" {
		fullPath = fullPath + ".docx"
	}
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		runtime.LogErrorf(a.ctx, "File was not created at expected path: %s", fullPath)
		_ = a.DeleteWorkPermanent(work.WorkID, false)
		return nil, fmt.Errorf("file not created at %s", fullPath)
	}
	runtime.LogInfof(a.ctx, "File verified to exist at: %s", fullPath)

	// Update the work's path to include the .docx extension (if not already present)
	pathWithExt := *work.Path
	if filepath.Ext(pathWithExt) == "" {
		pathWithExt = pathWithExt + ".docx"
	}
	work.Path = &pathWithExt
	runtime.LogDebugf(a.ctx, "Updating work path to include extension: %s", pathWithExt)
	_, err = a.db.UpdateWork(work)
	if err != nil {
		runtime.LogErrorf(a.ctx, "UpdateWork path failed: %v", err)
		return nil, fmt.Errorf("failed to update work path: %w", err)
	}

	docPath, err := fileops.FindFileWithExtension(a.fileOps.GetFullPath(work))
	if err == nil {
		runtime.LogDebugf(a.ctx, "Generating PDF...")
		_, _ = a.fileOps.GeneratePDF(docPath, work.WorkID)
	} else {
		runtime.LogWarningf(a.ctx, "Could not find file for PDF generation: %v", err)
	}

	// Add to default collection
	runtime.LogDebugf(a.ctx, "Getting or creating 'New Works' collection...")
	defaultColl, err := a.db.GetOrCreateDefaultCollection()
	if err != nil {
		runtime.LogErrorf(a.ctx, "GetOrCreateDefaultCollection failed: %v", err)
	} else if defaultColl == nil {
		runtime.LogWarningf(a.ctx, "GetOrCreateDefaultCollection returned nil collection")
	} else {
		runtime.LogInfof(a.ctx, "Adding work to collection '%s' (ID: %d)", defaultColl.CollectionName, defaultColl.CollID)
		err = a.db.AddWorkToCollection(defaultColl.CollID, work.WorkID)
		if err != nil {
			runtime.LogErrorf(a.ctx, "AddWorkToCollection failed: %v", err)
		} else {
			runtime.LogInfof(a.ctx, "Successfully added work to collection")
		}
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
