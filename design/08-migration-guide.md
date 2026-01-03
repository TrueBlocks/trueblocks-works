# Migration Guide

> **Document:** 08-migration-guide.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Setup](#3-project-setup)
4. [Database Setup](#4-database-setup)
5. [Data Import](#5-data-import)
6. [Go Backend Development](#6-go-backend-development)
7. [React Frontend Development](#7-react-frontend-development)
8. [Building & Distribution](#8-building--distribution)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Overview

### 1.1 Migration Goals

- **Data Integrity:** 100% of records migrated without loss
- **Feature Parity:** All FileMaker functionality reproduced
- **Native Desktop App:** Single binary, cross-platform distribution
- **Modern Stack:** TypeScript + React for maintainable frontend
- **Future-Proof:** Standard technologies with active communities

### 1.2 Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Framework** | Wails | v2.x | Native desktop with web UI |
| **Backend** | Go | 1.21+ | Fast, excellent SQLite support |
| **Frontend** | React | 18.x | Component-based, TypeScript support |
| **Language** | TypeScript | 5.x | Type safety, IDE support |
| **Package Manager** | Yarn | 4.x | Fast, reliable dependencies |
| **Database** | SQLite | 3.x | Portable, file-based |
| **UI Library** | Mantine | 7.x | Full-featured React component library |
| **Icons** | Tabler Icons | 3.x | Consistent icon set, Mantine compatible |
| **Routing** | React Router | 7.x | Client-side routing |

### 1.3 Migration Phases

```
Phase 1: Project Setup (Day 1)
├── Initialize Wails project with React/TypeScript
├── Configure Yarn and dependencies
├── Set up project structure
└── Configure Mantine UI library

Phase 2: Database Setup (Day 1)
├── Create SQLite schema
├── One-time CSV import from FileMaker exports
├── Validate data integrity
└── Set up Go database layer

Phase 3: Go Backend (Week 1)
├── Implement data models
├── Create Wails-bound methods
├── Implement file operations
└── Add PDF preview support

Phase 4: React Frontend (Week 2)
├── Build TypeScript interfaces
├── Create page components
├── Implement conditional formatting
├── Connect to Wails backend

Phase 5: Testing & Polish (Week 3)
├── Compare against FileMaker
├── Test all workflows
├── Fix edge cases
└── Build production binary
```

---

## 2. Prerequisites

### 2.1 Required Software

All software is assumed to be installed on the development machine:

| Software | Version | Verification |
|----------|---------|--------------|
| Go | 1.21+ | `go version` |
| Node.js | 18+ | `node --version` |
| Yarn | 4.x | `yarn --version` |
| Wails CLI | 2.x | `wails version` |
| SQLite | 3.x | `sqlite3 --version` |

### 2.2 Data Prerequisites

The following CSV exports should already exist:

```
/Users/jrush/Development/databases/design/export/dbSubmissions/
├── Collections.csv
├── CollectionDetails.csv
├── Works.csv
├── Organizations.csv
├── Submissions.csv
├── Work Notes.csv
└── Journal Notes.csv
```

---

## 3. Project Setup

### 3.1 Initialize Wails Project

```bash
# Create new Wails project with React + TypeScript
wails init -n submissions -t react-ts

cd submissions
```

### 3.2 Project Structure

```
submissions/
├── app.go                    # Main Wails app struct
├── app_collections.go        # Collection bindings
├── app_works.go              # Work bindings
├── app_organizations.go      # Organization bindings
├── app_submissions.go        # Submission bindings
├── app_files.go              # File operation bindings
├── main.go                   # Entry point
├── wails.json                # Wails configuration
├── go.mod
├── go.sum
│
├── internal/
│   ├── db/
│   │   ├── db.go             # Database connection
│   │   ├── works.go          # Works CRUD
│   │   ├── organizations.go  # Orgs CRUD
│   │   ├── submissions.go    # Submissions CRUD
│   │   ├── collections.go    # Collections CRUD
│   │   └── notes.go          # Notes CRUD
│   ├── fileops/
│   │   ├── paths.go          # Path generation
│   │   ├── files.go          # File operations
│   │   └── preview.go        # PDF preview
│   ├── models/
│   │   ├── work.go
│   │   ├── organization.go
│   │   ├── submission.go
│   │   ├── collection.go
│   │   ├── notes.go
│   │   └── enums.go
│   └── migrate/
│       └── import.go         # One-time CSV import
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   ├── QualityBadge.tsx
│   │   │   │   ├── ResponseBadge.tsx
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   │   └── Navigation.tsx
│   │   │   ├── collections/
│   │   │   │   ├── CollectionSidebar.tsx
│   │   │   │   └── FilterCheckboxes.tsx
│   │   │   ├── works/
│   │   │   │   ├── WorksTable.tsx
│   │   │   │   ├── WorkHeader.tsx
│   │   │   │   ├── FileActionsToolbar.tsx
│   │   │   │   ├── PDFPreview.tsx
│   │   │   │   └── PathDisplay.tsx
│   │   │   ├── organizations/
│   │   │   │   └── OrganizationsTable.tsx
│   │   │   └── submissions/
│   │   │       └── SubmissionsTable.tsx
│   │   ├── pages/
│   │   │   ├── CollectionsPage.tsx
│   │   │   ├── WorksPage.tsx
│   │   │   ├── WorkDetailPage.tsx
│   │   │   ├── OrganizationsPage.tsx
│   │   │   └── SubmissionsPage.tsx
│   │   ├── hooks/
│   │   │   ├── useNavigation.ts
│   │   │   ├── useValueLists.ts
│   │   │   └── useFileOperations.ts
│   │   ├── types/
│   │   │   ├── models.ts
│   │   │   ├── enums.ts
│   │   │   ├── constants.ts
│   │   │   └── styles.ts
│   │   └── utils/
│   │       ├── paths.ts
│   │       ├── dates.ts
│   │       └── validation.ts
│   └── wailsjs/              # Auto-generated bindings
│       ├── go/
│       │   └── main/
│       │       ├── App.d.ts
│       │       └── App.js
│       └── runtime/
│
├── data/
│   └── submissions.db        # SQLite database
│
└── schema.sql                # Database schema
```

### 3.3 Configure Frontend Dependencies

```bash
cd frontend

# Install dependencies with Yarn
yarn add react-router-dom
yarn add @mantine/core @mantine/hooks @mantine/dates
yarn add @tabler/icons-react
yarn add dayjs
```

### 3.4 Configure Mantine

```tsx
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);
```

### 3.5 Status/Quality Color Configuration

```tsx
// frontend/src/types/styles.ts

// Row background colors by status (for table styling)
export const statusRowColors: Record<string, string> = {
  Focus: '#E8F5E9',
  Active: '#E8F5E9',
  Working: '#E3F2FD',
  Resting: '#F3E5F5',
  Waiting: '#FFF3E0',
  Gestating: '#FFFDE7',
  Sleeping: '#FAFAFA',
  Dying: '#FFEBEE',
  Dead: '#ECEFF1',
  Out: '#E1F5FE',
};

// Badge colors for Status
export const statusBadgeColors: Record<string, { bg: string; color: string }> = {
  Focus: { bg: '#C8E6C9', color: '#1B5E20' },
  Active: { bg: '#A5D6A7', color: '#1B5E20' },
  Working: { bg: '#BBDEFB', color: '#0D47A1' },
  Resting: { bg: '#E1BEE7', color: '#4A148C' },
  Waiting: { bg: '#FFE0B2', color: '#E65100' },
  Gestating: { bg: '#FFF9C4', color: '#F57F17' },
  Sleeping: { bg: '#EEEEEE', color: '#616161' },
  Dying: { bg: '#FFCDD2', color: '#B71C1C' },
  Dead: { bg: '#CFD8DC', color: '#37474F' },
  Out: { bg: '#B3E5FC', color: '#01579B' },
};

// Badge colors for Quality
export const qualityBadgeColors: Record<string, { bg: string; color: string }> = {
  Best: { bg: '#1B5E20', color: '#FFFFFF' },
  Better: { bg: '#388E3C', color: '#FFFFFF' },
  Good: { bg: '#66BB6A', color: '#1B5E20' },
  Okay: { bg: '#E0E0E0', color: '#616161' },
  Bad: { bg: '#FFCDD2', color: '#B71C1C' },
  Unknown: { bg: '#F5F5F5', color: '#9E9E9E' },
};
```

### 3.6 Configure wails.json

```json
{
  "name": "submissions",
  "outputfilename": "submissions",
  "frontend:install": "yarn install",
  "frontend:build": "yarn build",
  "frontend:dev:watcher": "yarn dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "Your Name"
  }
}
```

---

## 4. Database Setup

### 4.1 Create Schema File

Save as `schema.sql` in project root:

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    coll_id INTEGER PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    is_status INTEGER DEFAULT 0,
    type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Works table
CREATE TABLE IF NOT EXISTS works (
    work_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    year TEXT NOT NULL DEFAULT '2024',
    status TEXT NOT NULL DEFAULT 'Gestating',
    quality TEXT NOT NULL DEFAULT 'Okay',
    doc_type TEXT DEFAULT 'rtf',
    path TEXT,
    draft TEXT,
    n_words INTEGER DEFAULT 0,
    course_name TEXT,
    is_blog INTEGER DEFAULT 0,
    is_printed INTEGER DEFAULT 0,
    is_prose_poem INTEGER DEFAULT 0,
    is_revised INTEGER DEFAULT 0,
    mark TEXT,
    access_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- CollectionDetails (junction table)
CREATE TABLE IF NOT EXISTS collection_details (
    id INTEGER PRIMARY KEY,
    coll_id INTEGER NOT NULL,
    work_id INTEGER NOT NULL,
    collection_name TEXT,
    FOREIGN KEY (coll_id) REFERENCES collections(coll_id),
    FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE,
    UNIQUE(coll_id, work_id)
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    org_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    other_name TEXT,
    url TEXT,
    other_url TEXT,
    status TEXT DEFAULT 'Open',
    type TEXT DEFAULT 'Journal',
    timing TEXT,
    submission_types TEXT,
    accepts TEXT,
    my_interest TEXT,
    ranking INTEGER,
    source TEXT,
    duotrope_num INTEGER,
    n_push_fiction INTEGER DEFAULT 0,
    n_push_nonfiction INTEGER DEFAULT 0,
    n_push_poetry INTEGER DEFAULT 0,
    contest_ends TEXT,
    contest_fee TEXT,
    contest_prize TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    submission_id INTEGER PRIMARY KEY,
    work_id INTEGER NOT NULL,
    org_id INTEGER NOT NULL,
    draft TEXT,
    submission_type TEXT,
    submission_date TEXT,
    query_date TEXT,
    response_date TEXT,
    response_type TEXT DEFAULT 'Waiting',
    contest_name TEXT,
    cost REAL,
    web_address TEXT,
    FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);

-- Work Notes table
CREATE TABLE IF NOT EXISTS work_notes (
    note_id INTEGER PRIMARY KEY,
    work_id INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE
);

-- Journal Notes table
CREATE TABLE IF NOT EXISTS journal_notes (
    note_id INTEGER PRIMARY KEY,
    org_id INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_works_status ON works(status);
CREATE INDEX idx_works_type ON works(type);
CREATE INDEX idx_works_year ON works(year);
CREATE INDEX idx_works_quality ON works(quality);
CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_submissions_work ON submissions(work_id);
CREATE INDEX idx_submissions_org ON submissions(org_id);
CREATE INDEX idx_collection_details_coll ON collection_details(coll_id);
CREATE INDEX idx_collection_details_work ON collection_details(work_id);
CREATE INDEX idx_work_notes_work ON work_notes(work_id);
CREATE INDEX idx_journal_notes_org ON journal_notes(org_id);
```

### 4.2 Create Database

```bash
# Create data directory
mkdir -p data

# Create database from schema
sqlite3 data/submissions.db < schema.sql
``` |

---

## 5. Data Import

### 5.0 CSV Validation (Run BEFORE Import)

The FileMaker CSV exports contain data quality issues that must be fixed before import. Run the validation script first to identify and correct problems.

#### 5.0.1 Known Data Quality Issues

| Field | Issue | Example | Fix |
|-------|-------|---------|-----|
| `nWords` | Comma-separated thousands | `"2,055"` | Remove commas: `2055` |
| `accessDate` | Inconsistent date format | `"8/13/2020 7:14:27 PM"` | Parse to ISO: `2020-08-13T19:14:27` |
| `accessDate` | Empty values | `""` | Leave as NULL |
| Boolean fields | "yes" or empty | `"yes"`, `""` | Convert to 1/0 |
| `Title` | Contains quotes | `"The ""Quote"" Poem"` | Properly escaped already |
| `workID` | Leading zeros in some | `"00090"` | Parse as integer |

#### 5.0.2 Validation Script

Create `internal/migrate/validate.go`:

```go
package migrate

import (
    "encoding/csv"
    "fmt"
    "os"
    "regexp"
    "strconv"
    "strings"
    "time"
)

type ValidationIssue struct {
    File    string
    Row     int
    Column  string
    Value   string
    Issue   string
    CanFix  bool
}

type ValidationReport struct {
    Issues   []ValidationIssue
    FixCount int
    ErrCount int
}

func ValidateCSVs(csvDir string) (*ValidationReport, error) {
    report := &ValidationReport{}
    
    files := []struct {
        name    string
        columns map[string]Validator
    }{
        {
            "Works.csv",
            map[string]Validator{
                "workID":     ValidateInteger,
                "nWords":     ValidateNumberWithCommas,
                "accessDate": ValidateFileMakerDate,
                "isBlog":     ValidateYesEmpty,
                "isPrinted":  ValidateYesEmpty,
                "isProsePoem": ValidateYesEmpty,
                "isRevised":  ValidateYesEmpty,
                "Status":     ValidateInList(StatusValues),
                "Quality":    ValidateInList(QualityValues),
                "Type":       ValidateInList(WorkTypeValues),
            },
        },
        {
            "Organizations.csv",
            map[string]Validator{
                "orgID":          ValidateInteger,
                "nPushFiction":   ValidateInteger,
                "nPushNonFiction": ValidateInteger,
                "nPushPoetry":    ValidateInteger,
                "DuotropeNum":    ValidateIntegerOrEmpty,
                "Ranking":        ValidateIntegerOrEmpty,
            },
        },
        {
            "Submissions.csv",
            map[string]Validator{
                "submissionID":    ValidateInteger,
                "workID":          ValidateInteger,
                "orgID":           ValidateInteger,
                "SubmissionDate":  ValidateFileMakerDate,
                "QueryDate":       ValidateFileMakerDate,
                "ResponseDate":    ValidateFileMakerDate,
                "Cost":            ValidateDecimal,
            },
        },
        {
            "CollectionDetails.csv",
            map[string]Validator{
                "collID": ValidateInteger,
                "WorkID": ValidateInteger,
            },
        },
    }
    
    for _, f := range files {
        issues, err := validateFile(csvDir+f.name, f.columns)
        if err != nil {
            return nil, fmt.Errorf("validate %s: %w", f.name, err)
        }
        report.Issues = append(report.Issues, issues...)
    }
    
    for _, issue := range report.Issues {
        if issue.CanFix {
            report.FixCount++
        } else {
            report.ErrCount++
        }
    }
    
    return report, nil
}

type Validator func(value string) (string, bool, error)

// ValidateNumberWithCommas fixes "2,055" -> "2055"
func ValidateNumberWithCommas(value string) (string, bool, error) {
    if value == "" {
        return "0", true, nil
    }
    
    // Remove commas
    clean := strings.ReplaceAll(value, ",", "")
    
    if _, err := strconv.Atoi(clean); err != nil {
        return value, false, fmt.Errorf("not a number: %s", value)
    }
    
    if clean != value {
        return clean, true, nil // Fixed
    }
    return value, false, nil // Already good
}

// ValidateFileMakerDate fixes "8/13/2020 7:14:27 PM" -> "2020-08-13T19:14:27"
func ValidateFileMakerDate(value string) (string, bool, error) {
    if value == "" {
        return "", false, nil // Empty is OK
    }
    
    // Try FileMaker format: "M/D/YYYY H:MM:SS PM"
    formats := []string{
        "1/2/2006 3:04:05 PM",
        "1/2/2006 15:04:05",
        "1/2/2006",
        "2006-01-02T15:04:05",
        "2006-01-02",
    }
    
    for _, format := range formats {
        if t, err := time.Parse(format, value); err == nil {
            iso := t.Format("2006-01-02T15:04:05")
            if iso != value {
                return iso, true, nil // Fixed
            }
            return value, false, nil // Already good
        }
    }
    
    return value, false, fmt.Errorf("unrecognized date format: %s", value)
}

// ValidateYesEmpty converts "yes"/"Yes"/empty to consistent values
func ValidateYesEmpty(value string) (string, bool, error) {
    lower := strings.ToLower(strings.TrimSpace(value))
    switch lower {
    case "yes":
        return "yes", false, nil
    case "", "no":
        return "", false, nil
    default:
        return value, false, fmt.Errorf("expected 'yes' or empty, got: %s", value)
    }
}

// ValidateInList checks value is in allowed list
func ValidateInList(allowed []string) Validator {
    set := make(map[string]bool)
    for _, v := range allowed {
        set[v] = true
    }
    
    return func(value string) (string, bool, error) {
        if value == "" {
            return "", false, nil // Empty OK
        }
        if !set[value] {
            return value, false, fmt.Errorf("unknown value: %s", value)
        }
        return value, false, nil
    }
}

var StatusValues = []string{
    "Out", "Focus", "Active", "Working", "Resting", "Waiting",
    "Gestating", "Sound", "Published", "Sleeping", "Dying", "Dead", "Done",
}

var QualityValues = []string{
    "Best", "Better", "Good", "Okay", "Bad", "Worst", "Unknown",
}

var WorkTypeValues = []string{
    "Article", "Book", "Chapter", "Critique", "Essay", "Flash",
    "Interview", "Freewrite", "Journal", "Micro", "Poem", "Paper",
    "Lesson", "Character", "Research", "Review", "Song", "Story", "Travel",
    "Essay Idea", "Poem Idea", "Article Idea", "Book Idea", "Story Idea",
    "Paper Idea", "Interview Idea", "Flash Idea", "Micro Idea", "Other",
}
```

#### 5.0.3 Run Validation

```bash
# Run validation before import
go run cmd/validate/main.go

# Output:
# Validating Works.csv...
#   Row 2, nWords: "2,055" -> "2055" (fixed)
#   Row 2, accessDate: "8/13/2020 7:14:27 PM" -> "2020-08-13T19:14:27" (fixed)
#   ...
# Summary: 342 issues found, 340 auto-fixable, 2 require manual review
```

#### 5.0.4 Auto-Fix Script

```go
// FixCSVs writes corrected versions of CSV files
func FixCSVs(csvDir string, outputDir string) error {
    // Read, validate, fix, and write new CSVs
    // Original files are NOT modified
    // Output goes to outputDir
}
```

### 5.1 One-Time Import Script

Create `internal/migrate/import.go`:

```go
package migrate

import (
    "database/sql"
    "encoding/csv"
    "fmt"
    "os"
    "strconv"
    "strings"
)

const CSVDir = "/Users/jrush/Development/databases/design/export/dbSubmissions/"

func ImportAll(db *sql.DB) error {
    // Import in order of dependencies
    tables := []struct {
        name   string
        file   string
        import func(*sql.DB, string) error
    }{
        {"Collections", "Collections.csv", ImportCollections},
        {"Organizations", "Organizations.csv", ImportOrganizations},
        {"Works", "Works.csv", ImportWorks},
        {"CollectionDetails", "CollectionDetails.csv", ImportCollectionDetails},
        {"Submissions", "Submissions.csv", ImportSubmissions},
        {"WorkNotes", "Work Notes.csv", ImportWorkNotes},
        {"JournalNotes", "Journal Notes.csv", ImportJournalNotes},
    }
    
    for _, t := range tables {
        path := CSVDir + t.file
        fmt.Printf("Importing %s from %s...\n", t.name, t.file)
        if err := t.import(db, path); err != nil {
            return fmt.Errorf("%s: %w", t.name, err)
        }
    }
    
    return nil
}

func ImportWorks(db *sql.DB, csvPath string) error {
    file, err := os.Open(csvPath)
    if err != nil {
        return err
    }
    defer file.Close()
    
    reader := csv.NewReader(file)
    header, _ := reader.Read()
    colIndex := makeColIndex(header)
    
    stmt, err := db.Prepare(`
        INSERT INTO works (
            work_id, title, type, year, status, quality, doc_type, path, draft,
            n_words, course_name, is_blog, is_printed, is_prose_poem, is_revised, mark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    if err != nil {
        return err
    }
    defer stmt.Close()
    
    count := 0
    for {
        row, err := reader.Read()
        if err != nil {
            break
        }
        
        workID, _ := strconv.Atoi(getField(row, colIndex, "workID"))
        nWords, _ := strconv.Atoi(getField(row, colIndex, "nWords"))
        
        _, err = stmt.Exec(
            workID,
            getField(row, colIndex, "Title"),
            getField(row, colIndex, "Type"),
            getField(row, colIndex, "Year"),
            getField(row, colIndex, "Status"),
            getField(row, colIndex, "Quality"),
            getField(row, colIndex, "DocType"),
            getField(row, colIndex, "Path"),
            getField(row, colIndex, "Draft"),
            nWords,
            getField(row, colIndex, "CourseName"),
            yesNoToBool(getField(row, colIndex, "isBlog")),
            yesNoToBool(getField(row, colIndex, "isPrinted")),
            yesNoToBool(getField(row, colIndex, "isProsePoem")),
            yesNoToBool(getField(row, colIndex, "isRevised")),
            getField(row, colIndex, "Mark"),
        )
        if err != nil {
            return err
        }
        count++
    }
    
    fmt.Printf("  Imported %d works\n", count)
    return nil
}

func makeColIndex(header []string) map[string]int {
    colIndex := make(map[string]int)
    for i, col := range header {
        colIndex[col] = i
    }
    return colIndex
}

func getField(row []string, colIndex map[string]int, col string) string {
    if idx, ok := colIndex[col]; ok && idx < len(row) {
        return strings.TrimSpace(row[idx])
    }
    return ""
}

func yesNoToBool(val string) int {
    if strings.ToLower(val) == "yes" {
        return 1
    }
    return 0
}

// Similar functions for ImportOrganizations, ImportSubmissions, etc.
// See 01-data-model.md for field mappings
```

### 5.2 Run Import

Add import command to `main.go`:

```go
// Check for --import flag
if len(os.Args) > 1 && os.Args[1] == "--import" {
    db, _ := sql.Open("sqlite3", "./data/submissions.db")
    if err := migrate.ImportAll(db); err != nil {
        log.Fatal(err)
    }
    fmt.Println("Import complete!")
    return
}
```

Run the import:

```bash
go run . --import
```

### 5.3 Validate Import

```bash
sqlite3 data/submissions.db << 'EOF'
SELECT 'works' as tbl, COUNT(*) as count FROM works
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'collection_details', COUNT(*) FROM collection_details
UNION ALL SELECT 'work_notes', COUNT(*) FROM work_notes
UNION ALL SELECT 'journal_notes', COUNT(*) FROM journal_notes;
EOF
```

Expected output:
```
works|1749
organizations|755
submissions|246
collections|31
collection_details|2996
work_notes|221
journal_notes|239
```

---

## 6. Go Backend Development

### 6.1 Main Wails App

```go
// app.go
package main

import (
    "context"
    "submissions/internal/db"
    "submissions/internal/fileops"
)

type App struct {
    ctx     context.Context
    db      *db.Database
    fileops *fileops.Manager
}

func NewApp() *App {
    return &App{}
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Open database
    database, err := db.Open("./data/submissions.db")
    if err != nil {
        panic(err)
    }
    a.db = database
    
    // Initialize file operations
    a.fileops = fileops.NewManager()
}

func (a *App) shutdown(ctx context.Context) {
    a.db.Close()
}
```

### 6.2 Database Layer

```go
// internal/db/db.go
package db

import (
    "database/sql"
    _ "github.com/mattn/go-sqlite3"
)

type Database struct {
    conn *sql.DB
}

func Open(path string) (*Database, error) {
    conn, err := sql.Open("sqlite3", path+"?_foreign_keys=on")
    if err != nil {
        return nil, err
    }
    
    // Enable WAL mode for better concurrency
    conn.Exec("PRAGMA journal_mode=WAL")
    
    return &Database{conn: conn}, nil
}

func (d *Database) Close() error {
    return d.conn.Close()
}
```

### 6.3 Wails Bindings for Works

```go
// app_works.go
package main

import "submissions/internal/models"

func (a *App) GetWorks() ([]models.Work, error) {
    return a.db.GetAllWorks()
}

func (a *App) GetWork(workID int) (*models.Work, error) {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return nil, err
    }
    
    // Add computed fields
    work.GeneratedPath = a.fileops.GeneratePath(work)
    work.Check = a.fileops.CheckPath(work)
    
    return work, nil
}

func (a *App) UpdateWork(work models.Work) error {
    return a.db.UpdateWork(&work)
}

func (a *App) CreateWork(work models.Work) (*models.Work, error) {
    // Set defaults
    if work.Status == "" {
        work.Status = "Gestating"
    }
    if work.Quality == "" {
        work.Quality = "Okay"
    }
    if work.Year == "" {
        work.Year = "2024"
    }
    
    return a.db.CreateWork(&work)
}

func (a *App) DeleteWork(workID int) error {
    return a.db.DeleteWork(workID)
}

func (a *App) GetWorkNotes(workID int) ([]models.WorkNote, error) {
    return a.db.GetWorkNotes(workID)
}

func (a *App) AddWorkNote(workID int, noteType, note string) (*models.WorkNote, error) {
    return a.db.AddWorkNote(workID, noteType, note)
}
```

### 6.4 Wails Bindings for File Operations

```go
// app_files.go
package main

import (
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) OpenDocument(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.fileops.OpenDocument(work)
}

func (a *App) MoveFile(workID int) (string, error) {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return "", err
    }
    
    oldPath := work.Path
    newPath, err := a.fileops.MoveFile(work)
    if err != nil {
        return "", err
    }
    
    // Update database
    work.Path = newPath
    if err := a.db.UpdateWork(work); err != nil {
        return "", err
    }
    
    // Add note
    a.db.AddWorkNote(workID, "Moved", "Moved from "+oldPath+" to "+newPath)
    
    return newPath, nil
}

func (a *App) CopyToSubmissions(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.fileops.CopyToSubmissions(work)
}

func (a *App) PrintFile(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.fileops.PrintFile(work)
}

func (a *App) FileExists(path string) bool {
    return a.fileops.Exists(path)
}

func (a *App) GetPDFPreviewURL(workID int) (string, error) {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return "", err
    }
    return a.fileops.GetPDFURL(work), nil
}

// Native dialogs
func (a *App) ConfirmDialog(title, message string) (bool, error) {
    result, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
        Type:    runtime.QuestionDialog,
        Title:   title,
        Message: message,
        Buttons: []string{"Yes", "No"},
    })
    return result == "Yes", err
}
```

### 6.5 Entry Point

```go
// main.go
package main

import (
    "embed"
    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
    app := NewApp()

    err := wails.Run(&options.App{
        Title:  "Submissions",
        Width:  1400,
        Height: 900,
        AssetServer: &assetserver.Options{
            Assets: assets,
        },
        OnStartup:  app.startup,
        OnShutdown: app.shutdown,
        Bind: []interface{}{
            app,
        },
    })
    if err != nil {
        panic(err)
    }
}
```

### 6.6 Complete Wails Binding Signatures

All public methods on the `App` struct are automatically exposed to the frontend. Here is the complete API:

#### Works API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `GetWorks()` | - | `Result[[]Work]` | Get all works |
| `GetWorksByCollection(collID int)` | collID | `Result[[]Work]` | Get works in collection |
| `GetWork(workID int)` | workID | `Result[Work]` | Get single work with computed fields |
| `CreateWork(work Work)` | work | `Result[Work]` | Create new work |
| `UpdateWork(work Work)` | work | `Result[Work]` | Update existing work |
| `DeleteWork(workID int)` | workID | `Result[bool]` | Delete work and related notes |
| `GetWorkNotes(workID int)` | workID | `Result[[]WorkNote]` | Get notes for work |
| `AddWorkNote(workID int, noteType, note string)` | workID, noteType, note | `Result[WorkNote]` | Add note to work |
| `DeleteWorkNote(noteID int)` | noteID | `Result[bool]` | Delete note |
| `GetWorkSubmissions(workID int)` | workID | `Result[[]Submission]` | Get submissions for work |
| `GetWorkCollections(workID int)` | workID | `Result[[]Collection]` | Get collections containing work |

#### Organizations API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `GetOrganizations()` | - | `Result[[]Organization]` | Get all organizations |
| `GetOrganization(orgID int)` | orgID | `Result[Organization]` | Get single org |
| `CreateOrganization(org Organization)` | org | `Result[Organization]` | Create new org |
| `UpdateOrganization(org Organization)` | org | `Result[Organization]` | Update existing org |
| `DeleteOrganization(orgID int)` | orgID | `Result[bool]` | Delete org |
| `GetJournalNotes(orgID int)` | orgID | `Result[[]JournalNote]` | Get notes for org |
| `AddJournalNote(orgID int, noteType, note string)` | orgID, noteType, note | `Result[JournalNote]` | Add note to org |
| `GetOrgSubmissions(orgID int)` | orgID | `Result[[]Submission]` | Get submissions to org |

#### Submissions API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `GetSubmissions()` | - | `Result[[]Submission]` | Get all submissions |
| `GetPendingSubmissions()` | - | `Result[[]Submission]` | Get awaiting response |
| `GetSubmission(subID int)` | subID | `Result[Submission]` | Get single submission |
| `CreateSubmission(sub Submission)` | sub | `Result[Submission]` | Create new submission |
| `UpdateSubmission(sub Submission)` | sub | `Result[Submission]` | Update submission |
| `DeleteSubmission(subID int)` | subID | `Result[bool]` | Delete submission |

#### Collections API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `GetCollections()` | - | `Result[[]Collection]` | Get all collections |
| `GetCollectionsByFilter(filter string)` | filter | `Result[[]Collection]` | Filter: all, active, process, dead, books, other |
| `GetCollection(collID int)` | collID | `Result[Collection]` | Get single collection |
| `CreateCollection(coll Collection)` | coll | `Result[Collection]` | Create new collection |
| `AddWorkToCollection(workID, collID int)` | workID, collID | `Result[bool]` | Add work to collection |
| `RemoveWorkFromCollection(workID, collID int)` | workID, collID | `Result[bool]` | Remove work from collection |

#### File Operations API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `OpenDocument(workID int)` | workID | `Result[bool]` | Open .docx in default app |
| `RevealInFinder(workID int)` | workID | `Result[bool]` | Show file in Finder/Explorer |
| `MoveFile(workID int)` | workID | `Result[string]` | Move file to generated path |
| `CopyForSubmission(workID int)` | workID | `Result[string]` | Copy to submissions folder |
| `FileExists(workID int)` | workID | `Result[bool]` | Check if file exists |
| `GetPDFPreviewPath(workID int)` | workID | `Result[string]` | Get/generate PDF preview |
| `GeneratePDF(workID int)` | workID | `Result[string]` | Force regenerate PDF |
| `BrowseForFolder(title string)` | title | `Result[string]` | Open folder picker dialog |
| `BrowseForFile(title string, filters []string)` | title, filters | `Result[string]` | Open file picker dialog |

#### Search API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `Search(query string)` | query | `Result[[]SearchResult]` | Global search across all entities |
| `SearchWorks(filter WorksFilter)` | filter | `Result[[]Work]` | Advanced work search |
| `SearchOrganizations(filter OrgsFilter)` | filter | `Result[[]Organization]` | Advanced org search |

#### Settings & State API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `GetSettings()` | - | `Result[Settings]` | Get app settings |
| `SaveSettings(settings Settings)` | settings | `Result[bool]` | Save settings |
| `GetAppState()` | - | `Result[AppState]` | Get persisted app state |
| `SaveAppState(state AppState)` | state | `Result[bool]` | Save app state |
| `SetCollectionFilter(filter string)` | filter | `Result[bool]` | Set collection filter |

#### Backup & Maintenance API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `CreateBackup()` | - | `Result[string]` | Create manual backup |
| `GetBackupList()` | - | `Result[[]BackupEntry]` | List available backups |
| `RestoreFromBackup(filename string)` | filename | `Result[bool]` | Restore from backup |
| `ExportBackup()` | - | `Result[string]` | Export backup to chosen location |
| `RunHealthCheck()` | - | `Result[HealthCheckResult]` | Check database & files |

#### First-Run & Setup API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `CheckFirstRunStatus()` | - | `FirstRunStatus` | Check if first run |
| `ValidateImportFolder(path string)` | path | `Result[ImportValidation]` | Validate CSV folder |
| `StartImport(path string)` | path | `Result[bool]` | Start CSV import (emits events) |
| `CompleteSetup(config SetupConfig)` | config | `Result[bool]` | Finish first-run setup |
| `CheckLibreOffice()` | - | `LibreOfficeStatus` | Check for LibreOffice |
| `OpenLibreOfficeDownload()` | - | - | Open download page |

#### Utility API

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `OpenURL(url string)` | url | `Result[bool]` | Open URL in browser |
| `ConfirmDialog(title, message string)` | title, message | `Result[bool]` | Show confirmation dialog |
| `ErrorDialog(title, message string)` | title, message | - | Show error dialog |
| `GetValueList(name string)` | name | `Result[[]string]` | Get value list by name |

#### Result Type

All API methods return a `Result[T]` wrapper:

```go
type Result[T any] struct {
    Success bool        `json:"success"`
    Data    T           `json:"data,omitempty"`
    Error   *ErrorInfo  `json:"error,omitempty"`
}

type ErrorInfo struct {
    Code    string   `json:"code"`
    Message string   `json:"message"`
    Details string   `json:"details,omitempty"`
    Actions []string `json:"actions,omitempty"`
}
```

#### TypeScript Usage

```typescript
// Auto-generated in wailsjs/go/main/App.ts
import { GetWork, UpdateWork, Search } from '../wailsjs/go/main/App';

// Usage with Result wrapper
const result = await GetWork(123);
if (result.success) {
  console.log(result.data.title);
} else {
  console.error(result.error.message);
}
```

---

## 7. React Frontend Development

### 7.1 TypeScript Interfaces

```typescript
// frontend/src/types/models.ts
export interface Work {
  workID: number;
  title: string;
  type: string;
  year: string;
  status: Status;
  quality: Quality;
  docType: string;
  path: string;
  draft: string;
  nWords: number;
  courseName: string;
  isBlog: boolean;
  isPrinted: boolean;
  isProsePoem: boolean;
  isRevised: boolean;
  mark: string;
  accessDate: string;
  // Computed
  generatedPath?: string;
  check?: string;
  nSubmissions?: number;
}

export interface Organization {
  orgID: number;
  name: string;
  url: string;
  myInterest: Quality;
  nPushcarts?: number;
  nSubmissions?: number;
}

export interface Submission {
  submissionID: number;
  workID: number;
  orgID: number;
  draft: string;
  submissionDate: string;
  responseDate: string;
  responseType: ResponseType;
  // Joined
  titleOfWork?: string;
  journalName?: string;
}

export interface Collection {
  collID: number;
  collectionName: string;
  isStatus: boolean;
  type: string;
  nItems?: number;
}

export type Status = 'Out' | 'Focus' | 'Active' | 'Working' | 'Resting' | 'Waiting' |
  'Gestating' | 'Sound' | 'Published' | 'Sleeping' | 'Dying' | 'Dead' | 'Done';

export type Quality = 'Best' | 'Better' | 'Good' | 'Okay' | 'Poor' | 'Bad' | 'Worst' | 'Unknown';

export type ResponseType = 'Waiting' | 'Accepted' | 'Form' | 'Personal' | 'Withdrawn' | 'Lost';
```

### 7.2 Main App Component

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { CollectionsPage } from './pages/CollectionsPage';
import { WorksPage } from './pages/WorksPage';
import { WorkDetailPage } from './pages/WorkDetailPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { SubmissionsPage } from './pages/SubmissionsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<CollectionsPage />} />
          <Route path="works" element={<WorksPage />} />
          <Route path="works/:id" element={<WorkDetailPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 7.3 Collections Page (Main View)

```tsx
// frontend/src/pages/CollectionsPage.tsx
import { useState, useEffect } from 'react';
import { GetCollections, GetWorksByCollection } from '../../wailsjs/go/main/App';
import { Collection, Work } from '../types/models';
import { CollectionSidebar } from '../components/collections/CollectionSidebar';
import { WorksTable } from '../components/works/WorksTable';
import { PDFPreview } from '../components/works/PDFPreview';

export function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);

  useEffect(() => {
    GetCollections().then(setCollections);
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      GetWorksByCollection(selectedCollection.collID).then(setWorks);
    }
  }, [selectedCollection]);

  return (
    <div className="flex h-full">
      <CollectionSidebar
        collections={collections}
        selected={selectedCollection}
        onSelect={setSelectedCollection}
      />
      <div className="flex-1">
        <WorksTable
          works={works}
          selectedWork={selectedWork}
          onSelectWork={setSelectedWork}
        />
      </div>
      <PDFPreview work={selectedWork} />
    </div>
  );
}
```

### 7.4 Status and Quality Badges

```tsx
// frontend/src/components/ui/StatusBadge.tsx
import { Status } from '../../types/models';

const STATUS_COLORS: Record<Status, string> = {
  'Out': 'bg-red-200 text-red-900',
  'Focus': 'bg-sky-700 text-white',
  'Active': 'bg-indigo-900 text-white',
  'Working': 'bg-rose-800 text-white',
  'Resting': 'bg-orange-700 text-white',
  'Waiting': 'bg-fuchsia-600 text-white',
  'Gestating': 'bg-blue-200 text-blue-900',
  'Sound': 'bg-green-200 text-green-900',
  'Published': 'bg-green-700 text-white',
  'Sleeping': 'bg-purple-800 text-white',
  'Dying': 'bg-yellow-700 text-white',
  'Dead': 'bg-lime-900 text-white',
  'Done': 'bg-green-800 text-white',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}
```

### 7.5 Works Table with Conditional Formatting

```tsx
// frontend/src/components/works/WorksTable.tsx
import { Work } from '../../types/models';
import { StatusBadge } from '../ui/StatusBadge';
import { QualityBadge } from '../ui/QualityBadge';

interface WorksTableProps {
  works: Work[];
  selectedWork: Work | null;
  onSelectWork: (work: Work) => void;
}

export function WorksTable({ works, selectedWork, onSelectWork }: WorksTableProps) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-100 sticky top-0">
        <tr>
          <th className="p-2 text-left">ID</th>
          <th className="p-2 text-left">Type</th>
          <th className="p-2 text-left">Year</th>
          <th className="p-2 text-left">Title</th>
          <th className="p-2 text-left">Status</th>
          <th className="p-2 text-left">Quality</th>
          <th className="p-2 text-center">R</th>
          <th className="p-2 text-center">B</th>
          <th className="p-2 text-center">P</th>
          <th className="p-2 text-left">Check</th>
        </tr>
      </thead>
      <tbody>
        {works.map((work) => (
          <tr
            key={work.workID}
            onClick={() => onSelectWork(work)}
            className={`
              cursor-pointer hover:bg-blue-50 border-b
              ${selectedWork?.workID === work.workID ? 'bg-blue-100' : ''}
              ${work.check === 'name changed' ? 'bg-yellow-50' : ''}
              ${work.check === 'file missing' ? 'bg-red-50' : ''}
            `}
          >
            <td className="p-2 text-gray-500">{work.workID}</td>
            <td className="p-2">{work.type}</td>
            <td className="p-2">{work.year}</td>
            <td className="p-2 font-medium">{work.title}</td>
            <td className="p-2"><StatusBadge status={work.status} /></td>
            <td className="p-2"><QualityBadge quality={work.quality} /></td>
            <td className="p-2 text-center">
              {work.isRevised && <span className="text-green-600">✓</span>}
            </td>
            <td className="p-2 text-center">
              {work.isBlog && <span className="text-blue-600">✓</span>}
            </td>
            <td className="p-2 text-center">
              {work.isPrinted && <span className="text-purple-600">✓</span>}
            </td>
            <td className="p-2">
              {work.check && (
                <span className="text-xs text-orange-600">{work.check}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 7.6 Using Wails Bindings

```typescript
// Wails auto-generates TypeScript bindings in frontend/wailsjs/go/main/App.ts
// Import and use them directly:

import { 
  GetCollections, 
  GetWork, 
  UpdateWork, 
  OpenDocument,
  MoveFile,
  ConfirmDialog 
} from '../../wailsjs/go/main/App';

// Example usage in a component:
async function handleMoveFile(workID: number) {
  const confirmed = await ConfirmDialog(
    'Move File',
    'Move this file to its new location?'
  );
  
  if (confirmed) {
    const newPath = await MoveFile(workID);
    console.log('File moved to:', newPath);
  }
}
```

---

## 8. Building & Distribution

### 8.1 Development Mode

```bash
# Run with hot reload
wails dev

# This starts:
# - Go backend with auto-rebuild
# - Vite dev server for React
# - Native window with DevTools
```

### 8.2 Production Build

```bash
# Build for current platform
wails build

# Build for macOS (from macOS)
wails build -platform darwin/universal

# Output: build/bin/submissions (single binary)
```

### 8.3 Build Output

```
build/
└── bin/
    └── submissions          # ~20-30MB single binary
                             # Contains:
                             # - Go backend
                             # - SQLite driver
                             # - React frontend (embedded)
                             # - WebView runtime
```

### 8.4 Distribution

The built binary is self-contained:

1. **Copy the binary** to any location
2. **Copy the database** (`data/submissions.db`) alongside
3. **Run directly** - no installation required

For macOS, optionally create an app bundle:

```bash
wails build -platform darwin/universal -o Submissions.app
```

---

## 9. Testing Strategy

### 9.1 Go Backend Tests

```go
// internal/db/works_test.go
func TestWorksRepository(t *testing.T) {
    db := setupTestDB(t)
    
    t.Run("CreateWork", func(t *testing.T) {
        work := &models.Work{
            Title:   "Test Poem",
            Type:    "Poem",
            Year:    "2024",
            Status:  "Gestating",
            Quality: "Okay",
        }
        
        created, err := db.CreateWork(work)
        assert.NoError(t, err)
        assert.NotZero(t, created.WorkID)
    })
    
    t.Run("GetWork", func(t *testing.T) {
        work, err := db.GetWork(1)
        assert.NoError(t, err)
        assert.Equal(t, "Test Poem", work.Title)
    })
}
```

### 9.2 Path Generation Tests

```go
func TestPathGeneration(t *testing.T) {
    tests := []struct {
        name     string
        work     *models.Work
        expected string
    }{
        {
            name: "Active poem 2024",
            work: &models.Work{
                Type: "Poem", Year: "2024", Title: "Test",
                Quality: "Good", Status: "Working",
            },
            expected: "34 Current Work/bPoem - 2024 - Test",
        },
        {
            name: "Published",
            work: &models.Work{
                Type: "Poem", Year: "2022", Title: "Winner",
                Quality: "Best", Status: "Published",
            },
            expected: "150 Published/aaPoem - 2022 - Winner",
        },
        {
            name: "Idea",
            work: &models.Work{
                Type: "Essay Idea", Year: "2024", Title: "New Concept",
                Quality: "Okay", Status: "Gestating",
            },
            expected: "35 Open Ideas/cEssay Idea - 2024 - New Concept",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := fileops.GeneratePath(tt.work)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

### 9.3 User Acceptance Criteria

| Feature | Test Case | Expected Result |
|---------|-----------|-----------------|
| Collections | Select collection | Shows works in that collection |
| Filter Works | Click status checkbox | Only matching works shown |
| Edit Work | Change status dropdown | Status saves, row updates color |
| Add Submission | Click Submit button | Submission created with today's date |
| Move File | Click Move button | File renamed, path updated, note added |
| Export File | Click Export button | File copied to ~/Desktop/Submissions/ |
| PDF Preview | Select work | PDF displays in preview pane |
| Open File | Double-click work | Opens in default app (Word/TextEdit) |

### 9.4 Data Validation Checklist

After import and before deployment:

- [ ] Record counts match FileMaker exports
- [ ] All status values are valid enum members
- [ ] All quality values are valid enum members
- [ ] Foreign key relationships are intact
- [ ] No orphan submissions or collection_details
- [ ] Path generation matches existing paths
- [ ] File existence checks pass for active works

### 9.5 Run All Tests

```bash
# Go tests
go test ./...

# Frontend tests (if added)
cd frontend && yarn test
```

---

*End of Migration Guide*
