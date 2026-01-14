package db

import (
	"fmt"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

// GetRecentlyChanged returns recently modified records across all entity types,
// sorted by modification date descending.
func (db *DB) GetRecentlyChanged(limit int) ([]models.RecentChange, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT entity_type, entity_id, name, modified_at FROM (
			SELECT 'work' as entity_type, workID as entity_id, title as name, modified_at
			FROM Works WHERE modified_at IS NOT NULL
			UNION ALL
			SELECT 'organization', orgID, name, modified_at
			FROM Organizations WHERE modified_at IS NOT NULL
			UNION ALL
			SELECT 'submission', submissionID, 
				(SELECT title FROM Works WHERE workID = s.workID) as name, modified_at
			FROM Submissions s WHERE modified_at IS NOT NULL
			UNION ALL
			SELECT 'note', id, SUBSTR(COALESCE(note, ''), 1, 50) as name, modified_at
			FROM Notes WHERE modified_at IS NOT NULL
			UNION ALL
			SELECT 'collection', collID, collection_name as name, modified_at
			FROM Collections WHERE modified_at IS NOT NULL
		)
		ORDER BY datetime(modified_at) DESC
		LIMIT ?
	`

	rows, err := db.conn.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("query recent changes: %w", err)
	}
	defer rows.Close()

	var changes []models.RecentChange
	for rows.Next() {
		var c models.RecentChange
		var name *string
		if err := rows.Scan(&c.EntityType, &c.EntityID, &name, &c.ModifiedAt); err != nil {
			return nil, fmt.Errorf("scan recent change: %w", err)
		}
		if name != nil {
			c.Name = *name
		} else {
			c.Name = "(unnamed)"
		}
		changes = append(changes, c)
	}

	return changes, rows.Err()
}
