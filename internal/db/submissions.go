package db

import (
	"database/sql"
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateSubmission(s *models.Submission) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Submissions (
		workID, orgID, draft, submission_date, submission_type,
		query_date, response_date, response_type, contest_name,
		cost, user_id, password, web_address, attributes, created_at, modified_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		s.WorkID, s.OrgID, s.Draft, s.SubmissionDate, s.SubmissionType,
		s.QueryDate, s.ResponseDate, s.ResponseType, s.ContestName,
		s.Cost, s.UserID, s.Password, s.WebAddress, s.Attributes, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert submission: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	s.SubmissionID = id
	s.CreatedAt = now
	s.ModifiedAt = now
	return nil
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

func (db *DB) UpdateSubmission(s *models.Submission) error {
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
		return fmt.Errorf("update submission: %w", err)
	}
	s.ModifiedAt = now
	return nil
}

func (db *DB) DeleteSubmission(id int64) error {
	if err := db.DeleteNotesByEntity("submission", id); err != nil {
		return fmt.Errorf("delete submission notes: %w", err)
	}
	_, err := db.conn.Exec("DELETE FROM Submissions WHERE submissionID = ?", id)
	if err != nil {
		return fmt.Errorf("delete submission: %w", err)
	}
	return nil
}

func (db *DB) ListSubmissions() ([]models.Submission, error) {
	query := `SELECT submissionID, workID, orgID, draft, submission_date,
		submission_type, query_date, response_date, response_type,
		contest_name, cost, user_id, password, web_address, attributes,
		created_at, modified_at
		FROM Submissions ORDER BY submission_date DESC`

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

func (db *DB) ListSubmissionViewsByWork(workID int64) ([]models.SubmissionView, error) {
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
	WHERE s.workID = ?
	ORDER BY s.submission_date DESC`

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
		views = append(views, v)
	}
	return views, rows.Err()
}

func (db *DB) ListSubmissionViewsByOrg(orgID int64) ([]models.SubmissionView, error) {
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
	WHERE s.orgID = ?
	ORDER BY s.submission_date DESC`

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
		views = append(views, v)
	}
	return views, rows.Err()
}

func (db *DB) ListAllSubmissionViews() ([]models.SubmissionView, error) {
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
	ORDER BY s.submission_date DESC`

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
		views = append(views, v)
	}
	return views, rows.Err()
}
