package analysis

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Storage handles persistence of analysis results
type Storage struct {
	db *sql.DB
}

// NewStorage creates a new analysis storage
func NewStorage(db *sql.DB) *Storage {
	return &Storage{db: db}
}

// SaveWorkAnalysis persists a work analysis result
func (s *Storage) SaveWorkAnalysis(result *WorkResult, rawResponse string) (int64, error) {
	query := `INSERT INTO WorkAnalyses (
		workID, analyzed_at, provider, model, genre_mode,
		technical_score, technical_summary,
		style_score, style_summary,
		structure_score, structure_summary,
		content_score, content_summary,
		genre_score, genre_summary,
		overall_summary, raw_response
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	res, err := s.db.Exec(query,
		result.WorkID,
		result.AnalyzedAt.Format(time.RFC3339),
		result.Provider,
		result.Model,
		result.GenreMode,
		result.TechnicalScore,
		result.TechnicalSummary,
		result.StyleScore,
		result.StyleSummary,
		result.StructureScore,
		result.StructureSummary,
		result.ContentScore,
		result.ContentSummary,
		result.GenreScore,
		result.GenreSummary,
		result.OverallSummary,
		rawResponse,
	)
	if err != nil {
		return 0, fmt.Errorf("insert work analysis: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("get last insert id: %w", err)
	}

	// Save annotations
	for _, ann := range result.Annotations {
		ann.AnalysisID = id
		if err := s.SaveAnnotation(&ann); err != nil {
			return id, fmt.Errorf("save annotation: %w", err)
		}
	}

	return id, nil
}

// SaveAnnotation persists an annotation
func (s *Storage) SaveAnnotation(ann *Annotation) error {
	query := `INSERT INTO AnalysisAnnotations (
		analysisID, paragraph_num, text_snippet, issue_type,
		message, score_impact, dismissed, dismissed_reason
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query,
		ann.AnalysisID,
		ann.ParagraphNum,
		ann.TextSnippet,
		ann.IssueType,
		ann.Message,
		ann.ScoreImpact,
		ann.Dismissed,
		ann.DismissedReason,
	)
	return err
}

// GetWorkAnalysis retrieves the latest analysis for a work
func (s *Storage) GetWorkAnalysis(workID int64) (*WorkResult, error) {
	query := `SELECT id, workID, analyzed_at, provider, model, genre_mode,
		technical_score, technical_summary,
		style_score, style_summary,
		structure_score, structure_summary,
		content_score, content_summary,
		genre_score, genre_summary,
		overall_summary
	FROM WorkAnalyses WHERE workID = ? ORDER BY analyzed_at DESC LIMIT 1`

	row := s.db.QueryRow(query, workID)
	result, err := scanWorkResult(row)
	if err != nil {
		return nil, err
	}

	// Load annotations
	annotations, err := s.GetAnnotations(result.ID)
	if err != nil {
		return nil, err
	}
	result.Annotations = annotations

	return result, nil
}

// GetWorkAnalysisHistory retrieves all analyses for a work
func (s *Storage) GetWorkAnalysisHistory(workID int64) ([]*WorkResult, error) {
	query := `SELECT id, workID, analyzed_at, provider, model, genre_mode,
		technical_score, technical_summary,
		style_score, style_summary,
		structure_score, structure_summary,
		content_score, content_summary,
		genre_score, genre_summary,
		overall_summary
	FROM WorkAnalyses WHERE workID = ? ORDER BY analyzed_at DESC`

	rows, err := s.db.Query(query, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*WorkResult
	for rows.Next() {
		result, err := scanWorkResultRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return results, nil
}

// GetAnnotations retrieves annotations for an analysis
func (s *Storage) GetAnnotations(analysisID int64) ([]Annotation, error) {
	query := `SELECT id, analysisID, paragraph_num, text_snippet, issue_type,
		message, score_impact, dismissed, dismissed_reason
	FROM AnalysisAnnotations WHERE analysisID = ?`

	rows, err := s.db.Query(query, analysisID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var annotations []Annotation
	for rows.Next() {
		var ann Annotation
		var dismissedReason sql.NullString
		err := rows.Scan(
			&ann.ID, &ann.AnalysisID, &ann.ParagraphNum, &ann.TextSnippet,
			&ann.IssueType, &ann.Message, &ann.ScoreImpact,
			&ann.Dismissed, &dismissedReason,
		)
		if err != nil {
			return nil, err
		}
		ann.DismissedReason = dismissedReason.String
		annotations = append(annotations, ann)
	}

	return annotations, nil
}

// DismissAnnotation marks an annotation as dismissed
func (s *Storage) DismissAnnotation(annotationID int64, reason string) error {
	query := `UPDATE AnalysisAnnotations SET dismissed = 1, dismissed_reason = ? WHERE id = ?`
	_, err := s.db.Exec(query, reason, annotationID)
	return err
}

// UndismissAnnotation removes dismissal from an annotation
func (s *Storage) UndismissAnnotation(annotationID int64) error {
	query := `UPDATE AnalysisAnnotations SET dismissed = 0, dismissed_reason = NULL WHERE id = ?`
	_, err := s.db.Exec(query, annotationID)
	return err
}

// SaveCollectionAnalysis persists a collection analysis result
func (s *Storage) SaveCollectionAnalysis(result *CollectionResult, rawResponse string) (int64, error) {
	suggestionsJSON, _ := json.Marshal(result.SequenceSuggestions)

	query := `INSERT INTO CollectionAnalyses (
		collID, analyzed_at, provider, model,
		sequence_summary, sequence_suggestions,
		themes_summary, pacing_summary, balance_summary,
		gaps_summary, overall_summary, raw_response
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	res, err := s.db.Exec(query,
		result.CollID,
		result.AnalyzedAt.Format(time.RFC3339),
		result.Provider,
		result.Model,
		result.SequenceSummary,
		string(suggestionsJSON),
		result.ThemesSummary,
		result.PacingSummary,
		result.BalanceSummary,
		result.GapsSummary,
		result.OverallSummary,
		rawResponse,
	)
	if err != nil {
		return 0, fmt.Errorf("insert collection analysis: %w", err)
	}

	return res.LastInsertId()
}

// GetCollectionAnalysis retrieves the latest analysis for a collection
func (s *Storage) GetCollectionAnalysis(collID int64) (*CollectionResult, error) {
	query := `SELECT id, collID, analyzed_at, provider, model,
		sequence_summary, sequence_suggestions,
		themes_summary, pacing_summary, balance_summary,
		gaps_summary, overall_summary
	FROM CollectionAnalyses WHERE collID = ? ORDER BY analyzed_at DESC LIMIT 1`

	row := s.db.QueryRow(query, collID)
	return scanCollectionResult(row)
}

// GetCollectionAnalysisHistory retrieves all analyses for a collection
func (s *Storage) GetCollectionAnalysisHistory(collID int64) ([]*CollectionResult, error) {
	query := `SELECT id, collID, analyzed_at, provider, model,
		sequence_summary, sequence_suggestions,
		themes_summary, pacing_summary, balance_summary,
		gaps_summary, overall_summary
	FROM CollectionAnalyses WHERE collID = ? ORDER BY analyzed_at DESC`

	rows, err := s.db.Query(query, collID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []*CollectionResult
	for rows.Next() {
		result, err := scanCollectionResultRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, result)
	}

	return results, nil
}

func scanWorkResult(row *sql.Row) (*WorkResult, error) {
	var r WorkResult
	var analyzedAt string
	err := row.Scan(
		&r.ID, &r.WorkID, &analyzedAt, &r.Provider, &r.Model, &r.GenreMode,
		&r.TechnicalScore, &r.TechnicalSummary,
		&r.StyleScore, &r.StyleSummary,
		&r.StructureScore, &r.StructureSummary,
		&r.ContentScore, &r.ContentSummary,
		&r.GenreScore, &r.GenreSummary,
		&r.OverallSummary,
	)
	if err != nil {
		return nil, err
	}
	r.AnalyzedAt, _ = time.Parse(time.RFC3339, analyzedAt)
	return &r, nil
}

func scanWorkResultRows(rows *sql.Rows) (*WorkResult, error) {
	var r WorkResult
	var analyzedAt string
	err := rows.Scan(
		&r.ID, &r.WorkID, &analyzedAt, &r.Provider, &r.Model, &r.GenreMode,
		&r.TechnicalScore, &r.TechnicalSummary,
		&r.StyleScore, &r.StyleSummary,
		&r.StructureScore, &r.StructureSummary,
		&r.ContentScore, &r.ContentSummary,
		&r.GenreScore, &r.GenreSummary,
		&r.OverallSummary,
	)
	if err != nil {
		return nil, err
	}
	r.AnalyzedAt, _ = time.Parse(time.RFC3339, analyzedAt)
	return &r, nil
}

func scanCollectionResult(row *sql.Row) (*CollectionResult, error) {
	var r CollectionResult
	var analyzedAt, suggestionsJSON string
	err := row.Scan(
		&r.ID, &r.CollID, &analyzedAt, &r.Provider, &r.Model,
		&r.SequenceSummary, &suggestionsJSON,
		&r.ThemesSummary, &r.PacingSummary, &r.BalanceSummary,
		&r.GapsSummary, &r.OverallSummary,
	)
	if err != nil {
		return nil, err
	}
	r.AnalyzedAt, _ = time.Parse(time.RFC3339, analyzedAt)
	_ = json.Unmarshal([]byte(suggestionsJSON), &r.SequenceSuggestions)
	return &r, nil
}

func scanCollectionResultRows(rows *sql.Rows) (*CollectionResult, error) {
	var r CollectionResult
	var analyzedAt, suggestionsJSON string
	err := rows.Scan(
		&r.ID, &r.CollID, &analyzedAt, &r.Provider, &r.Model,
		&r.SequenceSummary, &suggestionsJSON,
		&r.ThemesSummary, &r.PacingSummary, &r.BalanceSummary,
		&r.GapsSummary, &r.OverallSummary,
	)
	if err != nil {
		return nil, err
	}
	r.AnalyzedAt, _ = time.Parse(time.RFC3339, analyzedAt)
	_ = json.Unmarshal([]byte(suggestionsJSON), &r.SequenceSuggestions)
	return &r, nil
}
