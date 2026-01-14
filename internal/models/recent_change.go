package models

// RecentChange represents a recently modified record from any entity type
type RecentChange struct {
	EntityType string `json:"entityType"` // work, organization, submission, note, collection
	EntityID   int64  `json:"entityID"`
	Name       string `json:"name"`
	ModifiedAt string `json:"modifiedAt"`
}
