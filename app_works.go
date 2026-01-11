package main

import (
	"works/internal/db"
	"works/internal/models"
	"works/internal/validation"
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
	return a.db.GetWorkDeleteConfirmation(id)
}

func (a *App) DeleteWorkPermanent(id int64) error {
	return a.db.DeleteWorkPermanent(id)
}
