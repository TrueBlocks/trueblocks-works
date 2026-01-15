package app

import (
	"os"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetSettings() settings.Settings {
	return a.settings.Get()
}

func (a *App) UpdateSettings(s settings.Settings) error {
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
