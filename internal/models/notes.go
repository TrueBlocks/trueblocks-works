package models

// Note stores notes for any entity type (work, journal, submission, collection)
type Note struct {
	ID         int64   `json:"id" db:"id"`
	EntityType string  `json:"entityType" db:"entity_type"`
	EntityID   int64   `json:"entityID" db:"entity_id"`
	Type       *string `json:"type,omitempty" db:"type"`
	Note       *string `json:"note,omitempty" db:"note"`
	Attributes string  `json:"attributes" db:"attributes"`
	ModifiedAt *string `json:"modifiedAt,omitempty" db:"modified_at"`
	CreatedAt  string  `json:"createdAt" db:"created_at"`
}

func (n *Note) IsDeleted() bool {
	return IsDeleted(n.Attributes)
}
