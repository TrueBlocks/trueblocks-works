# Custom Functions Specification

> **Document:** 05-custom-functions.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Function Definitions](#2-function-definitions)
3. [Dependency Graph](#3-dependency-graph)
4. [External Plugin Dependencies](#4-external-plugin-dependencies)
5. [Go/Wails Implementation](#5-gowails-implementation)
6. [TypeScript Utilities](#6-typescript-utilities)

---

## 1. Overview

The database defines **8 custom functions** that encapsulate reusable logic. These functions are critical for file path generation and validation.

### 1.1 Function Summary

| Function | Parameters | Purpose | External Dependency |
|----------|------------|---------|---------------------|
| `fileExists` | fn | Check if file exists on disk | **MISSING PLUGIN** |
| `getDateStr` | dt | Format date as YYYY_MM_DD | None |
| `getFilename` | partialPath | Build full file path | None |
| `generatePath` | type, yr, title, quality, status | Generate complete file path | Uses: getMainFolder, getQualityMark |
| `getMainFolder` | type, yr, status | Determine folder based on work type/status | Uses: getMainType |
| `getMainType` | type | Get pluralized folder name for type | None |
| `getQualityMark` | qual | Convert quality to letter prefix | None |
| `dateQuery` | query, dt1, dt2 | Compare two dates | None |

---

## 2. Function Definitions

### 2.1 fileExists(fn)

**Purpose:** Check if a file exists on the file system.

**Parameters:**
- `fn` - Full file path to check

**Original Definition:**
```
<Function Missing> ( "fileExists" ; fn ) = "1"
```

**Note:** This function relies on an **external FileMaker plugin** that is no longer available. The plugin function returned "1" if the file exists, "0" otherwise.

**Used In:**
- Field: `Works::Check` (calculated)
- Script: `enterRow`
- AppState: Browser URL generation (see [09-app-state.md](09-app-state.md))

**Go Replacement:**
```go
func FileExists(path string) bool {
    _, err := os.Stat(path)
    return err == nil
}
```

---

### 2.2 getDateStr(dt)

**Purpose:** Format a date as `YYYY_MM_DD ` (with trailing space).

**Parameters:**
- `dt` - Date value to format

**Original Definition:**
```filemaker
If ( IsEmpty(dt) ; "" ; 
    Year(dt) & "_" & 
    If ( Month(dt) < 10 ; "0" & Month(dt) ; Month(dt) ) & "_" & 
    If ( Day(dt) < 10 ; "0" & Day(dt) ; Day(dt) ) & " " 
)
```

**Behavior:**
- Returns empty string if date is empty
- Pads month and day with leading zeros
- Adds trailing space

**Examples:**
| Input | Output |
|-------|--------|
| 2024-03-15 | `"2024_03_15 "` |
| 2023-12-01 | `"2023_12_01 "` |
| (empty) | `""` |

**Go Implementation:**
```go
func GetDateStr(dt time.Time) string {
    if dt.IsZero() {
        return ""
    }
    return dt.Format("2006_01_02 ")
}
```

---

### 2.3 getFilename(partialPath)

**Purpose:** Build full file path from partial path by prepending base directory.

**Parameters:**
- `partialPath` - Relative path from base folder

**Original Definition:**
```filemaker
"/Users/jrush/Documents/Home/" & partialPath
```

**Behavior:**
- Simply concatenates base path with partial path
- Base path is hardcoded: `/Users/jrush/Documents/Home/`

**Examples:**
| Input | Output |
|-------|--------|
| `"34 Current Work/bPoem - 2024 - My Title"` | `"/Users/jrush/Documents/Home/34 Current Work/bPoem - 2024 - My Title"` |
| `"100 Poems/cPoem - 2020 - Old Work"` | `"/Users/jrush/Documents/Home/100 Poems/cPoem - 2020 - Old Work"` |

**Used In:**
- Field: `Works::Check`
- Scripts: `Open Document`, `AddWork`, `copyFile`, `moveFile`

**Go Implementation:**
```go
const BaseFolder = "/Users/jrush/Documents/Home/"

func GetFilename(partialPath string) string {
    return filepath.Join(BaseFolder, partialPath)
}
```

---

### 2.4 generatePath(type, yr, title, quality, status)

**Purpose:** Generate the complete relative file path for a work based on its metadata.

**Parameters:**
- `type` - Work type (Poem, Story, etc.)
- `yr` - Year created
- `title` - Work title
- `quality` - Quality rating
- `status` - Current status

**Original Definition:**
```filemaker
getMainFolder ( type ; yr ; status ) &
getQualityMark ( quality ) &
type & " - " &
yr & " - " &
Substitute ( title ; "/" ; "~" )
```

**Components:**
1. `getMainFolder(type, yr, status)` → Folder path (e.g., `"34 Current Work/"`)
2. `getQualityMark(quality)` → Quality prefix (e.g., `"b"` for Good)
3. `type & " - " & yr & " - "` → Type and year
4. `Substitute(title, "/", "~")` → Sanitized title

**Examples:**
| Inputs | Output |
|--------|--------|
| type=Poem, yr=2024, title=My Sonnet, quality=Good, status=Working | `"34 Current Work/bPoem - 2024 - My Sonnet"` |
| type=Story, yr=2020, title=The End, quality=Best, status=Sleeping | `"100 Stories/aaStory - 2020 - The End"` |
| type=Essay Idea, yr=2023, title=New Idea, quality=Okay, status=Gestating | `"35 Open Ideas/cEssay Idea - 2023 - New Idea"` |

**Used In:**
- Field: `Works::DocType` (validation)
- Field: `Works::generatedPath` (calculated)

**Go Implementation:**
```go
func GeneratePath(w *Work) string {
    folder := GetMainFolder(w.Type, w.Year, w.Status)
    qualityMark := GetQualityMark(w.Quality)
    sanitizedTitle := strings.ReplaceAll(w.Title, "/", "~")
    
    filename := fmt.Sprintf("%s%s - %s - %s",
        qualityMark, w.Type, w.Year, sanitizedTitle)
    
    return filepath.Join(folder, filename)
}
```

---

### 2.5 getMainFolder(type, yr, status)

**Purpose:** Determine the folder path based on work type, year, and status.

**Parameters:**
- `type` - Work type
- `yr` - Year
- `status` - Current status

**Original Definition:**
```filemaker
Case (
    Position ( type ; "Idea" ; 0 ; 1 ) > 0 ; "35 Open Ideas/" ;
    type = "Travel" ; "100 Travel/" ;
    type = "Book" ; "100 Books/" ;
    status = "Published" ; "150 Published/" ;
    status = "Focus" or status = "Active" or status = "Out" or status = "Working" ; 
        If ( yr < 2016 ; getMainType(type) & "/" ; "34 Current Work/" ) ;
    getMainType(type) & "/"
)
```

**Decision Logic:**

```
┌─────────────────────────────────────────────────┐
│ Is type an "Idea" variant?                      │
│   YES → "35 Open Ideas/"                        │
├─────────────────────────────────────────────────┤
│ Is type = "Travel"?                             │
│   YES → "100 Travel/"                           │
├─────────────────────────────────────────────────┤
│ Is type = "Book"?                               │
│   YES → "100 Books/"                            │
├─────────────────────────────────────────────────┤
│ Is status = "Published"?                        │
│   YES → "150 Published/"                        │
├─────────────────────────────────────────────────┤
│ Is status in {Focus, Active, Out, Working}?     │
│   YES → Is year < 2016?                         │
│         YES → getMainType(type) & "/"           │
│         NO → "34 Current Work/"                 │
├─────────────────────────────────────────────────┤
│ DEFAULT → getMainType(type) & "/"               │
└─────────────────────────────────────────────────┘
```

**Go Implementation:**
```go
func GetMainFolder(workType, year, status string) string {
    // Idea types go to Ideas folder
    if strings.Contains(workType, "Idea") {
        return "35 Open Ideas/"
    }
    
    // Special types
    if workType == "Travel" {
        return "100 Travel/"
    }
    if workType == "Book" {
        return "100 Books/"
    }
    
    // Published works
    if status == "Published" {
        return "150 Published/"
    }
    
    // Active work
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
    
    // Default: type-based folder
    return GetMainType(workType) + "/"
}
```

---

### 2.6 getMainType(type)

**Purpose:** Get the folder name for a work type (pluralized or special-cased).

**Parameters:**
- `type` - Work type

**Original Definition:**
```filemaker
If ( Position ( type ; "Idea" ; 0 ; 1 ) > 0 ;
    "35 Open Ideas" ;
    "100 " & 
    Case (
        type = "Travel" ; "Travel" ;
        type = "Flash" ; "Flash Fiction" ;
        type = "Micro" ; "Micro" ;
        type = "Story" ; "Stories" ;
        type = "Research" ; "Research" ;
        type & "s"
    )
)
```

**Mapping:**

| Type | Folder Name |
|------|-------------|
| *Idea variants | `"35 Open Ideas"` |
| Travel | `"100 Travel"` |
| Flash | `"100 Flash Fiction"` |
| Micro | `"100 Micro"` |
| Story | `"100 Stories"` |
| Research | `"100 Research"` |
| Poem | `"100 Poems"` |
| Essay | `"100 Essays"` |
| Article | `"100 Articles"` |
| *(other)* | `"100 " + type + "s"` |

**Go Implementation:**
```go
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
```

---

### 2.7 getQualityMark(qual)

**Purpose:** Convert quality rating to a letter prefix for filename sorting.

**Parameters:**
- `qual` - Quality rating

**Original Definition:**
```filemaker
Case (
    qual = "Best"   ; "aa" ;
    qual = "Better" ; "a" ;
    qual = "Good"   ; "b" ;
    qual = "Okay"   ; "c" ;
    qual = "Poor"   ; "d" ;
    qual = "Bad"    ; "e" ;
    qual = "Worst"  ; "f" ;
    qual = "n/a"    ; "z" ;
)
```

**Mapping:**

| Quality | Mark | Purpose |
|---------|------|---------|
| Best | `"aa"` | Sorts first (double letter) |
| Better | `"a"` | High priority |
| Good | `"b"` | Above average |
| Okay | `"c"` | Average |
| Poor | `"d"` | Below average |
| Bad | `"e"` | Low quality |
| Worst | `"f"` | Lowest quality |
| n/a | `"z"` | Unknown/unrated |
| Unknown | *(empty)* | Missing from definition |

**Note:** The value "Unknown" is in QualityList but not handled here - returns empty string.

**Go Implementation:**
```go
func GetQualityMark(quality string) string {
    marks := map[string]string{
        "Best":    "aa",
        "Better":  "a",
        "Good":    "b",
        "Okay":    "c",
        "Poor":    "d",
        "Bad":     "e",
        "Worst":   "f",
        "n/a":     "z",
        "Unknown": "z", // Added - not in original
    }
    
    if mark, ok := marks[quality]; ok {
        return mark
    }
    return "c" // Default to "Okay"
}
```

---

### 2.8 dateQuery(query, dt1, dt2)

**Purpose:** Compare two dates with a specified comparison operation.

**Parameters:**
- `query` - Comparison type: "isEarlier" or "isEqual"
- `dt1` - First date
- `dt2` - Second date

**Original Definition:**
```filemaker
If ( query = "isEarlier" ;
    If ( dt1 < dt2 ; 1 ; 0 ) ;
    If ( query = "isEqual" ;
        If ( dt1 = dt2 ; 1 ; 0 ) ;
        0
    )
)
```

**Behavior:**
| Query | Returns 1 if... |
|-------|-----------------|
| `"isEarlier"` | dt1 < dt2 |
| `"isEqual"` | dt1 = dt2 |
| *(other)* | Never (returns 0) |

**Go Implementation:**
```go
func DateQuery(query string, dt1, dt2 time.Time) int {
    switch query {
    case "isEarlier":
        if dt1.Before(dt2) {
            return 1
        }
    case "isEqual":
        if dt1.Equal(dt2) {
            return 1
        }
    }
    return 0
}
```

---

## 3. Dependency Graph

```
generatePath
├── getMainFolder
│   └── getMainType
└── getQualityMark

getFilename
└── (standalone - uses hardcoded base path)

fileExists
└── (MISSING EXTERNAL PLUGIN)

getDateStr
└── (standalone)

dateQuery
└── (standalone)
```

---

## 4. External Plugin Dependencies

The original FileMaker database relied on an external plugin that is **no longer available**. The following functions were provided by this plugin:

| Plugin Function | Used In | Purpose |
|-----------------|---------|---------|
| `fileExists(path)` | fileExists custom function, AddWork script, moveFile script | Check if file exists |
| `copyFile(src, dst)` | AddWork script, copyFile script | Copy file on disk |
| `moveFile(src, dst)` | moveFile script | Rename/move file |
| `touchFile(path)` | AddWork script | Update file timestamp |
| `printFile(path)` | printFile script | Send file to printer |
| `extractTitle(path)` | moveFile script | Extract title from filename |

### 4.1 Go Replacements

All plugin functions can be replaced with standard Go library calls:

```go
package fileops

import (
    "io"
    "os"
    "path/filepath"
    "strings"
    "time"
)

// FileExists checks if a file exists
func FileExists(path string) bool {
    _, err := os.Stat(path)
    return err == nil
}

// CopyFile copies a file from src to dst
func CopyFile(src, dst string) error {
    // Ensure destination directory exists
    if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
        return err
    }
    
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

// MoveFile moves/renames a file
func MoveFile(src, dst string) error {
    // Ensure destination directory exists
    if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
        return err
    }
    return os.Rename(src, dst)
}

// TouchFile updates the modification time of a file
func TouchFile(path string) error {
    now := time.Now()
    return os.Chtimes(path, now, now)
}

// PrintFile sends a file to the default printer (macOS)
func PrintFile(path string) error {
    cmd := exec.Command("lpr", path)
    return cmd.Run()
}

// ExtractTitle extracts the title from a work filename
// Format: "{quality}{type} - {year} - {title}"
func ExtractTitle(path string) string {
    base := filepath.Base(path)
    
    // Remove extension
    ext := filepath.Ext(base)
    name := strings.TrimSuffix(base, ext)
    
    // Split by " - "
    parts := strings.Split(name, " - ")
    if len(parts) >= 3 {
        return parts[2] // Title is the third part
    }
    
    return name
}
```

---

## 5. Go Implementation

### 5.1 Complete Package

```go
package pathgen

import (
    "fmt"
    "path/filepath"
    "strconv"
    "strings"
    "time"
)

// BaseFolder is the root directory for all work files
const BaseFolder = "/Users/jrush/Documents/Home/"

// Work represents the fields needed for path generation
type Work struct {
    Type    string
    Year    string
    Title   string
    Quality string
    Status  string
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

// GetFilename builds full path from partial path
func GetFilename(partialPath string) string {
    return filepath.Join(BaseFolder, partialPath)
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

// GetDateStr formats a date as YYYY_MM_DD
func GetDateStr(dt time.Time) string {
    if dt.IsZero() {
        return ""
    }
    return dt.Format("2006_01_02 ")
}

// DateQuery compares two dates
func DateQuery(query string, dt1, dt2 time.Time) bool {
    switch query {
    case "isEarlier":
        return dt1.Before(dt2)
    case "isEqual":
        return dt1.Equal(dt2)
    }
    return false
}
```

### 5.2 Unit Tests

```go
package pathgen

import (
    "testing"
)

func TestGeneratePath(t *testing.T) {
    tests := []struct {
        name     string
        work     Work
        expected string
    }{
        {
            name: "Active poem",
            work: Work{
                Type: "Poem", Year: "2024", Title: "My Sonnet",
                Quality: "Good", Status: "Working",
            },
            expected: "34 Current Work/bPoem - 2024 - My Sonnet",
        },
        {
            name: "Old inactive story",
            work: Work{
                Type: "Story", Year: "2020", Title: "The End",
                Quality: "Best", Status: "Sleeping",
            },
            expected: "100 Stories/aaStory - 2020 - The End",
        },
        {
            name: "Idea",
            work: Work{
                Type: "Essay Idea", Year: "2023", Title: "New Concept",
                Quality: "Okay", Status: "Gestating",
            },
            expected: "35 Open Ideas/cEssay Idea - 2023 - New Concept",
        },
        {
            name: "Published",
            work: Work{
                Type: "Poem", Year: "2022", Title: "Winner",
                Quality: "Best", Status: "Published",
            },
            expected: "150 Published/aaPoem - 2022 - Winner",
        },
        {
            name: "Title with slash",
            work: Work{
                Type: "Essay", Year: "2024", Title: "Before/After",
                Quality: "Good", Status: "Active",
            },
            expected: "34 Current Work/bEssay - 2024 - Before~After",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := GeneratePath(&tt.work)
            if result != tt.expected {
                t.Errorf("GeneratePath() = %q, want %q", result, tt.expected)
            }
        })
    }
}

func TestGetQualityMark(t *testing.T) {
    tests := []struct {
        quality  string
        expected string
    }{
        {"Best", "aa"},
        {"Better", "a"},
        {"Good", "b"},
        {"Okay", "c"},
        {"Bad", "e"},
        {"Unknown", "z"},
        {"Invalid", "c"}, // Default
    }
    
    for _, tt := range tests {
        t.Run(tt.quality, func(t *testing.T) {
            result := GetQualityMark(tt.quality)
            if result != tt.expected {
                t.Errorf("GetQualityMark(%q) = %q, want %q", 
                    tt.quality, result, tt.expected)
            }
        })
    }
}

func TestGetMainFolder(t *testing.T) {
    tests := []struct {
        name     string
        workType string
        year     string
        status   string
        expected string
    }{
        {"Idea type", "Poem Idea", "2024", "Gestating", "35 Open Ideas/"},
        {"Travel", "Travel", "2024", "Active", "100 Travel/"},
        {"Book", "Book", "2024", "Active", "100 Books/"},
        {"Published", "Poem", "2024", "Published", "150 Published/"},
        {"Active recent", "Poem", "2024", "Working", "34 Current Work/"},
        {"Active old", "Poem", "2015", "Working", "100 Poems/"},
        {"Inactive", "Poem", "2024", "Sleeping", "100 Poems/"},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := GetMainFolder(tt.workType, tt.year, tt.status)
            if result != tt.expected {
                t.Errorf("GetMainFolder(%q, %q, %q) = %q, want %q",
                    tt.workType, tt.year, tt.status, result, tt.expected)
            }
        })
    }
}
```

---

## 6. TypeScript Utilities

These TypeScript utilities mirror the Go functions for client-side use when needed.

### 6.1 Path Generation (Display Only)

```typescript
// src/utils/paths.ts
import { Work } from '@/types/models';
import { Quality } from '@/types/enums';
import { QUALITY_MARKS } from '@/types/constants';

const ACTIVE_STATUSES = ['Focus', 'Active', 'Out', 'Working'];

export function getQualityMark(quality: Quality): string {
  return QUALITY_MARKS[quality] ?? 'c';
}

export function getMainType(type: string): string {
  const typeMap: Record<string, string> = {
    'Poem': '100 Poems',
    'Story': '100 Stories',
    'Essay': '100 Essays',
    'Flash': '100 Flash Fiction',
    'Micro': '100 Micro',
    'Article': '100 Articles',
    'Book': '100 Books',
    'Travel': '100 Travel',
    'Research': '100 Research',
  };
  
  // Handle ideas - extract base type
  const baseType = type.replace(' Idea', '');
  return typeMap[baseType] ?? `100 ${baseType}s`;
}

export function getMainFolder(type: string, year: string, status: string): string {
  if (type.includes('Idea')) {
    return '35 Open Ideas/';
  }
  if (type === 'Travel') {
    return '100 Travel/';
  }
  if (type === 'Book') {
    return '100 Books/';
  }
  if (status === 'Published') {
    return '150 Published/';
  }
  const yearNum = parseInt(year, 10);
  if (ACTIVE_STATUSES.includes(status) && yearNum >= 2016) {
    return '34 Current Work/';
  }
  return `${getMainType(type)}/`;
}

export function generatePath(work: Pick<Work, 'type' | 'year' | 'title' | 'quality' | 'status'>): string {
  const folder = getMainFolder(work.type, work.year, work.status);
  const mark = getQualityMark(work.quality as Quality);
  const sanitizedTitle = work.title.replace(/\//g, '~');
  return `${folder}${mark}${work.type} - ${work.year} - ${sanitizedTitle}`;
}

export function getFullPath(partialPath: string): string {
  const BASE_FOLDER = '/Users/jrush/Documents/Home/';
  return `${BASE_FOLDER}${partialPath}`;
}
```

### 6.2 Date Utilities

```typescript
// src/utils/dates.ts

export function getDateStr(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day} `;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

### 6.3 Validation Utilities

```typescript
// src/utils/validation.ts
import { Work } from '@/types/models';

export interface CheckResult {
  status: 'ok' | 'name_changed' | 'file_missing' | 'paths_disagree';
  message: string;
}

// Note: Actual file existence checking is done via Wails backend
// This is just for display purposes based on data returned from Go
export function interpretCheck(checkValue: string): CheckResult {
  switch (checkValue) {
    case '':
      return { status: 'ok', message: 'File path is valid' };
    case 'name changed':
      return { status: 'name_changed', message: 'File exists but name has changed' };
    case 'file missing':
      return { status: 'file_missing', message: 'File not found on disk' };
    case 'paths disagree':
      return { status: 'paths_disagree', message: 'Generated path differs from stored path' };
    default:
      return { status: 'ok', message: '' };
  }
}

export function getCheckBadgeClass(checkValue: string): string {
  switch (checkValue) {
    case '':
      return 'bg-green-100 text-green-800';
    case 'name changed':
      return 'bg-yellow-100 text-yellow-800';
    case 'file missing':
      return 'bg-red-100 text-red-800';
    case 'paths disagree':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
```

### 6.4 React Hooks for File Operations

```typescript
// src/hooks/useFileOperations.ts
import { useCallback } from 'react';
import {
  FileExists,
  OpenDocument,
  MoveFile,
  CopyToSubmissions,
  PrintFile,
} from '../../wailsjs/go/main/App';
import { Work } from '@/types/models';

export function useFileOperations() {
  const checkFileExists = useCallback(async (path: string): Promise<boolean> => {
    return await FileExists(path);
  }, []);
  
  const openDocument = useCallback(async (work: Work): Promise<void> => {
    await OpenDocument(work.workID);
  }, []);
  
  const moveFile = useCallback(async (work: Work): Promise<string> => {
    // Returns the new path after moving
    return await MoveFile(work.workID);
  }, []);
  
  const copyToSubmissions = useCallback(async (work: Work): Promise<void> => {
    await CopyToSubmissions(work.workID);
  }, []);
  
  const printDocument = useCallback(async (work: Work): Promise<void> => {
    await PrintFile(work.workID);
  }, []);
  
  return {
    checkFileExists,
    openDocument,
    moveFile,
    copyToSubmissions,
    printDocument,
  };
}
```

---

*End of Custom Functions Specification*
