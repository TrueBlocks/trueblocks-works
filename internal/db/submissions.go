package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/validation"
)

const (
	andSubmissionsNotDeleted  = ` AND (s.attributes IS NULL OR s.attributes NOT LIKE '%deleted%')`
	orderBySubmissionDateDesc = ` ORDER BY s.submission_date DESC`
)

// validateSubmission validates a Submission entity
func (db *DB) validateSubmission(s *models.Submission) validation.ValidationResult {
	result := validation.ValidationResult{}

	// Required fields
	if s.WorkID <= 0 {
		result.AddError("workID", "workID is required")
	}
	if s.OrgID <= 0 {
		result.AddError("orgID", "orgID is required")
	}

	// Validate foreign keys exist
	if s.WorkID > 0 {
		work, err := db.GetWork(s.WorkID)
		if err != nil {
			result.AddError("workID", "Error validating workID: "+err.Error())
		} else if work == nil {
			result.AddError("workID", "Work does not exist")
		}
	}

	if s.OrgID > 0 {
		org, err := db.GetOrganization(s.OrgID)
		if err != nil {
			result.AddError("orgID", "Error validating orgID: "+err.Error())
		} else if org == nil {
			result.AddError("orgID", "Organization does not exist")
		}
	}

	// Validate cost is non-negative
	if s.Cost != nil {
		result.AddIfError(validation.NonNegativeFloat(*s.Cost, "cost"))
	}

	// Validate URLs
	if s.WebAddress != nil {
		result.AddIfError(validation.ValidURL(*s.WebAddress, "webAddress"))
	}

	// Apply defaults
	if s.ResponseType == nil || *s.ResponseType == "" {
		waiting := "Waiting"
		s.ResponseType = &waiting
	}

	return result
}

func (db *DB) CreateSubmission(s *models.Submission) (*validation.ValidationResult, error) {
	// Validate the submission
	result := db.validateSubmission(s)
	if !result.IsValid() {
		return &result, nil
	}

	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Submissions (
		workID, orgID, draft, submission_date, submission_type,
		query_date, response_date, response_type, contest_name,
		cost, user_id, password, web_address, attributes, created_at, modified_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	sqlResult, err := db.conn.Exec(query,
		s.WorkID, s.OrgID, s.Draft, s.SubmissionDate, s.SubmissionType,
		s.QueryDate, s.ResponseDate, s.ResponseType, s.ContestName,
		s.Cost, s.UserID, s.Password, s.WebAddress, s.Attributes, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert submission: %w", err)
	}

	id, err := sqlResult.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get last insert id: %w", err)
	}
	s.SubmissionID = id
	s.CreatedAt = now
	s.ModifiedAt = now
	return &result, nil
}

func (db *DB) GetSubmission(id int64) (*models.Submission, error) {
	query := `SELECT submissionID, workID, orgID, draft, submission_date,
		submission_type, query_date, response_date, response_type,
		contest_name, cost, user_id, password, web_address, attributes,
		created_at, modified_at
		FROM Submissions WHERE submissionID = ?`

	s := &models.Submission{}
	err := db.conn.QueryRow(query, id).Scan(
		&s.SubmissionID, &s.WorkID, &s.OrgID, &s.Draft, &s.SubmissionDate,
		&s.SubmissionType, &s.QueryDate, &s.ResponseDate, &s.ResponseType,
		&s.ContestName, &s.Cost, &s.UserID, &s.Password, &s.WebAddress,
		&s.Attributes, &s.CreatedAt, &s.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query submission: %w", err)
	}
	return s, nil
}

func (db *DB) UpdateSubmission(s *models.Submission) (*validation.ValidationResult, error) {
	// Validate the submission
	result := db.validateSubmission(s)
	if !result.IsValid() {
		return &result, nil
	}

	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Submissions SET
		workID=?, orgID=?, draft=?, submission_date=?, submission_type=?,
		query_date=?, response_date=?, response_type=?, contest_name=?,
		cost=?, user_id=?, password=?, web_address=?, attributes=?, modified_at=?
		WHERE submissionID=?`

	_, err := db.conn.Exec(query,
		s.WorkID, s.OrgID, s.Draft, s.SubmissionDate, s.SubmissionType,
		s.QueryDate, s.ResponseDate, s.ResponseType, s.ContestName,
		s.Cost, s.UserID, s.Password, s.WebAddress, s.Attributes, now, s.SubmissionID,
	)
	if err != nil {
		return nil, fmt.Errorf("update submission: %w", err)
	}
	s.ModifiedAt = now
	return &result, nil
}

func (db *DB) DeleteSubmission(id int64) error {
	submission, err := db.GetSubmission(id)
	if err != nil {
		return fmt.Errorf("get submission: %w", err)
	}
	if submission == nil {
		return fmt.Errorf("submission not found")
	}

	submission.Attributes = models.MarkDeleted(submission.Attributes)
	if _, err := db.UpdateSubmission(submission); err != nil {
		return fmt.Errorf("mark submission deleted: %w", err)
	}

	notes, _ := db.GetNotes("submission", id, true)
	for _, note := range notes {
		_ = db.DeleteNote(note.ID)
	}

	return nil
}

func (db *DB) UndeleteSubmission(id int64) (*validation.ValidationResult, error) {
	submission, err := db.GetSubmission(id)
	if err != nil {
		return nil, fmt.Errorf("get submission: %w", err)
	}
	if submission == nil {
		return nil, fmt.Errorf("submission not found")
	}

	submission.Attributes = models.Undelete(submission.Attributes)

	// Validate before undeleting
	result := db.validateSubmission(submission)
	if !result.IsValid() {
		return &result, nil
	}

	if validResult, err := db.UpdateSubmission(submission); err != nil || !validResult.IsValid() {
		return validResult, fmt.Errorf("undelete submission: %w", err)
	}

	notes, _ := db.GetNotes("submission", id, true)
	for _, note := range notes {
		if models.IsDeleted(note.Attributes) {
			_ = db.UndeleteNote(note.ID)
		}
	}

	return &result, nil
}

func (db *DB) ListSubmissions(showDeleted bool) ([]models.Submission, error) {
	query := `SELECT submissionID, workID, orgID, draft, submission_date,
		submission_type, query_date, response_date, response_type,
		contest_name, cost, user_id, password, web_address, attributes,
		created_at, modified_at
		FROM Submissions`

	if !showDeleted {
		query += ` WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')`
	}

	query += ` ORDER BY submission_date DESC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query submissions: %w", err)
	}
	defer rows.Close()

	var subs []models.Submission
	for rows.Next() {
		var s models.Submission
		err := rows.Scan(
			&s.SubmissionID, &s.WorkID, &s.OrgID, &s.Draft, &s.SubmissionDate,
			&s.SubmissionType, &s.QueryDate, &s.ResponseDate, &s.ResponseType,
			&s.ContestName, &s.Cost, &s.UserID, &s.Password, &s.WebAddress,
			&s.Attributes, &s.CreatedAt, &s.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan submission: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (db *DB) ListSubmissionsByWork(workID int64) ([]models.Submission, error) {
	query := `SELECT submissionID, workID, orgID, draft, submission_date,
		submission_type, query_date, response_date, response_type,
		contest_name, cost, user_id, password, web_address, attributes,
		created_at, modified_at
		FROM Submissions WHERE workID = ? ORDER BY submission_date DESC`

	rows, err := db.conn.Query(query, workID)
	if err != nil {
		return nil, fmt.Errorf("query submissions: %w", err)
	}
	defer rows.Close()

	var subs []models.Submission
	for rows.Next() {
		var s models.Submission
		err := rows.Scan(
			&s.SubmissionID, &s.WorkID, &s.OrgID, &s.Draft, &s.SubmissionDate,
			&s.SubmissionType, &s.QueryDate, &s.ResponseDate, &s.ResponseType,
			&s.ContestName, &s.Cost, &s.UserID, &s.Password, &s.WebAddress,
			&s.Attributes, &s.CreatedAt, &s.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan submission: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (db *DB) ListSubmissionViewsByWork(workID int64, showDeleted bool) ([]models.SubmissionView, error) {
	query := `SELECT 
		s.submissionID, s.workID, s.orgID, s.draft, s.submission_date,
		s.submission_type, s.query_date, s.response_date, s.response_type,
		s.contest_name, s.cost, s.user_id, s.password, s.web_address, s.attributes,
		s.created_at, s.modified_at,
		COALESCE(w.title, '') as title_of_work,
		COALESCE(o.name, '') as journal_name,
		COALESCE(o.status, 'Open') as journal_status,
		CASE WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting') THEN 'yes' ELSE 'no' END as decision_pending
	FROM Submissions s
	LEFT JOIN Works w ON s.workID = w.workID
	LEFT JOIN Organizations o ON s.orgID = o.orgID
	WHERE s.workID = ?`

	if !showDeleted {
		query += andSubmissionsNotDeleted
	}

	query += orderBySubmissionDateDesc

	rows, err := db.conn.Query(query, workID)
	if err != nil {
		return nil, fmt.Errorf("query submission views: %w", err)
	}
	defer rows.Close()

	var views []models.SubmissionView
	for rows.Next() {
		var v models.SubmissionView
		err := rows.Scan(
			&v.SubmissionID, &v.WorkID, &v.OrgID, &v.Draft, &v.SubmissionDate,
			&v.SubmissionType, &v.QueryDate, &v.ResponseDate, &v.ResponseType,
			&v.ContestName, &v.Cost, &v.UserID, &v.Password, &v.WebAddress,
			&v.Attributes, &v.CreatedAt, &v.ModifiedAt,
			&v.TitleOfWork, &v.JournalName, &v.JournalStatus, &v.DecisionPending,
		)
		if err != nil {
			return nil, fmt.Errorf("scan submission view: %w", err)
		}
		v.IsDeleted = v.Submission.IsDeleted()
		views = append(views, v)
	}
	return views, rows.Err()
}

func (db *DB) ListAllSubmissionViews(showDeleted bool) ([]models.SubmissionView, error) {
	query := `SELECT 
		s.submissionID, s.workID, s.orgID, s.draft, s.submission_date,
		s.submission_type, s.query_date, s.response_date, s.response_type,
		s.contest_name, s.cost, s.user_id, s.password, s.web_address, s.attributes,
		s.created_at, s.modified_at,
		COALESCE(w.title, '') as title_of_work,
		COALESCE(o.name, '') as journal_name,
		COALESCE(o.status, 'Open') as journal_status,
		CASE WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting') THEN 'yes' ELSE 'no' END as decision_pending
	FROM Submissions s
	LEFT JOIN Works w ON s.workID = w.workID
	LEFT JOIN Organizations o ON s.orgID = o.orgID`

	if !showDeleted {
		query += ` WHERE (s.attributes IS NULL OR s.attributes NOT LIKE '%deleted%')`
	}

	query += orderBySubmissionDateDesc

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query all submission views: %w", err)
	}
	defer rows.Close()

	var views []models.SubmissionView
	for rows.Next() {
		var v models.SubmissionView
		err := rows.Scan(
			&v.SubmissionID, &v.WorkID, &v.OrgID, &v.Draft, &v.SubmissionDate,
			&v.SubmissionType, &v.QueryDate, &v.ResponseDate, &v.ResponseType,
			&v.ContestName, &v.Cost, &v.UserID, &v.Password, &v.WebAddress,
			&v.Attributes, &v.CreatedAt, &v.ModifiedAt,
			&v.TitleOfWork, &v.JournalName, &v.JournalStatus, &v.DecisionPending,
		)
		if err != nil {
			return nil, fmt.Errorf("scan all submission views: %w", err)
		}
		v.IsDeleted = v.Submission.IsDeleted()
		views = append(views, v)
	}
	return views, rows.Err()
}

func (db *DB) ListSubmissionViewsByOrg(orgID int64, showDeleted bool) ([]models.SubmissionView, error) {
	query := `SELECT 
		s.submissionID, s.workID, s.orgID, s.draft, s.submission_date,
		s.submission_type, s.query_date, s.response_date, s.response_type,
		s.contest_name, s.cost, s.user_id, s.password, s.web_address, s.attributes,
		s.created_at, s.modified_at,
		COALESCE(w.title, '') as title_of_work,
		COALESCE(o.name, '') as journal_name,
		COALESCE(o.status, 'Open') as journal_status,
		CASE WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting') THEN 'yes' ELSE 'no' END as decision_pending
	FROM Submissions s
	LEFT JOIN Works w ON s.workID = w.workID
	LEFT JOIN Organizations o ON s.orgID = o.orgID
	WHERE s.orgID = ?`

	if !showDeleted {
		query += andSubmissionsNotDeleted
	}

	query += orderBySubmissionDateDesc

	rows, err := db.conn.Query(query, orgID)
	if err != nil {
		return nil, fmt.Errorf("query submission views by org: %w", err)
	}
	defer rows.Close()

	var views []models.SubmissionView
	for rows.Next() {
		var v models.SubmissionView
		err := rows.Scan(
			&v.SubmissionID, &v.WorkID, &v.OrgID, &v.Draft, &v.SubmissionDate,
			&v.SubmissionType, &v.QueryDate, &v.ResponseDate, &v.ResponseType,
			&v.ContestName, &v.Cost, &v.UserID, &v.Password, &v.WebAddress,
			&v.Attributes, &v.CreatedAt, &v.ModifiedAt,
			&v.TitleOfWork, &v.JournalName, &v.JournalStatus, &v.DecisionPending,
		)
		if err != nil {
			return nil, fmt.Errorf("scan submission view: %w", err)
		}
		v.IsDeleted = v.Submission.IsDeleted()
		views = append(views, v)
	}
	return views, rows.Err()
}

// ListSubmissionViewsByCollection returns submissions for all works in a collection
func (db *DB) ListSubmissionViewsByCollection(collID int64, showDeleted bool) ([]models.SubmissionView, error) {
	query := `SELECT 
		s.submissionID, s.workID, s.orgID, s.draft, s.submission_date,
		s.submission_type, s.query_date, s.response_date, s.response_type,
		s.contest_name, s.cost, s.user_id, s.password, s.web_address, s.attributes,
		s.created_at, s.modified_at,
		COALESCE(w.title, '') as title_of_work,
		COALESCE(o.name, '') as journal_name,
		COALESCE(o.status, 'Open') as journal_status,
		CASE WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting') THEN 'yes' ELSE 'no' END as decision_pending
	FROM Submissions s
	LEFT JOIN Works w ON s.workID = w.workID
	LEFT JOIN Organizations o ON s.orgID = o.orgID
	INNER JOIN CollectionDetails cd ON s.workID = cd.workID
	WHERE cd.collID = ?`

	if !showDeleted {
		query += andSubmissionsNotDeleted
	}

	query += orderBySubmissionDateDesc

	rows, err := db.conn.Query(query, collID)
	if err != nil {
		return nil, fmt.Errorf("query submission views by collection: %w", err)
	}
	defer rows.Close()

	var views []models.SubmissionView
	for rows.Next() {
		var v models.SubmissionView
		err := rows.Scan(
			&v.SubmissionID, &v.WorkID, &v.OrgID, &v.Draft, &v.SubmissionDate,
			&v.SubmissionType, &v.QueryDate, &v.ResponseDate, &v.ResponseType,
			&v.ContestName, &v.Cost, &v.UserID, &v.Password, &v.WebAddress,
			&v.Attributes, &v.CreatedAt, &v.ModifiedAt,
			&v.TitleOfWork, &v.JournalName, &v.JournalStatus, &v.DecisionPending,
		)
		if err != nil {
			return nil, fmt.Errorf("scan submission view: %w", err)
		}
		v.IsDeleted = v.Submission.IsDeleted()
		views = append(views, v)
	}
	return views, rows.Err()
}

// GetSubmissionDeleteConfirmation returns information about what will be deleted
func (db *DB) GetSubmissionDeleteConfirmation(submissionID int64) (*DeleteConfirmation, error) {
	sub, err := db.GetSubmission(submissionID)
	if err != nil {
		return nil, err
	}

	// Get work title for display
	work, _ := db.GetWork(sub.WorkID)
	org, _ := db.GetOrganization(sub.OrgID)
	displayName := "Submission"
	if work != nil && org != nil {
		displayName = work.Title + " → " + org.Name
	}

	conf := &DeleteConfirmation{
		EntityType: "submission",
		EntityName: displayName,
	}

	// Count notes
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM Notes WHERE entity_type = 'submission' AND entity_id = ?`, submissionID).Scan(&conf.NoteCount)
	if err != nil {
		return nil, err
	}

	return conf, nil
}

// DeleteSubmissionPermanent permanently deletes a submission and all its orphaned data
func (db *DB) DeleteSubmissionPermanent(submissionID int64) error {
	// Delete notes manually (polymorphic FK)
	_, err := db.conn.Exec(`DELETE FROM Notes WHERE entity_type = 'submission' AND entity_id = ?`, submissionID)
	if err != nil {
		return fmt.Errorf("delete submission notes: %w", err)
	}

	// Delete submission
	_, err = db.conn.Exec(`DELETE FROM Submissions WHERE submissionID = ?`, submissionID)
	if err != nil {
		return fmt.Errorf("delete submission: %w", err)
	}

	return nil
}
