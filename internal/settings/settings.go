package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Settings struct {
	BaseFolderPath       string `json:"baseFolderPath"`
	PDFPreviewPath       string `json:"pdfPreviewPath"`
	SubmissionExportPath string `json:"submissionExportPath"`
	TemplateFolderPath   string `json:"templateFolderPath"`
	LibreOfficePath      string `json:"libreOfficePath,omitempty"`
	ExportFolderPath     string `json:"exportFolderPath,omitempty"`
	SetupCompleted       bool   `json:"setupCompleted"`
	Theme                string `json:"theme"`
	DarkMode             bool   `json:"darkMode"`
	ArchiveOnDelete      bool   `json:"archiveOnDelete"`
}

type Manager struct {
	mu       sync.RWMutex
	settings *Settings
	filePath string
}

func NewManager() *Manager {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".works", "config.json")

	m := &Manager{
		settings: defaultSettings(),
		filePath: configPath,
	}

	_ = m.Load()
	return m
}

func defaultSettings() *Settings {
	home, _ := os.UserHomeDir()
	return &Settings{
		BaseFolderPath:       filepath.Join(home, "Documents", "Home"),
		PDFPreviewPath:       filepath.Join(home, ".works", "previews"),
		SubmissionExportPath: filepath.Join(home, "Desktop", "Submissions"),
		TemplateFolderPath:   filepath.Join(home, "Documents", "Home", "99 Templates"),
		LibreOfficePath:      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
		SetupCompleted:       false,
		Theme:                "default",
		DarkMode:             false,
	}
}

func (m *Manager) Load() error {
	data, err := os.ReadFile(m.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return m.Save()
		}
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	return json.Unmarshal(data, m.settings)
}

func (m *Manager) Save() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.MarshalIndent(m.settings, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(m.filePath), 0755); err != nil {
		return err
	}

	return os.WriteFile(m.filePath, data, 0644)
}

func (m *Manager) Get() Settings {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return *m.settings
}

func (m *Manager) Update(s Settings) error {
	m.mu.Lock()
	m.settings = &s
	m.mu.Unlock()
	return m.Save()
}

func (m *Manager) IsFirstRun() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return !m.settings.SetupCompleted
}

func (m *Manager) MarkSetupComplete() error {
	m.mu.Lock()
	m.settings.SetupCompleted = true
	m.mu.Unlock()
	return m.Save()
}
