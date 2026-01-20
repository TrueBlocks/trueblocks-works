package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Settings struct {
	BaseFolderPath       string   `json:"baseFolderPath"`
	PDFPreviewPath       string   `json:"pdfPreviewPath"`
	SubmissionExportPath string   `json:"submissionExportPath"`
	TemplateFolderPath   string   `json:"templateFolderPath"`
	LibreOfficePath      string   `json:"libreOfficePath,omitempty"`
	ExportFolderPath     string   `json:"exportFolderPath,omitempty"`
	CollectionExportPath string   `json:"collectionExportPath,omitempty"`
	SetupCompleted       bool     `json:"setupCompleted"`
	Theme                string   `json:"theme"`
	DarkMode             bool     `json:"darkMode"`
	ArchiveOnDelete      bool     `json:"archiveOnDelete"`
	ValidExtensions      []string `json:"validExtensions,omitempty"`
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
		ValidExtensions:      DefaultValidExtensions(),
	}
}

// DefaultValidExtensions returns the default list of valid file extensions
func DefaultValidExtensions() []string {
	return []string{".docx", ".txt", ".md", ".doc", ".xls", ".xlsx", ".pdf"}
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

// GetValidExtensions returns the configured valid extensions, or defaults if not set
func (m *Manager) GetValidExtensions() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if len(m.settings.ValidExtensions) == 0 {
		return DefaultValidExtensions()
	}
	return m.settings.ValidExtensions
}

// IsValidExtension checks if the given extension is in the valid list
func (m *Manager) IsValidExtension(ext string) bool {
	ext = strings.ToLower(ext)
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	for _, valid := range m.GetValidExtensions() {
		if strings.ToLower(valid) == ext {
			return true
		}
	}
	return false
}

// IsExtractable checks if the extension supports text extraction for FTS
func (m *Manager) IsExtractable(ext string) bool {
	ext = strings.ToLower(ext)
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	// Only these types support text extraction
	extractable := map[string]bool{
		".docx": true,
		".txt":  true,
		".md":   true,
	}
	return extractable[ext]
}
