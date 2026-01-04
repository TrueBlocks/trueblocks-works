package main

import "works/internal/models"

func (a *App) Search(query string, limit int) ([]models.SearchResult, error) {
	return a.db.Search(query, limit)
}
