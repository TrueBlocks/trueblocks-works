package db

import (
	"fmt"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

// validateCollection validates a Collection entity
func (db *DB) validateCollection(c *models.Collection) validation.ValidationResult {
	result := validation.ValidationResult{}

	// Required fields
	result.AddIfError(validation.Required(c.CollectionName, "collectionName"))

	// Field constraints
	result.AddIfError(validation.MaxLength(c.CollectionName, 200, "collectionName"))

	// Check for duplicate name (only if required fields are present)
	if result.IsValid() {
		matches, err := db.FindCollectionsByName(c.CollectionName)
		if err != nil {
			result.AddError("collectionName", "Error checking for duplicates: "+err.Error())
		} else {
			// Filter out the collection being validated (if it has an ID)
			for _, match := range matches {
				if match.CollID != c.CollID {
					result.AddError("collectionName", "A collection with this name already exists")
					break
				}
			}
		}
	}

	return result
}

// FindCollectionsByName finds all non-deleted collections with the given name
func (db *DB) FindCollectionsByName(name string) ([]models.Collection, error) {
	query := `SELECT collID, collection_name, type, attributes,
		created_at, modified_at
		FROM Collections WHERE collection_name = ?` + andNotDeleted

	rows, err := db.conn.Query(query, name)
	if err != nil {
		return nil, fmt.Errorf("query collections by name: %w", err)
	}
	defer rows.Close()

	var collections []models.Collection
	for rows.Next() {
		var c models.Collection
		err := rows.Scan(
			&c.CollID, &c.CollectionName, &c.Type, &c.Attributes,
			&c.CreatedAt, &c.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan collection: %w", err)
		}
		collections = append(collections, c)
	}

	return collections, rows.Err()
}
