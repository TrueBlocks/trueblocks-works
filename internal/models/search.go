package models

type SearchResult struct {
	EntityType       string  `json:"entityType"`
	EntityID         int64   `json:"entityID"`
	Title            string  `json:"title"`
	Subtitle         string  `json:"subtitle,omitempty"`
	Snippet          string  `json:"snippet,omitempty"`
	Rank             float64 `json:"rank"`
	ParentEntityType string  `json:"parentEntityType,omitempty"`
	ParentEntityID   int64   `json:"parentEntityID,omitempty"`
}
