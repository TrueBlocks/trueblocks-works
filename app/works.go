package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

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
	return a.db.CreateWork(work)
}

func (a *App) UpdateWork(work *models.Work) (*validation.ValidationResult, error) {
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
