package db

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

// validateNote validates a Note entity
func (db *DB) validateNote(n *models.Note) validation.ValidationResult {
	result := validation.ValidationResult{}

	// Required fields
	result.AddIfError(validation.Required(n.EntityType, "entityType"))
	if n.EntityID <= 0 {
		result.AddError("entityID", "entityID is required")
	}

	// Validate EntityID exists in the referenced table
	if n.EntityID > 0 && n.EntityType != "" {
		var exists bool
		var err error

		switch n.EntityType {
		case "work":
			work, werr := db.GetWork(n.EntityID)
			err = werr
			exists = (work != nil && err == nil)
		case "journal":
			org, oerr := db.GetOrganization(n.EntityID)
			err = oerr
			exists = (org != nil && err == nil)
		case "submission":
			sub, serr := db.GetSubmission(n.EntityID)
			err = serr
			exists = (sub != nil && err == nil)
		case "collection":
			coll, cerr := db.GetCollection(n.EntityID)
			err = cerr
			exists = (coll != nil && err == nil)
		default:
			result.AddError("entityType", "Invalid entity type: "+n.EntityType)
		}

		if err != nil {
			result.AddError("entityID", "Error validating entityID: "+err.Error())
		} else if !exists {
			result.AddError("entityID", "Referenced entity does not exist")
		}
	}

	return result
}
