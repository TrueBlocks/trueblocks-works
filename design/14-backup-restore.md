# Backup & Restore Specification

> **Document:** 14-backup-restore.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backup Strategy](#2-backup-strategy)
3. [Automatic Backups](#3-automatic-backups)
4. [Manual Backup](#4-manual-backup)
5. [Restore Process](#5-restore-process)
6. [Database Maintenance](#6-database-maintenance)
7. [Implementation](#7-implementation)

---

## 1. Overview

### 1.1 Why Backup Matters

The Submissions database contains:
- **1,749 works** — Years of creative writing metadata
- **755 organizations** — Research on literary journals
- **246 submissions** — Historical submission records
- **460+ notes** — Critiques, revisions, ideas

Data loss would be catastrophic and unrecoverable.

### 1.2 Backup Requirements

| Requirement | Priority | Solution |
|-------------|----------|----------|
| Protect against corruption | Critical | Automatic daily backup |
| User-initiated backup | High | "Backup Now" button |
| Restore to previous state | High | Select from backup list |
| Export to portable format | Medium | CSV/JSON export |
| Off-machine backup | Low | User responsibility (iCloud, Dropbox) |

### 1.3 What Gets Backed Up

| Component | Backed Up | Notes |
|-----------|-----------|-------|
| SQLite database | ✅ Yes | Primary data file |
| App preferences | ✅ Yes | JSON config file |
| Document files (.docx) | ❌ No | User manages separately |
| PDF previews | ❌ No | Can be regenerated |

---

## 2. Backup Strategy

### 2.1 Backup File Structure

```
~/Library/Application Support/Submissions/
├── submissions.db           # Active database
├── config.json              # App preferences
└── backups/
    ├── 2026-01-03_14-30-00.db   # Timestamped backups
    ├── 2026-01-02_09-15-00.db
    ├── 2026-01-01_09-15-00.db
    ├── ...
    └── backup_manifest.json     # Metadata about backups
```

### 2.2 Backup Naming Convention

Format: `YYYY-MM-DD_HH-MM-SS.db`

Example: `2026-01-03_14-30-00.db` = January 3, 2026 at 2:30 PM

### 2.3 Retention Policy

| Age | Retention |
|-----|-----------|
| Last 24 hours | Keep all |
| Last 7 days | Keep 1 per day |
| Last 30 days | Keep 1 per week |
| Older than 30 days | Delete automatically |

Maximum backup count: **15 files** (~150 MB assuming ~10 MB database)

---

## 3. Automatic Backups

### 3.1 Trigger Conditions

Automatic backup occurs when:

| Trigger | Condition |
|---------|-----------|
| App startup | If last backup > 24 hours ago |
| App shutdown | If any data modified since last backup |
| Timer | Every 4 hours while app is running |
| Before import | Always before CSV import |
| Before schema migration | Always before upgrade |

### 3.2 Background Backup Process

```
┌─────────────────────────────────────────────────────────────┐
│                  Automatic Backup Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Check Timer  →  Lock DB  →  Copy File  →  Unlock  →  Prune │
│     ↓              ↓           ↓            ↓          ↓    │
│  Every 4hr    WAL checkpoint  Atomic     Resume     Apply   │
│               + shared lock   copy       writes     policy  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 SQLite Backup API

Use SQLite's online backup API for consistent, non-blocking backups:

```go
// internal/backup/backup.go
package backup

import (
    "database/sql"
    "fmt"
    "os"
    "path/filepath"
    "time"
    
    _ "modernc.org/sqlite"
)

type BackupService struct {
    db          *sql.DB
    backupDir   string
    maxBackups  int
}

func NewBackupService(db *sql.DB, backupDir string) *BackupService {
    os.MkdirAll(backupDir, 0755)
    return &BackupService{
        db:         db,
        backupDir:  backupDir,
        maxBackups: 15,
    }
}

// CreateBackup performs a hot backup of the database
func (b *BackupService) CreateBackup(reason string) (string, error) {
    // Generate filename
    timestamp := time.Now().Format("2006-01-02_15-04-05")
    filename := fmt.Sprintf("%s.db", timestamp)
    destPath := filepath.Join(b.backupDir, filename)
    
    // Checkpoint WAL to ensure all data is in main DB file
    _, err := b.db.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
    if err != nil {
        return "", fmt.Errorf("WAL checkpoint failed: %w", err)
    }
    
    // Get source database path
    var dbPath string
    err = b.db.QueryRow("PRAGMA database_list").Scan(nil, nil, &dbPath)
    if err != nil {
        return "", fmt.Errorf("could not get database path: %w", err)
    }
    
    // Copy file atomically
    err = copyFileAtomic(dbPath, destPath)
    if err != nil {
        return "", fmt.Errorf("backup copy failed: %w", err)
    }
    
    // Update manifest
    err = b.updateManifest(filename, reason)
    if err != nil {
        // Non-fatal, backup still succeeded
        fmt.Printf("Warning: could not update manifest: %v\n", err)
    }
    
    // Apply retention policy
    b.pruneOldBackups()
    
    return destPath, nil
}

// copyFileAtomic copies src to dst using a temp file + rename
func copyFileAtomic(src, dst string) error {
    // Read source
    data, err := os.ReadFile(src)
    if err != nil {
        return err
    }
    
    // Write to temp file
    tmpFile := dst + ".tmp"
    err = os.WriteFile(tmpFile, data, 0644)
    if err != nil {
        return err
    }
    
    // Atomic rename
    return os.Rename(tmpFile, dst)
}
```

---

## 4. Manual Backup

### 4.1 UI Location

**Settings → Data → Backup Now**

Or keyboard shortcut: `⌘⇧B`

### 4.2 Backup Dialog

```
┌────────────────────────────────────────────────────────────────┐
│                        Backup Database                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📁 Backup Location                                            │
│  ~/Library/Application Support/Submissions/backups/            │
│                                                     [Change...] │
│                                                                 │
│  📊 Database Size: 9.2 MB                                      │
│  📅 Last Backup: Today at 9:15 AM (auto)                       │
│  🗂️ Backup Count: 8 files (73 MB total)                        │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  ☑️ Include in Time Machine / iCloud                    │   │
│  │  ☑️ Verify backup after creation                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Cancel]  [Backup Now]             │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Export to External Location

Users can also export to any location:

```go
func (b *BackupService) ExportBackup(destPath string) (string, error) {
    // Checkpoint WAL
    _, err := b.db.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
    if err != nil {
        return "", err
    }
    
    // Get source path
    var dbPath string
    b.db.QueryRow("PRAGMA database_list").Scan(nil, nil, &dbPath)
    
    // Copy to destination
    timestamp := time.Now().Format("2006-01-02_15-04-05")
    filename := fmt.Sprintf("submissions_backup_%s.db", timestamp)
    fullPath := filepath.Join(destPath, filename)
    
    return fullPath, copyFileAtomic(dbPath, fullPath)
}
```

---

## 5. Restore Process

### 5.1 Restore From Backup List

**Settings → Data → Restore from Backup**

```
┌────────────────────────────────────────────────────────────────┐
│                     Restore from Backup                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️  Restoring will replace your current database.             │
│      A backup of the current state will be created first.      │
│                                                                 │
│  Select a backup to restore:                                   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ ○ 2026-01-03 2:30 PM    9.2 MB    (auto: shutdown)     │   │
│  │ ● 2026-01-02 9:15 AM    9.1 MB    (auto: startup)      │   │
│  │ ○ 2026-01-01 9:15 AM    9.1 MB    (auto: startup)      │   │
│  │ ○ 2025-12-31 4:00 PM    9.0 MB    (manual)             │   │
│  │ ○ 2025-12-28 9:15 AM    8.9 MB    (auto: weekly)       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Or: [Import from file...]                                     │
│                                                                 │
│                              [Cancel]  [Restore Selected]       │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Restore Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Restore Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User selects backup                                         │
│  2. Create backup of current state ("pre-restore")              │
│  3. Close all database connections                              │
│  4. Verify backup file integrity                                │
│  5. Replace current database with backup                        │
│  6. Reopen database connections                                 │
│  7. Verify data integrity (quick sanity check)                  │
│  8. Refresh all UI                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Go Implementation

```go
// RestoreFromBackup restores the database from a backup file
func (b *BackupService) RestoreFromBackup(backupPath string) error {
    // Step 1: Verify backup exists and is valid SQLite
    if err := b.verifyBackup(backupPath); err != nil {
        return fmt.Errorf("backup verification failed: %w", err)
    }
    
    // Step 2: Create pre-restore backup
    _, err := b.CreateBackup("pre-restore")
    if err != nil {
        return fmt.Errorf("could not create pre-restore backup: %w", err)
    }
    
    // Step 3: Get current database path
    var dbPath string
    b.db.QueryRow("PRAGMA database_list").Scan(nil, nil, &dbPath)
    
    // Step 4: Close database (caller must handle this)
    // The app needs to close all connections before calling restore
    
    // Step 5: Replace database file
    err = copyFileAtomic(backupPath, dbPath)
    if err != nil {
        return fmt.Errorf("restore copy failed: %w", err)
    }
    
    // Steps 6-8 handled by caller (reopen DB, refresh UI)
    return nil
}

// verifyBackup checks that a file is a valid SQLite database
func (b *BackupService) verifyBackup(path string) error {
    // Open the backup file
    db, err := sql.Open("sqlite", path)
    if err != nil {
        return err
    }
    defer db.Close()
    
    // Check integrity
    var result string
    err = db.QueryRow("PRAGMA integrity_check").Scan(&result)
    if err != nil {
        return err
    }
    if result != "ok" {
        return fmt.Errorf("integrity check failed: %s", result)
    }
    
    // Verify it has expected tables
    var tableCount int
    err = db.QueryRow(`
        SELECT COUNT(*) FROM sqlite_master 
        WHERE type='table' AND name IN ('Works', 'Organizations', 'Submissions')
    `).Scan(&tableCount)
    if err != nil {
        return err
    }
    if tableCount < 3 {
        return fmt.Errorf("missing expected tables")
    }
    
    return nil
}
```

---

## 6. Database Maintenance

### 6.1 VACUUM

SQLite databases can become fragmented. Run VACUUM periodically:

```go
// Vacuum compacts the database and reclaims unused space
func (b *BackupService) Vacuum() error {
    // VACUUM requires exclusive access
    // Best run at app shutdown or when user requests
    _, err := b.db.Exec("VACUUM")
    return err
}
```

**When to VACUUM:**
- After deleting many records
- Monthly maintenance
- When database size seems larger than expected

### 6.2 Integrity Check

```go
// CheckIntegrity verifies database integrity
func (b *BackupService) CheckIntegrity() (bool, string, error) {
    var result string
    err := b.db.QueryRow("PRAGMA integrity_check").Scan(&result)
    if err != nil {
        return false, "", err
    }
    return result == "ok", result, nil
}
```

### 6.3 WAL Checkpoint

WAL (Write-Ahead Logging) provides better concurrency but needs periodic checkpoints:

```go
// Checkpoint ensures all WAL data is written to main database
func (b *BackupService) Checkpoint() error {
    _, err := b.db.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
    return err
}
```

Run checkpoint:
- Before backup
- At app shutdown
- After large batch operations

---

## 7. Implementation

### 7.1 Backup Manifest

```go
// internal/backup/manifest.go
type BackupManifest struct {
    Backups []BackupEntry `json:"backups"`
}

type BackupEntry struct {
    Filename    string    `json:"filename"`
    CreatedAt   time.Time `json:"createdAt"`
    Reason      string    `json:"reason"`      // "auto:startup", "manual", etc.
    SizeBytes   int64     `json:"sizeBytes"`
    RecordCount struct {
        Works         int `json:"works"`
        Organizations int `json:"organizations"`
        Submissions   int `json:"submissions"`
    } `json:"recordCount"`
}

func (b *BackupService) updateManifest(filename, reason string) error {
    manifestPath := filepath.Join(b.backupDir, "backup_manifest.json")
    
    // Load existing manifest
    var manifest BackupManifest
    data, err := os.ReadFile(manifestPath)
    if err == nil {
        json.Unmarshal(data, &manifest)
    }
    
    // Get file info
    backupPath := filepath.Join(b.backupDir, filename)
    info, _ := os.Stat(backupPath)
    
    // Get record counts
    var worksCount, orgsCount, subsCount int
    b.db.QueryRow("SELECT COUNT(*) FROM Works").Scan(&worksCount)
    b.db.QueryRow("SELECT COUNT(*) FROM Organizations").Scan(&orgsCount)
    b.db.QueryRow("SELECT COUNT(*) FROM Submissions").Scan(&subsCount)
    
    // Add new entry
    entry := BackupEntry{
        Filename:  filename,
        CreatedAt: time.Now(),
        Reason:    reason,
        SizeBytes: info.Size(),
    }
    entry.RecordCount.Works = worksCount
    entry.RecordCount.Organizations = orgsCount
    entry.RecordCount.Submissions = subsCount
    
    manifest.Backups = append([]BackupEntry{entry}, manifest.Backups...)
    
    // Save manifest
    data, _ = json.MarshalIndent(manifest, "", "  ")
    return os.WriteFile(manifestPath, data, 0644)
}
```

### 7.2 Wails Bindings

```go
// app_backup.go

// CreateBackup creates a manual backup
func (a *App) CreateBackup() Result[string] {
    path, err := a.backupService.CreateBackup("manual")
    if err != nil {
        return Fail[string](err, "BACKUP_FAILED")
    }
    return Ok(path)
}

// GetBackupList returns all available backups
func (a *App) GetBackupList() Result[[]BackupEntry] {
    entries, err := a.backupService.GetBackupList()
    if err != nil {
        return Fail[[]BackupEntry](err, "BACKUP_LIST_FAILED")
    }
    return Ok(entries)
}

// RestoreFromBackup restores from a specific backup
func (a *App) RestoreFromBackup(filename string) Result[bool] {
    // This requires app restart - show dialog to user
    path := filepath.Join(a.backupService.backupDir, filename)
    
    // Verify before proceeding
    if err := a.backupService.verifyBackup(path); err != nil {
        return Fail[bool](err, "BACKUP_INVALID")
    }
    
    // Close database
    a.db.Close()
    
    // Restore
    if err := a.backupService.RestoreFromBackup(path); err != nil {
        return Fail[bool](err, "RESTORE_FAILED")
    }
    
    // Signal that app needs restart
    return Ok(true) // Frontend should trigger app restart
}

// ExportBackup exports database to user-chosen location
func (a *App) ExportBackup() Result[string] {
    // Open folder picker
    destDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
        Title: "Choose Export Location",
    })
    if err != nil || destDir == "" {
        return Fail[string](fmt.Errorf("no destination selected"), "EXPORT_CANCELLED")
    }
    
    path, err := a.backupService.ExportBackup(destDir)
    if err != nil {
        return Fail[string](err, "EXPORT_FAILED")
    }
    return Ok(path)
}
```

### 7.3 React UI Component

```typescript
// src/pages/SettingsPage.tsx (partial)
import { useState, useEffect } from 'react';
import { 
  Card, Text, Button, Stack, Group, Table, Badge, 
  Modal, Alert 
} from '@mantine/core';
import { IconDatabase, IconDownload, IconUpload, IconAlertTriangle } from '@tabler/icons-react';
import { 
  GetBackupList, CreateBackup, RestoreFromBackup, ExportBackup 
} from '../../wailsjs/go/main/App';

interface BackupEntry {
  filename: string;
  createdAt: string;
  reason: string;
  sizeBytes: number;
  recordCount: {
    works: number;
    organizations: number;
    submissions: number;
  };
}

export function BackupSettings() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    const result = await GetBackupList();
    if (result.success) {
      setBackups(result.data);
    }
  };

  const handleBackupNow = async () => {
    setLoading(true);
    const result = await CreateBackup();
    setLoading(false);
    if (result.success) {
      notifications.show({ message: 'Backup created successfully', color: 'green' });
      loadBackups();
    } else {
      notifications.show({ message: result.error.message, color: 'red' });
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    
    const result = await RestoreFromBackup(selectedBackup);
    if (result.success) {
      // App needs restart
      notifications.show({ message: 'Restore complete. Restarting...', color: 'green' });
      window.location.reload();
    } else {
      notifications.show({ message: result.error.message, color: 'red' });
    }
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Card>
      <Stack>
        <Group justify="space-between">
          <Text fw={500} size="lg">Database Backup</Text>
          <Group>
            <Button 
              leftSection={<IconDownload size={16} />}
              onClick={() => ExportBackup()}
              variant="light"
            >
              Export...
            </Button>
            <Button 
              leftSection={<IconDatabase size={16} />}
              onClick={handleBackupNow}
              loading={loading}
            >
              Backup Now
            </Button>
          </Group>
        </Group>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Records</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {backups.map((backup) => (
              <Table.Tr key={backup.filename}>
                <Table.Td>{formatDate(backup.createdAt)}</Table.Td>
                <Table.Td>{formatBytes(backup.sizeBytes)}</Table.Td>
                <Table.Td>
                  <Badge variant="light">
                    {backup.reason}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {backup.recordCount.works} works
                </Table.Td>
                <Table.Td>
                  <Button 
                    size="xs" 
                    variant="subtle"
                    onClick={() => {
                      setSelectedBackup(backup.filename);
                      setRestoreModal(true);
                    }}
                  >
                    Restore
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Modal 
          opened={restoreModal} 
          onClose={() => setRestoreModal(false)}
          title="Confirm Restore"
        >
          <Alert icon={<IconAlertTriangle />} color="yellow" mb="md">
            This will replace your current database with the selected backup.
            A backup of the current state will be created first.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRestoreModal(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleRestore}>
              Restore
            </Button>
          </Group>
        </Modal>
      </Stack>
    </Card>
  );
}
```

---

*End of Backup & Restore Specification*
