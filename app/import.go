package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

type ConflictType string

const (
	NoConflict    ConflictType = "none"
	Reimport      ConflictType = "reimport"
	DuplicatePath ConflictType = "duplicate_path"
)

type ImportConflict struct {
	Type         ConflictType `json:"type"`
	ExistingWork *models.Work `json:"existingWork,omitempty"`
}

type InvalidFile struct {
	Filename string   `json:"filename"`
	Errors   []string `json:"errors"`
}

type ImportStatus string

const (
	ImportComplete  ImportStatus = "complete"
	ImportNeedsType ImportStatus = "needs_type"
	ImportCancelled ImportStatus = "cancelled"
)

type ImportResult struct {
	Status       ImportStatus  `json:"status"`
	Imported     int           `json:"imported"`
	Updated      int           `json:"updated"`
	Invalid      []InvalidFile `json:"invalid"`
	CollectionID int64         `json:"collectionID"`
	UnknownType  string        `json:"unknownType,omitempty"`
	CurrentFile  string        `json:"currentFile,omitempty"`
}

type ImportSession struct {
	Files        []string
	CollectionID int64
	CurrentIndex int
	ValidWorks   []*models.Work
	EditMap      map[string]FileEdit
	Result       ImportResult
}

type FilePreview struct {
	Filename string   `json:"filename"`
	Title    string   `json:"title,omitempty"`
	Type     string   `json:"type,omitempty"`
	Year     string   `json:"year,omitempty"`
	Quality  string   `json:"quality,omitempty"`
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors,omitempty"`
}

type FileEdit struct {
	Filename string `json:"filename"`
	Title    string `json:"title"`
	Type     string `json:"type"`
	Year     string `json:"year"`
	Quality  string `json:"quality"`
}

type ImportPreview struct {
	Files       []FilePreview  `json:"files"`
	TotalCount  int            `json:"totalCount"`
	ValidCount  int            `json:"validCount"`
	ByExtension map[string]int `json:"byExtension"`
}

func (a *App) CheckImportConflict(sourcePath string) (ImportConflict, error) {
	existingBySource, err := a.db.GetWorkByPath(sourcePath)
	if err != nil {
		return ImportConflict{}, fmt.Errorf("check path: %w", err)
	}
	if existingBySource != nil {
		// Check if file has been modified since last import
		fileInfo, err := os.Stat(sourcePath)
		if err != nil {
			return ImportConflict{}, fmt.Errorf("stat file: %w", err)
		}
		fileMtime := fileInfo.ModTime().Unix()

		// Only reimport if file is newer than stored mtime
		if existingBySource.FileMtime != nil && fileMtime <= *existingBySource.FileMtime {
			return ImportConflict{Type: NoConflict}, nil // Skip unchanged file
		}

		return ImportConflict{
			Type:         Reimport,
			ExistingWork: existingBySource,
		}, nil
	}

	return ImportConflict{Type: NoConflict}, nil
}

func (a *App) ImportWork(filename string, parsed fileops.ParsedFilename) (*models.Work, error) {
	conflict, err := a.CheckImportConflict(filename)
	if err != nil {
		return nil, err
	}

	// Convert to absolute path
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return nil, fmt.Errorf("get absolute path: %w", err)
	}

	// Convert markdown to docx if needed
	if strings.ToLower(parsed.Extension) == "md" {
		docxPath, err := a.convertMarkdownToDocx(absPath, parsed)
		if err != nil {
			return nil, fmt.Errorf("convert markdown to docx: %w", err)
		}
		absPath = docxPath
		parsed.Extension = "docx"
	}

	// Get file modification time
	fileInfo, err := os.Stat(absPath)
	if err != nil {
		return nil, fmt.Errorf("stat file: %w", err)
	}
	fileMtime := fileInfo.ModTime().Unix()

	year := parsed.Year
	work := &models.Work{
		Title:     parsed.Title,
		Type:      parsed.Type,
		Year:      &year,
		Quality:   parsed.Quality,
		Status:    "Gestating",
		DocType:   parsed.Extension,
		Path:      &absPath,
		FileMtime: &fileMtime,
	}

	if conflict.Type == Reimport {
		work.WorkID = conflict.ExistingWork.WorkID
		work.CreatedAt = conflict.ExistingWork.CreatedAt
		if _, err := a.db.UpdateWork(work); err != nil {
			return nil, fmt.Errorf("update work: %w", err)
		}
		return work, nil
	}

	if _, err := a.db.CreateWork(work); err != nil {
		return nil, fmt.Errorf("create work: %w", err)
	}

	return work, nil
}

func (a *App) convertMarkdownToDocx(mdPath string, _ fileops.ParsedFilename) (string, error) {
	// Check if pandoc is available
	pandocPath, err := exec.LookPath("pandoc")
	if err != nil {
		return "", fmt.Errorf("pandoc not found: install with 'brew install pandoc'")
	}

	// Create docx in same folder as markdown, with same base name
	dir := filepath.Dir(mdPath)
	baseName := strings.TrimSuffix(filepath.Base(mdPath), filepath.Ext(mdPath))
	destPath := filepath.Join(dir, baseName+".docx")

	// Build pandoc command with reference-doc for Word styles
	args := []string{"-f", "markdown", "-t", "docx", "-o", destPath}

	// Use Word's Normal.dotm template for consistent styling
	home, _ := os.UserHomeDir()
	normalDotm := filepath.Join(home, "Library", "Group Containers", "UBF8T346G9.Office",
		"User Content", "Templates", "Normal.dotm")
	if _, err := os.Stat(normalDotm); err == nil {
		args = append(args, "--reference-doc="+normalDotm)
	}

	args = append(args, mdPath)

	// Convert using pandoc
	cmd := exec.Command(pandocPath, args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pandoc conversion failed: %w (output: %s)", err, string(output))
	}

	// Remove the original markdown file
	if err := os.Remove(mdPath); err != nil {
		// Log but don't fail - the docx was created successfully
		_ = err
	}

	return destPath, nil
}

func (a *App) ScanImportFolder() ([]string, error) {
	importPath := filepath.Join("imports", "files")

	if _, err := os.Stat(importPath); os.IsNotExist(err) {
		return []string{}, nil
	}

	var files []string
	err := filepath.Walk(importPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if a.settings.IsValidExtension(ext) {
			files = append(files, path)
		}
		return nil
	})

	return files, err
}

func (a *App) PreviewImportFiles() (ImportPreview, error) {
	files, err := a.ScanImportFolder()
	if err != nil {
		return ImportPreview{}, fmt.Errorf("scan import folder: %w", err)
	}

	preview := ImportPreview{
		Files:       []FilePreview{},
		TotalCount:  len(files),
		ValidCount:  0,
		ByExtension: make(map[string]int),
	}

	types, _ := a.GetDistinctValues("Works", "type")

	for _, file := range files {
		parsed := fileops.ParseImportFilename(file, types)
		ext := strings.ToLower(filepath.Ext(file))
		preview.ByExtension[ext]++

		fp := FilePreview{
			Filename: filepath.Base(file),
			Title:    parsed.Title,
			Type:     parsed.Type,
			Year:     parsed.Year,
			Quality:  parsed.Quality,
			Valid:    parsed.Valid,
			Errors:   parsed.Errors,
		}
		preview.Files = append(preview.Files, fp)

		if parsed.Valid {
			preview.ValidCount++
		}
	}

	return preview, nil
}

func (a *App) AutoImportFiles(collectionID int64) (ImportResult, error) {
	return a.AutoImportFilesWithEdits(collectionID, nil)
}

func (a *App) AutoImportFilesWithEdits(collectionID int64, edits []FileEdit) (ImportResult, error) {
	files, err := a.ScanImportFolder()
	if err != nil {
		return ImportResult{Status: ImportComplete}, fmt.Errorf("scan import folder: %w", err)
	}

	if len(files) == 0 {
		return ImportResult{Status: ImportComplete}, nil
	}

	// Build edit lookup map
	editMap := make(map[string]FileEdit)
	for _, edit := range edits {
		editMap[edit.Filename] = edit
	}

	// If collectionID is 0, use the default "New Works" collection
	var targetCollID int64
	if collectionID == 0 {
		collection, err := a.db.GetOrCreateDefaultCollection()
		if err != nil {
			return ImportResult{Status: ImportComplete}, fmt.Errorf("get new works collection: %w", err)
		}
		targetCollID = collection.CollID
	} else {
		targetCollID = collectionID
	}

	session := &ImportSession{
		Files:        files,
		CollectionID: targetCollID,
		CurrentIndex: 0,
		ValidWorks:   []*models.Work{},
		EditMap:      editMap,
		Result: ImportResult{
			Status:       ImportComplete,
			Invalid:      []InvalidFile{},
			CollectionID: targetCollID,
		},
	}

	a.importSession = session
	return a.continueImport()
}

func (a *App) AddTypeAndContinue(newType string) (ImportResult, error) {
	if a.importSession == nil {
		return ImportResult{Status: ImportCancelled}, fmt.Errorf("no active import session")
	}

	// Add a dummy work with the new type to persist it
	dummyWork := &models.Work{
		Title:   fmt.Sprintf("_type_placeholder_%s", newType),
		Type:    newType,
		Status:  "Gestating",
		Quality: "Unknown",
		DocType: "txt",
	}
	dummyWork.Attributes = models.MarkDeleted("")

	if _, err := a.db.CreateWork(dummyWork); err != nil {
		return ImportResult{Status: ImportCancelled}, fmt.Errorf("add type: %w", err)
	}

	// Immediately delete the dummy work (but the type is now in the database)
	_ = a.db.DeleteWork(dummyWork.WorkID)

	return a.continueImport()
}

func (a *App) CancelImport() error {
	if a.importSession == nil {
		return nil
	}
	a.importSession = nil
	return nil
}

func (a *App) continueImport() (ImportResult, error) {
	session := a.importSession
	if session == nil {
		return ImportResult{Status: ImportCancelled}, fmt.Errorf("no active import session")
	}

	types, _ := a.GetDistinctValues("Works", "type")
	typeMap := make(map[string]bool)
	for _, t := range types {
		typeMap[t] = true
	}

	for i := session.CurrentIndex; i < len(session.Files); i++ {
		file := session.Files[i]
		filename := filepath.Base(file)
		parsed := fileops.ParseImportFilename(file, types)

		// Apply user edits if available
		if edit, ok := session.EditMap[filename]; ok {
			if edit.Title != "" {
				parsed.Title = edit.Title
			}
			if edit.Type != "" {
				parsed.Type = edit.Type
			}
			if edit.Year != "" {
				parsed.Year = edit.Year
			}
			if edit.Quality != "" {
				parsed.Quality = edit.Quality
			}
			// Re-validate after applying edits
			parsed.Valid = parsed.Title != "" && parsed.Type != "" && parsed.Year != "" && parsed.Quality != ""
			parsed.Errors = nil
		}

		if !parsed.Valid {
			session.Result.Invalid = append(session.Result.Invalid, InvalidFile{
				Filename: filename,
				Errors:   parsed.Errors,
			})
			continue
		}

		// Check if type exists
		if !typeMap[parsed.Type] {
			session.CurrentIndex = i
			session.Result.Status = ImportNeedsType
			session.Result.UnknownType = parsed.Type
			session.Result.CurrentFile = filepath.Base(file)
			return session.Result, nil
		}

		work, err := a.ImportWork(file, parsed)
		if err != nil {
			session.Result.Invalid = append(session.Result.Invalid, InvalidFile{
				Filename: filepath.Base(file),
				Errors:   []string{err.Error()},
			})
			continue
		}

		session.ValidWorks = append(session.ValidWorks, work)

		if work.CreatedAt == work.ModifiedAt {
			session.Result.Imported++
		} else {
			session.Result.Updated++
		}
	}

	// Import complete - add all works to collection
	for _, work := range session.ValidWorks {
		_ = a.db.AddWorkToCollection(session.CollectionID, work.WorkID)
	}

	session.Result.Status = ImportComplete
	result := session.Result
	a.importSession = nil
	return result, nil
}
