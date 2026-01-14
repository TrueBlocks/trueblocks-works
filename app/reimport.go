package app

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/migrate"
)

func (a *App) ReimportFromCSV() error {
	importsDir := filepath.Join("imports")
	if _, err := os.Stat(importsDir); os.IsNotExist(err) {
		return fmt.Errorf("imports directory not found: %s", importsDir)
	}

	if _, err := a.backup.CreateBackup("pre-reimport"); err != nil {
		return fmt.Errorf("create backup before reimport: %w", err)
	}

	importer := migrate.NewImporter(a.db, importsDir)
	if err := importer.ReimportAll(); err != nil {
		return fmt.Errorf("reimport: %w", err)
	}

	return nil
}
