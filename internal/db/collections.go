package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

const excludeDeletedFilter = ` AND (w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')`

func (db *DB) CreateCollection(c *models.Collection) (*validation.ValidationResult, error) {
	// Validate the collection
	result := db.validateCollection(c)
	if !result.IsValid() {
		return &result, nil
	}

	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Collections (
		collection_name, type, attributes, created_at, modified_at
	) VALUES (?, ?, ?, ?, ?)`

	sqlResult, err := db.conn.Exec(query,
		c.CollectionName, c.Type, c.Attributes, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert collection: %w", err)
	}

	id, err := sqlResult.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get last insert id: %w", err)
	}
	c.CollID = id
	c.CreatedAt = now
	c.ModifiedAt = now
	return &result, nil
}

func (db *DB) GetCollection(id int64) (*models.Collection, error) {
	query := `SELECT collID, collection_name, type, attributes,
		created_at, modified_at, is_book, smart_query
		FROM Collections WHERE collID = ?`

	c := &models.Collection{}
	err := db.conn.QueryRow(query, id).Scan(
		&c.CollID, &c.CollectionName, &c.Type, &c.Attributes,
		&c.CreatedAt, &c.ModifiedAt, &c.IsBook, &c.SmartQuery,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query collection: %w", err)
	}
	return c, nil
}

func (db *DB) GetSmartQuery(collID int64) (*string, error) {
	var smartQuery *string
	err := db.conn.QueryRow(`SELECT smart_query FROM Collections WHERE collID = ?`, collID).Scan(&smartQuery)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get smart query: %w", err)
	}
	return smartQuery, nil
}

func (db *DB) IsSmartCollection(collID int64) (bool, error) {
	sq, err := db.GetSmartQuery(collID)
	if err != nil {
		return false, err
	}
	return sq != nil && *sq != "", nil
}

func (db *DB) UpdateCollection(c *models.Collection) (*validation.ValidationResult, error) {
	// Validate the collection
	result := db.validateCollection(c)
	if !result.IsValid() {
		return &result, nil
	}

	query := `UPDATE Collections SET
		collection_name = ?, type = ?, attributes = ?, modified_at = CURRENT_TIMESTAMP
		WHERE collID = ?`

	_, err := db.conn.Exec(query,
		c.CollectionName, c.Type, c.Attributes, c.CollID,
	)
	if err != nil {
		return nil, fmt.Errorf("update collection: %w", err)
	}

	// Fetch the updated timestamp
	var modifiedAt string
	err = db.conn.QueryRow("SELECT modified_at FROM Collections WHERE collID = ?", c.CollID).Scan(&modifiedAt)
	if err == nil {
		c.ModifiedAt = modifiedAt
	}

	return &result, nil
}

func (db *DB) ListCollections(showDeleted bool) ([]models.CollectionView, error) {
	query := `SELECT c.collID, c.collection_name, c.type, c.attributes,
		c.created_at, c.modified_at, c.is_book, c.smart_query,
		COALESCE((SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID), 0) as n_items
		FROM Collections c`

	if !showDeleted {
		query += ` WHERE (c.attributes IS NULL OR c.attributes NOT LIKE '%deleted%')`
	}

	query += ` ORDER BY collection_name`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query collections: %w", err)
	}
	defer rows.Close()

	var cols []models.CollectionView
	for rows.Next() {
		var c models.CollectionView
		err := rows.Scan(
			&c.CollID, &c.CollectionName, &c.Type, &c.Attributes,
			&c.CreatedAt, &c.ModifiedAt, &c.IsBook, &c.SmartQuery, &c.NItems,
		)
		if err != nil {
			return nil, fmt.Errorf("scan collection: %w", err)
		}
		c.IsDeleted = c.Collection.IsDeleted()
		cols = append(cols, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range cols {
		if cols[i].SmartQuery != nil && *cols[i].SmartQuery != "" {
			var count int
			countQuery := `SELECT COUNT(*) FROM Works w WHERE ` + *cols[i].SmartQuery
			if !showDeleted {
				countQuery += excludeDeletedFilter
			}
			if err := db.conn.QueryRow(countQuery).Scan(&count); err == nil {
				cols[i].NItems = count
			}
		}
	}

	return cols, nil
}

func (db *DB) AddWorkToCollection(collID, workID int64) error {
	// Validate that the collection exists
	var exists bool
	err := db.conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM Collections WHERE collID = ?)`, collID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check collection exists: %w", err)
	}
	if !exists {
		return fmt.Errorf("collection with ID %d does not exist", collID)
	}

	// Validate that the work exists
	err = db.conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM Works WHERE workID = ?)`, workID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check work exists: %w", err)
	}
	if !exists {
		return fmt.Errorf("work with ID %d does not exist", workID)
	}

	var maxPos int64
	err = db.conn.QueryRow(`SELECT COALESCE(MAX(position), -1) FROM CollectionDetails WHERE collID = ?`, collID).Scan(&maxPos)
	if err != nil {
		return fmt.Errorf("get max position: %w", err)
	}

	query := `INSERT OR IGNORE INTO CollectionDetails (collID, workID, position) VALUES (?, ?, ?)`
	_, err = db.conn.Exec(query, collID, workID, maxPos+1)
	if err != nil {
		return fmt.Errorf("add work to collection: %w", err)
	}

	// Recalculate part_ids for the collection
	if err := db.RecalculatePartIDs(collID); err != nil {
		return fmt.Errorf("recalculate part_ids: %w", err)
	}

	// Update collection's modified_at timestamp
	_, err = db.conn.Exec(`UPDATE Collections SET modified_at = CURRENT_TIMESTAMP WHERE collID = ?`, collID)
	if err != nil {
		return fmt.Errorf("update collection modified_at: %w", err)
	}
	return nil
}

func (db *DB) RemoveWorkFromCollection(collID, workID int64) error {
	query := `DELETE FROM CollectionDetails WHERE collID = ? AND workID = ?`
	_, err := db.conn.Exec(query, collID, workID)
	if err != nil {
		return fmt.Errorf("remove work from collection: %w", err)
	}

	// Recalculate part_ids for the collection
	if err := db.RecalculatePartIDs(collID); err != nil {
		return fmt.Errorf("recalculate part_ids: %w", err)
	}

	// Update collection's modified_at timestamp
	_, err = db.conn.Exec(`UPDATE Collections SET modified_at = CURRENT_TIMESTAMP WHERE collID = ?`, collID)
	if err != nil {
		return fmt.Errorf("update collection modified_at: %w", err)
	}
	return nil
}

func (db *DB) GetWorkCollections(workID int64) ([]models.CollectionDetail, error) {
	query := `SELECT cd.id, cd.collID, cd.workID, cd.position, c.collection_name
		FROM CollectionDetails cd
		INNER JOIN Collections c ON cd.collID = c.collID
		WHERE cd.workID = ?`

	rows, err := db.conn.Query(query, workID)
	if err != nil {
		return nil, fmt.Errorf("query work collections: %w", err)
	}
	defer rows.Close()

	var details []models.CollectionDetail
	for rows.Next() {
		var d models.CollectionDetail
		err := rows.Scan(&d.ID, &d.CollID, &d.WorkID, &d.Position, &d.CollectionName)
		if err != nil {
			return nil, fmt.Errorf("scan collection detail: %w", err)
		}
		details = append(details, d)
	}
	return details, rows.Err()
}

func (db *DB) GetCollectionWorks(collID int64, showDeleted bool) ([]models.CollectionWork, error) {
	smartQuery, err := db.GetSmartQuery(collID)
	if err != nil {
		return nil, fmt.Errorf("check smart collection: %w", err)
	}

	if smartQuery != nil && *smartQuery != "" {
		return db.getSmartCollectionWorks(*smartQuery, showDeleted)
	}

	query := `SELECT w.workID, w.title, w.type, w.year, w.status, w.quality, w.doc_type,
		w.path, w.draft, w.n_words, w.course_name, w.attributes, w.access_date, w.created_at, w.modified_at,
		cd.position, COALESCE(w.is_marked, 0), COALESCE(cd.is_suppressed, 0), COALESCE(w.skip_audits, 0)
		FROM Works w
		INNER JOIN CollectionDetails cd ON w.workID = cd.workID
		WHERE cd.collID = ?`

	if !showDeleted {
		query += excludeDeletedFilter
	}

	query += ` ORDER BY cd.position, w.title`

	rows, err := db.conn.Query(query, collID)
	if err != nil {
		return nil, fmt.Errorf("query collection works: %w", err)
	}
	defer rows.Close()

	var works []models.CollectionWork
	for rows.Next() {
		var w models.CollectionWork
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
			&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
			&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt,
			&w.Position, &w.IsMarked, &w.IsSuppressed, &w.SkipAudits,
		)
		if err != nil {
			return nil, fmt.Errorf("scan work: %w", err)
		}
		works = append(works, w)
	}
	return works, rows.Err()
}

func (db *DB) getSmartCollectionWorks(smartQuery string, showDeleted bool) ([]models.CollectionWork, error) {
	query := `SELECT w.workID, w.title, w.type, w.year, w.status, w.quality, w.doc_type,
		w.path, w.draft, w.n_words, w.course_name, w.attributes, w.access_date, w.created_at, w.modified_at,
		0, COALESCE(w.is_marked, 0), 0, COALESCE(w.skip_audits, 0)
		FROM Works w
		WHERE ` + smartQuery

	if !showDeleted {
		query += excludeDeletedFilter
	}

	query += ` ORDER BY w.title`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query smart collection works: %w", err)
	}
	defer rows.Close()

	var works []models.CollectionWork
	for rows.Next() {
		var w models.CollectionWork
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
			&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
			&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt,
			&w.Position, &w.IsMarked, &w.IsSuppressed, &w.SkipAudits,
		)
		if err != nil {
			return nil, fmt.Errorf("scan smart collection work: %w", err)
		}
		works = append(works, w)
	}
	return works, rows.Err()
}

// SetWorkSuppressed sets or clears the suppressed flag for a work in a collection
func (db *DB) SetWorkSuppressed(collID, workID int64, suppressed bool) error {
	suppressedVal := 0
	if suppressed {
		suppressedVal = 1
	}
	_, err := db.conn.Exec(
		`UPDATE CollectionDetails SET is_suppressed = ? WHERE collID = ? AND workID = ?`,
		suppressedVal, collID, workID,
	)
	if err != nil {
		return fmt.Errorf("set work suppressed: %w", err)
	}
	// Update collection's modified_at timestamp
	_, _ = db.conn.Exec(`UPDATE Collections SET modified_at = CURRENT_TIMESTAMP WHERE collID = ?`, collID)
	return nil
}

func (db *DB) ReorderCollectionWorks(collID int64, workIDs []int64) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.Prepare(`UPDATE CollectionDetails SET position = ? WHERE collID = ? AND workID = ?`)
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for i, workID := range workIDs {
		_, err := stmt.Exec(i, collID, workID)
		if err != nil {
			return fmt.Errorf("update position for work %d: %w", workID, err)
		}
	}

	// Update the collection's modified_at timestamp
	_, err = tx.Exec(`UPDATE Collections SET modified_at = datetime('now') WHERE collID = ?`, collID)
	if err != nil {
		return fmt.Errorf("update collection modified_at: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	// Recalculate part_ids after reorder (outside transaction since it's already committed)
	if err := db.RecalculatePartIDs(collID); err != nil {
		return fmt.Errorf("recalculate part_ids: %w", err)
	}

	return nil
}

func (db *DB) DeleteCollection(id int64) error {
	collection, err := db.GetCollection(id)
	if err != nil {
		return fmt.Errorf("get collection: %w", err)
	}
	if collection == nil {
		return fmt.Errorf("collection not found")
	}

	collection.Attributes = models.MarkDeleted(collection.Attributes)
	result, err := db.UpdateCollection(collection)
	if err != nil {
		return fmt.Errorf("mark collection deleted: %w", err)
	}
	if result != nil && !result.IsValid() {
		return fmt.Errorf("validation failed: %v", result.Errors)
	}

	// Cascade to owned notes
	notes, _ := db.GetNotes("collection", id, true)
	for _, note := range notes {
		_ = db.DeleteNote(note.ID)
	}

	return nil
}

func (db *DB) UndeleteCollection(id int64) (*validation.ValidationResult, error) {
	collection, err := db.GetCollection(id)
	if err != nil {
		return nil, fmt.Errorf("get collection: %w", err)
	}
	if collection == nil {
		return nil, fmt.Errorf("collection not found")
	}

	collection.Attributes = models.Undelete(collection.Attributes)

	// Validate before undeleting to check for duplicates
	result := db.validateCollection(collection)
	if !result.IsValid() {
		return &result, nil
	}

	if validResult, err := db.UpdateCollection(collection); err != nil || !validResult.IsValid() {
		return validResult, fmt.Errorf("undelete collection: %w", err)
	}

	// Un-cascade notes
	notes, _ := db.GetNotes("collection", id, true)
	for _, note := range notes {
		if models.IsDeleted(note.Attributes) {
			_ = db.UndeleteNote(note.ID)
		}
	}

	return &result, nil
}

func (db *DB) GetOrCreateDefaultCollection() (*models.Collection, error) {
	const defaultName = "New Works"

	query := `SELECT collID, collection_name, type, attributes,
		created_at, modified_at
		FROM Collections WHERE collection_name = ?`

	c := &models.Collection{}
	err := db.conn.QueryRow(query, defaultName).Scan(
		&c.CollID, &c.CollectionName, &c.Type, &c.Attributes,
		&c.CreatedAt, &c.ModifiedAt,
	)
	if err == nil {
		return c, nil
	}
	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("query default collection: %w", err)
	}

	collType := "System"
	c = &models.Collection{
		CollectionName: defaultName,
		Type:           &collType,
		Attributes:     "uneditable",
	}
	if _, err := db.CreateCollection(c); err != nil {
		return nil, err
	}
	return c, nil
}

// GetCollectionDeleteConfirmation returns information about what will be deleted
func (db *DB) GetCollectionDeleteConfirmation(collID int64) (*DeleteConfirmation, error) {
	coll, err := db.GetCollection(collID)
	if err != nil {
		return nil, err
	}

	conf := &DeleteConfirmation{
		EntityType: "collection",
		EntityName: coll.CollectionName,
	}

	// Count notes
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM Notes WHERE entity_type = 'collection' AND entity_id = ?`, collID).Scan(&conf.NoteCount)
	if err != nil {
		return nil, err
	}

	// Count works in collection (for info only - won't be deleted)
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM CollectionDetails WHERE collID = ?`, collID).Scan(&conf.CollectionCount)
	if err != nil {
		return nil, err
	}

	return conf, nil
}

// DeleteCollectionPermanent permanently deletes a collection and all its orphaned data
func (db *DB) DeleteCollectionPermanent(collID int64) error {
	// Delete notes manually (polymorphic FK)
	_, err := db.conn.Exec(`DELETE FROM Notes WHERE entity_type = 'collection' AND entity_id = ?`, collID)
	if err != nil {
		return fmt.Errorf("delete collection notes: %w", err)
	}

	// Delete collection (CASCADE handles collection_details automatically, but NOT the works themselves)
	_, err = db.conn.Exec(`DELETE FROM Collections WHERE collID = ?`, collID)
	if err != nil {
		return fmt.Errorf("delete collection: %w", err)
	}

	return nil
}

// RecalculatePartIDs updates part_id for all works in a collection
// based on their position relative to Section-type works.
// part_id = 0 for works before any Section
// part_id = Section's workID for works after that Section
func (db *DB) RecalculatePartIDs(collID int64) error {
	// Get works ordered by position with their type
	rows, err := db.conn.Query(`
		SELECT cd.workID, w.type
		FROM CollectionDetails cd
		JOIN Works w ON cd.workID = w.workID
		WHERE cd.collID = ?
		ORDER BY cd.position`, collID)
	if err != nil {
		return fmt.Errorf("query collection works: %w", err)
	}
	defer rows.Close()

	type workInfo struct {
		workID   int64
		workType string
	}
	var works []workInfo
	for rows.Next() {
		var w workInfo
		if err := rows.Scan(&w.workID, &w.workType); err != nil {
			return fmt.Errorf("scan work info: %w", err)
		}
		works = append(works, w)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate works: %w", err)
	}

	// Calculate and update part_id for each work
	var currentPartID int64 = 0
	for _, w := range works {
		if w.workType == "Section" {
			currentPartID = w.workID
		}
		_, err := db.conn.Exec(`UPDATE CollectionDetails SET part_id = ? WHERE collID = ? AND workID = ?`,
			currentPartID, collID, w.workID)
		if err != nil {
			return fmt.Errorf("update part_id for work %d: %w", w.workID, err)
		}
	}

	return nil
}

// GetWorkPartInfo returns the collID and part_id for all collections containing the given work.
// This is used by the file watcher to know which part caches to invalidate.
func (db *DB) GetWorkPartInfo(workID int64) ([]struct {
	CollID int64
	PartID int64
}, error) {
	rows, err := db.conn.Query(`
		SELECT collID, part_id
		FROM CollectionDetails
		WHERE workID = ?`, workID)
	if err != nil {
		return nil, fmt.Errorf("query work part info: %w", err)
	}
	defer rows.Close()

	var result []struct {
		CollID int64
		PartID int64
	}
	for rows.Next() {
		var info struct {
			CollID int64
			PartID int64
		}
		if err := rows.Scan(&info.CollID, &info.PartID); err != nil {
			return nil, fmt.Errorf("scan part info: %w", err)
		}
		result = append(result, info)
	}
	return result, rows.Err()
}
