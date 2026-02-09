package fileops

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

type Config struct {
	BaseFolderPath       string
	PDFPreviewPath       string
	SubmissionExportPath string
	TemplateFolderPath   string
}

func DefaultConfig() Config {
	home, _ := os.UserHomeDir()
	return Config{
		BaseFolderPath:       filepath.Join(home, "Documents", "Home"),
		PDFPreviewPath:       filepath.Join(home, "Development", "databases", "support", "dbSubmissions"),
		SubmissionExportPath: filepath.Join(home, "Desktop", "Submissions"),
		TemplateFolderPath:   filepath.Join(home, "Documents", "Home", "99 Templates"),
	}
}

type FileOps struct {
	Config Config
}

func New(cfg Config) *FileOps {
	return &FileOps{Config: cfg}
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (f *FileOps) GeneratePath(w *models.Work) string {
	year := derefString(w.Year)
	folder := f.GetMainFolder(w.Type, year, w.Status)
	// For published works, use the original quality (qualityAtPublish) for the mark
	quality := w.Quality
	if w.Quality == "Published" && w.QualityAtPublish != nil && *w.QualityAtPublish != "" {
		quality = *w.QualityAtPublish
	}
	qualityMark := GetQualityMark(quality)
	sanitizedTitle := strings.ReplaceAll(w.Title, "/", "~")
	filename := fmt.Sprintf("%s%s - %s - %s", qualityMark, w.Type, year, sanitizedTitle)
	ext := w.DocType
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return folder + filename + ext
}

func (f *FileOps) GetFullPath(w *models.Work) string {
	return filepath.Join(f.Config.BaseFolderPath, f.GeneratePath(w))
}

func (f *FileOps) GetFilename(partialPath string) string {
	// If path is absolute, use it directly
	if filepath.IsAbs(partialPath) {
		return partialPath
	}
	return filepath.Join(f.Config.BaseFolderPath, partialPath)
}

func (f *FileOps) GetMainFolder(workType, year, status string) string {
	if strings.Contains(workType, "Idea") {
		return "35 Open Ideas/"
	}

	switch workType {
	case "Travel":
		return "100 Travel/"
	case "Book":
		return "100 Books/"
	}

	activeStatuses := map[string]bool{
		"Focus": true, "Active": true, "Out": true, "Working": true, "Resting": true, "Published": true,
	}
	if activeStatuses[status] {
		yearNum, _ := strconv.Atoi(year)
		if yearNum < 2026 {
			if status == "Published" {
				return "150 Published/"
			}
			return GetMainType(workType) + "/"
		}
		return "34 Current Work/"
	}

	return GetMainType(workType) + "/"
}

func GetMainType(workType string) string {
	if strings.Contains(workType, "Idea") {
		return "35 Open Ideas"
	}

	specialCases := map[string]string{
		"Travel":   "100 Travel",
		"Flash":    "100 Flash Fiction",
		"Micro":    "100 Micro",
		"Story":    "100 Stories",
		"Research": "100 Research",
	}

	if folder, ok := specialCases[workType]; ok {
		return folder
	}

	return "100 " + workType + "s"
}

func GetQualityMark(quality string) string {
	marks := map[string]string{
		"Published": "",
		"Best":      "aa",
		"Better":    "a",
		"Good":      "b",
		"Okay":      "c",
		"Poor":      "d",
		"Bad":       "e",
		"Worst":     "f",
		"Unknown":   "z",
	}

	if mark, ok := marks[quality]; ok {
		return mark
	}
	return "c"
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func GetFileInfo(path string) (os.FileInfo, error) {
	return os.Stat(path)
}

func FindFileWithExtension(basePath string) (string, error) {
	// Paths MUST have an extension - no wiggle room
	ext := strings.ToLower(filepath.Ext(basePath))
	if ext == "" {
		return "", fmt.Errorf("path has no extension (paths must include extension): %s", basePath)
	}

	// Exact match required
	if FileExists(basePath) {
		return basePath, nil
	}
	return "", fmt.Errorf("file not found at exact path: %s", basePath)
}

func (f *FileOps) CheckPath(w *models.Work) string {
	generatedPath := f.GeneratePath(w)
	storedPath := derefString(w.Path)

	// Paths match - no action needed
	if generatedPath == storedPath {
		return ""
	}

	fullGeneratedPath := f.GetFullPath(w)
	fullStoredPath := f.GetFilename(storedPath)

	existsAtGenerated := FileExists(fullGeneratedPath)
	existsAtStored := FileExists(fullStoredPath)

	// File already at correct location - just need to update DB
	if existsAtGenerated {
		return "path outdated"
	}

	// File exists at stored path but not generated - needs move
	if existsAtStored {
		return "name changed"
	}

	return "file missing"
}
