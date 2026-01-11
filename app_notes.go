package main

import (
	"works/internal/models"
	"works/internal/validation"
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
