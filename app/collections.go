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
	isSmart, err := a.db.IsSmartCollection(collID)
	if err != nil {
		return fmt.Errorf("check smart collection: %w", err)
	}
	if isSmart {
		return fmt.Errorf("cannot add works to a smart collection")
	}
	return a.db.AddWorkToCollection(collID, workID)
}

func (a *App) RemoveWorkFromCollection(collID, workID int64) error {
	isSmart, err := a.db.IsSmartCollection(collID)
	if err != nil {
		return fmt.Errorf("check smart collection: %w", err)
	}
	if isSmart {
		return fmt.Errorf("cannot remove works from a smart collection")
	}
	return a.db.RemoveWorkFromCollection(collID, workID)
}

func (a *App) GetWorkCollections(workID int64) ([]models.CollectionDetail, error) {
	return a.db.GetWorkCollections(workID)
}

func (a *App) GetCollectionWorks(collID int64) ([]models.CollectionWork, error) {
	return a.db.GetCollectionWorks(collID, a.state.GetShowDeleted())
}

func (a *App) ReorderCollectionWorks(collID int64, workIDs []int64) error {
	isSmart, err := a.db.IsSmartCollection(collID)
	if err != nil {
		return fmt.Errorf("check smart collection: %w", err)
	}
	if isSmart {
		return fmt.Errorf("cannot reorder works in a smart collection")
	}
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

// ToggleCollectionMarks toggles the marked state of all works in a collection.
// If any works are marked, all works are unmarked.
// If no works are marked, all works are marked.
// Returns true if works are now marked, false if unmarked.
func (a *App) ToggleCollectionMarks(collID int64) (bool, error) {
	works, err := a.db.GetCollectionWorks(collID, a.state.GetShowDeleted())
	if err != nil {
		return false, fmt.Errorf("get collection works: %w", err)
	}

	if len(works) == 0 {
		return false, nil
	}

	var markedCount int
	workIDs := make([]int64, 0, len(works))
	for _, w := range works {
		workIDs = append(workIDs, w.WorkID)
		if w.IsMarked {
			markedCount++
		}
	}

	newMarkedValue := 1
	if markedCount > 0 {
		newMarkedValue = 0
	}

	for _, workID := range workIDs {
		_, err = a.db.Conn().Exec(`UPDATE Works SET is_marked = ? WHERE workID = ?`, newMarkedValue, workID)
		if err != nil {
			return false, fmt.Errorf("update mark for work %d: %w", workID, err)
		}
	}

	return newMarkedValue == 1, nil
}

// GetCollectionHasMarkedWorks checks if any works in the collection are marked.
func (a *App) GetCollectionHasMarkedWorks(collID int64) (bool, error) {
	works, err := a.db.GetCollectionWorks(collID, a.state.GetShowDeleted())
	if err != nil {
		return false, fmt.Errorf("get collection works: %w", err)
	}
	for _, w := range works {
		if w.IsMarked {
			return true, nil
		}
	}
	return false, nil
}

// ToggleCollectionSuppressed toggles the suppressed state of all works in a collection.
// If any works are suppressed, all works are unsuppressed.
// If no works are suppressed, all works are suppressed.
// Returns true if works are now suppressed, false if unsuppressed.
// Smart collections do not support suppression.
func (a *App) ToggleCollectionSuppressed(collID int64) (bool, error) {
	isSmart, err := a.db.IsSmartCollection(collID)
	if err != nil {
		return false, fmt.Errorf("check smart collection: %w", err)
	}
	if isSmart {
		return false, fmt.Errorf("cannot toggle suppression in a smart collection")
	}

	var suppressedCount int
	err = a.db.Conn().QueryRow(`
		SELECT COUNT(*) FROM CollectionDetails
		WHERE collID = ? AND COALESCE(is_suppressed, 0) = 1
	`, collID).Scan(&suppressedCount)
	if err != nil {
		return false, fmt.Errorf("count suppressed works: %w", err)
	}

	newSuppressedValue := 1
	if suppressedCount > 0 {
		newSuppressedValue = 0
	}

	_, err = a.db.Conn().Exec(`
		UPDATE CollectionDetails SET is_suppressed = ?
		WHERE collID = ?
	`, newSuppressedValue, collID)
	if err != nil {
		return false, fmt.Errorf("update suppressed: %w", err)
	}

	return newSuppressedValue == 1, nil
}

// GetCollectionHasSuppressedWorks checks if any works in the collection are suppressed.
// Smart collections always return false.
func (a *App) GetCollectionHasSuppressedWorks(collID int64) (bool, error) {
	isSmart, err := a.db.IsSmartCollection(collID)
	if err != nil {
		return false, fmt.Errorf("check smart collection: %w", err)
	}
	if isSmart {
		return false, nil
	}

	var suppressedCount int
	err = a.db.Conn().QueryRow(`
		SELECT COUNT(*) FROM CollectionDetails
		WHERE collID = ? AND COALESCE(is_suppressed, 0) = 1
	`, collID).Scan(&suppressedCount)
	if err != nil {
		return false, fmt.Errorf("count suppressed works: %w", err)
	}
	return suppressedCount > 0, nil
}

// GetMarkedWorksInCollection returns work IDs and titles for all marked works in a collection.
type MarkedWorkInfo struct {
	WorkID int64  `json:"workID"`
	Title  string `json:"title"`
	Path   string `json:"path"`
}

func (a *App) GetMarkedWorksInCollection(collID int64) ([]MarkedWorkInfo, error) {
	works, err := a.db.GetCollectionWorks(collID, a.state.GetShowDeleted())
	if err != nil {
		return nil, fmt.Errorf("get collection works: %w", err)
	}
	var marked []MarkedWorkInfo
	for _, w := range works {
		if w.IsMarked {
			// Get full path using fileOps
			fullPath := ""
			if w.Path != nil && *w.Path != "" {
				fullPath = a.fileOps.GetFilename(*w.Path)
			}
			marked = append(marked, MarkedWorkInfo{
				WorkID: w.WorkID,
				Title:  w.Title,
				Path:   fullPath,
			})
		}
	}
	return marked, nil
}
