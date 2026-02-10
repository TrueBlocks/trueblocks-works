package app

import (
	"context"
	"fmt"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/analysis"
)

// GetAnalysisEnabled returns whether analysis feature is enabled
func (a *App) GetAnalysisEnabled() bool {
	s := a.settings.Get()
	return s.AnalysisEnabled
}

// GetAvailableProviders returns information about all available LLM providers
func (a *App) GetAvailableProviders() []analysis.ProviderInfo {
	s := a.settings.Get()
	return analysis.GetAvailableProviders(s.OpenAIAPIKey, s.AnthropicAPIKey, s.OllamaEndpoint)
}

// TestProviderConnection tests connection to an LLM provider
func (a *App) TestProviderConnection(providerName, model string) error {
	s := a.settings.Get()
	cfg := analysis.ProviderConfig{
		Provider: analysis.Provider(providerName),
		Model:    model,
	}

	switch analysis.Provider(providerName) {
	case analysis.ProviderOpenAI:
		cfg.APIKey = s.OpenAIAPIKey
	case analysis.ProviderAnthropic:
		cfg.APIKey = s.AnthropicAPIKey
	case analysis.ProviderOllama:
		cfg.Endpoint = s.OllamaEndpoint
	}

	provider, err := analysis.NewProvider(cfg)
	if err != nil {
		return err
	}

	return provider.TestConnection(context.Background())
}

// AnalyzeWork performs AI analysis on a single work
func (a *App) AnalyzeWork(workID int64) (*analysis.WorkResult, error) {
	s := a.settings.Get()
	if !s.AnalysisEnabled {
		return nil, fmt.Errorf("analysis feature is not enabled")
	}

	// Validate provider configuration
	provider := s.AnalysisProvider
	if provider == "" {
		return nil, fmt.Errorf("no AI provider configured - go to Settings > AI Analysis to set one")
	}

	// Get work details
	work, err := a.db.GetWork(workID)
	if err != nil {
		return nil, fmt.Errorf("get work: %w", err)
	}

	// Get file path
	filePath := a.fileOps.GetFullPath(work)

	// Create analyzer
	model := s.AnalysisModel
	if model == "" {
		// Default models per provider
		switch analysis.Provider(provider) {
		case analysis.ProviderOpenAI:
			model = "gpt-4o"
		case analysis.ProviderAnthropic:
			model = "claude-sonnet-4-20250514"
		case analysis.ProviderOllama:
			model = "llama3"
		}
	}

	cfg := analysis.ProviderConfig{
		Provider: analysis.Provider(provider),
		Model:    model,
	}
	switch analysis.Provider(provider) {
	case analysis.ProviderOpenAI:
		if s.OpenAIAPIKey == "" {
			return nil, fmt.Errorf("OpenAI API key not configured - go to Settings > AI Analysis")
		}
		cfg.APIKey = s.OpenAIAPIKey
	case analysis.ProviderAnthropic:
		if s.AnthropicAPIKey == "" {
			return nil, fmt.Errorf("anthropic API key not configured - go to Settings > AI Analysis")
		}
		cfg.APIKey = s.AnthropicAPIKey
	case analysis.ProviderOllama:
		if s.OllamaEndpoint == "" {
			cfg.Endpoint = "http://localhost:11434"
		} else {
			cfg.Endpoint = s.OllamaEndpoint
		}
	default:
		return nil, fmt.Errorf("unknown provider: %s - go to Settings > AI Analysis to configure", provider)
	}

	storage := analysis.NewStorage(a.db.Conn())
	analyzer, err := analysis.NewAnalyzer(storage, cfg)
	if err != nil {
		return nil, fmt.Errorf("create analyzer: %w", err)
	}

	return analyzer.AnalyzeWork(context.Background(), workID, work.Title, work.Type, filePath)
}

// GetWorkAnalysis retrieves the latest analysis for a work
func (a *App) GetWorkAnalysis(workID int64) (*analysis.WorkResult, error) {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.GetWorkAnalysis(workID)
}

// GetWorkAnalysisHistory retrieves all analyses for a work
func (a *App) GetWorkAnalysisHistory(workID int64) ([]*analysis.WorkResult, error) {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.GetWorkAnalysisHistory(workID)
}

// DismissAnnotation marks an annotation as intentionally dismissed
func (a *App) DismissAnnotation(annotationID int64, reason string) error {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.DismissAnnotation(annotationID, reason)
}

// UndismissAnnotation removes the dismissal from an annotation
func (a *App) UndismissAnnotation(annotationID int64) error {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.UndismissAnnotation(annotationID)
}

// AnalyzeCollection performs AI analysis on a collection
func (a *App) AnalyzeCollection(collID int64) (*analysis.CollectionResult, error) {
	s := a.settings.Get()
	if !s.AnalysisEnabled {
		return nil, fmt.Errorf("analysis feature is not enabled")
	}

	// Validate provider configuration
	provider := s.AnalysisProvider
	if provider == "" {
		return nil, fmt.Errorf("no AI provider configured - go to Settings > AI Analysis to set one")
	}

	// Get collection details
	coll, err := a.db.GetCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("get collection: %w", err)
	}

	// Get works in collection
	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("get collection works: %w", err)
	}

	// Build work summaries with previews, skipping suppressed works
	summaries := make([]analysis.WorkSummary, 0, len(works))
	for i, w := range works {
		if w.IsSuppressed {
			continue
		}
		filePath := a.fileOps.GetFullPath(&w.Work)
		preview := ""

		extracted, err := analysis.ExtractFromDocx(filePath)
		if err == nil && extracted.FullText != "" {
			preview = analysis.GetPreview(extracted.FullText, 100)
		}

		summaries = append(summaries, analysis.WorkSummary{
			WorkID:   w.WorkID,
			Title:    w.Title,
			Type:     w.Type,
			Preview:  preview,
			Position: i + 1,
		})
	}

	// Create analyzer with defaults
	model := s.AnalysisModel
	if model == "" {
		switch analysis.Provider(provider) {
		case analysis.ProviderOpenAI:
			model = "gpt-4o"
		case analysis.ProviderAnthropic:
			model = "claude-sonnet-4-20250514"
		case analysis.ProviderOllama:
			model = "llama3"
		}
	}

	cfg := analysis.ProviderConfig{
		Provider: analysis.Provider(provider),
		Model:    model,
	}
	switch analysis.Provider(provider) {
	case analysis.ProviderOpenAI:
		if s.OpenAIAPIKey == "" {
			return nil, fmt.Errorf("OpenAI API key not configured - go to Settings > AI Analysis")
		}
		cfg.APIKey = s.OpenAIAPIKey
	case analysis.ProviderAnthropic:
		if s.AnthropicAPIKey == "" {
			return nil, fmt.Errorf("anthropic API key not configured - go to Settings > AI Analysis")
		}
		cfg.APIKey = s.AnthropicAPIKey
	case analysis.ProviderOllama:
		if s.OllamaEndpoint == "" {
			cfg.Endpoint = "http://localhost:11434"
		} else {
			cfg.Endpoint = s.OllamaEndpoint
		}
	default:
		return nil, fmt.Errorf("unknown provider: %s - go to Settings > AI Analysis to configure", provider)
	}

	storage := analysis.NewStorage(a.db.Conn())
	analyzer, err := analysis.NewAnalyzer(storage, cfg)
	if err != nil {
		return nil, fmt.Errorf("create analyzer: %w", err)
	}

	return analyzer.AnalyzeCollection(context.Background(), collID, coll.CollectionName, summaries)
}

// GetCollectionAnalysis retrieves the latest analysis for a collection
func (a *App) GetCollectionAnalysis(collID int64) (*analysis.CollectionResult, error) {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.GetCollectionAnalysis(collID)
}

// GetCollectionAnalysisHistory retrieves all analyses for a collection
func (a *App) GetCollectionAnalysisHistory(collID int64) ([]*analysis.CollectionResult, error) {
	storage := analysis.NewStorage(a.db.Conn())
	return storage.GetCollectionAnalysisHistory(collID)
}
