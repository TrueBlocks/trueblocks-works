package app

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

const statusPublished = "Published"

func (a *App) GetWorks() ([]models.WorkView, error) {
	works, err := a.db.ListWorks(a.state.GetShowDeleted())
	if err != nil {
		return nil, err
	}
	// Populate NeedsMove field for each work
	for i := range works {
		pathStatus := a.fileOps.CheckPath(&works[i].Work)
		works[i].NeedsMove = pathStatus == "name changed"
	}
	return works, nil
}

func (a *App) GetWork(id int64) (*models.Work, error) {
	return a.db.GetWork(id)
}

func (a *App) CreateWork(work *models.Work) (*validation.ValidationResult, error) {
	// Check for duplicate path before creating
	genPath := a.fileOps.GeneratePath(work)
	if genPath != "" {
		if duplicate := a.findWorkWithPath(genPath, 0); duplicate != nil {
			result := &validation.ValidationResult{}
			result.AddError("duplicate", "A work with this title, type, and year already exists")
			return result, nil
		}
	}
	return a.db.CreateWork(work)
}

func (a *App) UpdateWork(work *models.Work) (*validation.ValidationResult, error) {
	// Check for duplicate path before updating
	genPath := a.fileOps.GeneratePath(work)
	if genPath != "" {
		if duplicate := a.findWorkWithPath(genPath, work.WorkID); duplicate != nil {
			result := &validation.ValidationResult{}
			result.AddError("duplicate", "A work with this title, type, and year already exists")
			return result, nil
		}
	}

	// Get the existing work to detect status transitions
	existing, err := a.db.GetWork(work.WorkID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		// Transition TO Published: save quality, set to "Published"
		if work.Status == statusPublished && existing.Status != statusPublished {
			work.QualityAtPublish = &work.Quality
			work.Quality = statusPublished
		}
		// Transition FROM Published: restore quality, clear qualityAtPublish
		if work.Status != statusPublished && existing.Status == statusPublished {
			if existing.QualityAtPublish != nil && *existing.QualityAtPublish != "" {
				work.Quality = *existing.QualityAtPublish
			}
			work.QualityAtPublish = nil
		}

		// If type changed to/from Section, recalculate part_ids for all affected collections
		if work.Type != existing.Type && (work.Type == "Section" || existing.Type == "Section") {
			a.recalculatePartIDsForWork(work.WorkID)
		}
	}
	return a.db.UpdateWork(work)
}

func (a *App) DeleteWork(id int64) error {
	return a.db.DeleteWork(id)
}

func (a *App) UndeleteWork(id int64) (*validation.ValidationResult, error) {
	return a.db.UndeleteWork(id)
}

func (a *App) GetWorkDeleteConfirmation(id int64) (*db.DeleteConfirmation, error) {
	conf, err := a.db.GetWorkDeleteConfirmation(id)
	if err != nil {
		return nil, err
	}

	work, err := a.db.GetWork(id)
	if err != nil {
		return nil, err
	}

	if work.Path != nil && *work.Path != "" {
		filePath, fileErr := a.fileOps.FindWorkFile(work)
		if fileErr == nil && filePath != "" {
			conf.HasFile = true
			conf.FilePath = filePath
		}
	}

	return conf, nil
}

func (a *App) DeleteWorkPermanent(id int64, archiveDocument bool) error {
	work, err := a.db.GetWork(id)
	if err != nil {
		return err
	}

	if archiveDocument {
		if err := a.fileOps.ArchiveToTrash(work); err != nil {
			return err
		}
	} else if work.Path != nil && *work.Path != "" {
		if err := a.fileOps.DeleteSupportingItem(*work.Path); err != nil {
			return err
		}
	}
	return a.db.DeleteWorkPermanent(id)
}

// findWorkWithPath finds a non-deleted work that would have the given generated path,
// excluding the work with excludeID (use 0 for new works)
func (a *App) findWorkWithPath(path string, excludeID int64) *models.Work {
	works, err := a.db.ListWorks(false) // non-deleted only
	if err != nil {
		return nil
	}
	for _, w := range works {
		if w.WorkID == excludeID {
			continue
		}
		if a.fileOps.GeneratePath(&w.Work) == path {
			return &w.Work
		}
	}
	return nil
}

// recalculatePartIDsForWork recalculates part_ids for all collections containing the work.
// Called when a work's type changes to/from Section.
func (a *App) recalculatePartIDsForWork(workID int64) {
	collections, err := a.db.GetWorkCollections(workID)
	if err != nil {
		return
	}
	for _, coll := range collections {
		_ = a.db.RecalculatePartIDs(coll.CollID)
	}
}

// BatchUpdateWorkField updates a single field for multiple works.
// Only whitelisted fields are allowed to prevent SQL injection.
func (a *App) BatchUpdateWorkField(workIDs []int64, field string, value string) (int, error) {
	allowedFields := map[string]string{
		"status":  "status",
		"type":    "type",
		"quality": "quality",
		"docType": "doc_type",
	}
	dbField, ok := allowedFields[field]
	if !ok {
		return 0, fmt.Errorf("field %q is not allowed for batch update", field)
	}
	if len(workIDs) == 0 {
		return 0, nil
	}

	updated := 0
	for _, id := range workIDs {
		query := fmt.Sprintf("UPDATE Works SET %s = ? WHERE workID = ?", dbField)
		_, err := a.db.Conn().Exec(query, value, id)
		if err != nil {
			return updated, fmt.Errorf("update work %d: %w", id, err)
		}
		updated++
	}
	return updated, nil
}

// DuplicateWork creates a copy of a work with a unique title.
// It copies all fields, the underlying file, and collection memberships.
// Returns the new work ID.
func (a *App) DuplicateWork(workID int64) (int64, error) {
	// Get the original work
	original, err := a.db.GetWork(workID)
	if err != nil {
		return 0, fmt.Errorf("get original work: %w", err)
	}
	if original == nil {
		return 0, fmt.Errorf("work %d not found", workID)
	}

	// Generate a unique title
	newTitle := a.generateUniqueCopyTitle(original.Title)

	// Create the new work (copy all fields except system ones)
	newWork := &models.Work{
		Title:            newTitle,
		Type:             original.Type,
		Year:             original.Year,
		Status:           original.Status,
		Quality:          original.Quality,
		QualityAtPublish: original.QualityAtPublish,
		DocType:          original.DocType,
		Draft:            original.Draft,
		NWords:           original.NWords,
		CourseName:       original.CourseName,
		Attributes:       "", // Reset attributes (not deleted)
		// Path will be set after we know the generated path
	}

	// Create the work record first to get the ID
	_, err = a.db.CreateWork(newWork)
	if err != nil {
		return 0, fmt.Errorf("create duplicate work: %w", err)
	}

	// Get the generated path for the new work
	newGenPath := a.fileOps.GeneratePath(newWork)
	newWork.Path = &newGenPath

	// Update the work with the path
	_, err = a.db.UpdateWork(newWork)
	if err != nil {
		return 0, fmt.Errorf("update duplicate work path: %w", err)
	}

	// Copy the underlying file if it exists
	if original.Path != nil && *original.Path != "" {
		srcFile, findErr := a.fileOps.FindWorkFile(original)
		if findErr == nil && srcFile != "" {
			destPath := a.fileOps.GetFullPath(newWork)
			if copyErr := a.copyFile(srcFile, destPath); copyErr != nil {
				// Log but don't fail - the work was created, file copy is optional
				// The user can manually copy or create the file
				_ = copyErr
			}
		}
	}

	// Get the original work's collections and add the duplicate to them
	collections, err := a.db.GetWorkCollections(workID)
	if err == nil {
		for _, coll := range collections {
			_ = a.db.AddWorkToCollection(coll.CollID, newWork.WorkID)
		}
	}

	return newWork.WorkID, nil
}

// generateUniqueCopyTitle generates a unique copy title.
// "My Work" -> "My Work copy" -> "My Work copy 2" -> "My Work copy 3"
func (a *App) generateUniqueCopyTitle(originalTitle string) string {
	// Check if the title already ends with " copy" or " copy N"
	copyPattern := regexp.MustCompile(`^(.+?) copy( \d+)?$`)
	matches := copyPattern.FindStringSubmatch(originalTitle)

	var baseTitle string
	if matches != nil {
		baseTitle = matches[1]
	} else {
		baseTitle = originalTitle
	}

	// Try "baseTitle copy" first
	candidate := baseTitle + " copy"
	if !a.titleExists(candidate) {
		return candidate
	}

	// Try "baseTitle copy 2", "baseTitle copy 3", etc.
	for n := 2; n < 1000; n++ {
		candidate = fmt.Sprintf("%s copy %d", baseTitle, n)
		if !a.titleExists(candidate) {
			return candidate
		}
	}

	// Fallback - shouldn't happen in practice
	return baseTitle + " copy"
}

// titleExists checks if a work with the given title exists (non-deleted)
func (a *App) titleExists(title string) bool {
	title = strings.TrimSpace(title)
	works, err := a.db.ListWorks(false)
	if err != nil {
		return false
	}
	for _, w := range works {
		if strings.TrimSpace(w.Title) == title {
			return true
		}
	}
	return false
}

// copyFile copies a file from src to dest, creating directories as needed
func (a *App) copyFile(src, dest string) error {
	// Create destination directory if it doesn't exist
	destDir := filepath.Dir(dest)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}

	srcFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer srcFile.Close()

	destFile, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("create destination: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, srcFile); err != nil {
		return fmt.Errorf("copy content: %w", err)
	}

	return destFile.Sync()
}
