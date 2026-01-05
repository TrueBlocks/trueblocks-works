package models

// Note stores notes for any entity type (work, journal, submission, collection)
type Note struct {
	ID           int64   `json:"id" db:"id"`
	EntityType   string  `json:"entityType" db:"entity_type"`
	EntityID     int64   `json:"entityID" db:"entity_id"`
	Type         *string `json:"type,omitempty" db:"type"`
	Note         *string `json:"note,omitempty" db:"note"`
	ModifiedDate *string `json:"modifiedDate,omitempty" db:"modified_date"`
	CreatedAt    string  `json:"createdAt" db:"created_at"`
}

// NoteSearchResult represents a note with its parent entity name
type NoteSearchResult struct {
	NoteID     int64   `json:"noteID"`
	EntityType string  `json:"entityType"`
	EntityID   int64   `json:"entityID"`
	EntityName string  `json:"entityName"`
	NoteType   *string `json:"noteType,omitempty"`
	Note       string  `json:"note"`
	CreatedAt  string  `json:"createdAt"`
}
