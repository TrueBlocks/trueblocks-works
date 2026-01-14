package app

import "github.com/TrueBlocks/trueblocks-works/v2/internal/models"

func (a *App) Search(query string, limit int) (*models.SearchResponse, error) {
	return a.db.Search(query, limit, a.state.GetShowDeleted())
}
