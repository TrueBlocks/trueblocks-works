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

type SupportingInfo struct {
	Exists   bool   `json:"exists"`
	Path     string `json:"path"`
	IsFolder bool   `json:"isFolder"`
	Size     int64  `json:"size"`
	ModTime  string `json:"modTime"`
	Count    int    `json:"count"`
}

func (f *FileOps) GetSupportingPath(workPath string) (string, bool) {
	fullPath := f.GetFilename(workPath)
	dir := filepath.Dir(fullPath)
	base := filepath.Base(fullPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)

	supportingDir := filepath.Join(dir, "Supporting")
	folderPath := filepath.Join(supportingDir, name)
	if info, err := os.Stat(folderPath); err == nil && info.IsDir() {
		return folderPath, true
	}

	filePath := filepath.Join(supportingDir, base)
	if _, err := os.Stat(filePath); err == nil {
		return filePath, true
	}

	return "", false
}

func (f *FileOps) GetSupportingInfo(workPath string) SupportingInfo {
	path, exists := f.GetSupportingPath(workPath)
	if !exists {
		return SupportingInfo{Exists: false}
	}

	info, err := os.Stat(path)
	if err != nil {
		return SupportingInfo{Exists: false}
	}

	result := SupportingInfo{
		Exists:   true,
		Path:     path,
		IsFolder: info.IsDir(),
		ModTime:  info.ModTime().Format("2006-01-02 15:04"),
	}

	if info.IsDir() {
		entries, _ := os.ReadDir(path)
		result.Count = len(entries)
	} else {
		result.Size = info.Size()
	}

	return result
}

func (f *FileOps) OpenSupportingItem(workPath string) error {
	path, exists := f.GetSupportingPath(workPath)
	if !exists {
		return fmt.Errorf("supporting item not found")
	}
	cmd := exec.Command("open", path)
	return cmd.Run()
}

func (f *FileOps) moveSupportingItem(sourcePath, destPath string) error {
	sourceDir := filepath.Dir(sourcePath)
	sourceBase := filepath.Base(sourcePath)
	sourceExt := filepath.Ext(sourceBase)
	sourceName := strings.TrimSuffix(sourceBase, sourceExt)

	destDir := filepath.Dir(destPath)
	destBase := filepath.Base(destPath)
	destExt := filepath.Ext(destBase)
	destName := strings.TrimSuffix(destBase, destExt)

	sourceSupportDir := filepath.Join(sourceDir, "Supporting")
	destSupportDir := filepath.Join(destDir, "Supporting")

	sourceFolderPath := filepath.Join(sourceSupportDir, sourceName)
	if info, err := os.Stat(sourceFolderPath); err == nil && info.IsDir() {
		if err := os.MkdirAll(destSupportDir, 0755); err != nil {
			return fmt.Errorf("failed to create Supporting directory: %w", err)
		}
		destFolderPath := filepath.Join(destSupportDir, destName)
		if err := os.Rename(sourceFolderPath, destFolderPath); err != nil {
			return fmt.Errorf("failed to move supporting folder: %w", err)
		}
		return nil
	}

	sourceFilePath := filepath.Join(sourceSupportDir, sourceBase)
	if _, err := os.Stat(sourceFilePath); err == nil {
		if err := os.MkdirAll(destSupportDir, 0755); err != nil {
			return fmt.Errorf("failed to create Supporting directory: %w", err)
		}
		destFilePath := filepath.Join(destSupportDir, destBase)
		if err := os.Rename(sourceFilePath, destFilePath); err != nil {
			return fmt.Errorf("failed to move supporting file: %w", err)
		}
	}

	return nil
}

func (f *FileOps) archiveSupportingItem(sourcePath string) error {
	sourceDir := filepath.Dir(sourcePath)
	sourceBase := filepath.Base(sourcePath)
	sourceExt := filepath.Ext(sourceBase)
	sourceName := strings.TrimSuffix(sourceBase, sourceExt)

	sourceSupportDir := filepath.Join(sourceDir, "Supporting")
	trashSupportDir := filepath.Join(f.Config.BaseFolderPath, "999 Trash", "Supporting")

	sourceFolderPath := filepath.Join(sourceSupportDir, sourceName)
	if info, err := os.Stat(sourceFolderPath); err == nil && info.IsDir() {
		if err := os.MkdirAll(trashSupportDir, 0755); err != nil {
			return fmt.Errorf("failed to create trash Supporting directory: %w", err)
		}
		destPath := filepath.Join(trashSupportDir, sourceName)
		if FileExists(destPath) {
			destPath = filepath.Join(trashSupportDir, fmt.Sprintf("%s_%d", sourceName, time.Now().Unix()))
		}
		if err := os.Rename(sourceFolderPath, destPath); err != nil {
			return fmt.Errorf("failed to archive supporting folder: %w", err)
		}
		return nil
	}

	sourceFilePath := filepath.Join(sourceSupportDir, sourceBase)
	if _, err := os.Stat(sourceFilePath); err == nil {
		if err := os.MkdirAll(trashSupportDir, 0755); err != nil {
			return fmt.Errorf("failed to create trash Supporting directory: %w", err)
		}
		destPath := filepath.Join(trashSupportDir, sourceBase)
		if FileExists(destPath) {
			ext := filepath.Ext(destPath)
			base := strings.TrimSuffix(filepath.Base(destPath), ext)
			destPath = filepath.Join(trashSupportDir, fmt.Sprintf("%s_%d%s", base, time.Now().Unix(), ext))
		}
		if err := os.Rename(sourceFilePath, destPath); err != nil {
			return fmt.Errorf("failed to archive supporting file: %w", err)
		}
	}

	return nil
}

func (f *FileOps) DeleteSupportingItem(workPath string) error {
	path, exists := f.GetSupportingPath(workPath)
	if !exists {
		return nil
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil
	}

	if info.IsDir() {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

func (f *FileOps) FindWorkFile(w *models.Work) (string, error) {
	return FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
}

func (f *FileOps) ArchiveToTrash(w *models.Work) error {
	sourcePath, err := FindFileWithExtension(f.GetFilename(derefStringOps(w.Path)))
	if err != nil {
		return nil
	}

	if err := f.archiveSupportingItem(sourcePath); err != nil {
		return fmt.Errorf("failed to archive supporting item: %w", err)
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

	if err := f.moveSupportingItem(sourcePath, destPath); err != nil {
		return "", fmt.Errorf("failed to move supporting item: %w", err)
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
