package analysis

import (
	"context"
	"fmt"
)

// LLMProvider is the interface for LLM providers
type LLMProvider interface {
	Analyze(ctx context.Context, prompt string) (string, error)
	TestConnection(ctx context.Context) error
}

// ProviderConfig holds configuration for an LLM provider
type ProviderConfig struct {
	Provider Provider
	Model    string
	APIKey   string
	Endpoint string // For Ollama
}

// NewProvider creates an LLM provider based on configuration
func NewProvider(cfg ProviderConfig) (LLMProvider, error) {
	switch cfg.Provider {
	case ProviderOpenAI:
		return newOpenAIProvider(cfg)
	case ProviderAnthropic:
		return newAnthropicProvider(cfg)
	case ProviderOllama:
		return newOllamaProvider(cfg)
	default:
		return nil, fmt.Errorf("unknown provider: %s", cfg.Provider)
	}
}

// GetAvailableProviders returns information about all available providers
func GetAvailableProviders(openAIKey, anthropicKey, ollamaEndpoint string) []ProviderInfo {
	providers := []ProviderInfo{
		{
			Name:        string(ProviderOpenAI),
			DisplayName: "OpenAI",
			Models: []Model{
				{Provider: ProviderOpenAI, Name: "gpt-4o", DisplayName: "GPT-4o"},
				{Provider: ProviderOpenAI, Name: "gpt-4o-mini", DisplayName: "GPT-4o Mini"},
				{Provider: ProviderOpenAI, Name: "gpt-4-turbo", DisplayName: "GPT-4 Turbo"},
			},
			Configured: openAIKey != "",
		},
		{
			Name:        string(ProviderAnthropic),
			DisplayName: "Anthropic",
			Models: []Model{
				{Provider: ProviderAnthropic, Name: "claude-sonnet-4-20250514", DisplayName: "Claude Sonnet 4"},
				{Provider: ProviderAnthropic, Name: "claude-3-5-sonnet-20241022", DisplayName: "Claude 3.5 Sonnet"},
				{Provider: ProviderAnthropic, Name: "claude-3-5-haiku-20241022", DisplayName: "Claude 3.5 Haiku"},
			},
			Configured: anthropicKey != "",
		},
		{
			Name:        string(ProviderOllama),
			DisplayName: "Ollama (Local)",
			Models: []Model{
				{Provider: ProviderOllama, Name: "llama3.2", DisplayName: "Llama 3.2"},
				{Provider: ProviderOllama, Name: "mistral", DisplayName: "Mistral"},
				{Provider: ProviderOllama, Name: "codellama", DisplayName: "Code Llama"},
			},
			Configured: ollamaEndpoint != "",
		},
	}
	return providers
}
