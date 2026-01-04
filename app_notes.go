package main

import "works/internal/models"

func (a *App) GetWorkNotes(workID int64) ([]models.WorkNote, error) {
	return a.db.GetWorkNotes(workID)
}

func (a *App) CreateWorkNote(note *models.WorkNote) error {
	return a.db.CreateWorkNote(note)
}

func (a *App) UpdateWorkNote(note *models.WorkNote) error {
	return a.db.UpdateWorkNote(note)
}

func (a *App) DeleteWorkNote(id int64) error {
	return a.db.DeleteWorkNote(id)
}

func (a *App) GetJournalNotes(orgID int64) ([]models.JournalNote, error) {
	return a.db.GetJournalNotes(orgID)
}

func (a *App) CreateJournalNote(note *models.JournalNote) error {
	return a.db.CreateJournalNote(note)
}

func (a *App) UpdateJournalNote(note *models.JournalNote) error {
	return a.db.UpdateJournalNote(note)
}

func (a *App) DeleteJournalNote(id int64) error {
	return a.db.DeleteJournalNote(id)
}

func (a *App) SearchNotesByText(searchText string) ([]models.NoteSearchResult, error) {
	return a.db.SearchNotesByText(searchText)
}
