package analysis

import "time"

// Provider represents an LLM provider
type Provider string

const (
	ProviderOpenAI    Provider = "openai"
	ProviderAnthropic Provider = "anthropic"
	ProviderOllama    Provider = "ollama"
)

// Model represents an LLM model
type Model struct {
	Provider    Provider `json:"provider"`
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
}

// ProviderInfo contains information about an LLM provider
type ProviderInfo struct {
	Name        string  `json:"name"`
	DisplayName string  `json:"displayName"`
	Models      []Model `json:"models"`
	Configured  bool    `json:"configured"`
}

// GenreMode represents the genre-specific analysis mode
type GenreMode string

const (
	GenrePoetry     GenreMode = "poetry"
	GenreFiction    GenreMode = "fiction"
	GenreNonfiction GenreMode = "nonfiction"
)

// WorkResult contains the analysis result for a single work
type WorkResult struct {
	ID               int64        `json:"id"`
	WorkID           int64        `json:"workID"`
	AnalyzedAt       time.Time    `json:"analyzedAt"`
	Provider         string       `json:"provider"`
	Model            string       `json:"model"`
	GenreMode        GenreMode    `json:"genreMode"`
	TechnicalScore   int          `json:"technicalScore"`
	TechnicalSummary string       `json:"technicalSummary"`
	StyleScore       int          `json:"styleScore"`
	StyleSummary     string       `json:"styleSummary"`
	StructureScore   int          `json:"structureScore"`
	StructureSummary string       `json:"structureSummary"`
	ContentScore     int          `json:"contentScore"`
	ContentSummary   string       `json:"contentSummary"`
	GenreScore       int          `json:"genreScore"`
	GenreSummary     string       `json:"genreSummary"`
	OverallSummary   string       `json:"overallSummary"`
	Annotations      []Annotation `json:"annotations"`
}

// Annotation represents a line-level issue annotation
type Annotation struct {
	ID              int64  `json:"id"`
	AnalysisID      int64  `json:"analysisID"`
	ParagraphNum    int    `json:"paragraphNum"`
	TextSnippet     string `json:"textSnippet"`
	IssueType       string `json:"issueType"`
	Message         string `json:"message"`
	ScoreImpact     int    `json:"scoreImpact"`
	Dismissed       bool   `json:"dismissed"`
	DismissedReason string `json:"dismissedReason,omitempty"`
}

// CollectionResult contains the analysis result for a collection
type CollectionResult struct {
	ID                  int64               `json:"id"`
	CollID              int64               `json:"collID"`
	AnalyzedAt          time.Time           `json:"analyzedAt"`
	Provider            string              `json:"provider"`
	Model               string              `json:"model"`
	SequenceSummary     string              `json:"sequenceSummary"`
	SequenceSuggestions []ReorderSuggestion `json:"sequenceSuggestions"`
	ThemesSummary       string              `json:"themesSummary"`
	PacingSummary       string              `json:"pacingSummary"`
	BalanceSummary      string              `json:"balanceSummary"`
	GapsSummary         string              `json:"gapsSummary"`
	OverallSummary      string              `json:"overallSummary"`
}

// ReorderSuggestion represents a suggestion to reorder works
type ReorderSuggestion struct {
	WorkID       int64  `json:"workID"`
	WorkTitle    string `json:"workTitle"`
	CurrentPos   int    `json:"currentPos"`
	SuggestedPos int    `json:"suggestedPos"`
	Rationale    string `json:"rationale"`
}

// WorkSummary contains minimal info for collection-level analysis
type WorkSummary struct {
	WorkID   int64  `json:"workID"`
	Title    string `json:"title"`
	Type     string `json:"type"`
	Preview  string `json:"preview"`
	Position int    `json:"position"`
}
