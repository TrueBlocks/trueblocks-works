package db

import (
	"database/sql"
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateWork(w *models.Work) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Works (
		title, type, year, status, quality, doc_type, path, draft,
		n_words, course_name, attributes, access_date, created_at, modified_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		w.Title, w.Type, w.Year, w.Status, w.Quality, w.DocType,
		w.Path, w.Draft, w.NWords, w.CourseName, w.Attributes,
		w.AccessDate, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert work: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	w.WorkID = id
	w.CreatedAt = now
	w.ModifiedAt = now
	return nil
}

func (db *DB) GetWork(id int64) (*models.Work, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at
		FROM Works WHERE workID = ?`

	w := &models.Work{}
	err := db.conn.QueryRow(query, id).Scan(
		&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
		&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
		&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query work: %w", err)
	}
	return w, nil
}

func (db *DB) UpdateWork(w *models.Work) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Works SET
		title=?, type=?, year=?, status=?, quality=?, doc_type=?,
		path=?, draft=?, n_words=?, course_name=?, attributes=?,
		access_date=?, modified_at=?
		WHERE workID=?`

	_, err := db.conn.Exec(query,
		w.Title, w.Type, w.Year, w.Status, w.Quality, w.DocType,
		w.Path, w.Draft, w.NWords, w.CourseName, w.Attributes,
		w.AccessDate, now, w.WorkID,
	)
	if err != nil {
		return fmt.Errorf("update work: %w", err)
	}
	w.ModifiedAt = now
	return nil
}

func (db *DB) DeleteWork(id int64) error {
	if err := db.DeleteNotesByEntity("work", id); err != nil {
		return fmt.Errorf("delete work notes: %w", err)
	}
	_, err := db.conn.Exec("DELETE FROM Works WHERE workID = ?", id)
	if err != nil {
		return fmt.Errorf("delete work: %w", err)
	}
	return nil
}

func (db *DB) ListWorks() ([]models.WorkView, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at,
		age_days, n_submissions, collection_list
		FROM WorksView ORDER BY title`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query works: %w", err)
	}
	defer rows.Close()

	var works []models.WorkView
	for rows.Next() {
		var w models.WorkView
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
			&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
			&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt,
			&w.AgeDays, &w.NSubmissions, &w.CollectionList,
		)
		if err != nil {
			return nil, fmt.Errorf("scan work: %w", err)
		}
		works = append(works, w)
	}
	return works, rows.Err()
}
