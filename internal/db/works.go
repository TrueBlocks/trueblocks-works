package db

import (
	"database/sql"
	"fmt"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

// validateWork validates a Work entity
func (db *DB) validateWork(w *models.Work) validation.ValidationResult {
	result := validation.ValidationResult{}

	// Required fields
	result.AddIfError(validation.Required(w.Title, "title"))
	result.AddIfError(validation.Required(w.Type, "type"))

	// Field constraints
	result.AddIfError(validation.MaxLength(w.Title, 500, "title"))

	// Year validation
	if w.Year != nil && *w.Year != "" {
		result.AddIfError(validation.MaxLength(*w.Year, 10, "year"))
	}

	// nWords must be non-negative if present
	if w.NWords != nil {
		result.AddIfError(validation.NonNegative(*w.NWords, "nWords"))
	}

	// Apply defaults if not set
	if w.Status == "" {
		w.Status = "New"
	}
	if w.Quality == "" {
		w.Quality = "Good"
	}
	if w.DocType == "" {
		w.DocType = "docx"
	}

	// Check for duplicate generatedPath (only if required fields are present)
	if result.IsValid() {
		genPath := w.GeneratedPath()
		if genPath != "" {
			matches, err := db.FindWorksByGeneratedPath(genPath)
			if err != nil {
				result.AddError("generatedPath", "Error checking for duplicates: "+err.Error())
			} else {
				// Filter out the work being validated (if it has an ID)
				for _, match := range matches {
					if match.WorkID != w.WorkID {
						result.AddError("generatedPath", "A work with this title, type, and year already exists")
						break
					}
				}
			}
		}
	}

	return result
}

func (db *DB) CreateWork(w *models.Work) (*validation.ValidationResult, error) {
	// Validate the work
	result := db.validateWork(w)
	if !result.IsValid() {
		return &result, nil
	}

	query := `INSERT INTO Works (
		title, type, year, status, quality, doc_type, path, draft,
		n_words, course_name, attributes, access_date, file_mtime
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	sqlResult, err := db.conn.Exec(query,
		w.Title, w.Type, w.Year, w.Status, w.Quality, w.DocType,
		w.Path, w.Draft, w.NWords, w.CourseName, w.Attributes,
		w.AccessDate, w.FileMtime,
	)
	if err != nil {
		return nil, fmt.Errorf("insert work: %w", err)
	}

	id, err := sqlResult.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get last insert id: %w", err)
	}
	w.WorkID = id

	// Fetch the timestamps set by SQLite
	var createdAt, modifiedAt string
	err = db.conn.QueryRow("SELECT created_at, modified_at FROM Works WHERE workID = ?", id).Scan(&createdAt, &modifiedAt)
	if err == nil {
		w.CreatedAt = createdAt
		w.ModifiedAt = modifiedAt
	}

	return &result, nil
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

func (db *DB) UpdateWork(w *models.Work) (*validation.ValidationResult, error) {
	// Validate the work
	result := db.validateWork(w)
	if !result.IsValid() {
		return &result, nil
	}

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
		return nil, fmt.Errorf("update work: %w", err)
	}

	// Fetch the updated timestamp
	var modifiedAt string
	err = db.conn.QueryRow("SELECT modified_at FROM Works WHERE workID = ?", w.WorkID).Scan(&modifiedAt)
	if err == nil {
		w.ModifiedAt = modifiedAt
	}

	return &result, nil
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
	if _, err := db.UpdateWork(work); err != nil {
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

func (db *DB) UndeleteWork(id int64) (*validation.ValidationResult, error) {
	work, err := db.GetWork(id)
	if err != nil {
		return nil, fmt.Errorf("get work: %w", err)
	}
	if work == nil {
		return nil, fmt.Errorf("work not found")
	}

	work.Attributes = models.Undelete(work.Attributes)

	// Validate before undeleting to check for duplicates
	result := db.validateWork(work)
	if !result.IsValid() {
		return &result, nil
	}

	if validResult, err := db.UpdateWork(work); err != nil || !validResult.IsValid() {
		return validResult, fmt.Errorf("undelete work: %w", err)
	}

	submissions, _ := db.ListSubmissionsByWork(id)
	for _, sub := range submissions {
		if models.IsDeleted(sub.Attributes) {
			_, _ = db.UndeleteSubmission(sub.SubmissionID)
		}
	}

	notes, _ := db.GetNotes("work", id, true)
	for _, note := range notes {
		if models.IsDeleted(note.Attributes) {
			_ = db.UndeleteNote(note.ID)
		}
	}

	return &result, nil
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

// FindWorksByGeneratedPath finds all non-deleted works that would have the given generated path
func (db *DB) FindWorksByGeneratedPath(path string) ([]models.Work, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at, file_mtime
		FROM Works` + whereNotDeleted + ` ORDER BY workID`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query works: %w", err)
	}
	defer rows.Close()

	var matches []models.Work
	for rows.Next() {
		var w models.Work
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
			&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
			&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt, &w.FileMtime,
		)
		if err != nil {
			return nil, fmt.Errorf("scan work: %w", err)
		}

		// Generate path and compare
		genPath := w.GeneratedPath()
		if genPath == path {
			matches = append(matches, w)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}

// GetWorkDeleteConfirmation returns information about what will be deleted
func (db *DB) GetWorkDeleteConfirmation(workID int64) (*DeleteConfirmation, error) {
	work, err := db.GetWork(workID)
	if err != nil {
		return nil, err
	}

	conf := &DeleteConfirmation{
		EntityType: "work",
		EntityName: work.Title,
	}

	// Count notes
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM Notes WHERE entity_type = 'work' AND entity_id = ?`, workID).Scan(&conf.NoteCount)
	if err != nil {
		return nil, err
	}

	// Count submissions
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM Submissions WHERE workID = ?`, workID).Scan(&conf.SubmissionCount)
	if err != nil {
		return nil, err
	}

	// Count collections
	err = db.conn.QueryRow(`SELECT COUNT(DISTINCT collID) FROM CollectionDetails WHERE workID = ?`, workID).Scan(&conf.CollectionCount)
	if err != nil {
		return nil, err
	}

	return conf, nil
}

// DeleteWorkPermanent permanently deletes a work and all its orphaned data
// CASCADE will automatically delete submissions and collection_details
// We manually delete notes since they use a polymorphic pattern
func (db *DB) DeleteWorkPermanent(workID int64) error {
	// Delete notes manually (polymorphic FK not supported by CASCADE)
	_, err := db.conn.Exec(`DELETE FROM Notes WHERE entity_type = 'work' AND entity_id = ?`, workID)
	if err != nil {
		return fmt.Errorf("delete work notes: %w", err)
	}

	// Delete work (CASCADE handles submissions and collection_details automatically)
	_, err = db.conn.Exec(`DELETE FROM Works WHERE workID = ?`, workID)
	if err != nil {
		return fmt.Errorf("delete work: %w", err)
	}

	return nil
}
