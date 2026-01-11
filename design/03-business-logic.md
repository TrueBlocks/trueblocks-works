# Business Logic Specification

> **Document:** 03-business-logic.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Script Overview](#1-script-overview)
2. [Navigation Scripts](#2-navigation-scripts)
3. [Data Entry Scripts](#3-data-entry-scripts)
4. [Status & Collection Management](#4-status--collection-management)
5. [File Management Scripts](#5-file-management-scripts)
6. [Export Scripts](#6-export-scripts)
7. [URL Management Scripts](#7-url-management-scripts)
8. [Utility Scripts](#8-utility-scripts)
9. [Script Dependencies](#9-script-dependencies)
10. [Wails Backend Implementation](#10-wails-backend-implementation)
11. [React Frontend Hooks](#11-react-frontend-hooks)

---

## 1. Script Overview

The database contains **46 scripts** organized into functional categories. Scripts use a `|` delimited parameter passing convention parsed by the `Parse` utility script.

### 1.1 Script Categories

| Category | Count | Description |
|----------|-------|-------------|
| Navigation | 6 | Layout switching, view cycling, record navigation |
| Data Entry | 7 | Create works, submissions, notes |
| Status/Collection | 5 | Workflow state changes, collection membership |
| File Management | 6 | Open, copy, move, print document files |
| Export | 2 | CSV export for backup/analysis |
| URL Management | 3 | Web browser control for journals |
| Utility | 8 | Parameter parsing, dialogs, sorting |
| Separators | 9 | Menu dividers (empty scripts named `-`) |

### 1.2 Parameter Convention

Scripts receive parameters as `|` delimited strings:
```
"value1|value2|value3"
```

The `Parse` script splits these into global variables:
- `$$arg1` - First parameter
- `$$arg2` - Second parameter  
- `$$arg3` - Third parameter
- `$$arg4` - Fourth parameter
- `$$arg5` - Fifth parameter
- `$$layoutName` - Current layout name
- `$$viewState` - Current view (Form/List/Table)

---

## 2. Navigation Scripts

### 2.1 Home

**Purpose:** Toggle between Works and Collections layouts with smart record navigation.

**Behavior:**
1. If first time ($$beenHere not set):
   - Set $$beenHere = True
   - Go to Works layout in Form view
2. If on Collections layout:
   - Move to next record (cycle at end)
3. If on other layout:
   - Save current workID
   - Go to Collections layout
   - Find and select the portal row matching saved workID

**Wails Backend Binding:**
```go
// App struct exposes methods to React frontend
type NavState struct {
    BeenHere      bool
    CurrentWorkID int
    CurrentView   string // "works" | "collections" | "organizations" | "submissions"
}

func (n *NavState) Home() {
    if !n.BeenHere {
        n.BeenHere = true
        n.CurrentView = "works"
        return
    }
    
    if n.CurrentView == "collections" {
        // Next record in collection
        n.NextRecord()
    } else {
        // Save current work ID and switch to collections
        n.CurrentView = "collections"
        // Find work in portal
    }
}
```

**React Hook:**
```typescript
// src/hooks/useNavigation.ts
import { useState, useCallback } from 'react';
import { Home as WailsHome } from '../../wailsjs/go/main/App';

export function useNavigation() {
  const [currentView, setCurrentView] = useState<'collections' | 'works' | 'organizations' | 'submissions'>('collections');
  
  const goHome = useCallback(async () => {
    await WailsHome();
    setCurrentView('works');
  }, []);
  
  return { currentView, setCurrentView, goHome };
}
```
```

### 2.2 Next Layout

**Purpose:** Cycle through layouts: Collections → Works → Organizations → Submissions → Collections

**Parameters:** None

**Flow:**
```
Collections → Works (with selected work)
Works → Organizations
Organizations → Submissions (sorted)
Submissions → Collections (sorted)
```

**Go Implementation:**
```go
func (n *NavState) NextLayout() {
    layoutCycle := []string{"collections", "works", "organizations", "submissions"}
    for i, layout := range layoutCycle {
        if n.CurrentView == layout {
            n.CurrentView = layoutCycle[(i+1)%len(layoutCycle)]
            break
        }
    }
}
```

### 2.3 Next View

**Purpose:** Cycle through view modes (Form → List → Table → Form)

**Go Implementation:**
```go
type ViewMode string
const (
    ViewForm  ViewMode = "form"
    ViewList  ViewMode = "list"
    ViewTable ViewMode = "table"
)

func (n *NavState) NextView() {
    switch n.CurrentViewMode {
    case ViewForm:
        n.CurrentViewMode = ViewList
    case ViewList:
        n.CurrentViewMode = ViewTable
    case ViewTable:
        n.CurrentViewMode = ViewForm
    }
}
```

### 2.4 SortIt

**Purpose:** Apply context-appropriate sorting based on current layout.

**Sort Orders:**

| Layout | Sort Fields |
|--------|-------------|
| Works | Status (value list), Quality (value list), Type (value list), Year, CourseName, Title |
| Organizations | My Interest (value list), Rating, nPushPoetry (desc), Name |
| Submissions (Form) | decisionPending (desc), Journal Name, Query Date, Title |
| Submissions (Table) | decisionPending (desc), Status (value list), Query Date, Response Type, Submission Date, Title |
| Collections | Collection ID |

**Go Implementation:**
```go
func SortWorks(works []Work) {
    sort.Slice(works, func(i, j int) bool {
        // Status priority
        si, sj := StatusOrder(works[i].Status), StatusOrder(works[j].Status)
        if si != sj {
            return si < sj
        }
        // Quality priority
        qi, qj := QualityOrder(works[i].Quality), QualityOrder(works[j].Quality)
        if qi != qj {
            return qi < qj
        }
        // Type priority
        ti, tj := TypeOrder(works[i].Type), TypeOrder(works[j].Type)
        if ti != tj {
            return ti < tj
        }
        // Year
        if works[i].Year != works[j].Year {
            return works[i].Year < works[j].Year
        }
        // Title
        return works[i].Title < works[j].Title
    })
}

func StatusOrder(status string) int {
    order := map[string]int{
        "Out": 1, "Focus": 2, "Active": 3, "Working": 4,
        "Resting": 5, "Waiting": 6, "Gestating": 7, "Sound": 8,
        "Published": 9, "Sleeping": 10, "Dying": 11, "Dead": 12, "Done": 13,
    }
    if v, ok := order[status]; ok {
        return v
    }
    return 99
}
```

---

## 3. Data Entry Scripts

### 3.1 AddWork

**Purpose:** Create a new work with associated document file, collection membership, and initial PDF preview.

**User Interface:**

```
┌─────────────────────────────────────────────────────────────┐
│  New Work                                               ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Title:    [___________________________]                    │
│                                                             │
│  Type:     [Poem        ▼]                                  │
│            Poem | Story | Essay | Flash | Article | Book    │
│            Review | Micro | Travel | Research | Poem Idea   │
│                                                             │
│  Year:     [2026    ]  (defaults to current year)           │
│                                                             │
│  Quality:  [Okay        ▼]                                  │
│                                                             │
│  Status:   [Working     ▼]                                  │
│                                                             │
│  Collection: [Working    ▼]  (optional second collection)   │
│                                                             │
│            [Cancel]  [Create]  [Create & Open]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Display new work dialog with defaults
2. User enters Title and selects Type (required)
3. Optionally adjust Year, Quality, Status, Collection
4. On confirm:
   - Create Works record in database
   - Generate file path using `generatePath(type, year, title, quality, status)`
   - Create directory structure if needed
   - Copy template file (Poem or Prose based on type)
   - Generate initial PDF preview
   - Add to "Working" collection (ID: 10030)
   - If additional collection specified, add to that too
   - If "Create & Open" clicked, open document in default editor
5. On cancel:
   - No changes made

**Template Selection:**
```
IF type contains "Poem"
    → "/Users/jrush/Documents/Home/99 Templates/00 Poem Template.docx"
ELSE
    → "/Users/jrush/Documents/Home/99 Templates/00 Prose Template.docx"
```

**Go Implementation:**
```go
package main

import (
    "database/sql"
    "errors"
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "strconv"
    "strings"
    "time"
)

type AddWorkRequest struct {
    Title      string `json:"title"`
    Type       string `json:"type"`
    Year       int    `json:"year"`       // defaults to current year if 0
    Quality    string `json:"quality"`    // defaults to "Okay"
    Status     string `json:"status"`     // defaults to "Working"
    Collection string `json:"collection"` // optional additional collection
    OpenAfter  bool   `json:"openAfter"`  // open in editor after creation
}

type AddWorkResponse struct {
    Work      *Work  `json:"work"`
    FilePath  string `json:"filePath"`
    PDFPath   string `json:"pdfPath"`
    Error     string `json:"error,omitempty"`
}

func (a *App) AddWork(req AddWorkRequest) AddWorkResponse {
    // Validate required fields
    if req.Title == "" {
        return AddWorkResponse{Error: "Title is required"}
    }
    if req.Type == "" {
        return AddWorkResponse{Error: "Type is required"}
    }
    
    // Apply defaults
    if req.Year == 0 {
        req.Year = time.Now().Year()
    }
    if req.Quality == "" {
        req.Quality = "Okay"
    }
    if req.Status == "" {
        req.Status = "Working"
    }
    
    work := &Work{
        Title:   req.Title,
        Type:    req.Type,
        Year:    strconv.Itoa(req.Year),
        Quality: req.Quality,
        Status:  req.Status,
        DocType: "docx",
    }
    
    // Generate path based on metadata
    work.Path = GeneratePath(work)
    fullPath := filepath.Join(BaseFolder, work.Path+".docx")
    
    // Insert work record
    result, err := a.db.Exec(`
        INSERT INTO Works (title, type, year, quality, status, doc_type, path)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        work.Title, work.Type, work.Year, work.Quality,
        work.Status, work.DocType, work.Path)
    if err != nil {
        return AddWorkResponse{Error: fmt.Sprintf("Database error: %v", err)}
    }
    
    workID, _ := result.LastInsertId()
    work.WorkID = int(workID)
    
    // Create document from template
    if err := a.createDocumentFromTemplate(work, fullPath); err != nil {
        log.Printf("Warning: could not create document: %v", err)
    }
    
    // Generate initial PDF preview
    pdfPath, err := GeneratePDF(fullPath, work.WorkID)
    if err != nil {
        log.Printf("Warning: could not generate preview: %v", err)
    }
    
    // Add to "Working" collection
    a.db.Exec(`INSERT INTO CollectionDetails (collID, workID) VALUES (?, ?)`,
        10030, work.WorkID)
    
    // Add to additional collection if specified
    if req.Collection != "" && req.Collection != "Working" {
        var collID int
        err = a.db.QueryRow(`
            SELECT collID FROM Collections WHERE collection_name = ?`,
            req.Collection).Scan(&collID)
        if err == nil {
            a.db.Exec(`INSERT INTO CollectionDetails (collID, workID) VALUES (?, ?)`,
                collID, work.WorkID)
        }
    }
    
    // Open in editor if requested
    if req.OpenAfter {
        exec.Command("open", fullPath).Start()
    }
    
    return AddWorkResponse{
        Work:     work,
        FilePath: fullPath,
        PDFPath:  pdfPath,
    }
}

// createDocumentFromTemplate creates a new document from the appropriate template
func (a *App) createDocumentFromTemplate(work *Work, destPath string) error {
    // Ensure directory exists
    if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
        return fmt.Errorf("failed to create directory: %w", err)
    }
    
    // Don't overwrite existing file
    if _, err := os.Stat(destPath); err == nil {
        return nil // File already exists
    }
    
    // Select template based on type
    var templatePath string
    if strings.Contains(work.Type, "Poem") {
        templatePath = filepath.Join(BaseFolder, "99 Templates/00 Poem Template.docx")
    } else {
        templatePath = filepath.Join(BaseFolder, "99 Templates/00 Prose Template.docx")
    }
    
    // Copy template to destination
    return CopyFile(templatePath, destPath)
}
```

**React Component:**
```tsx
// src/components/works/NewWorkDialog.tsx
import { useState } from 'react';
import { Modal, TextInput, Select, Button, Group, Stack, Checkbox } from '@mantine/core';
import { AddWork } from '../../wailsjs/go/main/App';

interface NewWorkDialogProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (work: Work) => void;
}

const WORK_TYPES = [
  'Poem', 'Story', 'Essay', 'Flash', 'Article', 'Book',
  'Review', 'Micro', 'Travel', 'Research', 'Poem Idea',
  'Story Idea', 'Essay Idea', 'Flash Idea'
];

const QUALITY_OPTIONS = ['Best', 'Better', 'Good', 'Okay', 'Poor', 'Bad', 'Worst'];
const STATUS_OPTIONS = ['Focus', 'Active', 'Working', 'Resting', 'Gestating'];

export function NewWorkDialog({ opened, onClose, onCreated }: NewWorkDialogProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Poem');
  const [quality, setQuality] = useState('Okay');
  const [status, setStatus] = useState('Working');
  const [openAfter, setOpenAfter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await AddWork({
        title,
        type,
        year: new Date().getFullYear(),
        quality,
        status,
        collection: '',
        openAfter,
      });
      
      if (result.error) {
        setError(result.error);
      } else if (result.work) {
        onCreated(result.work);
        onClose();
        // Reset form
        setTitle('');
        setType('Poem');
        setQuality('Okay');
        setStatus('Working');
      }
    } catch (err) {
      setError(`Failed to create work: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Work" size="md">
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Enter work title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          error={!title && error ? 'Title is required' : undefined}
        />
        
        <Select
          label="Type"
          data={WORK_TYPES}
          value={type}
          onChange={(v) => setType(v || 'Poem')}
          required
        />
        
        <Group grow>
          <Select
            label="Quality"
            data={QUALITY_OPTIONS}
            value={quality}
            onChange={(v) => setQuality(v || 'Okay')}
          />
          
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v || 'Working')}
          />
        </Group>
        
        <Checkbox
          label="Open in editor after creation"
          checked={openAfter}
          onChange={(e) => setOpenAfter(e.currentTarget.checked)}
        />
        
        {error && <div style={{ color: 'red' }}>{error}</div>}
        
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading}>
            {openAfter ? 'Create & Open' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

### 3.2 AddSubmission

**Purpose:** Create a new submission record linking a work to a journal.

**Parameters:**
- Regular call: `workID` - opens submission form
- NewSub call: `NewSub|workID|workName|journalID|journalName` - creates with notes

**Flow:**
1. If parameter starts with "NewSub":
   - Create WorkNote with type "Submission"
   - Create JournalNote with type "Submission"
2. Otherwise:
   - Open new window
   - Go to Submissions layout
   - Create new record
   - Set workID from parameter
   - Set Submission Date = today
   - Go to orgID field for input

**Go Implementation:**
```go
type SubmissionRequest struct {
    WorkID     int
    OrgID      int
    CreateNote bool
}

func AddSubmission(db *sql.DB, req SubmissionRequest) (*Submission, error) {
    sub := &Submission{
        WorkID:         req.WorkID,
        OrgID:          req.OrgID,
        SubmissionDate: time.Now(),
    }
    
    result, err := db.Exec(`
        INSERT INTO Submissions (workID, orgID, submission_date)
        VALUES (?, ?, ?)`,
        sub.WorkID, sub.OrgID, sub.SubmissionDate.Format("2006-01-02"))
    if err != nil {
        return nil, err
    }
    
    subID, _ := result.LastInsertId()
    sub.SubmissionID = int(subID)
    
    if req.CreateNote {
        // Get work and org names for notes
        var workTitle, orgName string
        db.QueryRow("SELECT title FROM Works WHERE workID = ?", req.WorkID).Scan(&workTitle)
        db.QueryRow("SELECT name FROM Organizations WHERE orgID = ?", req.OrgID).Scan(&orgName)
        
        AddWorkNote(db, req.WorkID, "Submission", workTitle)
        AddJournalNote(db, req.OrgID, "Submission", orgName)
    }
    
    return sub, nil
}
```

### 3.3 AddWorkNote

**Purpose:** Add a note to a work's history.

**Parameters:** `workID|noteType|noteText|optionalMessage`

**Go Implementation:**
```go
func AddWorkNote(db *sql.DB, workID int, noteType, noteText string) error {
    _, err := db.Exec(`
        INSERT INTO WorkNotes (workID, type, note, modified_date)
        VALUES (?, ?, ?, datetime('now'))`,
        workID, noteType, noteText)
    return err
}
```

### 3.4 AddJournalNote

**Purpose:** Add a note to a journal's history.

**Parameters:** `orgID|noteType|noteText`

**Go Implementation:**
```go
func AddJournalNote(db *sql.DB, orgID int, noteType, noteText string) error {
    _, err := db.Exec(`
        INSERT INTO JournalNotes (orgID, type, note, modified_date)
        VALUES (?, ?, ?, datetime('now'))`,
        orgID, noteType, noteText)
    return err
}
```

### 3.5 Delete Work

**Purpose:** Remove a work, its document, and preview file.

**Current Status:** NOT IMPLEMENTED - shows warning dialog only.

**Planned Behavior:**
1. Confirm deletion
2. Move Word document to trash folder
3. Delete preview PDF
4. Delete CollectionDetails records
5. Delete WorkNotes records
6. Delete Submissions records (or keep for history?)
7. Delete Works record

**Go Implementation:**
```go
func DeleteWork(db *sql.DB, workID int) error {
    // Get work details
    var work Work
    err := db.QueryRow(`SELECT path FROM Works WHERE workID = ?`, workID).Scan(&work.Path)
    if err != nil {
        return err
    }
    
    // Move document to trash
    trashPath := filepath.Join(BaseFolder, "zTrash", filepath.Base(work.Path))
    if err := os.Rename(work.Path, trashPath); err != nil {
        log.Printf("Warning: could not move file to trash: %v", err)
    }
    
    // Delete preview PDF
    previewPath := filepath.Join("/Users/jrush/Sites/Works", fmt.Sprintf("%d.pdf", workID))
    os.Remove(previewPath)
    
    // Delete related records (cascade should handle this via FK constraints)
    // But explicit deletion for clarity:
    db.Exec("DELETE FROM CollectionDetails WHERE workID = ?", workID)
    db.Exec("DELETE FROM WorkNotes WHERE workID = ?", workID)
    // Keep submissions for historical record
    
    // Delete work
    _, err = db.Exec("DELETE FROM Works WHERE workID = ?", workID)
    return err
}
```

---

## 4. Status & Collection Management

### 4.1 Status Change

**Purpose:** Handle work status transitions and their side effects.

**Parameters:**
- `Enter` - Called when entering Status field (saves old value)
- `Exit` - Called when leaving Status field (checks for change)
- `Response` - Called when submission response is recorded

**Behavior for Response:**
1. If Response Type is set:
   - Set Response Date = today
   - If "Accepted":
     - Set Work Status = "Published"
     - Update collection membership
     - Add acceptance note
     - Prompt to move file
   - If rejected:
     - Add rejection note

**Behavior for Enter/Exit:**
1. Enter: Save current workID and status to $$index and $$oldValue
2. Exit: Compare $$newValue to $$oldValue
   - If changed: Update accessDate, call Collection Change

**Go Implementation:**
```go
type StatusChangeEvent struct {
    WorkID      int
    OldStatus   string
    NewStatus   string
    ResponseType string // For submission responses
    JournalName  string
}

func HandleStatusChange(db *sql.DB, event StatusChangeEvent) error {
    // Update access timestamp
    _, err := db.Exec(`
        UPDATE Works SET access_date = datetime('now') WHERE workID = ?`,
        event.WorkID)
    if err != nil {
        return err
    }
    
    // Handle collection membership change
    if event.OldStatus != event.NewStatus {
        return UpdateCollectionMembership(db, event.WorkID, event.OldStatus, event.NewStatus)
    }
    
    return nil
}

func HandleSubmissionResponse(db *sql.DB, submissionID int, responseType string) error {
    // Get submission details
    var workID, orgID int
    var journalName string
    err := db.QueryRow(`
        SELECT s.workID, s.orgID, o.name 
        FROM Submissions s
        JOIN Organizations o ON s.orgID = o.orgID
        WHERE s.submissionID = ?`, submissionID).Scan(&workID, &orgID, &journalName)
    if err != nil {
        return err
    }
    
    // Update response date
    _, err = db.Exec(`
        UPDATE Submissions SET response_date = date('now'), response_type = ?
        WHERE submissionID = ?`, responseType, submissionID)
    if err != nil {
        return err
    }
    
    if responseType == "Accepted" {
        // Update work status
        db.Exec(`UPDATE Works SET status = 'Published' WHERE workID = ?`, workID)
        
        // Update collection membership
        UpdateCollectionMembership(db, workID, "", "Published")
        
        // Add note
        note := fmt.Sprintf("Work was accepted by '%s' on %s.", 
            journalName, time.Now().Format("2006-01-02"))
        AddWorkNote(db, workID, "Acceptance", note)
    } else {
        // Add rejection note
        note := fmt.Sprintf("Work was rejected by '%s' on %s.", 
            journalName, time.Now().Format("2006-01-02"))
        AddWorkNote(db, workID, "Rejection", note)
    }
    
    return nil
}
```

### 4.2 Collection Change

**Purpose:** Update collection membership when a work's status changes.

**Behavior:**
1. Look up collID for new status name
2. Look up collID for old status name  
3. Create new CollectionDetails record for new collection
4. Find and delete CollectionDetails record for old collection

**Note:** This implements "status as collection" - each status value (Working, Focus, etc.) has a corresponding collection.

**Go Implementation:**
```go
func UpdateCollectionMembership(db *sql.DB, workID int, oldStatus, newStatus string) error {
    // Get collection IDs
    var newCollID, oldCollID int
    
    if newStatus != "" {
        db.QueryRow(`
            SELECT collID FROM Collections WHERE collection_name = ?`,
            newStatus).Scan(&newCollID)
    }
    
    if oldStatus != "" {
        db.QueryRow(`
            SELECT collID FROM Collections WHERE collection_name = ?`,
            oldStatus).Scan(&oldCollID)
    }
    
    // Add to new collection
    if newCollID > 0 {
        _, err := db.Exec(`
            INSERT OR IGNORE INTO CollectionDetails (collID, workID)
            VALUES (?, ?)`, newCollID, workID)
        if err != nil {
            return err
        }
    }
    
    // Remove from old collection
    if oldCollID > 0 {
        _, err := db.Exec(`
            DELETE FROM CollectionDetails 
            WHERE collID = ? AND workID = ?`, oldCollID, workID)
        if err != nil {
            return err
        }
    }
    
    return nil
}
```

### 4.3 QueryCollections

**Purpose:** Filter visible collections based on the active filter.

**Filter State:** Managed via `AppState.CollectionFilter` (see [09-app-state.md](09-app-state.md))

Filter values: `"all"`, `"active"`, `"process"`, `"other"`, `"books"`, `"dead"`

**Go Implementation:**
```go
type CollectionFilter string

const (
    FilterAll     CollectionFilter = "all"
    FilterActive  CollectionFilter = "active"
    FilterProcess CollectionFilter = "process"
    FilterOther   CollectionFilter = "other"
    FilterBooks   CollectionFilter = "books"
    FilterDead    CollectionFilter = "dead"
)

func QueryCollections(db *sql.DB, filter CollectionFilter) ([]Collection, error) {
    if filter == FilterAll {
        return db.Query("SELECT * FROM Collections ORDER BY collID")
    }
    
    // Map filter to collection Type value
    typeMap := map[CollectionFilter]string{
        FilterActive:  "Active",
        FilterProcess: "Process",
        FilterOther:   "Other",
        FilterBooks:   "Book",
        FilterDead:    "Dead",
    }
    
    collType, ok := typeMap[filter]
    if !ok {
        return []Collection{}, nil
    }
    
    query := `SELECT * FROM Collections WHERE type = ? ORDER BY collID`
    return db.Query(query, collType)
}
```

---

## 5. File Management Scripts

### 5.1 Open Document

**Purpose:** Open the work's Word document or organization's URL.

**Behavior:**
- On Organizations layout: Open AppState.BrowserURL in browser (see [09-app-state.md](09-app-state.md))
- On other layouts: 
  - Get file path from generatedPath via getFilename()
  - Update accessDate
  - Open file with system default app

**Go Implementation:**
```go
func OpenDocument(work *Work) error {
    path := GetFilename(work.GeneratedPath)
    
    // Update access timestamp in database
    UpdateAccessDate(work.WorkID)
    
    // Open with system default app
    cmd := exec.Command("open", path)
    return cmd.Run()
}

func OpenURL(url string) error {
    cmd := exec.Command("open", url)
    return cmd.Run()
}
```

### 5.2 copyFile

**Purpose:** Export a work to a "CopyOut" folder with title as filename.

**Behavior:**
1. Get source path via getFilename(generatedPath)
2. Create destination path: `/Users/jrush/Desktop/CopyOut/{Title}.docx`
3. Copy file
4. Open the copied file
5. Beep to confirm

**Go Implementation:**
```go
func CopyWorkForExport(work *Work) (string, error) {
    srcPath := GetFilename(work.GeneratedPath)
    dstPath := filepath.Join("/Users/jrush/Desktop/CopyOut", 
        work.Title + ".docx")
    
    // Ensure directory exists
    os.MkdirAll(filepath.Dir(dstPath), 0755)
    
    // Copy file
    if err := CopyFile(srcPath, dstPath); err != nil {
        return "", err
    }
    
    // Open the copy
    exec.Command("open", dstPath).Run()
    
    return dstPath, nil
}
```

### 5.3 moveFile

**Purpose:** Rename/move a document file when its title or other path components change.

**Prerequisites:**
- Works.Check field must equal "name changed"

**Behavior:**
1. Validate Check field = "name changed"
2. Call external moveFile function: `moveFile(oldPath, newPath)`
3. If file moved successfully OR new file already exists:
   - Extract old title from Path
   - Extract new title from generatedPath
   - Update Path = generatedPath
   - If titles differ, add TitleChange note
4. Refresh window

**Go Implementation:**
```go
func MoveWorkFile(db *sql.DB, workID int) error {
    var work Work
    err := db.QueryRow(`
        SELECT path, generatedPath, check_field 
        FROM Works WHERE workID = ?`, workID).Scan(
        &work.Path, &work.GeneratedPath, &work.Check)
    if err != nil {
        return err
    }
    
    if work.Check != "name changed" {
        return errors.New("check field must be 'name changed'")
    }
    
    oldPath := GetFilename(work.Path)
    newPath := GetFilename(work.GeneratedPath)
    
    // Move file
    if err := os.Rename(oldPath, newPath); err != nil {
        // Check if new file already exists
        if _, err := os.Stat(newPath); os.IsNotExist(err) {
            return fmt.Errorf("move failed: %w", err)
        }
    }
    
    // Update database
    oldTitle := ExtractTitle(work.Path)
    newTitle := ExtractTitle(work.GeneratedPath)
    
    _, err = db.Exec(`UPDATE Works SET path = ? WHERE workID = ?`, 
        work.GeneratedPath, workID)
    if err != nil {
        return err
    }
    
    if oldTitle != newTitle {
        note := fmt.Sprintf("Title changed from '%s' to '%s'.", oldTitle, newTitle)
        AddWorkNote(db, workID, "TitleChange", note)
    }
    
    return nil
}
```

### 5.4 printFile

**Purpose:** Print the PDF preview of a work.

**Behavior:**
1. Build path: `/Users/jrush/Sites/Works/{workID}.pdf`
2. Call external printFile function
3. Show result in dialog

### 5.5 openFinder

**Purpose:** Open the document's folder in Finder.

**Go Implementation:**
```go
func OpenFinder(path string) error {
    dir := filepath.Dir(path)
    return exec.Command("open", dir).Run()
}
```

### 5.6 PreviewWindow

**Purpose:** Open a window showing the PDF preview of the current work.

---

## 6. Export Scripts

### 6.1 Export

**Purpose:** Export all works to CSV files organized by type.

**Behavior:**
1. Show all records
2. Filter to DocType = "docx"
3. Sort by Year, Type, Title, generatedPath
4. Export to `/Documents/Home/200Data2/AllFiles_List.csv`
5. For each work type, call ExportHelper:
   - Essay (with Ideas), Poem (with Ideas), Flash (with Ideas)
   - Story (with Ideas), Paper (with Ideas), Micro, Song
   - Journal, Review (with Ideas), Book (with Ideas)
   - Chapter, Article (with Ideas), Critique, Interview
   - Freewrite, Lesson, Character, Research, Travel
6. Restore full list and re-sort

**Go Implementation:**
```go
func ExportAllWorks(db *sql.DB, baseDir string) error {
    // Export master list
    rows, err := db.Query(`
        SELECT year, type, title, generatedPath, doc_type
        FROM Works
        WHERE doc_type = 'docx'
        ORDER BY year, type, title, generatedPath`)
    if err != nil {
        return err
    }
    defer rows.Close()
    
    masterFile := filepath.Join(baseDir, "AllFiles_List.csv")
    if err := ExportToCSV(rows, masterFile); err != nil {
        return err
    }
    
    // Export by type
    types := []struct {
        Name         string
        IncludeIdeas bool
    }{
        {"Essay", true}, {"Poem", true}, {"Flash", true},
        {"Story", true}, {"Paper", true}, {"Micro", false},
        {"Song", false}, {"Journal", false}, {"Review", true},
        {"Book", true}, {"Chapter", false}, {"Article", true},
        {"Critique", false}, {"Interview", false}, {"Freewrite", false},
        {"Lesson", false}, {"Character", false}, {"Research", false},
        {"Travel", false},
    }
    
    for _, t := range types {
        ExportByType(db, baseDir, t.Name, t.IncludeIdeas)
    }
    
    return nil
}

func ExportByType(db *sql.DB, baseDir, typeName string, includeIdeas bool) error {
    // Export main type
    rows, err := db.Query(`
        SELECT year, type, title, generatedPath, doc_type
        FROM Works
        WHERE type = ? AND doc_type = 'docx'
        ORDER BY year, type, title, generatedPath`, typeName)
    if err != nil {
        return err
    }
    
    file := filepath.Join(baseDir, fmt.Sprintf("AllFiles_z%s.csv", typeName))
    ExportToCSV(rows, file)
    rows.Close()
    
    // Export ideas variant if applicable
    if includeIdeas {
        ideaType := typeName + " Idea"
        rows, err := db.Query(`
            SELECT year, type, title, generatedPath, doc_type
            FROM Works
            WHERE type = ?
            ORDER BY year, type, title, generatedPath`, ideaType)
        if err == nil {
            file := filepath.Join(baseDir, fmt.Sprintf("AllFiles_z%s.csv", ideaType))
            ExportToCSV(rows, file)
            rows.Close()
        }
    }
    
    return nil
}
```

---

## 7. URL Management Scripts

### 7.1 SetURL

**Purpose:** Switch the embedded web browser to show a specific URL type.

**Parameters:** `duotrope` | `guidelines` | `website`

**Behavior:**
1. Based on parameter, select URL:
   - `duotrope`: Build URL from Duotrope Num field
   - `guidelines`: Use Other URL field
   - `website`: Use URL field
2. Set AppState.BrowserURL to selected URL (see [09-app-state.md](09-app-state.md))
3. Store selection in AppState.LastURL for CopyURL

**Go Implementation:**
```go
type URLType string
const (
    URLDuotrope   URLType = "duotrope"
    URLGuidelines URLType = "guidelines"  
    URLWebsite    URLType = "website"
)

func GetOrgURL(org *Organization, urlType URLType) string {
    switch urlType {
    case URLDuotrope:
        if org.DuotropeNum > 0 {
            return fmt.Sprintf("https://duotrope.com/market_%d.aspx", org.DuotropeNum)
        }
    case URLGuidelines:
        if org.OtherURL != "" {
            return org.OtherURL
        }
    case URLWebsite:
        if org.URL != "" {
            return org.URL
        }
    }
    return org.URL // Default fallback
}
```

### 7.2 CopyURL

**Purpose:** Copy current browser URL back to the appropriate database field.

**Behavior:**
1. Get current URL from browser
2. Based on $$lastURL:
   - `duotrope`: Extract market ID and save to Duotrope Num
   - `guidelines`: Save to Other URL
   - `website`: Save to URL

### 7.3 ShowURL

**Purpose:** Open URL in external browser or show publication web address.

**Parameters:** `ShowPub` - Opens Submissions::Web Address

---

## 8. Utility Scripts

### 8.1 Parse

**Purpose:** Split `|` delimited script parameter into global variables.

**Output Variables:**
- `$$arg1` through `$$arg5` - Parameter values
- `$$layoutName` - Current layout name
- `$$viewState` - Current view mode

**Go Implementation:**
```go
type ParsedParams struct {
    Args       []string
    LayoutName string
    ViewState  string
}

func Parse(param string) ParsedParams {
    result := ParsedParams{
        Args: strings.Split(param, "|"),
    }
    
    // Pad to 5 arguments
    for len(result.Args) < 5 {
        result.Args = append(result.Args, "")
    }
    
    return result
}
```

### 8.2 Wait

**Purpose:** Display a message dialog and wait for user acknowledgment.

**Parameters:** Message to display

### 8.3 Globals

**Purpose:** Initialize global variables on database open.

### 8.4 forEachRecord

**Purpose:** Iterator utility for processing all records.

### 8.5 keyStroke

**Purpose:** Handle keyboard shortcuts.

---

## 9. Script Dependencies

### 9.1 Dependency Graph

```
Home
├── findPortalRow
├── enterRow
│   └── Parse
└── QueryCollections

Next Layout
├── Parse
├── ViewWork
│   └── ...
└── SortIt
    └── Parse

AddWork
├── getFilename (Custom Function)
├── fileExists (External Plugin - MISSING)
├── copyFile (External Plugin - MISSING)
└── AddWork (recursive for retry)

Status Change
├── Parse
├── Collection Change
├── AddWorkNote
│   ├── Parse
│   └── Wait
├── Wait
└── moveFile
    ├── Parse
    ├── Wait
    ├── getFilename (Custom Function)
    └── AddWorkNote

Export
└── ExportHelper
    └── Parse
```

### 9.2 External Dependencies

Several scripts rely on **external FileMaker plugins** that are no longer available:

| Function | Used By | Replacement |
|----------|---------|-------------|
| `fileExists` | AddWork, enterRow, moveFile | `os.Stat()` |
| `copyFile` | AddWork, copyFile | `io.Copy()` |
| `moveFile` | moveFile | `os.Rename()` |
| `touchFile` | AddWork | `os.Chtimes()` |
| `printFile` | printFile | `exec.Command("lpr", ...)` |
| `extractTitle` | moveFile | `filepath.Base()` + parsing |

---

## 10. Go Implementation Guidelines

### 10.1 Command Structure

Implement as CLI commands:

```go
// main.go
func main() {
    app := &cli.App{
        Name: "submissions",
        Commands: []*cli.Command{
            {Name: "work", Subcommands: workCommands},
            {Name: "submission", Subcommands: submissionCommands},
            {Name: "export", Subcommands: exportCommands},
            {Name: "collection", Subcommands: collectionCommands},
        },
    }
    app.Run(os.Args)
}

// Commands
var workCommands = []*cli.Command{
    {Name: "add", Action: addWork},
    {Name: "delete", Action: deleteWork},
    {Name: "open", Action: openWork},
    {Name: "move", Action: moveWorkFile},
    {Name: "copy", Action: copyWork},
    {Name: "list", Action: listWorks},
}
```

### 10.2 Error Handling

Replace FileMaker dialogs with proper error returns:

```go
func AddWork(db *sql.DB, req AddWorkRequest) (*Work, error) {
    if req.Title == "" {
        return nil, &ValidationError{Field: "title", Message: "cannot be empty"}
    }
    // ...
}
```

### 10.3 Transaction Support

Wrap multi-step operations in transactions:

```go
func AddWork(db *sql.DB, req AddWorkRequest) (*Work, error) {
    tx, err := db.Begin()
    if err != nil {
        return nil, err
    }
    defer tx.Rollback()
    
    // Insert work
    // Create collection memberships
    // Create file
    
    if err := tx.Commit(); err != nil {
        // Clean up file if created
        return nil, err
    }
    
    return work, nil
}
```

---

*End of Business Logic Specification*
