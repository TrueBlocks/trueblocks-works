package main

import "works/internal/models"

func (a *App) GetCollections() ([]models.Collection, error) {
	return a.db.ListCollections()
}

func (a *App) GetCollection(id int64) (*models.Collection, error) {
	return a.db.GetCollection(id)
}

func (a *App) CreateCollection(coll *models.Collection) error {
	return a.db.CreateCollection(coll)
}

func (a *App) AddWorkToCollection(collID, workID int64, collName string) error {
	return a.db.AddWorkToCollection(collID, workID, collName)
}

func (a *App) RemoveWorkFromCollection(collID, workID int64) error {
	return a.db.RemoveWorkFromCollection(collID, workID)
}

func (a *App) GetWorkCollections(workID int64) ([]models.CollectionDetail, error) {
	return a.db.GetWorkCollections(workID)
}

func (a *App) GetCollectionWorks(collID int64) ([]models.Work, error) {
	return a.db.GetCollectionWorks(collID)
}
