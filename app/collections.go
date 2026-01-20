package app

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetCollections() ([]models.CollectionView, error) {
	return a.db.ListCollections(a.state.GetShowDeleted())
}

func (a *App) GetCollection(id int64) (*models.Collection, error) {
	return a.db.GetCollection(id)
}

func (a *App) CreateCollection(coll *models.Collection) (*validation.ValidationResult, error) {
	return a.db.CreateCollection(coll)
}

func (a *App) UpdateCollection(coll *models.Collection) (*validation.ValidationResult, error) {
	return a.db.UpdateCollection(coll)
}

func (a *App) AddWorkToCollection(collID, workID int64) error {
	return a.db.AddWorkToCollection(collID, workID)
}

func (a *App) RemoveWorkFromCollection(collID, workID int64) error {
	return a.db.RemoveWorkFromCollection(collID, workID)
}

func (a *App) GetWorkCollections(workID int64) ([]models.CollectionDetail, error) {
	return a.db.GetWorkCollections(workID)
}

func (a *App) GetCollectionWorks(collID int64) ([]models.CollectionWork, error) {
	return a.db.GetCollectionWorks(collID, a.state.GetShowDeleted())
}

func (a *App) ReorderCollectionWorks(collID int64, workIDs []int64) error {
	return a.db.ReorderCollectionWorks(collID, workIDs)
}

func (a *App) DeleteCollection(id int64) error {
	return a.db.DeleteCollection(id)
}

func (a *App) UndeleteCollection(id int64) (*validation.ValidationResult, error) {
	return a.db.UndeleteCollection(id)
}

func (a *App) GetCollectionDeleteConfirmation(id int64) (*db.DeleteConfirmation, error) {
	return a.db.GetCollectionDeleteConfirmation(id)
}

func (a *App) DeleteCollectionPermanent(id int64) error {
	return a.db.DeleteCollectionPermanent(id)
}

// ExportCollectionFolder exports all files from a collection to a user-selected folder
func (a *App) ExportCollectionFolder(collID int64) (int, error) {
	// Get the collection to get its name
	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return 0, fmt.Errorf("get collection: %w", err)
	}
	if coll == nil {
		return 0, fmt.Errorf("collection not found")
	}

	// Get the last used path as default
	settings := a.settings.Get()
	defaultPath := settings.CollectionExportPath

	// Open folder dialog with ability to create new folders
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Select Export Folder",
		DefaultDirectory:     defaultPath,
		CanCreateDirectories: true,
	})
	if err != nil {
		return 0, err
	}
	if folder == "" {
		// User cancelled
		return 0, nil
	}

	// Save the selected path for next time
	settings.CollectionExportPath = folder
	if err := a.settings.Update(settings); err != nil {
		return 0, fmt.Errorf("save settings: %w", err)
	}

	// Append collection name to the folder path
	exportFolder := filepath.Join(folder, coll.CollectionName)

	// Create the collection subfolder
	if err := os.MkdirAll(exportFolder, 0755); err != nil {
		return 0, fmt.Errorf("create folder %s: %w", exportFolder, err)
	}

	// Get all works in the collection
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return 0, fmt.Errorf("get collection works: %w", err)
	}

	copied := 0
	basePath := a.settings.Get().BaseFolderPath

	for _, work := range works {
		if work.Path == nil || *work.Path == "" {
			continue
		}

		srcPath := *work.Path
		if !filepath.IsAbs(srcPath) {
			srcPath = filepath.Join(basePath, srcPath)
		}

		// Check if source file exists
		if _, err := os.Stat(srcPath); os.IsNotExist(err) {
			continue
		}

		// Get just the filename for the destination
		filename := filepath.Base(srcPath)
		dstPath := filepath.Join(exportFolder, filename)

		// Copy the file
		if err := copyFile(srcPath, dstPath); err != nil {
			return copied, fmt.Errorf("copy %s: %w", filename, err)
		}
		copied++
	}

	return copied, nil
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}
