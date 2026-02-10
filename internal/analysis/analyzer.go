package analysis

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Analyzer orchestrates the analysis process
type Analyzer struct {
	storage  *Storage
	provider LLMProvider
	config   ProviderConfig
}

// NewAnalyzer creates a new analyzer
func NewAnalyzer(storage *Storage, cfg ProviderConfig) (*Analyzer, error) {
	provider, err := NewProvider(cfg)
	if err != nil {
		return nil, err
	}
	return &Analyzer{
		storage:  storage,
		provider: provider,
		config:   cfg,
	}, nil
}

// AnalyzeWork performs analysis on a single work
func (a *Analyzer) AnalyzeWork(ctx context.Context, workID int64, title, workType, filePath string) (*WorkResult, error) {
	// Extract text from file
	extracted, err := ExtractFromDocx(filePath)
	if err != nil {
		return nil, fmt.Errorf("extract text: %w", err)
	}

	// Generate prompt
	prompt := WorkAnalysisPrompt(title, workType, extracted.FullText)

	// Call LLM
	response, err := a.provider.Analyze(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("LLM analysis: %w", err)
	}

	// Parse response
	result, err := parseWorkAnalysisResponse(response)
	if err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	result.WorkID = workID
	result.AnalyzedAt = time.Now()
	result.Provider = string(a.config.Provider)
	result.Model = a.config.Model

	// Save to database
	id, err := a.storage.SaveWorkAnalysis(result, response)
	if err != nil {
		return nil, fmt.Errorf("save analysis: %w", err)
	}
	result.ID = id

	return result, nil
}

// AnalyzeCollection performs collection-level analysis
func (a *Analyzer) AnalyzeCollection(ctx context.Context, collID int64, collName string, summaries []WorkSummary) (*CollectionResult, error) {
	// Generate prompt
	prompt := CollectionAnalysisPrompt(collName, summaries)

	// Call LLM
	response, err := a.provider.Analyze(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("LLM analysis: %w", err)
	}

	// Parse response
	result, err := parseCollectionAnalysisResponse(response)
	if err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	result.CollID = collID
	result.AnalyzedAt = time.Now()
	result.Provider = string(a.config.Provider)
	result.Model = a.config.Model

	// Save to database
	id, err := a.storage.SaveCollectionAnalysis(result, response)
	if err != nil {
		return nil, fmt.Errorf("save analysis: %w", err)
	}
	result.ID = id

	return result, nil
}

type workAnalysisJSON struct {
	GenreMode string `json:"genre_mode"`
	Technical struct {
		Score       int              `json:"score"`
		Summary     string           `json:"summary"`
		Annotations []annotationJSON `json:"annotations"`
	} `json:"technical"`
	Style struct {
		Score       int              `json:"score"`
		Summary     string           `json:"summary"`
		Annotations []annotationJSON `json:"annotations"`
	} `json:"style"`
	Structure struct {
		Score       int              `json:"score"`
		Summary     string           `json:"summary"`
		Annotations []annotationJSON `json:"annotations"`
	} `json:"structure"`
	Content struct {
		Score       int              `json:"score"`
		Summary     string           `json:"summary"`
		Annotations []annotationJSON `json:"annotations"`
	} `json:"content"`
	Genre struct {
		Score       int              `json:"score"`
		Summary     string           `json:"summary"`
		Annotations []annotationJSON `json:"annotations"`
	} `json:"genre"`
	OverallSummary string `json:"overall_summary"`
}

type annotationJSON struct {
	ParagraphNum int    `json:"paragraph_num"`
	TextSnippet  string `json:"text_snippet"`
	IssueType    string `json:"issue_type"`
	Message      string `json:"message"`
	ScoreImpact  int    `json:"score_impact"`
}

// cleanJSONResponse strips markdown code blocks from LLM responses
func cleanJSONResponse(response string) string {
	response = strings.TrimSpace(response)
	// Strip ```json ... ``` or ``` ... ``` wrappers
	if strings.HasPrefix(response, "```json") {
		response = strings.TrimPrefix(response, "```json")
		if idx := strings.LastIndex(response, "```"); idx != -1 {
			response = response[:idx]
		}
	} else if strings.HasPrefix(response, "```") {
		response = strings.TrimPrefix(response, "```")
		if idx := strings.LastIndex(response, "```"); idx != -1 {
			response = response[:idx]
		}
	}
	return strings.TrimSpace(response)
}

func parseWorkAnalysisResponse(response string) (*WorkResult, error) {
	cleaned := cleanJSONResponse(response)
	var parsed workAnalysisJSON
	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	result := &WorkResult{
		GenreMode:        GenreMode(parsed.GenreMode),
		TechnicalScore:   parsed.Technical.Score,
		TechnicalSummary: parsed.Technical.Summary,
		StyleScore:       parsed.Style.Score,
		StyleSummary:     parsed.Style.Summary,
		StructureScore:   parsed.Structure.Score,
		StructureSummary: parsed.Structure.Summary,
		ContentScore:     parsed.Content.Score,
		ContentSummary:   parsed.Content.Summary,
		GenreScore:       parsed.Genre.Score,
		GenreSummary:     parsed.Genre.Summary,
		OverallSummary:   parsed.OverallSummary,
	}

	// Collect all annotations with their types
	for _, a := range parsed.Technical.Annotations {
		result.Annotations = append(result.Annotations, Annotation{
			ParagraphNum: a.ParagraphNum,
			TextSnippet:  a.TextSnippet,
			IssueType:    a.IssueType,
			Message:      a.Message,
			ScoreImpact:  a.ScoreImpact,
		})
	}
	for _, a := range parsed.Style.Annotations {
		result.Annotations = append(result.Annotations, Annotation{
			ParagraphNum: a.ParagraphNum,
			TextSnippet:  a.TextSnippet,
			IssueType:    "style",
			Message:      a.Message,
			ScoreImpact:  a.ScoreImpact,
		})
	}
	for _, a := range parsed.Structure.Annotations {
		result.Annotations = append(result.Annotations, Annotation{
			ParagraphNum: a.ParagraphNum,
			TextSnippet:  a.TextSnippet,
			IssueType:    "structure",
			Message:      a.Message,
			ScoreImpact:  a.ScoreImpact,
		})
	}
	for _, a := range parsed.Content.Annotations {
		result.Annotations = append(result.Annotations, Annotation{
			ParagraphNum: a.ParagraphNum,
			TextSnippet:  a.TextSnippet,
			IssueType:    "content",
			Message:      a.Message,
			ScoreImpact:  a.ScoreImpact,
		})
	}
	for _, a := range parsed.Genre.Annotations {
		result.Annotations = append(result.Annotations, Annotation{
			ParagraphNum: a.ParagraphNum,
			TextSnippet:  a.TextSnippet,
			IssueType:    "genre",
			Message:      a.Message,
			ScoreImpact:  a.ScoreImpact,
		})
	}

	return result, nil
}

type collectionAnalysisJSON struct {
	Sequence struct {
		Summary     string `json:"summary"`
		Suggestions []struct {
			WorkTitle    string `json:"workTitle"`
			CurrentPos   int    `json:"currentPos"`
			SuggestedPos int    `json:"suggestedPos"`
			Rationale    string `json:"rationale"`
		} `json:"suggestions"`
	} `json:"sequence"`
	Themes struct {
		Summary string `json:"summary"`
	} `json:"themes"`
	Pacing struct {
		Summary string `json:"summary"`
	} `json:"pacing"`
	Balance struct {
		Summary string `json:"summary"`
	} `json:"balance"`
	Gaps struct {
		Summary string `json:"summary"`
	} `json:"gaps"`
	OverallSummary string `json:"overall_summary"`
}

func parseCollectionAnalysisResponse(response string) (*CollectionResult, error) {
	cleaned := cleanJSONResponse(response)
	var parsed collectionAnalysisJSON
	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	result := &CollectionResult{
		SequenceSummary: parsed.Sequence.Summary,
		ThemesSummary:   parsed.Themes.Summary,
		PacingSummary:   parsed.Pacing.Summary,
		BalanceSummary:  parsed.Balance.Summary,
		GapsSummary:     parsed.Gaps.Summary,
		OverallSummary:  parsed.OverallSummary,
	}

	for _, s := range parsed.Sequence.Suggestions {
		result.SequenceSuggestions = append(result.SequenceSuggestions, ReorderSuggestion{
			WorkTitle:    s.WorkTitle,
			CurrentPos:   s.CurrentPos,
			SuggestedPos: s.SuggestedPos,
			Rationale:    s.Rationale,
		})
	}

	return result, nil
}
