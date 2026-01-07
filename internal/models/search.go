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

type ParsedQuery struct {
	Terms        []string `json:"terms"`
	Phrases      []string `json:"phrases"`
	Exclusions   []string `json:"exclusions"`
	EntityFilter []string `json:"entityFilter"`
	RawQuery     string   `json:"rawQuery"`
}

type SearchResponse struct {
	Results     []SearchResult `json:"results"`
	ParsedQuery ParsedQuery    `json:"parsedQuery"`
}
