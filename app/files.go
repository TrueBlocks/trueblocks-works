package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"

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

func (a *App) GetPDFPageSize(workID int64) (string, error) {
	pdfFilename := fmt.Sprintf("%d.pdf", workID)
	pdfPath := filepath.Join(a.fileOps.Config.PDFPreviewPath, pdfFilename)

	if !fileops.FileExists(pdfPath) {
		return "", nil
	}

	f, err := os.Open(pdfPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	conf := model.NewDefaultConfiguration()
	info, err := api.PDFInfo(f, pdfPath, nil, false, conf)
	if err != nil {
		return "", err
	}

	if len(info.PageDimensions) == 0 {
		return "", nil
	}

	for dim := range info.PageDimensions {
		inches := dim.ToInches()
		return fmt.Sprintf("%sx%s", formatInches(inches.Width), formatInches(inches.Height)), nil
	}

	return "", nil
}

// GetBatchPDFPageSizes returns page sizes for multiple works as a map.
// Works without PDFs or with errors are omitted from the result.
func (a *App) GetBatchPDFPageSizes(workIDs []int64) map[int64]string {
	result := make(map[int64]string)
	for _, id := range workIDs {
		size, err := a.GetPDFPageSize(id)
		if err == nil && size != "" {
			result[id] = size
		}
	}
	return result
}

func formatInches(v float64) string {
	if v == float64(int(v)) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.1f", v)
}

// BatchRevealInFinder opens the parent folder containing the work files.
// If files are in multiple folders, opens each unique parent folder.
func (a *App) BatchRevealInFinder(paths []string) (int, error) {
	if len(paths) == 0 {
		return 0, nil
	}

	// Collect unique parent directories
	parents := make(map[string]bool)
	for _, p := range paths {
		if p == "" {
			continue
		}
		parent := filepath.Dir(p)
		parents[parent] = true
	}

	opened := 0
	for parent := range parents {
		if err := exec.Command("open", parent).Run(); err != nil {
			continue
		}
		opened++
	}
	return opened, nil
}

// BatchBackupWorks backs up multiple works and returns the count of successful backups.
func (a *App) BatchBackupWorks(workIDs []int64) (int, error) {
	backed := 0
	for _, id := range workIDs {
		work, err := a.db.GetWork(id)
		if err != nil {
			continue
		}
		if work.Path == nil || *work.Path == "" {
			continue
		}
		if err := a.fileOps.BackupWork(*work.Path); err != nil {
			continue
		}
		backed++
	}
	return backed, nil
}

// BatchMoveResult contains the counts from a batch move operation.
type BatchMoveResult struct {
	Moved   int `json:"moved"`
	Skipped int `json:"skipped"`
	Failed  int `json:"failed"`
}

// BatchMoveMarkedFiles moves files for all marked works that have path mismatches.
// Works already at their generated path are skipped.
func (a *App) BatchMoveMarkedFiles(workIDs []int64) (*BatchMoveResult, error) {
	result := &BatchMoveResult{}

	for _, id := range workIDs {
		work, err := a.db.GetWork(id)
		if err != nil {
			result.Failed++
			continue
		}

		// Skip if no path
		if work.Path == nil || *work.Path == "" {
			result.Skipped++
			continue
		}

		// Check if path matches generated path
		generatedPath := a.fileOps.GeneratePath(work)
		if *work.Path == generatedPath {
			result.Skipped++
			continue
		}

		// Check if source file exists
		fullPath := a.fileOps.GetFilename(*work.Path)
		if _, err := fileops.FindFileWithExtension(fullPath); err != nil {
			result.Skipped++ // File doesn't exist, nothing to move
			continue
		}

		// Move the file
		newPath, err := a.fileOps.MoveFile(work)
		if err != nil {
			result.Failed++
			continue
		}

		// Update the database
		work.Path = &newPath
		if _, err := a.db.UpdateWork(work); err != nil {
			result.Failed++
			continue
		}

		result.Moved++
	}

	return result, nil
}
