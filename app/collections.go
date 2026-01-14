package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
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
