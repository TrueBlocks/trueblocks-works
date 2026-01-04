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
