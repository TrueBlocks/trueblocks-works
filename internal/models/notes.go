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
