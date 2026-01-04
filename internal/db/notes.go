package db

import (
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateWorkNote(n *models.WorkNote) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO WorkNotes (workID, type, note, modified_date, created_at)
		VALUES (?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query, n.WorkID, n.Type, n.Note, now, now)
	if err != nil {
		return fmt.Errorf("insert work note: %w", err)
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

func (db *DB) GetWorkNotes(workID int64) ([]models.WorkNote, error) {
	query := `SELECT id, workID, type, note, modified_date, created_at
		FROM WorkNotes WHERE workID = ? ORDER BY created_at DESC`

	rows, err := db.conn.Query(query, workID)
	if err != nil {
		return nil, fmt.Errorf("query work notes: %w", err)
	}
	defer rows.Close()

	var notes []models.WorkNote
	for rows.Next() {
		var n models.WorkNote
		err := rows.Scan(&n.ID, &n.WorkID, &n.Type, &n.Note,
			&n.ModifiedDate, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan work note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (db *DB) UpdateWorkNote(n *models.WorkNote) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE WorkNotes SET type=?, note=?, modified_date=? WHERE id=?`
	_, err := db.conn.Exec(query, n.Type, n.Note, now, n.ID)
	if err != nil {
		return fmt.Errorf("update work note: %w", err)
	}
	n.ModifiedDate = &now
	return nil
}

func (db *DB) DeleteWorkNote(id int64) error {
	_, err := db.conn.Exec("DELETE FROM WorkNotes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete work note: %w", err)
	}
	return nil
}

func (db *DB) CreateJournalNote(n *models.JournalNote) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO JournalNotes (orgID, type, note, modified_date, created_at)
		VALUES (?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query, n.OrgID, n.Type, n.Note, now, now)
	if err != nil {
		return fmt.Errorf("insert journal note: %w", err)
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

func (db *DB) GetJournalNotes(orgID int64) ([]models.JournalNote, error) {
	query := `SELECT id, orgID, type, note, modified_date, created_at
		FROM JournalNotes WHERE orgID = ? ORDER BY created_at DESC`

	rows, err := db.conn.Query(query, orgID)
	if err != nil {
		return nil, fmt.Errorf("query journal notes: %w", err)
	}
	defer rows.Close()

	var notes []models.JournalNote
	for rows.Next() {
		var n models.JournalNote
		err := rows.Scan(&n.ID, &n.OrgID, &n.Type, &n.Note,
			&n.ModifiedDate, &n.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan journal note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (db *DB) UpdateJournalNote(n *models.JournalNote) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE JournalNotes SET type=?, note=?, modified_date=? WHERE id=?`
	_, err := db.conn.Exec(query, n.Type, n.Note, now, n.ID)
	if err != nil {
		return fmt.Errorf("update journal note: %w", err)
	}
	n.ModifiedDate = &now
	return nil
}

func (db *DB) DeleteJournalNote(id int64) error {
	_, err := db.conn.Exec("DELETE FROM JournalNotes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete journal note: %w", err)
	}
	return nil
}

func (db *DB) SearchNotesByText(searchText string) ([]models.NoteSearchResult, error) {
	query := `
		SELECT wn.id as note_id, 'work' as entity_type, wn.workID as entity_id, w.title as entity_name, 
			   wn.type as note_type, wn.note, wn.created_at
		FROM WorkNotes wn
		LEFT JOIN Works w ON wn.workID = w.workID
		WHERE wn.note LIKE '%' || ? || '%'
		UNION ALL
		SELECT jn.id as note_id, 'journal' as entity_type, jn.orgID as entity_id, o.name as entity_name,
			   jn.type as note_type, jn.note, jn.created_at
		FROM JournalNotes jn
		LEFT JOIN Organizations o ON jn.orgID = o.orgID
		WHERE jn.note LIKE '%' || ? || '%'
		ORDER BY created_at DESC
		LIMIT 50`

	rows, err := db.conn.Query(query, searchText, searchText)
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
