package db

import (
	"fmt"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

const (
	orderByRankLimit = `
		ORDER BY rank
		LIMIT ?
	`
)

var entityFilters = map[string]string{
	"works":       "works",
	"orgs":        "orgs",
	"journals":    "orgs",
	"notes":       "notes",
	"submissions": "submissions",
}

func (db *DB) Search(query string, limit int, showDeleted bool) (*models.SearchResponse, error) {
	parsed := parseQuery(query)

	response := &models.SearchResponse{
		Results:     []models.SearchResult{},
		ParsedQuery: parsed,
	}

	if len(parsed.Terms) == 0 && len(parsed.Phrases) == 0 {
		return response, nil
	}

	if limit <= 0 {
		limit = 20
	}

	ftsQuery := buildFTSQuery(parsed)
	if ftsQuery == "" {
		return response, nil
	}

	searchAll := len(parsed.EntityFilter) == 0
	filterSet := make(map[string]bool)
	for _, f := range parsed.EntityFilter {
		filterSet[f] = true
	}

	if searchAll || filterSet["works"] {
		worksResults, err := db.searchWorks(ftsQuery, limit, showDeleted)
		if err != nil {
			return nil, fmt.Errorf("search works: %w", err)
		}
		response.Results = append(response.Results, worksResults...)
	}

	if searchAll || filterSet["orgs"] {
		orgsResults, err := db.searchOrganizations(ftsQuery, limit, showDeleted)
		if err != nil {
			return nil, fmt.Errorf("search organizations: %w", err)
		}
		response.Results = append(response.Results, orgsResults...)
	}

	if searchAll || filterSet["notes"] {
		notesResults, err := db.searchNotes(ftsQuery, limit, showDeleted)
		if err != nil {
			return nil, fmt.Errorf("search notes: %w", err)
		}
		response.Results = append(response.Results, notesResults...)
	}

	if searchAll || filterSet["submissions"] {
		submissionsResults, err := db.searchSubmissions(ftsQuery, limit, showDeleted)
		if err != nil {
			return nil, fmt.Errorf("search submissions: %w", err)
		}
		response.Results = append(response.Results, submissionsResults...)
	}

	if len(response.Results) > limit {
		response.Results = response.Results[:limit]
	}

	return response, nil
}

func (db *DB) searchWorks(ftsQuery string, limit int, showDeleted bool) ([]models.SearchResult, error) {
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
		WHERE works_fts MATCH ?`

	if !showDeleted {
		query += ` AND (w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')`
	}

	query += orderByRankLimit

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

func (db *DB) searchOrganizations(ftsQuery string, limit int, showDeleted bool) ([]models.SearchResult, error) {
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
		WHERE orgs_fts MATCH ?`

	if !showDeleted {
		query += ` AND (o.attributes IS NULL OR o.attributes NOT LIKE '%deleted%')`
	}

	query += orderByRankLimit

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

func (db *DB) searchNotes(ftsQuery string, limit int, showDeleted bool) ([]models.SearchResult, error) {
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
			END as entity_name,
			bm25(notes_fts) as rank
		FROM notes_fts
		JOIN Notes n ON notes_fts.rowid = n.id
		LEFT JOIN Works w ON n.entity_type = 'work' AND n.entity_id = w.workID
		LEFT JOIN Organizations o ON n.entity_type = 'journal' AND n.entity_id = o.orgID
		WHERE notes_fts MATCH ?`

	if !showDeleted {
		query += ` AND (n.attributes IS NULL OR n.attributes NOT LIKE '%deleted%')`
	}

	query += orderByRankLimit

	rows, err := db.conn.Query(query, ftsQuery, limit)
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
			rank       float64
		)
		if err := rows.Scan(&noteID, &entityType, &entityID, &noteType, &noteText, &entityName, &rank); err != nil {
			return nil, err
		}

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

		snippet := noteText
		if len(snippet) > 100 {
			snippet = snippet[:100] + "..."
		}

		results = append(results, models.SearchResult{
			EntityType:       "note",
			EntityID:         noteID,
			Title:            entityName,
			Subtitle:         subtitle,
			Snippet:          snippet,
			Rank:             rank,
			ParentEntityType: entityType,
			ParentEntityID:   entityID,
		})
	}

	return results, rows.Err()
}

func (db *DB) searchSubmissions(ftsQuery string, limit int, showDeleted bool) ([]models.SearchResult, error) {
	query := `
		SELECT 
			s.submissionID,
			w.title,
			o.name,
			s.contest_name,
			s.submission_date,
			s.response_type,
			bm25(submissions_fts) as rank
		FROM submissions_fts
		JOIN Submissions s ON submissions_fts.rowid = s.submissionID
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE submissions_fts MATCH ?`

	if !showDeleted {
		query += ` AND (s.attributes IS NULL OR s.attributes NOT LIKE '%deleted%')`
	}

	query += orderByRankLimit

	rows, err := db.conn.Query(query, ftsQuery, limit)
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
			rank           float64
		)
		if err := rows.Scan(&submissionID, &workTitle, &journalName, &contestName, &submissionDate, &responseType, &rank); err != nil {
			return nil, err
		}

		title := ""
		if workTitle != nil {
			title = *workTitle
		}
		if journalName != nil {
			title += " → " + *journalName
		}

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
			Rank:       rank,
		})
	}

	return results, rows.Err()
}

func parseQuery(raw string) models.ParsedQuery {
	result := models.ParsedQuery{
		RawQuery:     raw,
		Terms:        []string{},
		Phrases:      []string{},
		Exclusions:   []string{},
		EntityFilter: []string{},
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		return result
	}

	tokens := tokenize(raw)

	for _, token := range tokens {
		lower := strings.ToLower(token)

		if strings.HasPrefix(lower, "in:") {
			key := strings.TrimPrefix(lower, "in:")
			if canonical, ok := entityFilters[key]; ok {
				result.EntityFilter = append(result.EntityFilter, canonical)
			}
			continue
		}

		if strings.HasPrefix(token, "-") {
			exclusion := strings.TrimPrefix(token, "-")
			if strings.HasPrefix(exclusion, "\"") && strings.HasSuffix(exclusion, "\"") {
				exclusion = strings.Trim(exclusion, "\"")
			}
			if exclusion != "" {
				result.Exclusions = append(result.Exclusions, exclusion)
			}
			continue
		}

		if strings.HasPrefix(token, "\"") && strings.HasSuffix(token, "\"") {
			phrase := strings.Trim(token, "\"")
			if phrase != "" {
				result.Phrases = append(result.Phrases, phrase)
			}
			continue
		}

		if token != "" {
			result.Terms = append(result.Terms, token)
		}
	}

	return result
}

func tokenize(input string) []string {
	var tokens []string
	var current strings.Builder
	inQuotes := false

	for i := 0; i < len(input); i++ {
		c := input[i]

		if c == '"' {
			if inQuotes {
				current.WriteByte(c)
				tokens = append(tokens, current.String())
				current.Reset()
				inQuotes = false
			} else {
				inQuotes = true
				current.WriteByte(c)
			}
			continue
		}

		if c == '-' && current.Len() == 0 && !inQuotes {
			current.WriteByte(c)
			continue
		}

		if c == ' ' && !inQuotes {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			continue
		}

		current.WriteByte(c)
	}

	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}

	return tokens
}

func buildFTSQuery(parsed models.ParsedQuery) string {
	parts := make([]string, 0, len(parsed.Phrases)+len(parsed.Terms)+len(parsed.Exclusions))

	for _, phrase := range parsed.Phrases {
		parts = append(parts, "\""+phrase+"\"")
	}

	for _, term := range parsed.Terms {
		clean := strings.ReplaceAll(term, "\"", "")
		clean = strings.ReplaceAll(clean, "'", "")
		if clean != "" {
			parts = append(parts, "\""+clean+"\"*")
		}
	}

	for _, exclusion := range parsed.Exclusions {
		clean := strings.ReplaceAll(exclusion, "\"", "")
		clean = strings.ReplaceAll(clean, "'", "")
		if clean != "" {
			parts = append(parts, "NOT \""+clean+"\"")
		}
	}

	return strings.Join(parts, " ")
}
