package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

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
		created_at, modified_at
		FROM Collections WHERE collID = ?`

	c := &models.Collection{}
	err := db.conn.QueryRow(query, id).Scan(
		&c.CollID, &c.CollectionName, &c.Type, &c.Attributes,
		&c.CreatedAt, &c.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query collection: %w", err)
	}
	return c, nil
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
		c.created_at, c.modified_at,
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
			&c.CreatedAt, &c.ModifiedAt, &c.NItems,
		)
		if err != nil {
			return nil, fmt.Errorf("scan collection: %w", err)
		}
		c.IsDeleted = c.Collection.IsDeleted()
		cols = append(cols, c)
	}
	return cols, rows.Err()
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
	query := `SELECT w.workID, w.title, w.type, w.year, w.status, w.quality, w.doc_type,
		w.path, w.draft, w.n_words, w.course_name, w.attributes, w.access_date, w.created_at, w.modified_at,
		cd.position, COALESCE(w.is_template_clean, 0)
		FROM Works w
		INNER JOIN CollectionDetails cd ON w.workID = cd.workID
		WHERE cd.collID = ?`

	if !showDeleted {
		query += ` AND (w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')`
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
			&w.Position, &w.IsTemplateClean,
		)
		if err != nil {
			return nil, fmt.Errorf("scan work: %w", err)
		}
		works = append(works, w)
	}
	return works, rows.Err()
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
