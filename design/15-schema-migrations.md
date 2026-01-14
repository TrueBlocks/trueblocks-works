# Schema Migrations Specification

> **Document:** 15-schema-migrations.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Versioning Strategy](#2-versioning-strategy)
3. [Migration File Format](#3-migration-file-format)
4. [Migration Runner](#4-migration-runner)
5. [Common Migration Patterns](#5-common-migration-patterns)
6. [Rollback Strategy](#6-rollback-strategy)
7. [Testing Migrations](#7-testing-migrations)

---

## 1. Overview

### 1.1 Why Migrations Matter

As the application evolves, the database schema will need changes:
- Adding new fields (e.g., `Works.firstLine` for search)
- Renaming columns for clarity
- Adding new tables (e.g., `Tags` for categorization)
- Creating new indexes for performance
- Modifying constraints

Without a migration system, existing users' databases will break on app update.

### 1.2 Requirements

| Requirement | Priority |
|-------------|----------|
| Track current schema version | Critical |
| Apply migrations automatically on startup | Critical |
| Support forward migrations | Critical |
| Create backup before migration | Critical |
| Rollback on failure | High |
| Embed migrations in binary | High |
| Log migration history | Medium |

### 1.3 Design Principles

1. **Migrations are immutable** — Once released, never modify a migration
2. **Migrations are idempotent** — Running twice should not cause errors
3. **Migrations are atomic** — All changes in a transaction
4. **Always backup first** — Before any schema change

---

## 2. Versioning Strategy

### 2.1 Schema Version Table

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum    TEXT NOT NULL
);
```

### 2.2 Version Numbering

Format: Sequential integers starting from 1

```
Migration 001: Initial schema (1.0.0)
Migration 002: Add FTS tables (1.1.0)
Migration 003: Add firstLine to Works (1.2.0)
Migration 004: Add Tags table (1.3.0)
```

### 2.3 App Version ↔ Schema Version

| App Version | Min Schema | Max Schema |
|-------------|------------|------------|
| 1.0.0 | 1 | 1 |
| 1.1.0 | 1 | 2 |
| 1.2.0 | 1 | 3 |
| 2.0.0 | 3 | 5 |

The app should:
- Refuse to open databases with schema version > supported
- Auto-upgrade databases with schema version < current

---

## 3. Migration File Format

### 3.1 Directory Structure

```
internal/
└── migrations/
    ├── migrations.go       # Migration runner
    ├── embed.go            # Embeds SQL files
    └── sql/
        ├── 001_initial.sql
        ├── 002_fts_tables.sql
        ├── 003_add_firstline.sql
        ├── 004_add_tags.sql
        └── ...
```

### 3.2 Migration File Template

Each `.sql` file contains:

```sql
-- Migration: 003_add_firstline
-- Description: Add firstLine field to Works for search preview
-- Author: jrush
-- Date: 2026-01-15

-- Up Migration
ALTER TABLE Works ADD COLUMN first_line TEXT;

-- Create index for searching
CREATE INDEX IF NOT EXISTS idx_works_firstline ON Works(first_line);

-- Populate from existing data (optional)
-- UPDATE Works SET first_line = substr(content, 1, 100) WHERE first_line IS NULL;
```

### 3.3 Embedding Migrations

```go
// internal/migrations/embed.go
package migrations

import "embed"

//go:embed sql/*.sql
var migrationFiles embed.FS
```

---

## 4. Migration Runner

### 4.1 Core Migration Logic

```go
// internal/migrations/migrations.go
package migrations

import (
    "crypto/sha256"
    "database/sql"
    "embed"
    "fmt"
    "io/fs"
    "path/filepath"
    "regexp"
    "sort"
    "strconv"
    "strings"
    "time"
)

//go:embed sql/*.sql
var migrationFiles embed.FS

type Migration struct {
    Version  int
    Name     string
    SQL      string
    Checksum string
}

type MigrationRunner struct {
    db *sql.DB
}

func NewMigrationRunner(db *sql.DB) *MigrationRunner {
    return &MigrationRunner{db: db}
}

// GetCurrentVersion returns the current schema version
func (m *MigrationRunner) GetCurrentVersion() (int, error) {
    // Ensure migration table exists
    _, err := m.db.Exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            name        TEXT NOT NULL,
            applied_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            checksum    TEXT NOT NULL
        )
    `)
    if err != nil {
        return 0, err
    }
    
    var version int
    err = m.db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version)
    return version, err
}

// GetPendingMigrations returns migrations that need to be applied
func (m *MigrationRunner) GetPendingMigrations() ([]Migration, error) {
    currentVersion, err := m.GetCurrentVersion()
    if err != nil {
        return nil, err
    }
    
    allMigrations, err := m.loadMigrations()
    if err != nil {
        return nil, err
    }
    
    var pending []Migration
    for _, mig := range allMigrations {
        if mig.Version > currentVersion {
            pending = append(pending, mig)
        }
    }
    
    return pending, nil
}

// RunMigrations applies all pending migrations
func (m *MigrationRunner) RunMigrations() error {
    pending, err := m.GetPendingMigrations()
    if err != nil {
        return err
    }
    
    if len(pending) == 0 {
        return nil // Nothing to do
    }
    
    for _, mig := range pending {
        if err := m.applyMigration(mig); err != nil {
            return fmt.Errorf("migration %d (%s) failed: %w", mig.Version, mig.Name, err)
        }
    }
    
    return nil
}

// applyMigration applies a single migration in a transaction
func (m *MigrationRunner) applyMigration(mig Migration) error {
    tx, err := m.db.Begin()
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    // Execute migration SQL
    _, err = tx.Exec(mig.SQL)
    if err != nil {
        return fmt.Errorf("SQL execution failed: %w", err)
    }
    
    // Record migration
    _, err = tx.Exec(`
        INSERT INTO schema_migrations (version, name, applied_at, checksum)
        VALUES (?, ?, ?, ?)
    `, mig.Version, mig.Name, time.Now().Format(time.RFC3339), mig.Checksum)
    if err != nil {
        return fmt.Errorf("could not record migration: %w", err)
    }
    
    return tx.Commit()
}

// loadMigrations reads all migration files from embedded FS
func (m *MigrationRunner) loadMigrations() ([]Migration, error) {
    var migrations []Migration
    
    err := fs.WalkDir(migrationFiles, "sql", func(path string, d fs.DirEntry, err error) error {
        if err != nil {
            return err
        }
        if d.IsDir() || !strings.HasSuffix(path, ".sql") {
            return nil
        }
        
        content, err := migrationFiles.ReadFile(path)
        if err != nil {
            return err
        }
        
        // Parse version from filename (e.g., "001_initial.sql" -> 1)
        filename := filepath.Base(path)
        version, name, err := parseFilename(filename)
        if err != nil {
            return fmt.Errorf("invalid migration filename %s: %w", filename, err)
        }
        
        migrations = append(migrations, Migration{
            Version:  version,
            Name:     name,
            SQL:      string(content),
            Checksum: checksum(content),
        })
        
        return nil
    })
    
    if err != nil {
        return nil, err
    }
    
    // Sort by version
    sort.Slice(migrations, func(i, j int) bool {
        return migrations[i].Version < migrations[j].Version
    })
    
    return migrations, nil
}

// parseFilename extracts version and name from "001_initial.sql"
func parseFilename(filename string) (int, string, error) {
    re := regexp.MustCompile(`^(\d+)_(.+)\.sql$`)
    matches := re.FindStringSubmatch(filename)
    if len(matches) != 3 {
        return 0, "", fmt.Errorf("filename must match pattern NNN_name.sql")
    }
    
    version, err := strconv.Atoi(matches[1])
    if err != nil {
        return 0, "", err
    }
    
    return version, matches[2], nil
}

func checksum(data []byte) string {
    hash := sha256.Sum256(data)
    return fmt.Sprintf("%x", hash[:8])
}
```

### 4.2 Startup Integration

```go
// main.go or app.go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Open database
    db, err := sql.Open("sqlite", a.dbPath)
    if err != nil {
        a.handleFatalError("Could not open database", err)
        return
    }
    a.db = db
    
    // Run migrations
    runner := migrations.NewMigrationRunner(db)
    
    pending, err := runner.GetPendingMigrations()
    if err != nil {
        a.handleFatalError("Could not check migrations", err)
        return
    }
    
    if len(pending) > 0 {
        // Create backup before migration
        if err := a.backupService.CreateBackup("pre-migration"); err != nil {
            a.handleFatalError("Could not create pre-migration backup", err)
            return
        }
        
        // Apply migrations
        if err := runner.RunMigrations(); err != nil {
            a.handleFatalError("Migration failed", err)
            return
        }
        
        log.Printf("Applied %d migrations successfully", len(pending))
    }
}
```

---

## 5. Common Migration Patterns

### 5.1 Add Column

```sql
-- 003_add_firstline.sql
ALTER TABLE Works ADD COLUMN first_line TEXT;
```

SQLite limitations:
- Cannot add NOT NULL without default
- Cannot add PRIMARY KEY
- Cannot add UNIQUE constraint inline

### 5.2 Add Column with Default

```sql
-- 004_add_archived.sql
ALTER TABLE Works ADD COLUMN is_archived INTEGER DEFAULT 0;
```

### 5.3 Create New Table

```sql
-- 005_add_tags.sql
CREATE TABLE IF NOT EXISTS Tags (
    tagID INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#888888'
);

CREATE TABLE IF NOT EXISTS WorkTags (
    id INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    tagID INTEGER NOT NULL,
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    FOREIGN KEY (tagID) REFERENCES Tags(tagID) ON DELETE CASCADE,
    UNIQUE(workID, tagID)
);
```

### 5.4 Add Index

```sql
-- 006_add_indexes.sql
CREATE INDEX IF NOT EXISTS idx_works_accessdate ON Works(access_date);
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON Submissions(response_type) 
    WHERE response_type = 'Waiting';
```

### 5.5 Rename Column (SQLite Workaround)

SQLite doesn't support `ALTER TABLE RENAME COLUMN` before version 3.25.0. Use table rebuild:

```sql
-- 007_rename_nwords.sql
-- Rename n_words to word_count

-- Step 1: Create new table with correct schema
CREATE TABLE Works_new (
    workID INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    -- ... all other columns ...
    word_count INTEGER,  -- Renamed from n_words
    -- ... remaining columns ...
);

-- Step 2: Copy data
INSERT INTO Works_new SELECT 
    workID, title, /* ... */ n_words AS word_count, /* ... */
FROM Works;

-- Step 3: Drop old table
DROP TABLE Works;

-- Step 4: Rename new table
ALTER TABLE Works_new RENAME TO Works;

-- Step 5: Recreate indexes
CREATE INDEX idx_works_title ON Works(title);
-- ... other indexes ...
```

### 5.6 Data Migration

```sql
-- 008_populate_firstline.sql
-- Extract first line from title or note for search preview

UPDATE Works 
SET first_line = (
    SELECT substr(note, 1, 100) 
    FROM WorkNotes 
    WHERE WorkNotes.workID = Works.workID 
    AND type = 'Draft'
    LIMIT 1
)
WHERE first_line IS NULL;
```

---

## 6. Rollback Strategy

### 6.1 Philosophy

SQLite DDL operations are difficult to rollback:
- `ALTER TABLE ADD COLUMN` cannot be undone
- `DROP TABLE` is permanent

**Strategy:** Don't rollback. Instead, restore from pre-migration backup.

### 6.2 Failed Migration Recovery

```go
func (a *App) handleMigrationFailure(err error) {
    // Log the error
    log.Printf("Migration failed: %v", err)
    
    // Show dialog to user
    dialog := runtime.MessageDialog{
        Type:    runtime.ErrorDialog,
        Title:   "Database Upgrade Failed",
        Message: fmt.Sprintf(
            "The database could not be upgraded.\n\n"+
            "Error: %v\n\n"+
            "Would you like to restore from the pre-migration backup?",
            err,
        ),
        Buttons: []string{"Restore Backup", "Quit"},
    }
    
    choice, _ := runtime.MessageDialog(a.ctx, dialog)
    
    if choice == "Restore Backup" {
        // Find most recent pre-migration backup
        backups, _ := a.backupService.GetBackupList()
        for _, b := range backups {
            if strings.Contains(b.Reason, "pre-migration") {
                a.backupService.RestoreFromBackup(b.Filename)
                runtime.Quit(a.ctx) // Restart required
                return
            }
        }
    }
    
    runtime.Quit(a.ctx)
}
```

### 6.3 Version Downgrade Protection

If user tries to open database with newer schema than app supports:

```go
func (m *MigrationRunner) CheckCompatibility(maxSupportedVersion int) error {
    currentVersion, err := m.GetCurrentVersion()
    if err != nil {
        return err
    }
    
    if currentVersion > maxSupportedVersion {
        return fmt.Errorf(
            "database schema version %d is newer than this app supports (%d). "+
            "Please upgrade the application.",
            currentVersion, maxSupportedVersion,
        )
    }
    
    return nil
}
```

---

## 7. Testing Migrations

### 7.1 Migration Test Pattern

```go
// internal/migrations/migrations_test.go
func TestMigrations(t *testing.T) {
    // Start with empty database
    db := setupEmptyDB(t)
    runner := NewMigrationRunner(db)
    
    // Run all migrations
    err := runner.RunMigrations()
    require.NoError(t, err)
    
    // Verify final schema
    version, err := runner.GetCurrentVersion()
    require.NoError(t, err)
    assert.Equal(t, expectedLatestVersion, version)
    
    // Verify tables exist
    var tableCount int
    db.QueryRow(`
        SELECT COUNT(*) FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).Scan(&tableCount)
    assert.Equal(t, 8, tableCount) // Adjust expected count
}
```

### 7.2 Test Each Migration Individually

```go
func TestMigration003(t *testing.T) {
    // Apply migrations up to 002
    db := setupDBAtVersion(t, 2)
    
    // Verify first_line column doesn't exist
    _, err := db.Exec("SELECT first_line FROM Works LIMIT 1")
    assert.Error(t, err)
    
    // Apply migration 003
    runner := NewMigrationRunner(db)
    err = runner.RunMigrations()
    require.NoError(t, err)
    
    // Verify first_line column exists
    _, err = db.Exec("SELECT first_line FROM Works LIMIT 1")
    assert.NoError(t, err)
}
```

### 7.3 Test Migration with Real Data

```go
func TestMigrationWithProductionData(t *testing.T) {
    // Copy production database to temp location
    testDB := copyProductionDB(t)
    
    runner := NewMigrationRunner(testDB)
    
    // Get before counts
    var worksBefore int
    testDB.QueryRow("SELECT COUNT(*) FROM Works").Scan(&worksBefore)
    
    // Run migrations
    err := runner.RunMigrations()
    require.NoError(t, err)
    
    // Verify data preserved
    var worksAfter int
    testDB.QueryRow("SELECT COUNT(*) FROM Works").Scan(&worksAfter)
    assert.Equal(t, worksBefore, worksAfter, "Migration should not lose records")
}
```

---

## 8. Initial Migration

### 8.1 001_initial.sql

The first migration creates the complete schema:

```sql
-- Migration: 001_initial
-- Description: Initial database schema
-- Date: 2026-01-01

-- Collections table
CREATE TABLE IF NOT EXISTS Collections (
    collID INTEGER PRIMARY KEY,
    collection_name TEXT NOT NULL,
    is_status TEXT,
    type TEXT,
    UNIQUE(collection_name)
);

-- Works table
CREATE TABLE IF NOT EXISTS Works (
    workID INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    year TEXT,
    status TEXT DEFAULT 'Working',
    quality TEXT DEFAULT 'Okay',
    doc_type TEXT DEFAULT 'docx',
    path TEXT,
    draft TEXT,
    n_words INTEGER,
    course_name TEXT,
    is_blog TEXT,
    is_printed TEXT,
    is_prose_poem TEXT,
    is_revised TEXT,
    mark TEXT,
    access_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CollectionDetails (join table)
CREATE TABLE IF NOT EXISTS CollectionDetails (
    id INTEGER PRIMARY KEY,
    collID INTEGER NOT NULL,
    workID INTEGER NOT NULL,
    collection_name TEXT,
    FOREIGN KEY (collID) REFERENCES Collections(collID),
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    UNIQUE(collID, workID)
);

-- Organizations table
CREATE TABLE IF NOT EXISTS Organizations (
    orgID INTEGER PRIMARY KEY,
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
    website_menu TEXT,
    duotrope_num INTEGER,
    n_push_fiction INTEGER DEFAULT 0,
    n_push_nonfiction INTEGER DEFAULT 0,
    n_push_poetry INTEGER DEFAULT 0,
    contest_ends TEXT,
    contest_fee TEXT,
    contest_prize TEXT,
    contest_prize_2 TEXT,
    date_added TEXT DEFAULT CURRENT_TIMESTAMP,
    date_modified TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Submissions table
CREATE TABLE IF NOT EXISTS Submissions (
    submissionID INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    orgID INTEGER NOT NULL,
    draft TEXT NOT NULL,
    submission_date TEXT,
    submission_type TEXT,
    query_date TEXT,
    response_date TEXT,
    response_type TEXT,
    contest_name TEXT,
    cost REAL,
    user_id TEXT,
    password TEXT,
    web_address TEXT,
    mark TEXT,
    FOREIGN KEY (workID) REFERENCES Works(workID),
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID)
);

-- Work Notes table
CREATE TABLE IF NOT EXISTS WorkNotes (
    id INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE
);

-- Journal Notes table
CREATE TABLE IF NOT EXISTS JournalNotes (
    id INTEGER PRIMARY KEY,
    orgID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_works_status ON Works(status);
CREATE INDEX IF NOT EXISTS idx_works_type ON Works(type);
CREATE INDEX IF NOT EXISTS idx_works_quality ON Works(quality);
CREATE INDEX IF NOT EXISTS idx_works_year ON Works(year);
CREATE INDEX IF NOT EXISTS idx_works_title ON Works(title);

CREATE INDEX IF NOT EXISTS idx_colldet_collid ON CollectionDetails(collID);
CREATE INDEX IF NOT EXISTS idx_colldet_workid ON CollectionDetails(workID);

CREATE INDEX IF NOT EXISTS idx_submissions_workid ON Submissions(workID);
CREATE INDEX IF NOT EXISTS idx_submissions_orgid ON Submissions(orgID);
CREATE INDEX IF NOT EXISTS idx_submissions_response ON Submissions(response_type);

CREATE INDEX IF NOT EXISTS idx_worknotes_workid ON WorkNotes(workID);
CREATE INDEX IF NOT EXISTS idx_journalnotes_orgid ON JournalNotes(orgID);

CREATE INDEX IF NOT EXISTS idx_orgs_name ON Organizations(name);
CREATE INDEX IF NOT EXISTS idx_orgs_interest ON Organizations(my_interest);
```

---

*End of Schema Migrations Specification*
