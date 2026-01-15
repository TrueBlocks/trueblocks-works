package fileops

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

func derefStringOps(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (f *FileOps) FindWorkFile(w *models.Work) (string, error) {
	return FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
}

func (f *FileOps) ArchiveToTrash(w *models.Work) error {
	sourcePath, err := FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
	if err != nil {
		return nil
	}

	trashDir := filepath.Join(f.Config.BaseFolderPath, "999 Trash")
	if err := os.MkdirAll(trashDir, 0755); err != nil {
		return fmt.Errorf("failed to create trash directory: %w", err)
	}

	destPath := filepath.Join(trashDir, filepath.Base(sourcePath))

	if FileExists(destPath) {
		ext := filepath.Ext(destPath)
		base := strings.TrimSuffix(filepath.Base(destPath), ext)
		destPath = filepath.Join(trashDir, fmt.Sprintf("%s_%d%s", base, time.Now().Unix(), ext))
	}

	if err := os.Rename(sourcePath, destPath); err != nil {
		return fmt.Errorf("failed to move file to trash: %w", err)
	}

	return nil
}

func (f *FileOps) OpenDocument(w *models.Work) error {
	filePath, err := FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
	if err != nil {
		return fmt.Errorf("file not found: %w", err)
	}
	cmd := exec.Command("open", filePath)
	return cmd.Run()
}

func (f *FileOps) MoveFile(w *models.Work) (string, error) {
	currentPath := f.GetFilename(derefStringOps(w.Path))
	newPath := f.GetFullPath(w)

	sourcePath, err := FindFileWithExtension(currentPath)
	if err != nil {
		return "", fmt.Errorf("source file not found: %w", err)
	}

	sourceExt := strings.ToLower(filepath.Ext(sourcePath))
	destExt := strings.ToLower(filepath.Ext(newPath))

	destPath := newPath
	if destExt == "" {
		destPath = newPath + sourceExt
	} else if destExt != sourceExt {
		destPath = strings.TrimSuffix(newPath, filepath.Ext(newPath)) + sourceExt
	}

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.Rename(sourcePath, destPath); err != nil {
		return "", fmt.Errorf("failed to move file: %w", err)
	}

	now := time.Now()
	if err := os.Chtimes(destPath, now, now); err != nil {
		return "", fmt.Errorf("failed to update timestamp: %w", err)
	}

	relativePath, _ := filepath.Rel(f.Config.BaseFolderPath, destPath)
	return relativePath, nil
}

func (f *FileOps) CopyToSubmissions(w *models.Work) (string, error) {
	sourcePath, err := FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
	if err != nil {
		return "", fmt.Errorf("source file not found: %w", err)
	}

	ext := filepath.Ext(sourcePath)
	destPath := filepath.Join(f.Config.SubmissionExportPath, w.Title+ext)

	if err := os.MkdirAll(f.Config.SubmissionExportPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	if err := copyFile(sourcePath, destPath); err != nil {
		return "", fmt.Errorf("failed to copy file: %w", err)
	}

	return destPath, nil
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

func (f *FileOps) PrintFile(w *models.Work) error {
	filePath, err := FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
	if err != nil {
		return fmt.Errorf("file not found: %w", err)
	}
	cmd := exec.Command("lpr", filePath)
	return cmd.Run()
}

func (f *FileOps) GetTemplatePath(workType string) string {
	_ = workType
	return filepath.Join(f.Config.TemplateFolderPath, "Template.docx")
}

func (f *FileOps) CreateWorkFile(w *models.Work) error {
	fullPath := f.GetFullPath(w)
	// Only add .docx if the path doesn't already have an extension
	destPath := fullPath
	if filepath.Ext(fullPath) == "" {
		destPath = fullPath + ".docx"
	}

	if FileExists(destPath) {
		return nil
	}

	templatePath := f.GetTemplatePath(w.Type)
	if !FileExists(templatePath) {
		return fmt.Errorf("template file not found: %s", templatePath)
	}

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := copyFile(templatePath, destPath); err != nil {
		return fmt.Errorf("failed to copy template: %w", err)
	}

	now := time.Now()
	if err := os.Chtimes(destPath, now, now); err != nil {
		return fmt.Errorf("failed to update timestamp: %w", err)
	}

	return nil
}
