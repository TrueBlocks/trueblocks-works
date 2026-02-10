package app

import (
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// maskAPIKey masks all but the last 4 characters of an API key
func maskAPIKey(key string) string {
	if len(key) <= 4 {
		if len(key) > 0 {
			return "****"
		}
		return ""
	}
	return strings.Repeat("*", len(key)-4) + key[len(key)-4:]
}

// isMasked checks if a key appears to be masked (contains asterisks)
func isMasked(key string) bool {
	return strings.Contains(key, "*")
}

func (a *App) GetSettings() settings.Settings {
	s := a.settings.Get()
	// Mask API keys before sending to frontend
	s.OpenAIAPIKey = maskAPIKey(s.OpenAIAPIKey)
	s.AnthropicAPIKey = maskAPIKey(s.AnthropicAPIKey)
	return s
}

func (a *App) UpdateSettings(s settings.Settings) error {
	// Preserve real API keys if frontend sends masked values
	current := a.settings.Get()
	if isMasked(s.OpenAIAPIKey) {
		s.OpenAIAPIKey = current.OpenAIAPIKey
	}
	if isMasked(s.AnthropicAPIKey) {
		s.AnthropicAPIKey = current.AnthropicAPIKey
	}

	if err := a.settings.Update(s); err != nil {
		return err
	}
	a.reloadFileOpsConfig()
	return nil
}

func (a *App) IsFirstRun() bool {
	return a.settings.IsFirstRun()
}

func (a *App) CompleteSetup() error {
	return a.settings.MarkSetupComplete()
}

func (a *App) BrowseForFolder(title string) (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	return path, err
}

func (a *App) reloadFileOpsConfig() {
	s := a.settings.Get()
	a.fileOps.Config.BaseFolderPath = s.BaseFolderPath
	a.fileOps.Config.PDFPreviewPath = s.PDFPreviewPath
	a.fileOps.Config.SubmissionExportPath = s.SubmissionExportPath
	a.fileOps.Config.TemplateFolderPath = s.TemplateFolderPath
}

func (a *App) DetectLibreOffice() string {
	paths := []string{
		"/Applications/LibreOffice.app/Contents/MacOS/soffice",
		"/usr/local/bin/soffice",
		"/opt/homebrew/bin/soffice",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func (a *App) PathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (a *App) GetValidExtensions() []string {
	return a.settings.GetValidExtensions()
}

func (a *App) IsValidExtension(ext string) bool {
	return a.settings.IsValidExtension(ext)
}
