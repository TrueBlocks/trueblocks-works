package fts

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Searcher provides search functionality for the FTS index.
type Searcher struct {
	ftsDB  *Database
	mainDB *sql.DB
}

// NewSearcher creates a new Searcher instance.
func NewSearcher(ftsDB *Database, mainDB *sql.DB) *Searcher {
	return &Searcher{
		ftsDB:  ftsDB,
		mainDB: mainDB,
	}
}

// Search performs a full-text search and returns matching documents with snippets.
func (s *Searcher) Search(q Query) (*SearchResponse, error) {
	if err := s.ftsDB.ensureOpen(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	conn := s.ftsDB.Conn()
	if conn == nil {
		return nil, fmt.Errorf("fts database not open")
	}

	ftsQuery := buildFTSQuery(q.Text)
	if ftsQuery == "" {
		return &SearchResponse{
			Query:   q,
			Results: []Result{},
		}, nil
	}

	limit := q.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	baseSQL := `
		SELECT c.work_id, c.text_content, c.word_count,
		       snippet(content_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
		       bm25(content_fts) as rank
		FROM content_fts
		JOIN content c ON c.work_id = content_fts.rowid
		WHERE content_fts MATCH ?
	`
	countSQL := `
		SELECT COUNT(*)
		FROM content_fts
		WHERE content_fts MATCH ?
	`

	args := []interface{}{ftsQuery}
	countArgs := []interface{}{ftsQuery}

	if len(q.Filters.Types) > 0 || len(q.Filters.Years) > 0 || len(q.Filters.Statuses) > 0 || len(q.Filters.WorkIDs) > 0 {
		workIDs, err := s.getFilteredWorkIDs(q.Filters)
		if err != nil {
			return nil, fmt.Errorf("filter works: %w", err)
		}
		if len(workIDs) == 0 {
			return &SearchResponse{
				Query:   q,
				Results: []Result{},
			}, nil
		}

		placeholders := make([]string, len(workIDs))
		for i := range workIDs {
			placeholders[i] = "?"
		}
		filterClause := fmt.Sprintf(" AND c.work_id IN (%s)", strings.Join(placeholders, ","))
		baseSQL += filterClause

		for _, id := range workIDs {
			args = append(args, id)
		}
	}

	baseSQL += " ORDER BY rank LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := conn.Query(baseSQL, args...)
	if err != nil {
		return nil, fmt.Errorf("search query: %w", err)
	}
	defer rows.Close()

	var results []Result
	workIDs := make([]int, 0)
	for rows.Next() {
		var r Result
		var rank float64
		if err := rows.Scan(&r.WorkID, &r.TextContent, &r.WordCount, &r.Snippet, &rank); err != nil {
			return nil, fmt.Errorf("scan result: %w", err)
		}
		r.Rank = float32(rank)
		results = append(results, r)
		workIDs = append(workIDs, r.WorkID)
	}

	if err := s.enrichWithMetadata(results, workIDs); err != nil {
		return nil, fmt.Errorf("enrich metadata: %w", err)
	}

	var totalCount int
	if err := conn.QueryRow(countSQL, countArgs...).Scan(&totalCount); err != nil {
		return nil, fmt.Errorf("count query: %w", err)
	}

	return &SearchResponse{
		Query:      q,
		Results:    results,
		TotalCount: totalCount,
	}, nil
}

// GetDocumentContent retrieves the full extracted text for a single work.
func (s *Searcher) GetDocumentContent(workID int) (*ExtractionResult, error) {
	if err := s.ftsDB.ensureOpen(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	conn := s.ftsDB.Conn()
	var result ExtractionResult
	var extractedAtStr string
	err := conn.QueryRow(`
		SELECT work_id, text_content, word_count, extracted_at, source_mtime, source_size
		FROM content
		WHERE work_id = ?
	`, workID).Scan(
		&result.WorkID,
		&result.TextContent,
		&result.WordCount,
		&extractedAtStr,
		&result.SourceMtime,
		&result.SourceSize,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query content: %w", err)
	}
	result.ExtractedAt, _ = time.Parse(time.RFC3339, extractedAtStr)
	return &result, nil
}

// BatchGetContent retrieves extracted text for multiple works (for AI batch queries).
func (s *Searcher) BatchGetContent(workIDs []int) ([]ExtractionResult, error) {
	if len(workIDs) == 0 {
		return []ExtractionResult{}, nil
	}

	if err := s.ftsDB.ensureOpen(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	conn := s.ftsDB.Conn()

	placeholders := make([]string, len(workIDs))
	args := make([]interface{}, len(workIDs))
	for i, id := range workIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT work_id, text_content, word_count, extracted_at, source_mtime, source_size
		FROM content
		WHERE work_id IN (%s)
	`, strings.Join(placeholders, ","))

	rows, err := conn.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("batch query: %w", err)
	}
	defer rows.Close()

	var results []ExtractionResult
	for rows.Next() {
		var r ExtractionResult
		var extractedAtStr string
		if err := rows.Scan(&r.WorkID, &r.TextContent, &r.WordCount, &extractedAtStr, &r.SourceMtime, &r.SourceSize); err != nil {
			return nil, fmt.Errorf("scan batch result: %w", err)
		}
		r.ExtractedAt, _ = time.Parse(time.RFC3339, extractedAtStr)
		results = append(results, r)
	}

	return results, nil
}

// buildFTSQuery converts user input to FTS5 query syntax.
// For now, we use simple prefix matching with proper escaping.
func buildFTSQuery(input string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return ""
	}

	words := strings.Fields(input)
	for i, word := range words {
		escaped := strings.ReplaceAll(word, `"`, `""`)
		words[i] = `"` + escaped + `"*`
	}

	return strings.Join(words, " ")
}

// getFilteredWorkIDs returns work IDs matching the filter criteria from works.db.
func (s *Searcher) getFilteredWorkIDs(f Filters) ([]int, error) {
	if s.mainDB == nil {
		return nil, fmt.Errorf("main database not available")
	}

	if len(f.WorkIDs) > 0 {
		return f.WorkIDs, nil
	}

	var conditions []string
	var args []interface{}

	if len(f.Types) > 0 {
		placeholders := make([]string, len(f.Types))
		for i, t := range f.Types {
			placeholders[i] = "?"
			args = append(args, t)
		}
		conditions = append(conditions, fmt.Sprintf("type IN (%s)", strings.Join(placeholders, ",")))
	}

	if len(f.Years) > 0 {
		placeholders := make([]string, len(f.Years))
		for i, y := range f.Years {
			placeholders[i] = "?"
			args = append(args, y)
		}
		conditions = append(conditions, fmt.Sprintf("year IN (%s)", strings.Join(placeholders, ",")))
	}

	if len(f.Statuses) > 0 {
		placeholders := make([]string, len(f.Statuses))
		for i, st := range f.Statuses {
			placeholders[i] = "?"
			args = append(args, st)
		}
		conditions = append(conditions, fmt.Sprintf("status IN (%s)", strings.Join(placeholders, ",")))
	}

	if len(conditions) == 0 {
		return nil, nil
	}

	query := "SELECT workID FROM Works WHERE " + strings.Join(conditions, " AND ")
	rows, err := s.mainDB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("filter query: %w", err)
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan work id: %w", err)
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// enrichWithMetadata adds work metadata (title, type, year, status) to search results.
func (s *Searcher) enrichWithMetadata(results []Result, workIDs []int) error {
	if s.mainDB == nil || len(workIDs) == 0 {
		return nil
	}

	placeholders := make([]string, len(workIDs))
	args := make([]interface{}, len(workIDs))
	for i, id := range workIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT workID, title, type, year, status
		FROM Works
		WHERE workID IN (%s)
	`, strings.Join(placeholders, ","))

	rows, err := s.mainDB.Query(query, args...)
	if err != nil {
		return fmt.Errorf("metadata query: %w", err)
	}
	defer rows.Close()

	metadata := make(map[int]struct {
		Title  string
		Type   string
		Year   string
		Status string
	})
	for rows.Next() {
		var id int
		var m struct {
			Title  string
			Type   string
			Year   string
			Status string
		}
		if err := rows.Scan(&id, &m.Title, &m.Type, &m.Year, &m.Status); err != nil {
			return fmt.Errorf("scan metadata: %w", err)
		}
		metadata[id] = m
	}

	for i := range results {
		if m, ok := metadata[results[i].WorkID]; ok {
			results[i].Title = m.Title
			results[i].Type = m.Type
			results[i].Year = m.Year
			results[i].Status = m.Status
		}
	}

	return nil
}
