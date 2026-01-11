# 09 - Application State & Persistence

> **Purpose:** Define how FileMaker global fields translate to Go application state, and specify what state persists across sessions.

---

## 1. Overview

FileMaker Pro stores "global" values as special fields within tables. In the Go/Wails architecture, these become:

1. **Transient State** - Lives in the `App` struct, exposed to React via Wails bindings
2. **Persisted State** - Saved to a JSON config file, restored on app startup

---

## 2. FileMaker Globals Migration

### 2.1 Original FileMaker Global Fields

| Table | Field | Type | Purpose | Migration | Persist? |
|-------|-------|------|---------|-----------|----------|
| Collections | `gl_showAll` | Text | Filter: show all works | → `AppState.ActiveFilter` | ✅ Yes |
| Collections | `gl_showActive` | Text | Filter: active works | → `AppState.ActiveFilter` | ✅ Yes |
| Collections | `gl_showInProcess` | Text | Filter: in-process works | → `AppState.ActiveFilter` | ✅ Yes |
| Collections | `gl_showOther` | Text | Filter: other works | → `AppState.ActiveFilter` | ✅ Yes |
| Collections | `gl_showBooks` | Text | Filter: books/stories | → `AppState.ActiveFilter` | ✅ Yes |
| Collections | `gl_showDead` | Text | Filter: dead works | → `AppState.ActiveFilter` | ✅ Yes |
| Works | `gl_CurStatus` | Text | Current status for filtering | → `AppState.CurrentWorkStatus` | ✅ Yes |
| Works | `g_BrowserOn` | Text | PDF preview window state | → `AppState.PreviewVisible` | ✅ Yes |
| Works | `g_BrowserURL` | Text | Preview URL | → Computed on demand | ❌ No |
| Organizations | `g_CurrentURL` | Text | Web browser URL | → Computed on demand | ❌ No |
| Organizations | `g_BrowserOn` | Number | Web browser visibility | → `AppState.BrowserVisible` | ✅ Yes |
| Organizations | `g_currentWork` | Text | Cross-layout work ID | → `AppState.CurrentWorkID` | ✅ Yes |
| Submissions | `g_CurrentURL` | Text | Web browser URL | → Computed on demand | ❌ No |

### 2.2 Key Insight

The 6 filter flags (`gl_show*`) collapse into a single enum value since only one filter is active at a time.

**Persistence Rule:** State that represents user preferences or "where I left off" should be persisted. URL fields are **derived values** — they're computed on demand based on the currently selected record. When the app restores `LastWorkID` or `LastOrgID`, the URL is recalculated from that record's data. There's no need to persist computed values.

---

## 2.3 Detailed Global Field Usage Patterns

This section documents exactly how each FileMaker global field was used throughout the original application.

### 2.3.1 Collection Filter Globals (`gl_show*`)

**Original FileMaker Fields:**
- `Collections::gl_showAll` — Text checkbox, "yes" when checked
- `Collections::gl_showActive` — Text checkbox
- `Collections::gl_showInProcess` — Text checkbox
- `Collections::gl_showOther` — Text checkbox
- `Collections::gl_showBooks` — Text checkbox
- `Collections::gl_showDead` — Text checkbox

**How They Were Used:**

1. **Collections Layout Filter UI** ([06-layouts.md](06-layouts.md#filter-buttons))
   - Six checkboxes positioned vertically on the right side of the Collections layout
   - User clicks a checkbox → sets that global to "yes"
   - Only one checkbox should be active at a time (mutually exclusive)

2. **QueryCollections Logic** ([03-business-logic.md](03-business-logic.md#43-querycollections))
   - When refreshing the Collections portal, script checks each `gl_show*` flag
   - Builds a WHERE clause: `type IN ('Active', 'Process', ...)` based on checked flags
   - If `gl_showAll` is "yes", no type filtering is applied

3. **Keyboard Shortcut (⌘1)**
   - When on Collections page, ⌘1 cycles through filter values: all → active → process → other → books → dead
   - See [06-layouts.md Section 8](06-layouts.md#8-keyboard-shortcuts--navigation)

**Go Migration:**
```go
// Single enum replaces 6 checkboxes (only one active at a time)
type FilterType string
const (
    FilterAll     FilterType = "all"
    FilterActive  FilterType = "active"
    FilterProcess FilterType = "process"
    FilterOther   FilterType = "other"
    FilterBooks   FilterType = "books"
    FilterDead    FilterType = "dead"
)

// AppState.ActiveFilter holds the current filter value
```

---

### 2.3.2 Work Status Global (`gl_CurStatus`)

**Original FileMaker Field:** `Works::gl_CurStatus` — Text

**How It Was Used:**

1. **Status Filtering Context**
   - Stored the currently selected status value for filtering works
   - Used in conjunction with find/filter operations

2. **Cross-Layout State**
   - Preserved the user's last status filter when navigating between layouts
   - Script would read this value to restore filter state

**Go Migration:**
```go
// Part of AppState - persisted across sessions
AppState.CurrentWorkStatus string
```

---

### 2.3.3 PDF Preview Globals (`g_BrowserOn`, `g_BrowserURL`)

**Original FileMaker Fields:**
- `Works::g_BrowserOn` — Text, "yes" when preview is visible
- `Works::g_BrowserURL` — Text (calculated), contains preview URL

**How They Were Used:**

1. **Collections Layout Web Viewer** ([06-layouts.md](06-layouts.md#web-viewer-browser))
   - Web viewer object bound to `Works::g_BrowserURL`
   - Position: Right side panel at (50, 1080, 959, 1818)
   - Shows preview of selected work's document

2. **enterRow Script Trigger**
   - When cursor enters a portal row in the Collections list
   - Script builds URL from `generatedPath` using `getFilename()` custom function
   - Checks if file exists via `fileExists()` plugin function
   - Sets `g_BrowserURL` to the file path for preview

3. **Toggle Visibility**
   - `g_BrowserOn` controls whether preview panel is shown
   - User can toggle via keyboard shortcut or button

**Go Migration:**
```go
// Visibility is AppState, URL is computed on demand
AppState.PreviewVisible bool

// URL computed when selecting a work
func GetPreviewURL(work *Work) string {
    path := GetFilename(work.GeneratedPath)
    if FileExists(path) {
        return "file://" + path
    }
    return ""
}
```

---

### 2.3.4 Organization Browser Globals (`g_CurrentURL`, `g_BrowserOn`, `g_currentWork`)

**Original FileMaker Fields:**
- `Organizations::g_CurrentURL` — Text, current web browser URL
- `Organizations::g_BrowserOn` — Number (0/1), browser visibility toggle
- `Organizations::g_currentWork` — Text, ID of work being viewed cross-layout

**How They Were Used:**

1. **SwitchBrowser Script** ([03-business-logic.md](03-business-logic.md#71-switchbrowser))
   - Parameter: `duotrope` | `guidelines` | `website`
   - Builds URL based on parameter and organization record:
     - `duotrope`: `https://duotrope.com/market_{DuotropeNum}.aspx`
     - `guidelines`: Uses `Other URL` field
     - `website`: Uses `URL` field
   - Sets `g_CurrentURL` to the constructed URL
   - Web viewer refreshes to display the URL

2. **CopyURL Script** ([03-business-logic.md](03-business-logic.md#72-copyurl))
   - Copies the current browser URL back to the appropriate database field
   - Uses `$$lastURL` to know which field to update

3. **Open Document Script** ([03-business-logic.md](03-business-logic.md#51-open-document))
   - On Organizations layout: Opens `g_CurrentURL` in system browser
   - On other layouts: Opens work's Word document

4. **Cross-Layout Work Reference**
   - `g_currentWork` stores the work ID when navigating from Works to Organizations
   - Allows returning to the same work after viewing organization details

**Go Migration:**
```go
// Visibility is persistent state
AppState.BrowserVisible bool

// Current work ID tracked in AppState (cross-page navigation)
AppState.CurrentWorkID int

// URL computed on demand based on URL type selection
func GetOrgBrowserURL(org *Organization, urlType URLType) string {
    switch urlType {
    case URLDuotrope:
        return fmt.Sprintf("https://duotrope.com/market_%d.aspx", org.DuotropeNum)
    case URLGuidelines:
        return org.OtherURL
    case URLWebsite:
        return org.URL
    }
    return org.URL
}
```

---

### 2.3.5 Submissions Browser Global (`g_CurrentURL`)

**Original FileMaker Field:** `Submissions::g_CurrentURL` — Text

**How It Was Used:**

1. **Web Address Display**
   - Submissions table stores a `Web Address` field for the publication URL
   - `g_CurrentURL` mirrors this for browser display
   - ShowURL script with `ShowPub` parameter opens this URL

**Go Migration:**
```go
// Computed from Submission.WebAddress when needed
func GetSubmissionURL(sub *Submission) string {
    return sub.WebAddress
}
```

---

### 2.3.6 Summary: Script Variable Usage (`$$`)

In addition to global fields, FileMaker used script variables (prefixed `$$`):

| Variable | Usage | Migration |
|----------|-------|-----------|
| `$$lastURL` | Tracks which URL type was last set (for CopyURL) | `AppState.LastURLType` |
| `$$arg1`-`$$arg5` | Script parameter parsing | Go function parameters |
| `$$layoutName` | Current layout context | React Router location |
| `$$viewState` | Current view mode (form/table) | `AppState.*ViewMode` |

---

## 3. Transient State (In-Memory)

State that lives in the Go `App` struct and is exposed to the React frontend via Wails bindings. Lost when app closes.

### 3.1 State Definition

```go
// internal/state/state.go
package state

type ViewMode string

const (
    ViewForm  ViewMode = "form"
    ViewTable ViewMode = "table"
)

type FilterType string

const (
    FilterAll     FilterType = "all"
    FilterActive  FilterType = "active"
    FilterProcess FilterType = "process"
    FilterOther   FilterType = "other"
    FilterBooks   FilterType = "books"
    FilterDead    FilterType = "dead"
)

type URLType string

const (
    URLDuotrope   URLType = "duotrope"
    URLGuidelines URLType = "guidelines"
    URLWebsite    URLType = "website"
)

type AppState struct {
    // Navigation
    CurrentView string `json:"currentView"` // "collections" | "works" | "submissions" | "organizations"
    
    // Current Record IDs
    CurrentWorkID       int `json:"currentWorkId"`
    CurrentOrgID        int `json:"currentOrgId"`
    CurrentSubmissionID int `json:"currentSubmissionId"`
    CurrentCollectionID int `json:"currentCollectionId"`
    
    // View Modes per page
    WorksViewMode       ViewMode `json:"worksViewMode"`
    OrgsViewMode        ViewMode `json:"orgsViewMode"`
    SubmissionsViewMode ViewMode `json:"submissionsViewMode"`
    
    // Collections page filter
    ActiveFilter FilterType `json:"activeFilter"`
    
    // UI State
    PreviewVisible  bool `json:"previewVisible"`
    BrowserVisible  bool `json:"browserVisible"`
    
    // Browser URL tracking (for CopyURL functionality)
    LastURLType URLType `json:"lastUrlType"` // "duotrope" | "guidelines" | "website"
    
    // Current work status filter
    CurrentWorkStatus string `json:"currentWorkStatus"`
    
    // Persisted state (loaded from disk)
    Persisted PersistedState `json:"persisted"`
}

func NewAppState() *AppState {
    return &AppState{
        CurrentView:         "collections",
        ActiveFilter:        FilterAll,
        WorksViewMode:       ViewForm,
        OrgsViewMode:        ViewForm,
        SubmissionsViewMode: ViewForm,
        PreviewVisible:      true,
        BrowserVisible:      true,
        LastURLType:         URLWebsite,
        CurrentWorkStatus:   "",
        Persisted:           DefaultPersistedState(),
    }
}
```

### 3.2 Wails Bindings

```go
// app.go
type App struct {
    ctx   context.Context
    db    *database.DB
    state *state.AppState
}

// Exposed to frontend
func (a *App) GetState() *state.AppState {
    return a.state
}

func (a *App) SetCurrentView(view string) {
    a.state.CurrentView = view
    a.state.Persisted.LastView = view
    a.SaveState() // Auto-persist
}

func (a *App) SetCurrentWorkID(id int) {
    a.state.CurrentWorkID = id
    a.state.Persisted.LastWorkID = id
    a.addToRecentWorks(id)
    a.SaveState()
}

func (a *App) SetActiveFilter(filter state.FilterType) {
    a.state.ActiveFilter = filter
    a.state.Persisted.LastFilter = string(filter)
    a.SaveState()
}

func (a *App) ToggleViewMode(page string) state.ViewMode {
    switch page {
    case "works":
        if a.state.WorksViewMode == state.ViewForm {
            a.state.WorksViewMode = state.ViewTable
        } else {
            a.state.WorksViewMode = state.ViewForm
        }
        return a.state.WorksViewMode
    // ... similar for other pages
    }
    return state.ViewForm
}
```

---

## 4. Persisted State (Disk)

State saved to disk and restored on app startup. Enables "resume where you left off" experience.

### 4.1 Config File Location

```
~/Library/Application Support/Submissions/state.json
```

### 4.2 Persisted State Definition

```go
// internal/state/persisted.go
package state

type PersistedState struct {
    // Window geometry
    WindowWidth  int `json:"windowWidth"`
    WindowHeight int `json:"windowHeight"`
    WindowX      int `json:"windowX"`
    WindowY      int `json:"windowY"`
    WindowMaximized bool `json:"windowMaximized"`
    
    // Last session state (navigation)
    LastView         string `json:"lastView"`
    LastWorkID       int    `json:"lastWorkId"`
    LastOrgID        int    `json:"lastOrgId"`
    LastSubmissionID int    `json:"lastSubmissionId"`
    LastCollectionID int    `json:"lastCollectionId"`
    
    // Filter/status preferences (from FileMaker globals)
    LastFilter       string `json:"lastFilter"`       // "all", "active", etc.
    LastWorkStatus   string `json:"lastWorkStatus"`   // gl_CurStatus migration
    
    // UI visibility preferences (from FileMaker globals)
    PreviewVisible   bool   `json:"previewVisible"`   // g_BrowserOn (Works)
    BrowserVisible   bool   `json:"browserVisible"`   // g_BrowserOn (Orgs)
    
    // Recent items (for quick access menu)
    RecentWorks []int `json:"recentWorks"` // Last 10 work IDs
    RecentOrgs  []int `json:"recentOrgs"`  // Last 10 org IDs
    
    // File system paths (configurable - see 07-file-management.md)
    BaseFolderPath       string `json:"baseFolderPath"`       // Root for all work files
    PDFPreviewPath       string `json:"pdfPreviewPath"`       // PDF previews
    SubmissionExportPath string `json:"submissionExportPath"` // Export destination
    TemplateFolderPath   string `json:"templateFolderPath"`   // New work templates
    
    // User preferences
    Theme            string `json:"theme"`            // "light" | "dark" | "system"
    SidebarCollapsed bool   `json:"sidebarCollapsed"`
    
    // Version for migration
    Version int `json:"version"`
}

func DefaultPersistedState() PersistedState {
    home, _ := os.UserHomeDir()
    
    return PersistedState{
        WindowWidth:     1400,
        WindowHeight:    900,
        WindowX:         -1, // -1 = center
        WindowY:         -1,
        LastView:        "collections",
        LastFilter:      "all",
        LastWorkStatus:  "",
        PreviewVisible:  true,
        BrowserVisible:  true,
        // Default file paths (user can configure in Settings)
        // docx files are in ~/Documents/Home/{subfolder}/
        // PDFs are in ~/Development/databases/support/dbSubmissions/
        BaseFolderPath:       filepath.Join(home, "Documents", "Home"),
        PDFPreviewPath:       filepath.Join(home, "Development", "databases", "support", "dbSubmissions"),
        SubmissionExportPath: filepath.Join(home, "Desktop", "Submissions"),
        TemplateFolderPath:   filepath.Join(home, "Documents", "Home", "99 Templates"),
        Theme:                "system",
        Version:              1,
    }
}
```

### 4.3 Load/Save Implementation

```go
// internal/state/persistence.go
package state

import (
    "encoding/json"
    "os"
    "path/filepath"
    "runtime"
)

func getConfigPath() string {
    home, _ := os.UserHomeDir()
    configDir := filepath.Join(home, "Library", "Application Support", "Submissions")
    return filepath.Join(configDir, "state.json")
}

func LoadPersistedState() (PersistedState, error) {
    configPath := getConfigPath()
    
    data, err := os.ReadFile(configPath)
    if err != nil {
        if os.IsNotExist(err) {
            return DefaultPersistedState(), nil // First run
        }
        return DefaultPersistedState(), err
    }
    
    var state PersistedState
    if err := json.Unmarshal(data, &state); err != nil {
        return DefaultPersistedState(), err
    }
    
    return state, nil
}

func SavePersistedState(state PersistedState) error {
    configPath := getConfigPath()
    
    // Ensure directory exists
    if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
        return err
    }
    
    data, err := json.MarshalIndent(state, "", "  ")
    if err != nil {
        return err
    }
    
    return os.WriteFile(configPath, data, 0644)
}
```

### 4.4 App Integration

```go
// app.go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Load persisted state
    persisted, err := state.LoadPersistedState()
    if err != nil {
        log.Printf("Warning: could not load state: %v", err)
    }
    a.state.Persisted = persisted
    
    // Restore last session
    a.state.CurrentView = persisted.LastView
    a.state.CurrentWorkID = persisted.LastWorkID
    a.state.CurrentOrgID = persisted.LastOrgID
    a.state.CurrentCollectionID = persisted.LastCollectionID
    a.state.ActiveFilter = state.FilterType(persisted.LastFilter)
}

func (a *App) shutdown(ctx context.Context) {
    // Save state before exit
    a.SaveState()
}

func (a *App) SaveState() error {
    return state.SavePersistedState(a.state.Persisted)
}

// Called when window is moved or resized
func (a *App) OnWindowChange(x, y, width, height int, maximized bool) {
    a.state.Persisted.WindowX = x
    a.state.Persisted.WindowY = y
    a.state.Persisted.WindowWidth = width
    a.state.Persisted.WindowHeight = height
    a.state.Persisted.WindowMaximized = maximized
    a.SaveState()
}
```

---

## 5. React Frontend Integration

### 5.1 State Hook

```typescript
// src/hooks/useAppState.ts
import { useState, useEffect, useCallback } from 'react';
import { GetState, SetCurrentView, SetCurrentWorkID, SetActiveFilter } from '../../wailsjs/go/main/App';
import { state } from '../../wailsjs/go/models';

export function useAppState() {
  const [appState, setAppState] = useState<state.AppState | null>(null);

  useEffect(() => {
    GetState().then(setAppState);
  }, []);

  const setView = useCallback(async (view: string) => {
    await SetCurrentView(view);
    setAppState(prev => prev ? { ...prev, currentView: view } : null);
  }, []);

  const setWorkId = useCallback(async (id: number) => {
    await SetCurrentWorkID(id);
    setAppState(prev => prev ? { ...prev, currentWorkId: id } : null);
  }, []);

  const setFilter = useCallback(async (filter: string) => {
    await SetActiveFilter(filter);
    setAppState(prev => prev ? { ...prev, activeFilter: filter } : null);
  }, []);

  return {
    state: appState,
    setView,
    setWorkId,
    setFilter,
  };
}
```

### 5.2 Usage in Components

```typescript
// src/App.tsx
function App() {
  const { state, setView } = useAppState();

  // On startup, navigate to last view
  useEffect(() => {
    if (state?.persisted.lastView) {
      navigate(`/${state.persisted.lastView}`);
    }
  }, [state?.persisted.lastView]);

  // ... rest of app
}
```

---

## 6. Recent Items

Track recently accessed records for quick navigation.

```go
const MaxRecentItems = 10

func (a *App) addToRecentWorks(id int) {
    recent := a.state.Persisted.RecentWorks
    
    // Remove if already in list
    for i, rid := range recent {
        if rid == id {
            recent = append(recent[:i], recent[i+1:]...)
            break
        }
    }
    
    // Add to front
    recent = append([]int{id}, recent...)
    
    // Trim to max
    if len(recent) > MaxRecentItems {
        recent = recent[:MaxRecentItems]
    }
    
    a.state.Persisted.RecentWorks = recent
}

func (a *App) GetRecentWorks() []int {
    return a.state.Persisted.RecentWorks
}
```

---

## 7. Example state.json

```json
{
  "windowWidth": 1400,
  "windowHeight": 900,
  "windowX": 100,
  "windowY": 50,
  "windowMaximized": false,
  "lastView": "works",
  "lastWorkId": 1842,
  "lastOrgId": 156,
  "lastSubmissionId": 0,
  "lastCollectionId": 5,
  "lastFilter": "active",
  "lastWorkStatus": "",
  "previewVisible": true,
  "browserVisible": true,
  "recentWorks": [1842, 1839, 1756, 1698, 1654],
  "recentOrgs": [156, 89, 234],
  "baseFolderPath": "/Users/jrush/Documents/Home",
  "pdfPreviewPath": "/Users/jrush/Sites/Works",
  "submissionExportPath": "/Users/jrush/Desktop/Submissions",
  "templateFolderPath": "/Users/jrush/Documents/Home/99 Templates",
  "theme": "system",
  "sidebarCollapsed": false,
  "version": 1
}
```

---

## 8. State Migration

When the persisted state schema changes, increment `Version` and add migration logic:

```go
func migrateState(state *PersistedState) {
    if state.Version < 2 {
        // Migration from v1 to v2
        // e.g., rename a field, add new defaults
        state.Version = 2
    }
    // Add more migrations as needed
}
```

---

*End of Application State Specification*
