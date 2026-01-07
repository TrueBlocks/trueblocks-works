package db

import (
	"database/sql"
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateCollection(c *models.Collection) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Collections (
		collection_name, type, attributes, created_at, modified_at
	) VALUES (?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		c.CollectionName, c.Type, c.Attributes, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert collection: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	c.CollID = id
	c.CreatedAt = now
	c.ModifiedAt = now
	return nil
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

func (db *DB) UpdateCollection(c *models.Collection) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Collections SET
		collection_name = ?, type = ?, attributes = ?, modified_at = ?
		WHERE collID = ?`

	_, err := db.conn.Exec(query,
		c.CollectionName, c.Type, c.Attributes, now, c.CollID,
	)
	if err != nil {
		return fmt.Errorf("update collection: %w", err)
	}
	c.ModifiedAt = now
	return nil
}

func (db *DB) ListCollections() ([]models.CollectionView, error) {
	query := `SELECT c.collID, c.collection_name, c.type, c.attributes,
		c.created_at, c.modified_at,
		COALESCE((SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID), 0) as n_items
		FROM Collections c ORDER BY collection_name`

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
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

func (db *DB) AddWorkToCollection(collID, workID int64) error {
	var maxPos int64
	err := db.conn.QueryRow(`SELECT COALESCE(MAX(position), -1) FROM CollectionDetails WHERE collID = ?`, collID).Scan(&maxPos)
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

func (db *DB) GetCollectionWorks(collID int64) ([]models.CollectionWork, error) {
	query := `SELECT w.workID, w.title, w.type, w.year, w.status, w.quality, w.doc_type,
		w.path, w.draft, w.n_words, w.course_name, w.attributes, w.access_date, w.created_at, w.modified_at,
		cd.position
		FROM Works w
		INNER JOIN CollectionDetails cd ON w.workID = cd.workID
		WHERE cd.collID = ?
		ORDER BY cd.position, w.title`

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
			&w.Position,
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

	collType := "Manual"
	c = &models.Collection{
		CollectionName: defaultName,
		Type:           &collType,
	}
	if err := db.CreateCollection(c); err != nil {
		return nil, err
	}
	return c, nil
}
