package app

import (
	"os"
	"path/filepath"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

type WorkUpdateResult struct {
	Work        *models.Work `json:"work"`
	FileMoved   bool         `json:"fileMoved"`
	OldPath     string       `json:"oldPath,omitempty"`
	NewPath     string       `json:"newPath,omitempty"`
	MoveError   string       `json:"moveError,omitempty"`
	CollUpdated bool         `json:"collUpdated"`
}

func (a *App) UpdateWorkWithWorkflow(work *models.Work) (*WorkUpdateResult, error) {
	result := &WorkUpdateResult{Work: work}

	oldWork, err := a.db.GetWork(work.WorkID)
	if err != nil {
		return nil, err
	}

	now := time.Now().Format(time.RFC3339)
	work.AccessDate = &now

	if oldWork.Status != work.Status {
		if err := a.db.UpdateCollectionMembership(work.WorkID, oldWork.Status, work.Status); err != nil {
			return nil, err
		}
		result.CollUpdated = true
	}

	oldGenPath := a.fileOps.GeneratePath(oldWork)
	newGenPath := a.fileOps.GeneratePath(work)

	if oldGenPath != "" && newGenPath != "" && oldGenPath != newGenPath {
		basePath := a.settings.Get().BaseFolderPath
		oldFullPath := filepath.Join(basePath, oldGenPath)
		newFullPath := filepath.Join(basePath, newGenPath)

		if _, err := os.Stat(oldFullPath); err == nil {
			if err := os.MkdirAll(filepath.Dir(newFullPath), 0755); err == nil {
				if err := os.Rename(oldFullPath, newFullPath); err == nil {
					result.FileMoved = true
					result.OldPath = oldFullPath
					result.NewPath = newFullPath
					work.Path = &newGenPath
				} else {
					result.MoveError = err.Error()
				}
			} else {
				result.MoveError = err.Error()
			}
		}
	}

	if _, err := a.db.UpdateWork(work); err != nil {
		return nil, err
	}

	result.Work = work
	return result, nil
}

func (a *App) TouchWorkAccessDate(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return err
	}
	now := time.Now().Format(time.RFC3339)
	work.AccessDate = &now
	if _, err := a.db.UpdateWork(work); err != nil {
		return err
	}
	return nil
}
