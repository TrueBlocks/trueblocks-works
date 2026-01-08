package main

import "works/internal/models"

func (a *App) Search(query string, limit int) (*models.SearchResponse, error) {
	return a.db.Search(query, limit, a.state.GetShowDeleted())
}
