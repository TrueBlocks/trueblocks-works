# File Management Specification

> **Document:** 07-file-management.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Path Configuration](#2-path-configuration)
3. [Directory Structure](#3-directory-structure)
4. [File Naming Convention](#4-file-naming-convention)
5. [Path Generation Logic](#5-path-generation-logic)
6. [File Operations](#6-file-operations)
7. [PDF Preview System](#7-pdf-preview-system)
8. [Go/Wails Implementation](#8-gowails-implementation)
9. [React Integration](#9-react-integration)

---

## 1. Overview

The database manages creative writing files stored on the local filesystem. Each work has an associated document file (typically `.rtf` or `.docx`) that can be:

- Created from templates
- Moved/renamed when metadata changes
- Copied to submission folders
- Printed
- Previewed as PDF

### 1.1 Key Paths

| Path | Purpose | Configurable |
|------|---------|--------------|
| Base Folder | Root folder for all work files | ✅ Yes |
| PDF Preview Folder | PDF previews for web viewer | ✅ Yes |
| Submissions Export Folder | Export destination for submissions | ✅ Yes |

**Default Values (for reference):**
- Base Folder: `/Users/jrush/Documents/Home/`
- PDF Preview: `/Users/jrush/Sites/Works/`
- Submissions Export: `/Users/jrush/Desktop/Submissions/`

---

## 2. Path Configuration

### 2.1 Configuration in AppState

All file paths are configurable and stored in the persisted state:

```go
// internal/state/persisted.go
type PersistedState struct {
    // ... other fields ...
    
    // File system paths (configurable)
    BaseFolderPath       string `json:"baseFolderPath"`       // Root for all work files
    PDFPreviewPath       string `json:"pdfPreviewPath"`       // PDF previews
    SubmissionExportPath string `json:"submissionExportPath"` // Export destination
    TemplateFolderPath   string `json:"templateFolderPath"`   // New work templates
}

func DefaultPersistedState() PersistedState {
    home, _ := os.UserHomeDir()
    
    return PersistedState{
        // ... other defaults ...
        
        // Actual paths for this user's setup
        BaseFolderPath:       filepath.Join(home, "Documents", "Home"),
        PDFPreviewPath:       filepath.Join(home, "Development", "databases", "support", "dbSubmissions"),
        SubmissionExportPath: filepath.Join(home, "Desktop", "Submissions"),
        TemplateFolderPath:   filepath.Join(home, "Documents", "Home", "99 Templates"),
    }
}
```

### 2.2 First-Run Setup

On first launch, the app checks if required paths exist and prompts user to configure:

```go
// app.go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Load persisted state
    persisted, err := state.LoadPersistedState()
    if err != nil {
        log.Printf("Warning: could not load state: %v", err)
    }
    
    // Check if base folder exists
    if !fileExists(persisted.BaseFolderPath) {
        a.state.NeedsPathSetup = true
    }
}
```

### 2.3 Settings Panel (React)

```typescript
// src/pages/SettingsPage.tsx
import { useState } from 'react';
import { TextInput, Button, Stack, Group, Text } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';
import { 
    GetSettings, 
    SaveSettings, 
    BrowseForFolder 
} from '../../wailsjs/go/main/App';

interface PathSettings {
    baseFolderPath: string;
    pdfPreviewPath: string;
    submissionExportPath: string;
    templateFolderPath: string;
}

export function SettingsPage() {
    const [paths, setPaths] = useState<PathSettings | null>(null);
    
    useEffect(() => {
        GetSettings().then(setPaths);
    }, []);
    
    const browsePath = async (field: keyof PathSettings) => {
        const selected = await BrowseForFolder("Select Folder");
        if (selected) {
            setPaths(prev => prev ? { ...prev, [field]: selected } : null);
        }
    };
    
    const savePaths = async () => {
        if (paths) {
            await SaveSettings(paths);
        }
    };
    
    return (
        <Stack gap="md">
            <Text size="lg" fw={600}>File Locations</Text>
            
            <PathInput
                label="Base Folder (Root for all work files)"
                value={paths?.baseFolderPath || ''}
                onChange={(v) => setPaths(p => p ? {...p, baseFolderPath: v} : null)}
                onBrowse={() => browsePath('baseFolderPath')}
            />
            
            <PathInput
                label="PDF Preview Folder"
                value={paths?.pdfPreviewPath || ''}
                onChange={(v) => setPaths(p => p ? {...p, pdfPreviewPath: v} : null)}
                onBrowse={() => browsePath('pdfPreviewPath')}
            />
            
            <PathInput
                label="Submissions Export Folder"
                value={paths?.submissionExportPath || ''}
                onChange={(v) => setPaths(p => p ? {...p, submissionExportPath: v} : null)}
                onBrowse={() => browsePath('submissionExportPath')}
            />
            
            <PathInput
                label="Template Folder (for new works)"
                value={paths?.templateFolderPath || ''}
                onChange={(v) => setPaths(p => p ? {...p, templateFolderPath: v} : null)}
                onBrowse={() => browsePath('templateFolderPath')}
            />
            
            <Button onClick={savePaths}>Save Settings</Button>
        </Stack>
    );
}

function PathInput({ label, value, onChange, onBrowse }) {
    return (
        <TextInput
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rightSection={
                <Button variant="subtle" size="xs" onClick={onBrowse}>
                    <IconFolder size={16} />
                </Button>
            }
        />
    );
}
```

### 2.4 Wails Backend Bindings

```go
// app_settings.go
func (a *App) BrowseForFolder(title string) (string, error) {
    return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
        Title: title,
    })
}

func (a *App) GetSettings() PathSettings {
    return PathSettings{
        BaseFolderPath:       a.state.Persisted.BaseFolderPath,
        PDFPreviewPath:       a.state.Persisted.PDFPreviewPath,
        SubmissionExportPath: a.state.Persisted.SubmissionExportPath,
        TemplateFolderPath:   a.state.Persisted.TemplateFolderPath,
    }
}

func (a *App) SaveSettings(settings PathSettings) error {
    // Validate paths exist
    for name, path := range map[string]string{
        "Base Folder":       settings.BaseFolderPath,
        "PDF Preview":       settings.PDFPreviewPath,
        "Submissions Export": settings.SubmissionExportPath,
        "Template Folder":   settings.TemplateFolderPath,
    } {
        if path != "" {
            if _, err := os.Stat(path); os.IsNotExist(err) {
                return fmt.Errorf("%s does not exist: %s", name, path)
            }
        }
    }
    
    // Save to persisted state
    a.state.Persisted.BaseFolderPath = settings.BaseFolderPath
    a.state.Persisted.PDFPreviewPath = settings.PDFPreviewPath
    a.state.Persisted.SubmissionExportPath = settings.SubmissionExportPath
    a.state.Persisted.TemplateFolderPath = settings.TemplateFolderPath
    
    return a.SaveState()
}
```

### 2.5 Updated getFilename Function

The `getFilename` function now uses configured base path instead of hardcoded value:

```go
// internal/fileops/paths.go
func (f *FileOps) GetFilename(partialPath string) string {
    return filepath.Join(f.config.BaseFolderPath, partialPath)
}

// All file operations use the configured path
func (f *FileOps) GetWorkFullPath(work *models.Work) string {
    return f.GetFilename(work.GeneratedPath + "." + work.DocType)
}
```

---

## 3. Directory Structure

```
/Users/jrush/Documents/Home/
├── 34 Current Work/              # Active works (year >= 2016)
│   ├── aaPoem - 2024 - Best Work.rtf
│   ├── aPoem - 2024 - Better Work.rtf
│   ├── bStory - 2024 - Good Work.docx
│   └── ...
│
├── 35 Open Ideas/                # All idea types
│   ├── cPoem Idea - 2024 - Future Concept.rtf
│   ├── cEssay Idea - 2023 - Research Topic.rtf
│   └── ...
│
├── 100 Poems/                    # Inactive poems
│   ├── bPoem - 2015 - Old Poem.rtf
│   └── ...
│
├── 100 Stories/                  # Inactive stories
├── 100 Essays/                   # Inactive essays
├── 100 Articles/                 # Inactive articles
├── 100 Flash Fiction/            # Inactive flash fiction
├── 100 Micro/                    # Inactive micro fiction
├── 100 Travel/                   # Travel pieces (all statuses)
├── 100 Books/                    # Book projects (all statuses)
├── 100 Research/                 # Research documents
│
├── 150 Published/                # Published works
│   ├── aaPoem - 2020 - Award Winner.rtf
│   └── ...
│
└── [Other type folders]/         # 100 + pluralized type name
```

### 2.1 Folder Selection Rules

```
IF type contains "Idea"
    → "35 Open Ideas/"

ELSE IF type = "Travel"
    → "100 Travel/"

ELSE IF type = "Book"
    → "100 Books/"

ELSE IF status = "Published"
    → "150 Published/"

ELSE IF status IN (Focus, Active, Out, Working) AND year >= 2016
    → "34 Current Work/"

ELSE IF status IN (Focus, Active, Out, Working) AND year < 2016
    → getMainType(type) + "/"

ELSE
    → getMainType(type) + "/"
```

---

## 3. File Naming Convention

### 3.1 Format

```
{qualityMark}{Type} - {Year} - {Title}
```

### 3.2 Components

| Component | Description | Example |
|-----------|-------------|---------|
| qualityMark | 1-2 letter prefix based on quality | `aa`, `a`, `b`, `c`, `d`, `e`, `f`, `z` |
| Type | Work type exactly as stored | `Poem`, `Story`, `Essay Idea` |
| Year | 4-digit year | `2024` |
| Title | Work title with `/` replaced by `~` | `My Sonnet`, `Before~After` |

### 3.3 Quality Mark Mapping

| Quality | Mark | Sort Position |
|---------|------|---------------|
| Best | `aa` | First (double letter sorts before single) |
| Better | `a` | High |
| Good | `b` | Above average |
| Okay | `c` | Average |
| Poor | `d` | Below average |
| Bad | `e` | Low |
| Worst | `f` | Very low |
| Unknown / n/a | `z` | Last |

### 3.4 Examples

| Work Attributes | Generated Filename |
|-----------------|-------------------|
| Type=Poem, Year=2024, Title=My Sonnet, Quality=Best | `aaPoem - 2024 - My Sonnet` |
| Type=Story, Year=2023, Title=The End, Quality=Good | `bStory - 2023 - The End` |
| Type=Essay Idea, Year=2024, Title=New Concept, Quality=Okay | `cEssay Idea - 2024 - New Concept` |
| Type=Poem, Year=2024, Title=Before/After, Quality=Better | `aPoem - 2024 - Before~After` |

---

## 4. Path Generation Logic

### 4.1 Full Path Formula

```
FullPath = BaseFolder + RelativePath
RelativePath = getMainFolder(type, year, status) + getQualityMark(quality) + type + " - " + year + " - " + sanitize(title)
```

### 4.2 Path Validation (Check Field)

The `Check` calculated field compares:
- `generatedPath`: Expected path based on current metadata
- `Path`: Actually stored path in database

**Check Results:**

| Condition | Check Value |
|-----------|-------------|
| generatedPath = Path | `""` (empty) |
| generatedPath ≠ Path AND file exists at generatedPath | `""` (empty) |
| generatedPath ≠ Path AND file exists at Path | `"name changed"` |
| Neither path has a file | `"file missing"` |

### 4.3 File Extensions

The system handles multiple file extensions. When moving/copying:
1. Try `.rtf` first (most common)
2. Try `.docx` if no `.rtf`
3. Try `.txt` if no `.docx`
4. Try no extension if nothing else matches

---

## 5. File Operations

### 5.1 Create New Work (AddWork Script)

**Trigger:** "New" button on Works layout

**Steps:**
1. Create new Works record
2. Set default values (Year=current year, Status=Gestating, Quality=Okay)
3. Prompt for Type and Title
4. Generate path using `generatePath(type, year, title, quality, status)`
5. If file exists at generated path, use existing file
6. If no file exists:
   - Copy template file based on type
   - Rename copy to generated path
   - Touch file to update timestamp

**Template Selection:**
```
IF type contains "Poem"
    → "/Users/jrush/Documents/Home/99 Templates/00 Poem Template.rtf"
ELSE
    → "/Users/jrush/Documents/Home/99 Templates/00 Prose Template.rtf"
```

### 5.2 Move File (moveFile Script)

**Trigger:** "Move" button (only enabled when Check = "name changed")

**Steps:**
1. Get current path from `Path` field
2. Generate new path using `generatePath()`
3. Find file at current path (try extensions: .rtf, .docx, .txt, none)
4. Move file to new path
5. Update `Path` field to new path
6. Touch file to update timestamp
7. Add note: "Moved from [old folder] to [new folder]"

### 5.3 Copy File (copyFile Script)

**Trigger:** "Export" button on Works layout

**Steps:**
1. Get source path from `Path` field (with extension)
2. Build destination: `/Users/jrush/Desktop/Submissions/[Title].[ext]`
3. Copy file to destination
4. Show confirmation

### 5.4 Print File (printFile Script)

**Trigger:** "Print" button on Works layout

**Steps:**
1. Get file path with extension
2. Send to printer using `printFile` plugin function (or `lpr` command)

### 5.5 Open Document (Open Document Script)

**Trigger:** Double-click on file path field

**Steps:**
1. Get full path from `getFilename(Path)`
2. Open with system default application

---

## 6. PDF Preview System

### 6.1 Architecture

The system displays PDF previews of work documents in a preview panel. Existing PDFs are stored in `~/Development/databases/support/dbSubmissions/`. When a `.docx` file is created or updated, the app automatically regenerates its PDF using LibreOffice.

**Key Paths:**
- Source documents: `~/Documents/Home/{subfolder}/{filename}.docx`
- PDF previews: `~/Development/databases/support/dbSubmissions/{workID}.pdf`

### 6.2 PDF Auto-Regeneration

PDFs are automatically regenerated when:

| Trigger | Action |
|---------|--------|
| File watcher detects `.docx` change | Regenerate PDF in background |
| Work opened and PDF is older than docx | Regenerate before display |
| New work created | Generate PDF after first save |
| Manual "Regenerate Preview" button | Force regeneration |

**LibreOffice is required.** The app checks for LibreOffice at startup and blocks if not found.

### 6.3 Go Implementation - PDF Generator

```go
package fileops

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "time"
)

// NeedsRegeneration checks if PDF is stale or missing
func NeedsRegeneration(docxPath, pdfPath string) bool {
    pdfInfo, err := os.Stat(pdfPath)
    if os.IsNotExist(err) {
        return true // PDF doesn't exist
    }
    
    docxInfo, err := os.Stat(docxPath)
    if err != nil {
        return false // Can't read source, don't regenerate
    }
    
    // Regenerate if docx is newer than PDF
    return docxInfo.ModTime().After(pdfInfo.ModTime())
}

// GeneratePDF converts a docx file to PDF using LibreOffice
func GeneratePDF(docxPath string, workID int) (string, error) {
    pdfPath := filepath.Join(PreviewsDir, fmt.Sprintf("%d.pdf", workID))
    
    // Ensure previews directory exists
    if err := os.MkdirAll(PreviewsDir, 0755); err != nil {
        return "", fmt.Errorf("failed to create previews directory: %w", err)
    }
    
    // Use LibreOffice headless for conversion
    cmd := exec.Command("soffice",
        "--headless",
        "--convert-to", "pdf",
        "--outdir", PreviewsDir,
        docxPath,
    )
    
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("PDF conversion failed: %w", err)
    }
    
    // LibreOffice outputs with original filename, rename to workID.pdf
    baseName := filepath.Base(docxPath)
    baseName = baseName[:len(baseName)-len(filepath.Ext(baseName))] + ".pdf"
    tempPath := filepath.Join(PreviewsDir, baseName)
    
    if tempPath != pdfPath {
        if err := os.Rename(tempPath, pdfPath); err != nil {
            return "", fmt.Errorf("failed to rename PDF: %w", err)
        }
    }
    
    return pdfPath, nil
}

// GetPreviewPath returns PDF path, generating if needed
func GetPreviewPath(workID int, docxPath string) (string, error) {
    pdfPath := filepath.Join(PreviewsDir, fmt.Sprintf("%d.pdf", workID))
    
    if NeedsRegeneration(docxPath, pdfPath) {
        return GeneratePDF(docxPath, workID)
    }
    
    return pdfPath, nil
}
```

### 6.4 Background File Watcher

For a smoother experience, a background goroutine watches for docx changes and pre-generates PDFs:

```go
package fileops

import (
    "log"
    "path/filepath"
    "strings"
    
    "github.com/fsnotify/fsnotify"
)

// StartPreviewWatcher monitors the work files directory for changes
func StartPreviewWatcher(db *Database) error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    
    go func() {
        defer watcher.Close()
        
        for {
            select {
            case event, ok := <-watcher.Events:
                if !ok {
                    return
                }
                
                // Only process docx write events
                if event.Op&fsnotify.Write == fsnotify.Write {
                    if strings.HasSuffix(event.Name, ".docx") {
                        // Find work by path and regenerate preview
                        work := db.FindWorkByFullPath(event.Name)
                        if work != nil {
                            log.Printf("Regenerating preview for work %d: %s", work.WorkID, work.Title)
                            if _, err := GeneratePDF(event.Name, work.WorkID); err != nil {
                                log.Printf("Warning: failed to regenerate PDF: %v", err)
                            }
                        }
                    }
                }
                
            case err, ok := <-watcher.Errors:
                if !ok {
                    return
                }
                log.Printf("File watcher error: %v", err)
            }
        }
    }()
    
    // Watch the base folder and subfolders
    return filepath.Walk(BaseFolder, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        if info.IsDir() {
            return watcher.Add(path)
        }
        return nil
    })
}
```

### 6.5 Preview URL Logic (Legacy Reference)

The original FileMaker formula for reference:
```filemaker
If ( fileExists("/Users/jrush/Sites/Works/" & workID & ".pdf") ; 
    "http://localhost/Works/" & workID & ".pdf" ; 
    "http://localhost/Scans/0000 NoPreview.pdf" 
)
```

In the new system, this is handled by the Wails backend serving static files.

---

## 7. Go Implementation

### 7.1 File Manager Package

```go
package fileops

import (
    "fmt"
    "io"
    "os"
    "os/exec"
    "path/filepath"
    "strconv"
    "strings"
    "time"
)

const (
    BaseFolder       = "/Users/jrush/Documents/Home/"
    SubmissionsDir   = "/Users/jrush/Desktop/Submissions/"
    PreviewsDir      = "/Users/jrush/Sites/Works/"
    PoemTemplate     = BaseFolder + "99 Templates/00 Poem Template.rtf"
    ProseTemplate    = BaseFolder + "99 Templates/00 Prose Template.rtf"
    NoPreviewPath    = "0000 NoPreview.pdf"
)

var Extensions = []string{".rtf", ".docx", ".txt", ""}

// Work represents the fields needed for path operations
type Work struct {
    WorkID  int
    Type    string
    Year    string
    Title   string
    Quality string
    Status  string
    Path    string
}

// GeneratePath creates the relative path for a work
func GeneratePath(w *Work) string {
    folder := GetMainFolder(w.Type, w.Year, w.Status)
    qualityMark := GetQualityMark(w.Quality)
    sanitizedTitle := strings.ReplaceAll(w.Title, "/", "~")
    
    filename := fmt.Sprintf("%s%s - %s - %s",
        qualityMark, w.Type, w.Year, sanitizedTitle)
    
    return folder + filename
}

// GetFullPath returns the absolute path for a work
func GetFullPath(w *Work) string {
    return filepath.Join(BaseFolder, GeneratePath(w))
}

// GetMainFolder determines the folder based on work metadata
func GetMainFolder(workType, year, status string) string {
    // Idea types
    if strings.Contains(workType, "Idea") {
        return "35 Open Ideas/"
    }
    
    // Special types
    switch workType {
    case "Travel":
        return "100 Travel/"
    case "Book":
        return "100 Books/"
    }
    
    // Published
    if status == "Published" {
        return "150 Published/"
    }
    
    // Active statuses
    activeStatuses := map[string]bool{
        "Focus": true, "Active": true, "Out": true, "Working": true,
    }
    if activeStatuses[status] {
        yearNum, _ := strconv.Atoi(year)
        if yearNum < 2016 {
            return GetMainType(workType) + "/"
        }
        return "34 Current Work/"
    }
    
    // Default
    return GetMainType(workType) + "/"
}

// GetMainType returns the folder name for a work type
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

// GetQualityMark converts quality to sort prefix
func GetQualityMark(quality string) string {
    marks := map[string]string{
        "Best":    "aa",
        "Better":  "a",
        "Good":    "b",
        "Okay":    "c",
        "Poor":    "d",
        "Bad":     "e",
        "Worst":   "f",
        "Unknown": "z",
    }
    
    if mark, ok := marks[quality]; ok {
        return mark
    }
    return "c"
}

// FindFileWithExtension finds the actual file path trying multiple extensions
func FindFileWithExtension(basePath string) (string, error) {
    for _, ext := range Extensions {
        path := basePath + ext
        if FileExists(path) {
            return path, nil
        }
    }
    return "", fmt.Errorf("no file found at %s with any extension", basePath)
}

// FileExists checks if a file exists
func FileExists(path string) bool {
    _, err := os.Stat(path)
    return err == nil
}

// CheckPath validates the file path and returns a status
func CheckPath(w *Work) string {
    generatedPath := GetFullPath(w)
    storedPath := filepath.Join(BaseFolder, w.Path)
    
    // Paths match
    if generatedPath == storedPath {
        return ""
    }
    
    // File exists at generated path
    if _, err := FindFileWithExtension(generatedPath); err == nil {
        return ""
    }
    
    // File exists at stored path
    if _, err := FindFileWithExtension(storedPath); err == nil {
        return "name changed"
    }
    
    return "file missing"
}

// MoveFile moves a work file from current to generated path
func MoveFile(w *Work) error {
    currentPath := filepath.Join(BaseFolder, w.Path)
    newPath := GetFullPath(w)
    
    // Find source file with extension
    sourcePath, err := FindFileWithExtension(currentPath)
    if err != nil {
        return fmt.Errorf("source file not found: %w", err)
    }
    
    // Get extension from source
    ext := filepath.Ext(sourcePath)
    destPath := newPath + ext
    
    // Ensure destination directory exists
    if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
        return fmt.Errorf("failed to create directory: %w", err)
    }
    
    // Move file
    if err := os.Rename(sourcePath, destPath); err != nil {
        return fmt.Errorf("failed to move file: %w", err)
    }
    
    // Touch file
    now := time.Now()
    if err := os.Chtimes(destPath, now, now); err != nil {
        return fmt.Errorf("failed to update timestamp: %w", err)
    }
    
    return nil
}

// CopyToSubmissions copies the file to the submissions folder
func CopyToSubmissions(w *Work) (string, error) {
    sourcePath, err := FindFileWithExtension(filepath.Join(BaseFolder, w.Path))
    if err != nil {
        return "", fmt.Errorf("source file not found: %w", err)
    }
    
    ext := filepath.Ext(sourcePath)
    destPath := filepath.Join(SubmissionsDir, w.Title+ext)
    
    // Ensure destination directory exists
    if err := os.MkdirAll(SubmissionsDir, 0755); err != nil {
        return "", fmt.Errorf("failed to create directory: %w", err)
    }
    
    // Copy file
    if err := copyFile(sourcePath, destPath); err != nil {
        return "", fmt.Errorf("failed to copy file: %w", err)
    }
    
    return destPath, nil
}

// copyFile copies a file from src to dst
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

// PrintFile sends a file to the default printer
func PrintFile(w *Work) error {
    filePath, err := FindFileWithExtension(filepath.Join(BaseFolder, w.Path))
    if err != nil {
        return fmt.Errorf("file not found: %w", err)
    }
    
    cmd := exec.Command("lpr", filePath)
    return cmd.Run()
}

// OpenDocument opens a file with the default application
func OpenDocument(w *Work) error {
    filePath, err := FindFileWithExtension(filepath.Join(BaseFolder, w.Path))
    if err != nil {
        return fmt.Errorf("file not found: %w", err)
    }
    
    cmd := exec.Command("open", filePath)
    return cmd.Run()
}

// CreateNewWork creates a new work file from template
func CreateNewWork(w *Work) error {
    destPath := GetFullPath(w)
    
    // Check if file already exists
    if _, err := FindFileWithExtension(destPath); err == nil {
        return nil // File exists, nothing to do
    }
    
    // Select template
    templatePath := ProseTemplate
    if strings.Contains(w.Type, "Poem") {
        templatePath = PoemTemplate
    }
    
    // Ensure destination directory exists
    if err := os.MkdirAll(filepath.Dir(destPath+".rtf"), 0755); err != nil {
        return fmt.Errorf("failed to create directory: %w", err)
    }
    
    // Copy template
    if err := copyFile(templatePath, destPath+".rtf"); err != nil {
        return fmt.Errorf("failed to copy template: %w", err)
    }
    
    // Touch file
    now := time.Now()
    return os.Chtimes(destPath+".rtf", now, now)
}

// GetPreviewURL returns the URL for the PDF preview
func GetPreviewURL(workID int) string {
    pdfPath := filepath.Join(PreviewsDir, fmt.Sprintf("%d.pdf", workID))
    if FileExists(pdfPath) {
        return fmt.Sprintf("/previews/%d.pdf", workID)
    }
    return "/previews/" + NoPreviewPath
}
```

---

## 8. React Integration

### 8.1 File Operations Hook

```typescript
// src/hooks/useFileOperations.ts
import { useCallback, useState } from 'react';
import {
  FileExists,
  OpenDocument,
  MoveFile,
  CopyToSubmissions,
  PrintFile,
  CreateNewWork,
  GetPDFPreviewURL,
} from '../../wailsjs/go/main/App';
import { Work } from '@/types/models';

export function useFileOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDocument = useCallback(async (work: Work) => {
    setLoading(true);
    setError(null);
    try {
      await OpenDocument(work.workID);
    } catch (err) {
      setError(`Failed to open document: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const moveFile = useCallback(async (work: Work): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const newPath = await MoveFile(work.workID);
      return newPath;
    } catch (err) {
      setError(`Failed to move file: ${err}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const copyToSubmissions = useCallback(async (work: Work) => {
    setLoading(true);
    setError(null);
    try {
      await CopyToSubmissions(work.workID);
    } catch (err) {
      setError(`Failed to copy file: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const printDocument = useCallback(async (work: Work) => {
    setLoading(true);
    setError(null);
    try {
      await PrintFile(work.workID);
    } catch (err) {
      setError(`Failed to print: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    openDocument,
    moveFile,
    copyToSubmissions,
    printDocument,
  };
}
```

### 8.2 File Actions Toolbar Component (Mantine)

```tsx
// src/components/works/FileActionsToolbar.tsx
import { Group, Button, Loader, Text } from '@mantine/core';
import { IconFileText, IconArrowsMove, IconDownload, IconPrinter } from '@tabler/icons-react';
import { Work } from '@/types/models';
import { useFileOperations } from '@/hooks/useFileOperations';

interface FileActionsToolbarProps {
  work: Work;
  onUpdate?: (work: Work) => void;
}

export function FileActionsToolbar({ work, onUpdate }: FileActionsToolbarProps) {
  const { loading, openDocument, moveFile, copyToSubmissions, printDocument } =
    useFileOperations();

  const handleMove = async () => {
    const newPath = await moveFile(work);
    if (newPath && onUpdate) {
      onUpdate({ ...work, path: newPath, check: '' });
    }
  };

  return (
    <Group gap="sm" p="md" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Button
        leftSection={<IconFileText size={16} />}
        onClick={() => openDocument(work)}
        disabled={loading}
        variant="light"
      >
        Open
      </Button>
      
      {work.check === 'name changed' && (
        <Button
          leftSection={<IconArrowsMove size={16} />}
          onClick={handleMove}
          disabled={loading}
          color="yellow"
        >
          Move File
        </Button>
      )}
      
      <Button
        leftSection={<IconDownload size={16} />}
        onClick={() => copyToSubmissions(work)}
        disabled={loading}
        variant="light"
      >
        Export
      </Button>
      
      <Button
        leftSection={<IconPrinter size={16} />}
        onClick={() => printDocument(work)}
        disabled={loading}
        variant="light"
      >
        Print
      </Button>
      
      {loading && <Loader size="sm" />}
    </Group>
  );
}
```

### 8.3 PDF Preview Component (Mantine)

```tsx
// src/components/works/PDFPreview.tsx
import { useState, useEffect } from 'react';
import { Stack, Text, Center, Loader, Paper } from '@mantine/core';
import { IconFileOff } from '@tabler/icons-react';
import { GetPreviewPath, GeneratePDF } from '../../wailsjs/go/main/App';
import { Work } from '@/types/models';

interface PDFPreviewProps {
  work: Work | null;
}

export function PDFPreview({ work }: PDFPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!work) {
      setPreviewUrl(null);
      return;
    }

    setLoading(true);
    GetPreviewPath(work.workID, work.path)
      .then((path) => {
        // Wails serves static files from the previews directory
        setPreviewUrl(`/previews/${work.workID}.pdf`);
      })
      .catch(() => setPreviewUrl(null))
      .finally(() => setLoading(false));
  }, [work]);

  const handleRegenerate = async () => {
    if (!work) return;
    setRegenerating(true);
    try {
      await GeneratePDF(work.path, work.workID);
      // Force reload by appending timestamp
      setPreviewUrl(`/previews/${work.workID}.pdf?t=${Date.now()}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (!work) {
    return (
      <Paper w={400} h="100%" bg="gray.1" p="xl">
        <Center h="100%">
          <Text c="dimmed">Select a work to preview</Text>
        </Center>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper w={400} h="100%" bg="gray.1" p="xl">
        <Center h="100%">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading preview...</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  if (!previewUrl) {
    return (
      <Paper w={400} h="100%" bg="gray.1" p="xl">
        <Center h="100%">
          <Stack align="center" gap="md">
            <IconFileOff size={48} color="gray" />
            <Text c="dimmed">No preview available</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper w={400} h="100%" withBorder style={{ overflow: 'hidden' }}>
      <iframe
        src={previewUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={`Preview of ${work.title}`}
      />
    </Paper>
  );
}
```

### 8.4 Path Display Component (Mantine)

```tsx
// src/components/works/PathDisplay.tsx
import { Stack, Text, Badge, Code, Group } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconFileOff } from '@tabler/icons-react';
import { Work } from '@/types/models';
import { generatePath } from '@/utils/paths';

interface PathDisplayProps {
  work: Work;
}

export function PathDisplay({ work }: PathDisplayProps) {
  const generatedPath = generatePath(work);
  const pathsMatch = work.path === generatedPath;

  return (
    <Stack gap="xs">
      <div>
        <Text size="xs" c="dimmed">Generated Path:</Text>
        <Code block c={pathsMatch ? 'green' : 'yellow'}>
          {generatedPath}
        </Code>
      </div>
      
      {!pathsMatch && (
        <div>
          <Text size="xs" c="dimmed">Stored Path:</Text>
          <Code block>{work.path}</Code>
        </div>
      )}
      
      <Group gap="xs">
        {!work.check && pathsMatch && (
          <Badge color="green" leftSection={<IconCheck size={12} />}>
            Path OK
          </Badge>
        )}
        
        {work.check === 'name changed' && (
          <Badge color="yellow" leftSection={<IconAlertTriangle size={12} />}>
            File needs move
          </Badge>
        )}
        
        {work.check === 'file missing' && (
          <Badge color="red" leftSection={<IconFileOff size={12} />}>
            File missing
          </Badge>
        )}
      </Group>
    </Stack>
  );
}
```

---

*End of File Management Specification*
