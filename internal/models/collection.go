package models

// Collection represents a grouping/category for organizing works
type Collection struct {
	CollID         int64   `json:"collID" db:"collID"`
	CollectionName string  `json:"collectionName" db:"collection_name"`
	Type           *string `json:"type,omitempty" db:"type"`
	Attributes     string  `json:"attributes" db:"attributes"`
	CreatedAt      string  `json:"createdAt" db:"created_at"`
	ModifiedAt     string  `json:"modifiedAt" db:"modified_at"`
	IsBook         bool    `json:"isBook" db:"is_book"`
}

// CollectionView extends Collection with computed fields
type CollectionView struct {
	Collection
	IsDeleted bool `json:"isDeleted"`
	NItems    int  `json:"nItems" db:"n_items"`
}

// CollectionDetail is the join table between Collections and Works
type CollectionDetail struct {
	ID             int64   `json:"id" db:"id"`
	CollID         int64   `json:"collID" db:"collID"`
	WorkID         int64   `json:"workID" db:"workID"`
	Position       int64   `json:"position" db:"position"`
	CollectionName *string `json:"collectionName,omitempty" db:"collection_name"`
}

// CollectionWork represents a Work with its position in a collection
type CollectionWork struct {
	Work
	Position int64 `json:"position" db:"position"`
	IsMarked bool  `json:"isMarked" db:"is_marked"`
}

func (c *Collection) IsDeleted() bool {
	return IsDeleted(c.Attributes)
}
