# Installation & First-Run Guide

> **Document:** 17-installation-guide.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [First-Run Detection](#2-first-run-detection)
3. [Setup Wizard](#3-setup-wizard)
4. [LibreOffice Detection](#4-libreoffice-detection)
5. [Data Import](#5-data-import)
6. [Post-Install Verification](#6-post-install-verification)
7. [Implementation](#7-implementation)

---

## 1. Overview

### 1.1 First-Run Goals

When a user launches the app for the first time, they need:

1. **Configure document location** — Where are their writing files?
2. **Import data from FileMaker** — One-time CSV import
3. **Verify LibreOffice** — Required for PDF generation
4. **Validate file paths** — Ensure documents are accessible
5. **Quick tour** — Optional onboarding

### 1.2 First-Run Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      First-Run Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Launch App                                                      │
│      ↓                                                          │
│  Check for existing database                                    │
│      ↓                                                          │
│  ┌─ Database exists? ──────────────────────────────────────┐   │
│  │                                                          │   │
│  │  YES → Normal startup                                   │   │
│  │                                                          │   │
│  │  NO  → Show Setup Wizard                                │   │
│  │         Step 1: Welcome                                  │   │
│  │         Step 2: Configure Paths                          │   │
│  │         Step 3: Import Data                              │   │
│  │         Step 4: Verify LibreOffice (optional)           │   │
│  │         Step 5: Validate & Complete                      │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. First-Run Detection

### 2.1 Detection Logic

```go
// internal/app/firstrun.go
package app

import (
    "os"
    "path/filepath"
)

type FirstRunStatus struct {
    IsFirstRun       bool   `json:"isFirstRun"`
    DatabaseExists   bool   `json:"databaseExists"`
    ConfigExists     bool   `json:"configExists"`
    BasePathSet      bool   `json:"basePathSet"`
    DataImported     bool   `json:"dataImported"`
    LibreOfficeFound bool   `json:"libreOfficeFound"`
}

func (a *App) CheckFirstRunStatus() FirstRunStatus {
    appDataDir := a.getAppDataDir()
    
    status := FirstRunStatus{}
    
    // Check if database exists
    dbPath := filepath.Join(appDataDir, "submissions.db")
    status.DatabaseExists = fileExists(dbPath)
    
    // Check if config exists
    configPath := filepath.Join(appDataDir, "config.json")
    status.ConfigExists = fileExists(configPath)
    
    // Check if base path is configured
    if status.ConfigExists {
        config, _ := a.loadConfig()
        status.BasePathSet = config.BaseFolderPath != ""
    }
    
    // Check if data has been imported (works table has records)
    if status.DatabaseExists {
        var count int
        a.db.QueryRow("SELECT COUNT(*) FROM Works").Scan(&count)
        status.DataImported = count > 0
    }
    
    // Check LibreOffice
    status.LibreOfficeFound = isLibreOfficeInstalled()
    
    // First run if no database or no data imported
    status.IsFirstRun = !status.DatabaseExists || !status.DataImported
    
    return status
}
```

### 2.2 App Startup Integration

```go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Check first-run status
    status := a.CheckFirstRunStatus()
    
    if status.IsFirstRun {
        // Don't load normal UI yet
        // Frontend will show setup wizard
        a.isFirstRun = true
        return
    }
    
    // Normal startup
    a.initializeDatabase()
    a.runMigrations()
    a.loadUserPreferences()
}
```

---

## 3. Setup Wizard

### 3.1 Step 1: Welcome

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    📁 Submissions Tracker                      │
│                                                                │
│                    Welcome to your new                         │
│                   writing management app!                      │
│                                                                │
│   This wizard will help you:                                  │
│                                                                │
│   ✓ Configure where your documents are stored                 │
│   ✓ Import your existing data from FileMaker                  │
│   ✓ Set up PDF preview (optional)                             │
│   ✓ Verify everything is working                              │
│                                                                │
│   It should only take a few minutes.                          │
│                                                                │
│                                                                │
│                                        [Get Started →]         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Step 2: Configure Paths

```
┌────────────────────────────────────────────────────────────────┐
│                    📂 Document Location                        │
│────────────────────────────────────────────────────────────────│
│                                                                │
│   Where are your writing documents stored?                    │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐   │
│   │ /Users/jrush/Writing                         [Browse] │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                                │
│   Expected folder structure:                                  │
│                                                                │
│   📁 Writing/                                                  │
│   ├── 📁 34 Current Work/                                     │
│   ├── 📁 35 Open Ideas/                                       │
│   ├── 📁 100 Stories/                                         │
│   ├── 📁 150 Published/                                       │
│   └── 📁 999 Archive/                                         │
│                                                                │
│   ⚠️  This folder contains 1,423 .docx files                  │
│                                                                │
│                                  [← Back]  [Continue →]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Step 3: Import Data

```
┌────────────────────────────────────────────────────────────────┐
│                    📥 Import Data                              │
│────────────────────────────────────────────────────────────────│
│                                                                │
│   Select your FileMaker export folder:                        │
│                                                                │
│   ┌──────────────────────────────────────────────────────┐   │
│   │ /Users/jrush/.../export/dbSubmissions       [Browse]  │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                                │
│   Found CSV files:                                            │
│                                                                │
│   ✅ Works.csv                    1,749 records               │
│   ✅ Organizations.csv              755 records               │
│   ✅ Submissions.csv                246 records               │
│   ✅ Collections.csv                 31 records               │
│   ✅ CollectionDetails.csv        2,996 records               │
│   ✅ Work Notes.csv                 221 records               │
│   ✅ Journal Notes.csv              239 records               │
│                                                                │
│   ────────────────────────────────────────────────────────    │
│   Total: 6,237 records                                        │
│                                                                │
│                                  [← Back]  [Import →]          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.4 Step 3b: Import Progress

```
┌────────────────────────────────────────────────────────────────┐
│                    📥 Importing Data                           │
│────────────────────────────────────────────────────────────────│
│                                                                │
│   ████████████████████████░░░░░░░░░░░░░░░░░░  60%             │
│                                                                │
│   Importing Works... 1,049 of 1,749                           │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │ ✅ Collections.csv              31 records    ✓        │  │
│   │ ✅ CollectionDetails.csv     2,996 records    ✓        │  │
│   │ 🔄 Works.csv                 1,049 / 1,749              │  │
│   │ ⏳ Organizations.csv           755 records              │  │
│   │ ⏳ Submissions.csv              246 records              │  │
│   │ ⏳ Work Notes.csv               221 records              │  │
│   │ ⏳ Journal Notes.csv            239 records              │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│   Elapsed: 12 seconds                                          │
│   Estimated remaining: 8 seconds                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.5 Step 4: LibreOffice (Required)

```
┌────────────────────────────────────────────────────────────────┐
│                    📄 PDF Preview Setup                        │
│────────────────────────────────────────────────────────────────│
│                                                                │
│   LibreOffice is required to generate PDF previews when       │
│   you create or update documents.                             │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   ❌ LibreOffice not found                             │  │
│   │                                                         │  │
│   │   Please install LibreOffice to continue.              │  │
│   │                                                         │  │
│   │              [Download LibreOffice]                     │  │
│   │                                                         │  │
│   │   After installing, click "Check Again"                │  │
│   │                                                         │  │
│   │              [Check Again]                              │  │
│   │                                                         │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│                                  [← Back]                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**When LibreOffice IS found:**

```
│   ┌────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   ✅ LibreOffice found                                 │  │
│   │                                                         │  │
│   │   Version: 7.5.3                                       │  │
│   │   Path: /Applications/LibreOffice.app                  │  │
│   │                                                         │  │
│   │   PDFs will auto-regenerate when documents change.     │  │
│   │                                                         │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│                                  [← Back]  [Continue →]        │
```

### 3.6 Step 5: Validation & Complete

```
┌────────────────────────────────────────────────────────────────┐
│                    ✅ Setup Complete                           │
│────────────────────────────────────────────────────────────────│
│                                                                │
│   Your database is ready!                                     │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   📊 Summary                                           │  │
│   │                                                         │  │
│   │   Works:          1,749 imported                       │  │
│   │   Organizations:    755 imported                       │  │
│   │   Submissions:      246 imported                       │  │
│   │   Collections:       31 imported                       │  │
│   │                                                         │  │
│   │   Files verified:  1,698 found (97%)                   │  │
│   │   Files missing:      51 (can be fixed later)          │  │
│   │                                                         │  │
│   │   PDF Preview: ✅ Available                            │  │
│   │                                                         │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│   ☐ Show me a quick tour of the app                           │
│                                                                │
│                                        [Start Using App →]     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. LibreOffice Detection

### 4.1 Detection Logic

```go
// internal/deps/libreoffice.go
package deps

import (
    "os/exec"
    "runtime"
    "strings"
)

type LibreOfficeStatus struct {
    Installed bool   `json:"installed"`
    Path      string `json:"path"`
    Version   string `json:"version"`
}

func CheckLibreOffice() LibreOfficeStatus {
    path := findLibreOfficePath()
    if path == "" {
        return LibreOfficeStatus{Installed: false}
    }
    
    version := getLibreOfficeVersion(path)
    
    return LibreOfficeStatus{
        Installed: true,
        Path:      path,
        Version:   version,
    }
}

func findLibreOfficePath() string {
    // macOS only
    path := "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if fileExists(path) {
        return path
    }
    return ""
}

func getLibreOfficeVersion(path string) string {
    cmd := exec.Command(path, "--version")
    output, err := cmd.Output()
    if err != nil {
        return "Unknown"
    }
    
    // Parse "LibreOffice 7.5.3.2..."
    parts := strings.Fields(string(output))
    if len(parts) >= 2 {
        return parts[1]
    }
    return "Unknown"
}

func GetLibreOfficeDownloadURL() string {
    return "https://www.libreoffice.org/download/download-libreoffice/?type=mac-x86_64"
}
```

### 4.2 Wails Bindings

```go
// app_deps.go

func (a *App) CheckLibreOffice() LibreOfficeStatus {
    return deps.CheckLibreOffice()
}

func (a *App) OpenLibreOfficeDownload() {
    url := deps.GetLibreOfficeDownloadURL()
    runtime.BrowserOpenURL(a.ctx, url)
}
```

---

## 5. Data Import

### 5.1 Import Service

```go
// internal/importer/importer.go
package importer

import (
    "encoding/csv"
    "fmt"
    "os"
    "path/filepath"
)

type ImportProgress struct {
    CurrentFile   string `json:"currentFile"`
    CurrentRecord int    `json:"currentRecord"`
    TotalRecords  int    `json:"totalRecords"`
    FilesComplete int    `json:"filesComplete"`
    TotalFiles    int    `json:"totalFiles"`
    Errors        []string `json:"errors"`
}

type ImportService struct {
    db       *sql.DB
    progress ImportProgress
    onProgress func(ImportProgress)
}

func NewImportService(db *sql.DB) *ImportService {
    return &ImportService{
        db: db,
        progress: ImportProgress{TotalFiles: 7},
    }
}

func (s *ImportService) SetProgressCallback(cb func(ImportProgress)) {
    s.onProgress = cb
}

// ImportFromFolder imports all CSV files from a FileMaker export folder
func (s *ImportService) ImportFromFolder(folderPath string) error {
    // Define import order (respecting foreign keys)
    files := []struct {
        filename string
        importer func(string) error
    }{
        {"Collections.csv", s.importCollections},
        {"Works.csv", s.importWorks},
        {"CollectionDetails.csv", s.importCollectionDetails},
        {"Organizations.csv", s.importOrganizations},
        {"Submissions.csv", s.importSubmissions},
        {"Work Notes.csv", s.importWorkNotes},
        {"Journal Notes.csv", s.importJournalNotes},
    }
    
    for i, f := range files {
        path := filepath.Join(folderPath, f.filename)
        
        if !fileExists(path) {
            s.progress.Errors = append(s.progress.Errors, 
                fmt.Sprintf("File not found: %s", f.filename))
            continue
        }
        
        s.progress.CurrentFile = f.filename
        s.progress.FilesComplete = i
        s.reportProgress()
        
        if err := f.importer(path); err != nil {
            s.progress.Errors = append(s.progress.Errors,
                fmt.Sprintf("Error importing %s: %v", f.filename, err))
        }
    }
    
    s.progress.FilesComplete = len(files)
    s.reportProgress()
    
    return nil
}

func (s *ImportService) importWorks(path string) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()
    
    reader := csv.NewReader(file)
    
    // Read header
    header, err := reader.Read()
    if err != nil {
        return err
    }
    
    // Create column index map
    colIndex := make(map[string]int)
    for i, col := range header {
        colIndex[col] = i
    }
    
    // Read all records to get count
    records, err := reader.ReadAll()
    if err != nil {
        return err
    }
    
    s.progress.TotalRecords = len(records)
    
    // Prepare insert statement
    stmt, err := s.db.Prepare(`
        INSERT INTO Works (
            workID, title, type, year, status, quality, doc_type,
            path, draft, n_words, course_name, is_blog, is_printed,
            is_prose_poem, is_revised, mark, access_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    if err != nil {
        return err
    }
    defer stmt.Close()
    
    // Begin transaction
    tx, err := s.db.Begin()
    if err != nil {
        return err
    }
    
    for i, record := range records {
        s.progress.CurrentRecord = i + 1
        if i % 100 == 0 {
            s.reportProgress()
        }
        
        _, err := tx.Stmt(stmt).Exec(
            getCol(record, colIndex, "workID"),
            getCol(record, colIndex, "Title"),
            getCol(record, colIndex, "Type"),
            getCol(record, colIndex, "Year"),
            getColOrDefault(record, colIndex, "Status", "Working"),
            getColOrDefault(record, colIndex, "Quality", "Okay"),
            getColOrDefault(record, colIndex, "DocType", "docx"),
            getCol(record, colIndex, "Path"),
            getCol(record, colIndex, "Draft"),
            parseIntOrZero(getCol(record, colIndex, "nWords")),
            getCol(record, colIndex, "CourseName"),
            getCol(record, colIndex, "isBlog"),
            getCol(record, colIndex, "isPrinted"),
            getCol(record, colIndex, "isProsePoem"),
            getCol(record, colIndex, "isRevised"),
            getCol(record, colIndex, "Mark"),
            parseDate(getCol(record, colIndex, "accessDate")),
        )
        
        if err != nil {
            s.progress.Errors = append(s.progress.Errors,
                fmt.Sprintf("Row %d: %v", i+1, err))
        }
    }
    
    return tx.Commit()
}

func (s *ImportService) reportProgress() {
    if s.onProgress != nil {
        s.onProgress(s.progress)
    }
}
```

### 5.2 Wails Bindings for Import

```go
// app_import.go

func (a *App) ValidateImportFolder(folderPath string) Result[ImportValidation] {
    validation := a.importer.ValidateFolder(folderPath)
    return Ok(validation)
}

func (a *App) StartImport(folderPath string) Result[bool] {
    // Create progress channel
    go func() {
        a.importer.SetProgressCallback(func(progress ImportProgress) {
            // Emit event to frontend
            runtime.EventsEmit(a.ctx, "import:progress", progress)
        })
        
        err := a.importer.ImportFromFolder(folderPath)
        
        if err != nil {
            runtime.EventsEmit(a.ctx, "import:error", err.Error())
        } else {
            runtime.EventsEmit(a.ctx, "import:complete", nil)
        }
    }()
    
    return Ok(true)
}
```

### 5.3 React Import Component

```typescript
// src/components/setup/ImportStep.tsx
import { useState, useEffect } from 'react';
import { Progress, Stack, Text, List, Badge, Button } from '@mantine/core';
import { IconCheck, IconLoader, IconClock } from '@tabler/icons-react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { StartImport, ValidateImportFolder } from '../../wailsjs/go/main/App';

interface ImportProgress {
  currentFile: string;
  currentRecord: number;
  totalRecords: number;
  filesComplete: number;
  totalFiles: number;
  errors: string[];
}

export function ImportStep({ folderPath, onComplete }: Props) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // Listen for progress events
    const unsubProgress = EventsOn('import:progress', (p: ImportProgress) => {
      setProgress(p);
    });
    
    const unsubComplete = EventsOn('import:complete', () => {
      setComplete(true);
      setImporting(false);
      onComplete();
    });
    
    const unsubError = EventsOn('import:error', (err: string) => {
      setImporting(false);
      notifications.show({ message: err, color: 'red' });
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, []);

  const startImport = async () => {
    setImporting(true);
    await StartImport(folderPath);
  };

  const overallPercent = progress
    ? ((progress.filesComplete / progress.totalFiles) * 100) +
      ((progress.currentRecord / progress.totalRecords) * (100 / progress.totalFiles))
    : 0;

  return (
    <Stack>
      {!importing && !complete && (
        <Button onClick={startImport} size="lg">
          Start Import
        </Button>
      )}

      {importing && progress && (
        <>
          <Progress value={overallPercent} size="xl" animated />
          
          <Text>
            Importing {progress.currentFile}... {progress.currentRecord} of {progress.totalRecords}
          </Text>

          <List>
            {['Collections.csv', 'Works.csv', 'CollectionDetails.csv', 
              'Organizations.csv', 'Submissions.csv', 'Work Notes.csv', 
              'Journal Notes.csv'].map((file, i) => (
              <List.Item
                key={file}
                icon={
                  i < progress.filesComplete ? <IconCheck color="green" /> :
                  i === progress.filesComplete ? <IconLoader className="spinning" /> :
                  <IconClock color="gray" />
                }
              >
                {file}
                {i < progress.filesComplete && (
                  <Badge ml="sm" color="green">Complete</Badge>
                )}
              </List.Item>
            ))}
          </List>
        </>
      )}

      {complete && (
        <Text c="green" fw={500}>
          ✓ Import complete!
        </Text>
      )}
    </Stack>
  );
}
```

---

## 6. Post-Install Verification

### 6.1 File Path Verification

After import, verify that document files can be found:

```go
// internal/verify/verify.go
package verify

type VerificationResult struct {
    TotalWorks   int      `json:"totalWorks"`
    FilesFound   int      `json:"filesFound"`
    FilesMissing int      `json:"filesMissing"`
    MissingList  []string `json:"missingList"` // First 20 missing
}

func (v *VerifyService) VerifyFilePaths(basePath string) VerificationResult {
    result := VerificationResult{}
    
    rows, _ := v.db.Query("SELECT workID, title, path FROM Works")
    defer rows.Close()
    
    var missing []string
    
    for rows.Next() {
        var workID int
        var title, path string
        rows.Scan(&workID, &title, &path)
        
        result.TotalWorks++
        
        fullPath := filepath.Join(basePath, path)
        if fileExists(fullPath) {
            result.FilesFound++
        } else {
            result.FilesMissing++
            if len(missing) < 20 {
                missing = append(missing, fmt.Sprintf("%d: %s", workID, title))
            }
        }
    }
    
    result.MissingList = missing
    return result
}
```

### 6.2 Quick Health Check

```go
func (a *App) RunHealthCheck() HealthCheckResult {
    result := HealthCheckResult{}
    
    // Check database
    err := a.db.Ping()
    result.DatabaseOK = err == nil
    
    // Check counts
    a.db.QueryRow("SELECT COUNT(*) FROM Works").Scan(&result.WorkCount)
    a.db.QueryRow("SELECT COUNT(*) FROM Organizations").Scan(&result.OrgCount)
    a.db.QueryRow("SELECT COUNT(*) FROM Submissions").Scan(&result.SubCount)
    
    // Check LibreOffice
    result.LibreOfficeOK = deps.CheckLibreOffice().Installed
    
    // Check base path
    result.BasePathOK = dirExists(a.config.BaseFolderPath)
    
    // Quick file sample check
    var samplePath string
    a.db.QueryRow("SELECT path FROM Works WHERE path != '' LIMIT 1").Scan(&samplePath)
    if samplePath != "" {
        fullPath := filepath.Join(a.config.BaseFolderPath, samplePath)
        result.SampleFileOK = fileExists(fullPath)
    }
    
    return result
}
```

---

## 7. Implementation

### 7.1 Setup Wizard React Component

```typescript
// src/pages/SetupWizard.tsx
import { useState } from 'react';
import { Stepper, Button, Group, Container } from '@mantine/core';
import { WelcomeStep } from '../components/setup/WelcomeStep';
import { PathsStep } from '../components/setup/PathsStep';
import { ImportStep } from '../components/setup/ImportStep';
import { LibreOfficeStep } from '../components/setup/LibreOfficeStep';
import { CompleteStep } from '../components/setup/CompleteStep';
import { CompleteSetup } from '../../wailsjs/go/main/App';

export function SetupWizard() {
  const [active, setActive] = useState(0);
  const [config, setConfig] = useState({
    baseFolderPath: '',
    importFolderPath: '',
    skipLibreOffice: false,
  });

  const nextStep = () => setActive((current) => Math.min(current + 1, 4));
  const prevStep = () => setActive((current) => Math.max(current - 1, 0));

  const finishSetup = async () => {
    await CompleteSetup(config);
    // Reload app
    window.location.reload();
  };

  return (
    <Container size="md" py="xl">
      <Stepper active={active} onStepClick={setActive}>
        <Stepper.Step label="Welcome" description="Get started">
          <WelcomeStep onNext={nextStep} />
        </Stepper.Step>

        <Stepper.Step label="Documents" description="Configure paths">
          <PathsStep
            value={config.baseFolderPath}
            onChange={(path) => setConfig({ ...config, baseFolderPath: path })}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Stepper.Step>

        <Stepper.Step label="Import" description="Import data">
          <ImportStep
            folderPath={config.importFolderPath}
            onFolderChange={(path) => setConfig({ ...config, importFolderPath: path })}
            onComplete={nextStep}
            onBack={prevStep}
          />
        </Stepper.Step>

        <Stepper.Step label="Preview" description="PDF setup">
          <LibreOfficeStep
            onSkip={() => {
              setConfig({ ...config, skipLibreOffice: true });
              nextStep();
            }}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Stepper.Step>

        <Stepper.Completed>
          <CompleteStep
            config={config}
            onFinish={finishSetup}
            onBack={prevStep}
          />
        </Stepper.Completed>
      </Stepper>
    </Container>
  );
}
```

### 7.2 App Entry Point

```typescript
// src/App.tsx
import { useEffect, useState } from 'react';
import { CheckFirstRunStatus } from '../wailsjs/go/main/App';
import { SetupWizard } from './pages/SetupWizard';
import { MainApp } from './MainApp';

function App() {
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    CheckFirstRunStatus().then((status) => {
      setIsFirstRun(status.isFirstRun);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (isFirstRun) {
    return <SetupWizard />;
  }

  return <MainApp />;
}
```

### 7.3 Complete Setup Binding

```go
// app_setup.go

type SetupConfig struct {
    BaseFolderPath   string `json:"baseFolderPath"`
    ImportFolderPath string `json:"importFolderPath"`
    SkipLibreOffice  bool   `json:"skipLibreOffice"`
}

func (a *App) CompleteSetup(config SetupConfig) Result[bool] {
    // Save configuration
    a.config.BaseFolderPath = config.BaseFolderPath
    if err := a.saveConfig(); err != nil {
        return Fail[bool](err, "CONFIG_SAVE_FAILED")
    }
    
    // Mark first run complete
    a.isFirstRun = false
    
    // Rebuild FTS indexes
    if err := a.searchService.RebuildIndexes(); err != nil {
        // Non-fatal
        log.Printf("Warning: FTS rebuild failed: %v", err)
    }
    
    // Create initial backup
    a.backupService.CreateBackup("initial-setup")
    
    return Ok(true)
}
```

---

*End of Installation & First-Run Guide*
