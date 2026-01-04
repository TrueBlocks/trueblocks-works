package models

// WorkNote stores notes, critiques, and history for individual works
type WorkNote struct {
	ID           int64   `json:"id" db:"id"`
	WorkID       int64   `json:"workID" db:"workID"`
	Type         *string `json:"type,omitempty" db:"type"`
	Note         *string `json:"note,omitempty" db:"note"`
	ModifiedDate *string `json:"modifiedDate,omitempty" db:"modified_date"`
	CreatedAt    string  `json:"createdAt" db:"created_at"`
}

// JournalNote stores notes about organizations/journals
type JournalNote struct {
	ID           int64   `json:"id" db:"id"`
	OrgID        int64   `json:"orgID" db:"orgID"`
	Type         *string `json:"type,omitempty" db:"type"`
	Note         *string `json:"note,omitempty" db:"note"`
	ModifiedDate *string `json:"modifiedDate,omitempty" db:"modified_date"`
	CreatedAt    string  `json:"createdAt" db:"created_at"`
}

// NoteSearchResult represents a note from either works or journals
type NoteSearchResult struct {
	NoteID     int64   `json:"noteID"`
	EntityType string  `json:"entityType"`
	EntityID   int64   `json:"entityID"`
	EntityName string  `json:"entityName"`
	NoteType   *string `json:"noteType,omitempty"`
	Note       string  `json:"note"`
	CreatedAt  string  `json:"createdAt"`
}
