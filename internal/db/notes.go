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
		FROM Notes ORDER BY type, entity_type, note`

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
