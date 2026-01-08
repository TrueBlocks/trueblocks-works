package main

import "works/internal/models"

func (a *App) GetWorks() ([]models.WorkView, error) {
	return a.db.ListWorks(a.state.GetShowDeleted())
}

func (a *App) GetWork(id int64) (*models.Work, error) {
	return a.db.GetWork(id)
}

func (a *App) CreateWork(work *models.Work) error {
	return a.db.CreateWork(work)
}

func (a *App) UpdateWork(work *models.Work) error {
	return a.db.UpdateWork(work)
}

func (a *App) DeleteWork(id int64) error {
	return a.db.DeleteWork(id)
}

func (a *App) UndeleteWork(id int64) error {
	return a.db.UndeleteWork(id)
}
