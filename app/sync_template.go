package app

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
)

func (a *App) SyncWorkTemplate(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return fmt.Errorf("get work: %w", err)
	}
	if work == nil {
		return fmt.Errorf("work not found: %d", workID)
	}

	docxPath, err := a.fileOps.FindWorkFile(work)
	if err != nil {
		return fmt.Errorf("find work file: %w", err)
	}
	if docxPath == "" {
		return fmt.Errorf("no document file found for work")
	}
	if !strings.HasSuffix(strings.ToLower(docxPath), ".docx") {
		return fmt.Errorf("document is not a .docx file")
	}

	templatePath, err := a.GetWorkTemplatePath(workID)
	if err != nil {
		return fmt.Errorf("get template path: %w", err)
	}
	if templatePath == "" {
		return fmt.Errorf("no template found for this work's book")
	}

	if err := backupDocx(docxPath); err != nil {
		return fmt.Errorf("backup failed: %w", err)
	}

	if err := fileops.SyncTemplateToDocument(templatePath, docxPath); err != nil {
		return fmt.Errorf("sync template failed: %w", err)
	}

	if err := a.SetWorkMarked(workID, true); err != nil {
		return fmt.Errorf("mark work: %w", err)
	}

	return nil
}

func backupDocx(docxPath string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}

	backupDir := filepath.Join(homeDir, ".works", "backups", "works")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("create backup dir: %w", err)
	}

	filename := filepath.Base(docxPath)
	backupPath := filepath.Join(backupDir, filename)

	src, err := os.Open(docxPath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return fmt.Errorf("create backup: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("copy file: %w", err)
	}

	return nil
}
