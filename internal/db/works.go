package db

import (
	"database/sql"
	"fmt"

	"works/internal/models"
)

func (db *DB) CreateWork(w *models.Work) error {
	query := `INSERT INTO Works (
		title, type, year, status, quality, doc_type, path, draft,
		n_words, course_name, attributes, access_date, file_mtime
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		w.Title, w.Type, w.Year, w.Status, w.Quality, w.DocType,
		w.Path, w.Draft, w.NWords, w.CourseName, w.Attributes,
		w.AccessDate, w.FileMtime,
	)
	if err != nil {
		return fmt.Errorf("insert work: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	w.WorkID = id

	// Fetch the timestamps set by SQLite
	var createdAt, modifiedAt string
	err = db.conn.QueryRow("SELECT created_at, modified_at FROM Works WHERE workID = ?", id).Scan(&createdAt, &modifiedAt)
	if err == nil {
		w.CreatedAt = createdAt
		w.ModifiedAt = modifiedAt
	}

	return nil
}

func (db *DB) GetWork(id int64) (*models.Work, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at, file_mtime
		FROM Works WHERE workID = ?`

	w := &models.Work{}
	err := db.conn.QueryRow(query, id).Scan(
		&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
		&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
		&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt, &w.FileMtime,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query work: %w", err)
	}
	return w, nil
}

func (db *DB) GetWorkByPath(path string) (*models.Work, error) {
	// First check if there are duplicates
	var count int
	err := db.conn.QueryRow(`SELECT COUNT(*) FROM Works WHERE path = ?`, path).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("count works by path: %w", err)
	}
	if count > 1 {
		return nil, fmt.Errorf("duplicate works found with path %s (count: %d)", path, count)
	}
	if count == 0 {
		return nil, nil
	}

	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at, file_mtime
		FROM Works WHERE path = ?`

	w := &models.Work{}
	err = db.conn.QueryRow(query, path).Scan(
		&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
		&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
		&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt, &w.FileMtime,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query work by path: %w", err)
	}
	return w, nil
}

func (db *DB) UpdateWork(w *models.Work) error {
	query := `UPDATE Works SET
		title=?, type=?, year=?, status=?, quality=?, doc_type=?,
		path=?, draft=?, n_words=?, course_name=?, attributes=?,
		access_date=?, modified_at=CURRENT_TIMESTAMP
		WHERE workID=?`

	_, err := db.conn.Exec(query,
		w.Title, w.Type, w.Year, w.Status, w.Quality, w.DocType,
		w.Path, w.Draft, w.NWords, w.CourseName, w.Attributes,
		w.AccessDate, w.WorkID,
	)
	if err != nil {
		return fmt.Errorf("update work: %w", err)
	}

	// Fetch the updated timestamp
	var modifiedAt string
	err = db.conn.QueryRow("SELECT modified_at FROM Works WHERE workID = ?", w.WorkID).Scan(&modifiedAt)
	if err == nil {
		w.ModifiedAt = modifiedAt
	}

	return nil
}

func (db *DB) DeleteWork(id int64) error {
	work, err := db.GetWork(id)
	if err != nil {
		return fmt.Errorf("get work: %w", err)
	}
	if work == nil {
		return fmt.Errorf("work not found")
	}

	work.Attributes = models.MarkDeleted(work.Attributes)
	if err := db.UpdateWork(work); err != nil {
		return fmt.Errorf("mark work deleted: %w", err)
	}

	submissions, _ := db.ListSubmissionsByWork(id)
	for _, sub := range submissions {
		_ = db.DeleteSubmission(sub.SubmissionID)
	}

	notes, _ := db.GetNotes("work", id, true)
	for _, note := range notes {
		_ = db.DeleteNote(note.ID)
	}

	return nil
}

func (db *DB) UndeleteWork(id int64) error {
	work, err := db.GetWork(id)
	if err != nil {
		return fmt.Errorf("get work: %w", err)
	}
	if work == nil {
		return fmt.Errorf("work not found")
	}

	work.Attributes = models.Undelete(work.Attributes)
	if err := db.UpdateWork(work); err != nil {
		return fmt.Errorf("undelete work: %w", err)
	}

	submissions, _ := db.ListSubmissionsByWork(id)
	for _, sub := range submissions {
		if models.IsDeleted(sub.Attributes) {
			_ = db.UndeleteSubmission(sub.SubmissionID)
		}
	}

	notes, _ := db.GetNotes("work", id, true)
	for _, note := range notes {
		if models.IsDeleted(note.Attributes) {
			_ = db.UndeleteNote(note.ID)
		}
	}

	return nil
}

func (db *DB) ListWorks(showDeleted bool) ([]models.WorkView, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at,
		age_days, n_submissions, collection_list
		FROM WorksView`

	if !showDeleted {
		query += whereNotDeleted
	}

	query += ` ORDER BY title`

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
		w.IsDeleted = w.Work.IsDeleted()
		w.GeneratedPath = w.Work.GeneratedPath()
		works = append(works, w)
	}
	return works, rows.Err()
}
