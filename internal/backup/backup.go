package backup

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Manager struct {
	dbPath    string
	backupDir string
	maxAge    time.Duration
	maxCount  int
}

type BackupInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	CreatedAt   string    `json:"createdAt"`
	createdTime time.Time `json:"-"` // internal use only, not exported to JSON
}

func NewManager(dbPath string) *Manager {
	homeDir, _ := os.UserHomeDir()
	backupDir := filepath.Join(homeDir, ".works", "backups")

	return &Manager{
		dbPath:    dbPath,
		backupDir: backupDir,
		maxAge:    30 * 24 * time.Hour,
		maxCount:  10,
	}
}

func (m *Manager) CreateBackup(label string) (*BackupInfo, error) {
	if err := os.MkdirAll(m.backupDir, 0755); err != nil {
		return nil, fmt.Errorf("create backup dir: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("works_%s", timestamp)
	if label != "" {
		filename = fmt.Sprintf("works_%s_%s", timestamp, sanitizeLabel(label))
	}
	filename += ".db"

	backupPath := filepath.Join(m.backupDir, filename)

	if err := copyFile(m.dbPath, backupPath); err != nil {
		return nil, fmt.Errorf("copy database: %w", err)
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return &BackupInfo{
		Name:        filename,
		Path:        backupPath,
		Size:        info.Size(),
		CreatedAt:   now.Format(time.RFC3339),
		createdTime: now,
	}, nil
}

func (m *Manager) ListBackups() ([]BackupInfo, error) {
	entries, err := os.ReadDir(m.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []BackupInfo{}, nil
		}
		return nil, err
	}

	backups := make([]BackupInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), "works_") || !strings.HasSuffix(entry.Name(), ".db") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		modTime := info.ModTime()
		backups = append(backups, BackupInfo{
			Name:        entry.Name(),
			Path:        filepath.Join(m.backupDir, entry.Name()),
			Size:        info.Size(),
			CreatedAt:   modTime.Format(time.RFC3339),
			createdTime: modTime,
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].createdTime.After(backups[j].createdTime)
	})

	return backups, nil
}

func (m *Manager) RestoreBackup(backupPath string) error {
	if _, err := os.Stat(backupPath); err != nil {
		return fmt.Errorf("backup not found: %w", err)
	}

	tempPath := m.dbPath + ".restore-temp"
	if err := copyFile(backupPath, tempPath); err != nil {
		return fmt.Errorf("copy backup: %w", err)
	}

	if err := os.Rename(tempPath, m.dbPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("replace database: %w", err)
	}

	return nil
}

func (m *Manager) DeleteBackup(backupPath string) error {
	if !strings.HasPrefix(backupPath, m.backupDir) {
		return fmt.Errorf("invalid backup path")
	}
	return os.Remove(backupPath)
}

func (m *Manager) CleanupOldBackups() (int, error) {
	backups, err := m.ListBackups()
	if err != nil {
		return 0, err
	}

	removed := 0
	cutoff := time.Now().Add(-m.maxAge)

	for i, backup := range backups {
		shouldRemove := false

		if i >= m.maxCount {
			shouldRemove = true
		}

		if backup.createdTime.Before(cutoff) {
			shouldRemove = true
		}

		if shouldRemove {
			if err := os.Remove(backup.Path); err == nil {
				removed++
			}
		}
	}

	return removed, nil
}

func (m *Manager) AutoBackup() (*BackupInfo, error) {
	backups, err := m.ListBackups()
	if err != nil {
		return nil, err
	}

	if len(backups) > 0 {
		lastBackup := backups[0]
		if time.Since(lastBackup.createdTime) < 24*time.Hour {
			return nil, nil
		}
	}

	backup, err := m.CreateBackup("auto")
	if err != nil {
		return nil, err
	}

	_, _ = m.CleanupOldBackups()

	return backup, nil
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}

	return dstFile.Sync()
}

func sanitizeLabel(label string) string {
	label = strings.ReplaceAll(label, " ", "-")
	label = strings.ReplaceAll(label, "/", "-")
	label = strings.ReplaceAll(label, "\\", "-")
	if len(label) > 30 {
		label = label[:30]
	}
	return label
}
