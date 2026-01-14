package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

func (a *App) GetNotes(entityType string, entityID int64) ([]models.Note, error) {
	return a.db.GetNotes(entityType, entityID, a.state.GetShowDeleted())
}

func (a *App) CreateNote(note *models.Note) (*validation.ValidationResult, error) {
	return a.db.CreateNote(note)
}

func (a *App) UpdateNote(note *models.Note) (*validation.ValidationResult, error) {
	return a.db.UpdateNote(note)
}

func (a *App) DeleteNote(id int64) error {
	return a.db.DeleteNote(id)
}

func (a *App) UndeleteNote(id int64) error {
	return a.db.UndeleteNote(id)
}

func (a *App) DeleteNotePermanent(id int64) error {
	return a.db.DeleteNotePermanent(id)
}
