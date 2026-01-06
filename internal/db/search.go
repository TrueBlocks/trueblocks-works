package db

import (
	"fmt"
	"strings"

	"works/internal/models"
)

func (db *DB) Search(query string, limit int) ([]models.SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return []models.SearchResult{}, nil
	}

	if limit <= 0 {
		limit = 20
	}

	ftsQuery := escapeFTSQuery(query)
	likeQuery := "%" + strings.TrimSpace(query) + "%"

	results := []models.SearchResult{}

	worksResults, err := db.searchWorks(ftsQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("search works: %w", err)
	}
	results = append(results, worksResults...)

	orgsResults, err := db.searchOrganizations(ftsQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("search organizations: %w", err)
	}
	results = append(results, orgsResults...)

	notesResults, err := db.searchNotes(likeQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("search notes: %w", err)
	}
	results = append(results, notesResults...)

	submissionsResults, err := db.searchSubmissions(likeQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("search submissions: %w", err)
	}
	results = append(results, submissionsResults...)

	if len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

func (db *DB) searchWorks(ftsQuery string, limit int) ([]models.SearchResult, error) {
	query := `
		SELECT 
			w.workID,
			w.title,
			w.type,
			w.year,
			w.status,
			bm25(works_fts) as rank
		FROM works_fts
		JOIN Works w ON works_fts.rowid = w.workID
		WHERE works_fts MATCH ?
		ORDER BY rank
		LIMIT ?
	`

	rows, err := db.conn.Query(query, ftsQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var (
			workID int64
			title  string
			typ    string
			year   *string
			status string
			rank   float64
		)
		if err := rows.Scan(&workID, &title, &typ, &year, &status, &rank); err != nil {
			return nil, err
		}

		subtitle := typ
		if year != nil && *year != "" {
			subtitle += " (" + *year + ")"
		}

		results = append(results, models.SearchResult{
			EntityType: "work",
			EntityID:   workID,
			Title:      title,
			Subtitle:   subtitle,
			Snippet:    status,
			Rank:       rank,
		})
	}

	return results, rows.Err()
}

func (db *DB) searchOrganizations(ftsQuery string, limit int) ([]models.SearchResult, error) {
	query := `
		SELECT 
			o.orgID,
			o.name,
			o.type,
			o.status,
			o.accepts,
			bm25(orgs_fts) as rank
		FROM orgs_fts
		JOIN Organizations o ON orgs_fts.rowid = o.orgID
		WHERE orgs_fts MATCH ?
		ORDER BY rank
		LIMIT ?
	`

	rows, err := db.conn.Query(query, ftsQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var (
			orgID   int64
			name    string
			typ     *string
			status  *string
			accepts *string
			rank    float64
		)
		if err := rows.Scan(&orgID, &name, &typ, &status, &accepts, &rank); err != nil {
			return nil, err
		}

		subtitle := ""
		if typ != nil {
			subtitle = *typ
		}
		if status != nil && *status != "" {
			if subtitle != "" {
				subtitle += " • "
			}
			subtitle += *status
		}

		snippet := ""
		if accepts != nil {
			snippet = *accepts
		}

		results = append(results, models.SearchResult{
			EntityType: "organization",
			EntityID:   orgID,
			Title:      name,
			Subtitle:   subtitle,
			Snippet:    snippet,
			Rank:       rank,
		})
	}

	return results, rows.Err()
}

func (db *DB) searchNotes(likeQuery string, limit int) ([]models.SearchResult, error) {
	query := `
		SELECT 
			n.id,
			n.entity_type,
			n.entity_id,
			n.type,
			n.note,
			CASE 
				WHEN n.entity_type = 'work' THEN COALESCE(w.title, 'Unknown Work')
				WHEN n.entity_type = 'journal' THEN COALESCE(o.name, 'Unknown Journal')
				ELSE 'Unknown'
			END as entity_name
		FROM Notes n
		LEFT JOIN Works w ON n.entity_type = 'work' AND n.entity_id = w.workID
		LEFT JOIN Organizations o ON n.entity_type = 'journal' AND n.entity_id = o.orgID
		WHERE n.note LIKE ?
		ORDER BY n.id DESC
		LIMIT ?
	`

	rows, err := db.conn.Query(query, likeQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var (
			noteID     int64
			entityType string
			entityID   int64
			noteType   *string
			noteText   string
			entityName string
		)
		if err := rows.Scan(&noteID, &entityType, &entityID, &noteType, &noteText, &entityName); err != nil {
			return nil, err
		}

		// Build subtitle: "Work Note" or "Journal Note" + note type
		subtitle := ""
		switch entityType {
		case "work":
			subtitle = "Work"
		case "journal":
			subtitle = "Journal"
		}
		if noteType != nil && *noteType != "" {
			subtitle += " • " + *noteType
		}

		// Truncate note text for snippet
		snippet := noteText
		if len(snippet) > 100 {
			snippet = snippet[:100] + "..."
		}

		results = append(results, models.SearchResult{
			EntityType: "note",
			EntityID:   noteID,
			Title:      entityName,
			Subtitle:   subtitle,
			Snippet:    snippet,
			Rank:       0,
		})
	}

	return results, rows.Err()
}

func (db *DB) searchSubmissions(likeQuery string, limit int) ([]models.SearchResult, error) {
	query := `
		SELECT 
			s.submissionID,
			w.title,
			o.name,
			s.contest_name,
			s.submission_date,
			s.response_type
		FROM Submissions s
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE s.contest_name LIKE ?
		   OR w.title LIKE ?
		   OR o.name LIKE ?
		ORDER BY s.submission_date DESC
		LIMIT ?
	`

	rows, err := db.conn.Query(query, likeQuery, likeQuery, likeQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var (
			submissionID   int64
			workTitle      *string
			journalName    *string
			contestName    *string
			submissionDate *string
			responseType   *string
		)
		if err := rows.Scan(&submissionID, &workTitle, &journalName, &contestName, &submissionDate, &responseType); err != nil {
			return nil, err
		}

		// Title: "Work Title → Journal Name"
		title := ""
		if workTitle != nil {
			title = *workTitle
		}
		if journalName != nil {
			title += " → " + *journalName
		}

		// Subtitle: date and response
		subtitle := ""
		if submissionDate != nil && *submissionDate != "" {
			subtitle = *submissionDate
		}
		if responseType != nil && *responseType != "" {
			if subtitle != "" {
				subtitle += " • "
			}
			subtitle += *responseType
		}

		// Snippet: contest name if present
		snippet := ""
		if contestName != nil {
			snippet = *contestName
		}

		results = append(results, models.SearchResult{
			EntityType: "submission",
			EntityID:   submissionID,
			Title:      title,
			Subtitle:   subtitle,
			Snippet:    snippet,
			Rank:       0,
		})
	}

	return results, rows.Err()
}

func escapeFTSQuery(query string) string {
	query = strings.TrimSpace(query)
	words := strings.Fields(query)
	for i, word := range words {
		word = strings.ReplaceAll(word, "\"", "")
		word = strings.ReplaceAll(word, "'", "")
		words[i] = "\"" + word + "\"*"
	}
	return strings.Join(words, " ")
}
