package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

func (a *App) GetBook(id int64) (*models.Book, error) {
	return a.db.GetBook(id)
}

func (a *App) GetBookByCollection(collID int64) (*models.Book, error) {
	return a.db.GetBookByCollection(collID)
}

func (a *App) CreateBook(book *models.Book) error {
	return a.db.CreateBook(book)
}

func (a *App) UpdateBook(book *models.Book) error {
	return a.db.UpdateBook(book)
}

func (a *App) DeleteBook(id int64) error {
	return a.db.DeleteBook(id)
}

func (a *App) SetCollectionIsBook(collID int64, isBook bool) error {
	return a.db.SetCollectionIsBook(collID, isBook)
}

func (a *App) GetCollectionIsBook(collID int64) (bool, error) {
	return a.db.GetCollectionIsBook(collID)
}
