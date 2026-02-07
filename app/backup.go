package app

import (
	"github.com/TrueBlocks/trueblocks-works/v2/internal/backup"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) CreateBackup(label string) (*backup.BackupInfo, error) {
	return a.backup.CreateBackup(label)
}

func (a *App) ListBackups() ([]backup.BackupInfo, error) {
	return a.backup.ListBackups()
}

func (a *App) RestoreBackup(backupPath string) error {
	return a.backup.RestoreBackup(backupPath)
}

// RestoreBackupAndQuit closes the database, restores the backup, and quits the app.
// This ensures no stale database handles can corrupt data after restore.
func (a *App) RestoreBackupAndQuit(backupPath string) error {
	// Close FTS database first
	if ftsDB != nil && ftsDB.Exists() {
		if conn := ftsDB.Conn(); conn != nil {
			_, _ = conn.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		}
		ftsDB.Close()
	}

	// Close main database
	if a.db != nil {
		_, _ = a.db.Conn().Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		a.db.Close()
	}

	// Now restore with no active connections
	if err := a.backup.RestoreBackup(backupPath); err != nil {
		return err
	}

	// Quit the app - user must restart
	runtime.Quit(a.ctx)
	return nil
}

func (a *App) DeleteBackup(backupPath string) error {
	return a.backup.DeleteBackup(backupPath)
}
