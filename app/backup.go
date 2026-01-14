package app

import "github.com/TrueBlocks/trueblocks-works/v2/internal/backup"

func (a *App) CreateBackup(label string) (*backup.BackupInfo, error) {
	return a.backup.CreateBackup(label)
}

func (a *App) ListBackups() ([]backup.BackupInfo, error) {
	return a.backup.ListBackups()
}

func (a *App) RestoreBackup(backupPath string) error {
	return a.backup.RestoreBackup(backupPath)
}

func (a *App) DeleteBackup(backupPath string) error {
	return a.backup.DeleteBackup(backupPath)
}
