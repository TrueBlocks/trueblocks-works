package db

import (
	"fmt"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

func (db *DB) CreateNote(n *models.Note) (*validation.ValidationResult, error) {
	// Validate the note
	result := db.validateNote(n)
	if !result.IsValid() {
		return &result, nil
	}

	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Notes (entity_type, entity_id, type, note, attributes, modified_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`

	sqlResult, err := db.conn.Exec(query, n.EntityType, n.EntityID, n.Type, n.Note, n.Attributes, now, now)
	if err != nil {
		return nil, fmt.Errorf("insert note: %w", err)
	}

	id, err := sqlResult.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get last insert id: %w", err)
	}
	n.ID = id
	n.ModifiedAt = &now
	n.CreatedAt = now
	return &result, nil
}

func (db *DB) GetNote(id int64) (*models.Note, error) {
	query := `SELECT id, entity_type, entity_id, type, note, attributes, modified_at, created_at
		FROM Notes WHERE id = ?`

	n := &models.Note{}
	err := db.conn.QueryRow(query, id).Scan(
		&n.ID, &n.EntityType, &n.EntityID, &n.Type, &n.Note,
		&n.Attributes, &n.ModifiedAt, &n.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query note: %w", err)
	}
	return n, nil
}

func (db *DB) GetNotes(entityType string, entityID int64, showDeleted bool) ([]models.Note, error) {
	query := `SELECT id, entity_type, entity_id, type, note, attributes, modified_at, created_at
		FROM Notes WHERE entity_type = ? AND entity_id = ?`

	if !showDeleted {
		query += ` AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')`
	}

	query += ` ORDER BY created_at DESC`

	rows, err := db.conn.Query(query, entityType, entityID)
	if err != nil {
		return nil, fmt.Errorf("query notes: %w", err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var n models.Note
		err := rows.Scan(&n.ID, &n.EntityType, &n.EntityID, &n.Type, &n.Note,
			&n.Attributes, &n.ModifiedAt, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (db *DB) UpdateNote(n *models.Note) (*validation.ValidationResult, error) {
	// Validate the note
	result := db.validateNote(n)
	if !result.IsValid() {
		return &result, nil
	}

	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Notes SET type=?, note=?, attributes=?, modified_at=? WHERE id=?`
	_, err := db.conn.Exec(query, n.Type, n.Note, n.Attributes, now, n.ID)
	if err != nil {
		return nil, fmt.Errorf("update note: %w", err)
	}
	n.ModifiedAt = &now
	return &result, nil
}

func (db *DB) DeleteNote(id int64) error {
	note, err := db.GetNote(id)
	if err != nil {
		return fmt.Errorf("get note: %w", err)
	}

	note.Attributes = models.MarkDeleted(note.Attributes)
	if _, err := db.UpdateNote(note); err != nil {
		return fmt.Errorf("mark note deleted: %w", err)
	}

	return nil
}

func (db *DB) UndeleteNote(id int64) error {
	note, err := db.GetNote(id)
	if err != nil {
		return fmt.Errorf("get note: %w", err)
	}

	note.Attributes = models.Undelete(note.Attributes)
	if _, err := db.UpdateNote(note); err != nil {
		return fmt.Errorf("undelete note: %w", err)
	}

	return nil
}

func (db *DB) DeleteNotePermanent(id int64) error {
	query := `DELETE FROM Notes WHERE id = ?`
	_, err := db.conn.Exec(query, id)
	if err != nil {
		return fmt.Errorf("delete note permanently: %w", err)
	}
	return nil
}

func (db *DB) GetAllNotes(showDeleted bool) ([]models.Note, error) {
	query := `SELECT id, entity_type, entity_id, type, note, attributes, modified_at, created_at
		FROM Notes`

	if !showDeleted {
		query += whereNotDeleted
	}

	query += ` ORDER BY type, entity_type, note`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query all notes: %w", err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var n models.Note
		err := rows.Scan(&n.ID, &n.EntityType, &n.EntityID, &n.Type, &n.Note,
			&n.Attributes, &n.ModifiedAt, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}
