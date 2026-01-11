package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"works/internal/fileops"
	"works/internal/models"
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
	Result       ImportResult
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

	// Get file modification time
	fileInfo, err := os.Stat(filename)
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
		if ext == ".docx" || ext == ".txt" || ext == ".md" || ext == ".doc" {
			files = append(files, path)
		}
		return nil
	})

	return files, err
}

func (a *App) AutoImportFiles() (ImportResult, error) {
	files, err := a.ScanImportFolder()
	if err != nil {
		return ImportResult{Status: ImportComplete}, fmt.Errorf("scan import folder: %w", err)
	}

	if len(files) == 0 {
		return ImportResult{Status: ImportComplete}, nil
	}

	timestamp := time.Now().Format("2006-01-02 15-04-05")
	collName := fmt.Sprintf("Imported at %s", timestamp)
	collType := "Import"
	collection := &models.Collection{
		CollectionName: collName,
		Type:           &collType,
	}
	if _, err := a.db.CreateCollection(collection); err != nil {
		return ImportResult{Status: ImportComplete}, fmt.Errorf("create collection: %w", err)
	}

	session := &ImportSession{
		Files:        files,
		CollectionID: collection.CollID,
		CurrentIndex: 0,
		ValidWorks:   []*models.Work{},
		Result: ImportResult{
			Status:       ImportComplete,
			Invalid:      []InvalidFile{},
			CollectionID: collection.CollID,
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
		parsed := fileops.ParseImportFilename(file)

		if !parsed.Valid {
			session.Result.Invalid = append(session.Result.Invalid, InvalidFile{
				Filename: filepath.Base(file),
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
