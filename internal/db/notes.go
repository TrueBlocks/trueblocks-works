package db

import (
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateNote(n *models.Note) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Notes (entity_type, entity_id, type, note, modified_date, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query, n.EntityType, n.EntityID, n.Type, n.Note, now, now)
	if err != nil {
		return fmt.Errorf("insert note: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	n.ID = id
	n.ModifiedDate = &now
	n.CreatedAt = now
	return nil
}

func (db *DB) GetNotes(entityType string, entityID int64) ([]models.Note, error) {
	query := `SELECT id, entity_type, entity_id, type, note, modified_date, created_at
		FROM Notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`

	rows, err := db.conn.Query(query, entityType, entityID)
	if err != nil {
		return nil, fmt.Errorf("query notes: %w", err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var n models.Note
		err := rows.Scan(&n.ID, &n.EntityType, &n.EntityID, &n.Type, &n.Note,
			&n.ModifiedDate, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (db *DB) UpdateNote(n *models.Note) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Notes SET type=?, note=?, modified_date=? WHERE id=?`
	_, err := db.conn.Exec(query, n.Type, n.Note, now, n.ID)
	if err != nil {
		return fmt.Errorf("update note: %w", err)
	}
	n.ModifiedDate = &now
	return nil
}

func (db *DB) DeleteNote(id int64) error {
	_, err := db.conn.Exec("DELETE FROM Notes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete note: %w", err)
	}
	return nil
}

func (db *DB) DeleteNotesByEntity(entityType string, entityID int64) error {
	_, err := db.conn.Exec("DELETE FROM Notes WHERE entity_type = ? AND entity_id = ?", entityType, entityID)
	if err != nil {
		return fmt.Errorf("delete notes by entity: %w", err)
	}
	return nil
}

func (db *DB) GetAllNotes() ([]models.Note, error) {
	query := `SELECT id, entity_type, entity_id, type, note, modified_date, created_at
		FROM Notes ORDER BY id`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query all notes: %w", err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var n models.Note
		err := rows.Scan(&n.ID, &n.EntityType, &n.EntityID, &n.Type, &n.Note,
			&n.ModifiedDate, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (db *DB) SearchNotesByText(searchText string) ([]models.NoteSearchResult, error) {
	query := `
		SELECT n.id as note_id, n.entity_type, n.entity_id,
			CASE 
				WHEN n.entity_type = 'work' THEN COALESCE(w.title, 'Unknown Work')
				WHEN n.entity_type = 'journal' THEN COALESCE(o.name, 'Unknown Org')
				WHEN n.entity_type = 'submission' THEN 'Submission #' || n.entity_id
				WHEN n.entity_type = 'collection' THEN COALESCE(c.collection_name, 'Unknown Collection')
				ELSE 'Unknown'
			END as entity_name,
			n.type as note_type, n.note, n.created_at
		FROM Notes n
		LEFT JOIN Works w ON n.entity_type = 'work' AND n.entity_id = w.workID
		LEFT JOIN Organizations o ON n.entity_type = 'journal' AND n.entity_id = o.orgID
		LEFT JOIN Collections c ON n.entity_type = 'collection' AND n.entity_id = c.collID
		WHERE n.note LIKE '%' || ? || '%'
		ORDER BY n.created_at DESC
		LIMIT 50`

	rows, err := db.conn.Query(query, searchText)
	if err != nil {
		return nil, fmt.Errorf("search notes: %w", err)
	}
	defer rows.Close()

	var results []models.NoteSearchResult
	for rows.Next() {
		var r models.NoteSearchResult
		err := rows.Scan(&r.NoteID, &r.EntityType, &r.EntityID, &r.EntityName, &r.NoteType, &r.Note, &r.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan note result: %w", err)
		}
		results = append(results, r)
	}
	return results, rows.Err()
}
