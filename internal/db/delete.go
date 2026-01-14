package db

// DeleteConfirmation contains information about what will be deleted
// when permanently deleting an entity
type DeleteConfirmation struct {
	EntityType      string `json:"entityType"`      // "work", "organization", "collection", "submission"
	EntityName      string `json:"entityName"`      // Display name of the entity
	NoteCount       int    `json:"noteCount"`       // Number of notes that will be deleted
	SubmissionCount int    `json:"submissionCount"` // Number of submissions (for works/orgs only)
	CollectionCount int    `json:"collectionCount"` // Number of collections work belongs to (for works only)
	HasFile         bool   `json:"hasFile"`         // Whether the work has an underlying document file
	FilePath        string `json:"filePath"`        // Path to the file (if HasFile is true)
}
