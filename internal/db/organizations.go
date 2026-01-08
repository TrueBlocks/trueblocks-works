package db

import (
	"database/sql"
	"fmt"
	"time"

	"works/internal/models"
)

func (db *DB) CreateOrganization(o *models.Organization) error {
	now := time.Now().Format(time.RFC3339)
	query := `INSERT INTO Organizations (
		name, other_name, url, other_url, status, type, timing,
		submission_types, accepts, my_interest, ranking, source,
		website_menu, duotrope_num, n_push_fiction, n_push_nonfiction,
		n_push_poetry, contest_ends, contest_fee, contest_prize,
		contest_prize_2, attributes, date_added, modified_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := db.conn.Exec(query,
		o.Name, o.OtherName, o.URL, o.OtherURL, o.Status, o.Type,
		o.Timing, o.SubmissionType, o.Accepts, o.MyInterest, o.Ranking,
		o.Source, o.WebsiteMenu, o.DuotropeNum, o.NPushFiction,
		o.NPushNonfict, o.NPushPoetry, o.ContestEnds, o.ContestFee,
		o.ContestPrize, o.ContestPrize2, o.Attributes, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert organization: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("get last insert id: %w", err)
	}
	o.OrgID = id
	o.DateAdded = &now
	o.ModifiedAt = &now
	return nil
}

func (db *DB) GetOrganization(id int64) (*models.Organization, error) {
	query := `SELECT orgID, name, other_name, url, other_url, status, type,
		timing, submission_types, accepts, my_interest, ranking, source,
		website_menu, duotrope_num, n_push_fiction, n_push_nonfiction,
		n_push_poetry, contest_ends, contest_fee, contest_prize,
		contest_prize_2, attributes, date_added, modified_at
		FROM Organizations WHERE orgID = ?`

	o := &models.Organization{}
	err := db.conn.QueryRow(query, id).Scan(
		&o.OrgID, &o.Name, &o.OtherName, &o.URL, &o.OtherURL,
		&o.Status, &o.Type, &o.Timing, &o.SubmissionType, &o.Accepts,
		&o.MyInterest, &o.Ranking, &o.Source, &o.WebsiteMenu,
		&o.DuotropeNum, &o.NPushFiction, &o.NPushNonfict, &o.NPushPoetry,
		&o.ContestEnds, &o.ContestFee, &o.ContestPrize, &o.ContestPrize2,
		&o.Attributes, &o.DateAdded, &o.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query organization: %w", err)
	}
	return o, nil
}

func (db *DB) UpdateOrganization(o *models.Organization) error {
	now := time.Now().Format(time.RFC3339)
	query := `UPDATE Organizations SET
		name=?, other_name=?, url=?, other_url=?, status=?, type=?,
		timing=?, submission_types=?, accepts=?, my_interest=?, ranking=?,
		source=?, website_menu=?, duotrope_num=?, n_push_fiction=?,
		n_push_nonfiction=?, n_push_poetry=?, contest_ends=?, contest_fee=?,
		contest_prize=?, contest_prize_2=?, attributes=?, modified_at=?
		WHERE orgID=?`

	_, err := db.conn.Exec(query,
		o.Name, o.OtherName, o.URL, o.OtherURL, o.Status, o.Type,
		o.Timing, o.SubmissionType, o.Accepts, o.MyInterest, o.Ranking,
		o.Source, o.WebsiteMenu, o.DuotropeNum, o.NPushFiction,
		o.NPushNonfict, o.NPushPoetry, o.ContestEnds, o.ContestFee,
		o.ContestPrize, o.ContestPrize2, o.Attributes, now, o.OrgID,
	)
	if err != nil {
		return fmt.Errorf("update organization: %w", err)
	}
	o.ModifiedAt = &now
	return nil
}

func (db *DB) DeleteOrganization(id int64) error {
	org, err := db.GetOrganization(id)
	if err != nil {
		return fmt.Errorf("get organization: %w", err)
	}
	if org == nil {
		return fmt.Errorf("organization not found")
	}

	org.Attributes = models.MarkDeleted(org.Attributes)
	if err := db.UpdateOrganization(org); err != nil {
		return fmt.Errorf("mark organization deleted: %w", err)
	}

	notes, _ := db.GetNotes("journal", id, true)
	for _, note := range notes {
		_ = db.DeleteNote(note.ID)
	}

	return nil
}

func (db *DB) UndeleteOrganization(id int64) error {
	org, err := db.GetOrganization(id)
	if err != nil {
		return fmt.Errorf("get organization: %w", err)
	}
	if org == nil {
		return fmt.Errorf("organization not found")
	}

	org.Attributes = models.Undelete(org.Attributes)
	if err := db.UpdateOrganization(org); err != nil {
		return fmt.Errorf("undelete organization: %w", err)
	}

	notes, _ := db.GetNotes("journal", id, true)
	for _, note := range notes {
		if models.IsDeleted(note.Attributes) {
			_ = db.UndeleteNote(note.ID)
		}
	}

	return nil
}

func (db *DB) ListOrganizations(showDeleted bool) ([]models.Organization, error) {
	query := `SELECT orgID, name, other_name, url, other_url, status, type,
		timing, submission_types, accepts, my_interest, ranking, source,
		website_menu, duotrope_num, n_push_fiction, n_push_nonfiction,
		n_push_poetry, contest_ends, contest_fee, contest_prize,
		contest_prize_2, attributes, date_added, modified_at
		FROM Organizations`

	if !showDeleted {
		query += ` WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')`
	}

	query += ` ORDER BY name`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query organizations: %w", err)
	}
	defer rows.Close()

	var orgs []models.Organization
	for rows.Next() {
		var o models.Organization
		err := rows.Scan(
			&o.OrgID, &o.Name, &o.OtherName, &o.URL, &o.OtherURL,
			&o.Status, &o.Type, &o.Timing, &o.SubmissionType, &o.Accepts,
			&o.MyInterest, &o.Ranking, &o.Source, &o.WebsiteMenu,
			&o.DuotropeNum, &o.NPushFiction, &o.NPushNonfict, &o.NPushPoetry,
			&o.ContestEnds, &o.ContestFee, &o.ContestPrize, &o.ContestPrize2,
			&o.Attributes, &o.DateAdded, &o.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan organization: %w", err)
		}
		orgs = append(orgs, o)
	}
	return orgs, rows.Err()
}

func (db *DB) ListOrganizationsWithNotes() ([]models.OrganizationWithNotes, error) {
	query := `SELECT o.orgID, o.name, o.other_name, o.url, o.other_url, o.status, o.type,
		o.timing, o.submission_types, o.accepts, o.my_interest, o.ranking, o.source,
		o.website_menu, o.duotrope_num, o.n_push_fiction, o.n_push_nonfiction,
		o.n_push_poetry, o.contest_ends, o.contest_fee, o.contest_prize,
		o.contest_prize_2, o.attributes, o.date_added, o.modified_at,
		(SELECT COUNT(*) FROM Submissions s WHERE s.orgID = o.orgID) as n_submissions,
		GROUP_CONCAT(n.note, ' ') as notes
		FROM Organizations o
		LEFT JOIN Notes n ON n.entity_type = 'journal' AND o.orgID = n.entity_id
		GROUP BY o.orgID
		ORDER BY o.name`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query organizations with notes: %w", err)
	}
	defer rows.Close()

	orgs := make([]models.OrganizationWithNotes, 0)
	for rows.Next() {
		var o models.OrganizationWithNotes
		err := rows.Scan(
			&o.OrgID, &o.Name, &o.OtherName, &o.URL, &o.OtherURL,
			&o.Status, &o.Type, &o.Timing, &o.SubmissionType, &o.Accepts,
			&o.MyInterest, &o.Ranking, &o.Source, &o.WebsiteMenu,
			&o.DuotropeNum, &o.NPushFiction, &o.NPushNonfict, &o.NPushPoetry,
			&o.ContestEnds, &o.ContestFee, &o.ContestPrize, &o.ContestPrize2,
			&o.Attributes, &o.DateAdded, &o.ModifiedAt, &o.NSubmissions, &o.Notes,
		)
		if err != nil {
			return nil, fmt.Errorf("scan organization with notes: %w", err)
		}
		orgs = append(orgs, o)
	}
	return orgs, rows.Err()
}
