# Full-Text Search: Technical Specification

> **Document:** fts-specification.md  
> **Parent:** [specification.md](specification.md)  
> **Related:** [fts-use-cases.md](fts-use-cases.md)  
> **Status:** Implemented  
> **Version:** 1.0  
> **Implemented:** January 13, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Text Extraction](#4-text-extraction)
5. [Index Management](#5-index-management)
6. [Query Interface](#6-query-interface)
7. [User Interface](#7-user-interface)
8. [AI Integration](#8-ai-integration)
9. [Wails Bindings](#9-wails-bindings)
10. [Error Handling](#10-error-handling)
11. [Performance Requirements](#11-performance-requirements)
12. [Testing Strategy](#12-testing-strategy)
13. [Migration & Rollout](#13-migration--rollout)
14. [Future Considerations](#14-future-considerations)

---

## 1. Overview

### 1.1 Purpose

Enable full-text search of creative work content, primarily to support AI-assisted corpus analysis. The feature transforms the work archive from a static collection into a queryable database of the writer's creative output.

### 1.2 Goals

| Goal | Description |
|------|-------------|
| **Searchable Content** | Query the actual text of works, not just metadata |
| **Separate Storage** | FTS index in dedicated database, not main `works.db` |
| **Opt-In** | Users who don't need FTS pay no storage/performance cost |
| **AI-Ready** | Expose search capabilities to AI agents for corpus analysis |
| **Maintainable** | Detect stale content, support incremental updates |
| **Rebuildable** | Index can be deleted and regenerated from source files |

### 1.3 Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Real-time indexing | Write-once documents don't need sub-second sync |
| Fuzzy/phonetic matching | Standard FTS5 tokenization is sufficient |
| Semantic search (embeddings) | Out of scope for v1; possible future enhancement |
| Cross-device sync | Local-only application |

### 1.4 Scale Parameters

| Metric | Expected Value | Design Ceiling |
|--------|---------------|----------------|
| Total works | ~2,000 | 10,000 |
| Extracted text | ~50 MB | 500 MB |
| FTS index size | ~150 MB | 1 GB |
| Largest single document | ~100 KB text | 1 MB text |

---

## 2. Architecture

### 2.1 Database Separation

```
~/.works/
├── works.db          # Main application database
│                     # - Works, Collections, Submissions, Notes
│                     # - Backed up regularly
│                     # - Never contains document content
│
└── fulltext.db       # Full-text search database (optional)
                      # - Extracted document text
                      # - FTS5 virtual tables
                      # - Can be deleted and rebuilt
                      # - Only opened when FTS features accessed
```

### 2.2 Lazy Loading

The `fulltext.db` is **not opened at application startup**. It is opened only when:

1. User enters "Full-Text Search" mode
2. User triggers "Build Index" / "Update Index"
3. AI agent makes an FTS query

This ensures zero performance impact for users who don't use FTS.

### 2.3 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Wails Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   works.db   │    │ fulltext.db  │    │ Source Files │      │
│  │              │    │              │    │              │      │
│  │ - Works      │    │ - content    │    │ ~/Documents/ │      │
│  │ - Metadata   │◄───│ - fts_index  │◄───│   Home/      │      │
│  │ - file_mtime │    │ - extracted  │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FTS Manager (Go)                       │  │
│  │                                                           │  │
│  │  - OpenFTSDatabase()      - ExtractText(path)            │  │
│  │  - BuildIndex()           - CheckStaleness()             │  │
│  │  - Search(query)          - UpdateDocument(workID)       │  │
│  │  - GetContext(workID)     - RebuildIndex()               │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Wails Bindings                         │  │
│  │                                                           │  │
│  │  - FTSSearch(query, filters)                             │  │
│  │  - FTSBuildIndex()                                       │  │
│  │  - FTSGetStatus()                                        │  │
│  │  - FTSGetDocumentContent(workID)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Frontend / AI                          │  │
│  │                                                           │  │
│  │  - Cmd+K Search Modal (FTS toggle)                       │  │
│  │  - Index Management UI                                   │  │
│  │  - AI Agent Queries                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 fulltext.db Tables

```sql
-- Metadata about the FTS database itself
CREATE TABLE fts_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Example meta entries:
-- ('version', '1')
-- ('created_at', '2026-01-13T10:00:00Z')
-- ('last_full_build', '2026-01-13T10:00:00Z')
-- ('document_count', '1993')
-- ('total_words', '287432')

-- Extracted content storage
CREATE TABLE content (
    work_id INTEGER PRIMARY KEY,
    text_content TEXT NOT NULL,
    word_count INTEGER,
    extracted_at TEXT NOT NULL,
    source_mtime INTEGER NOT NULL,  -- file mtime at extraction
    source_size INTEGER,            -- file size at extraction
    source_hash TEXT                -- optional SHA256 for verification
);

-- FTS5 virtual table (external content mode)
CREATE VIRTUAL TABLE content_fts USING fts5(
    text_content,
    content='content',
    content_rowid='work_id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync with content table
CREATE TRIGGER content_ai AFTER INSERT ON content BEGIN
    INSERT INTO content_fts(rowid, text_content) 
    VALUES (NEW.work_id, NEW.text_content);
END;

CREATE TRIGGER content_ad AFTER DELETE ON content BEGIN
    INSERT INTO content_fts(content_fts, rowid, text_content) 
    VALUES ('delete', OLD.work_id, OLD.text_content);
END;

CREATE TRIGGER content_au AFTER UPDATE ON content BEGIN
    INSERT INTO content_fts(content_fts, rowid, text_content) 
    VALUES ('delete', OLD.work_id, OLD.text_content);
    INSERT INTO content_fts(rowid, text_content) 
    VALUES (NEW.work_id, NEW.text_content);
END;
```

### 3.2 Tokenizer Choice

| Tokenizer | Description | Use Case |
|-----------|-------------|----------|
| `unicode61` | Unicode-aware word boundaries | International text support |
| `porter` | Stemming (running → run) | English morphological matching |
| Combined | `tokenize='porter unicode61'` | **Recommended**: both benefits |

### 3.3 No Changes to works.db

The main database requires **no schema changes** for FTS. We use:

- `workID` — join key to content table
- `file_mtime` — staleness detection (already exists)
- Metadata fields — for filtering search results

---

## 4. Text Extraction

### 4.1 Supported Formats

| Format | Extension | Extraction Method | Priority |
|--------|-----------|-------------------|----------|
| Word Document | `.docx` | Parse `document.xml` from zip | P0 |
| Markdown | `.md` | Direct read (already plain text) | P0 |
| Plain Text | `.txt` | Direct read | P0 |
| Excel | `.xlsx` | Parse `sharedStrings.xml` + sheets | P1 |
| PDF | `.pdf` | LibreOffice conversion or `pdftotext` | P2 |

### 4.2 DOCX Extraction

DOCX files are ZIP archives containing XML. The text content is in `word/document.xml`.

```go
// Pseudocode for docx extraction
func ExtractDocx(path string) (string, error) {
    // 1. Open as zip
    reader, err := zip.OpenReader(path)
    
    // 2. Find word/document.xml
    for _, file := range reader.File {
        if file.Name == "word/document.xml" {
            // 3. Parse XML
            // 4. Extract text from <w:t> elements
            // 5. Preserve paragraph breaks as \n\n
        }
    }
    
    // 6. Return cleaned text
}
```

**Go Libraries**:
- `github.com/nguyenthenguyen/docx` — simple docx reader
- Native `archive/zip` + `encoding/xml` — no dependencies

### 4.3 Markdown Handling

Markdown is already plain text. Options:

| Approach | Pros | Cons |
|----------|------|------|
| Store raw markdown | Simple, preserves structure | Search matches `#`, `*`, etc. |
| Strip markdown syntax | Cleaner matches | Loses structure info |
| **Recommended**: Store raw | Simplicity wins; markdown syntax rarely interferes |

### 4.4 Excel Extraction

For `.xlsx` files (spreadsheet works, outlines):

```go
// Extract all cell values from all sheets
func ExtractXlsx(path string) (string, error) {
    // 1. Open as zip
    // 2. Parse sharedStrings.xml for string table
    // 3. Parse each sheet*.xml
    // 4. Concatenate cell values with spaces
}
```

**Go Library**: `github.com/tealeg/xlsx` (pure Go)

### 4.5 Extraction Pipeline

```go
type ExtractionResult struct {
    WorkID     int
    Text       string
    WordCount  int
    ExtractedAt time.Time
    SourceMtime int64
    SourceSize  int64
    Error      error
}

func ExtractWork(work Work, basePath string) ExtractionResult {
    fullPath := filepath.Join(basePath, work.Path)
    
    // Check file exists
    info, err := os.Stat(fullPath)
    if err != nil {
        return ExtractionResult{WorkID: work.WorkID, Error: err}
    }
    
    // Extract based on extension
    var text string
    switch work.DocType {
    case "docx":
        text, err = ExtractDocx(fullPath)
    case "md":
        text, err = ExtractMarkdown(fullPath)
    case "txt":
        text, err = ExtractPlainText(fullPath)
    case "xlsx":
        text, err = ExtractXlsx(fullPath)
    default:
        err = fmt.Errorf("unsupported doc type: %s", work.DocType)
    }
    
    return ExtractionResult{
        WorkID:      work.WorkID,
        Text:        text,
        WordCount:   countWords(text),
        ExtractedAt: time.Now(),
        SourceMtime: info.ModTime().Unix(),
        SourceSize:  info.Size(),
        Error:       err,
    }
}
```

---

## 5. Index Management

### 5.1 Index States

| State | Description | User Action |
|-------|-------------|-------------|
| **Not Built** | `fulltext.db` doesn't exist | "Build Index" button |
| **Current** | All documents indexed, none stale | Search available |
| **Stale** | Some documents newer than index | "Update Index" button |
| **Building** | Index operation in progress | Progress indicator |
| **Error** | Build failed | Error message + retry |

### 5.2 Staleness Detection

On entering FTS mode, check all works for staleness:

```go
type StalenessReport struct {
    TotalWorks     int
    IndexedWorks   int
    StaleWorks     int      // source_mtime > extracted mtime
    MissingWorks   int      // in works.db but not in content
    OrphanedWorks  int      // in content but not in works.db
    StaleWorkIDs   []int
    MissingWorkIDs []int
}

func CheckStaleness() StalenessReport {
    // 1. Query works.db for all works with file_mtime
    // 2. Query fulltext.db content table
    // 3. Compare mtimes
    // 4. Return report
}
```

### 5.3 Build Strategies

| Strategy | When | Description |
|----------|------|-------------|
| **Full Build** | First time, or "Rebuild" | Extract all documents |
| **Incremental** | Normal update | Only extract stale/missing |
| **Single Document** | After file edit | Update one document |

### 5.4 Build Process

```go
func BuildIndex(mode string) error {
    // 1. Open or create fulltext.db
    // 2. Create schema if needed
    // 3. Get list of works from works.db
    
    switch mode {
    case "full":
        // Clear content table
        // Extract all works
    case "incremental":
        // Check staleness
        // Extract only stale/missing
    }
    
    // 4. For each work:
    //    a. Extract text
    //    b. Insert/update content table (triggers update FTS)
    //    c. Report progress
    
    // 5. Update fts_meta with stats
    // 6. Run VACUUM on fulltext.db
}
```

### 5.5 Progress Reporting

During index builds, emit progress events:

```go
type IndexProgress struct {
    Phase       string  // "extracting", "indexing", "optimizing"
    Current     int
    Total       int
    CurrentFile string
    Errors      []string
}
```

Frontend displays:
- Progress bar
- Current file name
- Error count (expandable)
- Estimated time remaining

---

## 6. Query Interface

### 6.1 FTS5 Query Syntax

Users can use standard FTS5 query syntax:

| Query | Meaning |
|-------|---------|
| `morning light` | Both words, any order |
| `"morning light"` | Exact phrase |
| `morning OR evening` | Either word |
| `morning NOT mourning` | Exclude term |
| `morn*` | Prefix match |
| `NEAR(morning light, 5)` | Within 5 words |

### 6.2 Search Function

```go
type FTSResult struct {
    WorkID    int
    Title     string
    Type      string
    Year      string
    Status    string
    Snippet   string    // Context around match
    Rank      float64   // BM25 relevance score
}

type FTSQuery struct {
    Query      string            // FTS5 query string
    Filters    map[string]string // Metadata filters (type, year, status)
    Limit      int               // Max results (default 50)
    Offset     int               // For pagination
    SnippetLen int               // Context length (default 64 tokens)
}

func Search(q FTSQuery) ([]FTSResult, error) {
    // Build SQL:
    // SELECT w.workID, w.title, w.type, w.year, w.status,
    //        snippet(content_fts, 0, '<b>', '</b>', '...', 64) as snippet,
    //        bm25(content_fts) as rank
    // FROM content_fts f
    // JOIN main.Works w ON f.rowid = w.workID
    // WHERE content_fts MATCH ?
    // AND w.type = ? (if filtered)
    // ORDER BY rank
    // LIMIT ? OFFSET ?
}
```

### 6.3 Snippet Extraction

FTS5's `snippet()` function extracts context around matches:

```sql
snippet(content_fts, 
        0,              -- column index
        '<mark>',       -- start highlight
        '</mark>',      -- end highlight  
        '...',          -- ellipsis
        64)             -- max tokens
```

### 6.4 Full Content Retrieval

For AI analysis, retrieve complete document content:

```go
func GetDocumentContent(workID int) (string, error) {
    // SELECT text_content FROM content WHERE work_id = ?
}

func GetDocumentsContent(workIDs []int) (map[int]string, error) {
    // Batch retrieval for AI analysis
}
```

---

## 7. User Interface

### 7.1 Entry Points

| Location | Trigger | Behavior |
|----------|---------|----------|
| Cmd+K Modal | Toggle "Search Content" | Switch between metadata/FTS |
| Menu | Tools → Full-Text Search | Open dedicated FTS panel |
| Settings | FTS Settings | Index management |

### 7.2 Cmd+K Integration

The existing Cmd+K search modal gains a toggle:

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search...                                         [⌘K] │
├─────────────────────────────────────────────────────────────┤
│  ○ Metadata    ● Content                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "morning light"                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 The River at Dawn (Poem, 2012)                   │   │
│  │    ...the <mark>morning light</mark> falling on...  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 📄 What Water Knows (Essay, 2015)                   │   │
│  │    ...I remember the <mark>morning light</mark>...  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 📄 Elegy for My Father (Poem, 2018)                 │   │
│  │    ...each <mark>morning</mark>, that same <mark>   │   │
│  │    light</mark> through the kitchen...              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  12 results (0.003s)                      [Filters ▼]       │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Filter Panel

Expandable filters for content search:

```
┌─────────────────────────────────────────────────────────────┐
│ Filters                                              [Hide] │
├─────────────────────────────────────────────────────────────┤
│ Type:   [All ▼]  Status: [All ▼]  Year: [All ▼]           │
│                                                             │
│ ☑ Include Dead/Sleeping works                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Index Status Indicator

When FTS is not available or stale:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Content search unavailable                              │
│                                                             │
│  Full-text index needs to be built.                        │
│                                                             │
│  [Build Index]                                              │
│                                                             │
│  This will extract text from 1,993 documents.              │
│  Estimated time: 30-60 seconds.                            │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Index out of date                                       │
│                                                             │
│  47 documents have changed since last index.               │
│                                                             │
│  [Update Index]  [Search Anyway]                           │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Build Progress UI

```
┌─────────────────────────────────────────────────────────────┐
│  Building full-text index...                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████████████████████░░░░░░░░░░  847 / 1993                │
│                                                             │
│  Extracting: 100 Poems/aPoem - 2015 - November Fugue.docx  │
│                                                             │
│  Elapsed: 0:23    Remaining: ~0:32                         │
│                                                             │
│  Errors: 3 (view details)                                  │
│                                                             │
│                                           [Cancel]          │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 Settings Panel

In application settings, FTS section:

```
┌─────────────────────────────────────────────────────────────┐
│  Full-Text Search                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Index Status: ✓ Current (1,993 documents)                 │
│  Index Size: 147.3 MB                                       │
│  Last Updated: January 13, 2026 10:42 AM                   │
│                                                             │
│  [Update Index]  [Rebuild Index]  [Delete Index]           │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  ☐ Auto-update index on app launch                         │
│  ☑ Include Dead/Sleeping works in index                    │
│  ☐ Include file contents in AI context                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. AI Integration

### 8.1 Design Philosophy

The AI should be able to:

1. **Search** the corpus for specific terms/phrases
2. **Retrieve** full content of specific works
3. **Batch query** for thematic analysis
4. **Filter** by metadata when searching

### 8.2 MCP Server Approach

Expose FTS as an MCP (Model Context Protocol) tool:

```json
{
  "name": "search_works_content",
  "description": "Search the full text content of creative works",
  "parameters": {
    "query": {
      "type": "string",
      "description": "FTS5 search query (supports phrases, OR, NOT, wildcards)"
    },
    "filters": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "year": { "type": "string" },
        "status": { "type": "string" }
      }
    },
    "limit": {
      "type": "integer",
      "default": 20
    },
    "include_content": {
      "type": "boolean",
      "default": false,
      "description": "If true, return full document text, not just snippets"
    }
  }
}
```

### 8.3 AI-Specific Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `FTSSearch` | Standard search | Snippets + metadata |
| `FTSGetContent` | Full document | Complete text |
| `FTSBatchContent` | Multiple documents | Map of workID → text |
| `FTSGetStats` | Corpus statistics | Word counts, type distribution |
| `FTSTermFrequency` | Word frequency | Most common terms |

### 8.4 Context Window Management

AI models have token limits. For corpus analysis:

```go
type ContentRequest struct {
    WorkIDs     []int
    MaxTokens   int    // Approximate token budget
    Priority    string // "full", "truncate", "summarize"
}

func GetContentWithinBudget(req ContentRequest) (map[int]string, error) {
    // 1. Retrieve requested documents
    // 2. Estimate tokens (words × 1.3)
    // 3. If over budget:
    //    - "truncate": Return first N chars
    //    - "summarize": Return excerpts
    //    - "full": Return error with count
}
```

### 8.5 Example AI Interactions

**Thematic Search**:
```
AI calls: FTSSearch(query="father OR dad OR papa", limit=50)
Returns: List of 47 works with snippets
AI synthesizes: "You have 47 works mentioning father figures..."
```

**Deep Analysis**:
```
AI calls: FTSBatchContent(workIDs=[123, 456, 789])
Returns: Full text of 3 selected works
AI analyzes: Voice, imagery, theme comparison
```

**Corpus Statistics**:
```
AI calls: FTSTermFrequency(topN=100)
Returns: [(water, 234), (hand, 189), (light, 167), ...]
AI interprets: "Your most frequent image words are..."
```

---

## 9. Wails Bindings

### 9.1 Binding Summary

| Binding | Parameters | Returns |
|---------|------------|---------|
| `FTSGetStatus` | none | `FTSStatus` |
| `FTSBuildIndex` | `mode: string` | `Result[IndexReport]` |
| `FTSSearch` | `FTSQuery` | `Result[[]FTSResult]` |
| `FTSGetContent` | `workID: int` | `Result[string]` |
| `FTSBatchContent` | `workIDs: []int` | `Result[map[int]string]` |
| `FTSDeleteIndex` | none | `Result[bool]` |
| `FTSCancelBuild` | none | `Result[bool]` |

### 9.2 Type Definitions

```go
// FTS database status
type FTSStatus struct {
    Available     bool      // fulltext.db exists and is valid
    DocumentCount int       // Number of indexed documents
    StaleCount    int       // Documents needing re-index
    MissingCount  int       // Documents not yet indexed
    IndexSize     int64     // fulltext.db file size in bytes
    LastUpdated   time.Time // Last successful index update
    TotalWords    int       // Total word count in corpus
}

// Search query parameters
type FTSQuery struct {
    Query         string            `json:"query"`
    Filters       map[string]string `json:"filters"`
    Limit         int               `json:"limit"`
    Offset        int               `json:"offset"`
    IncludeContent bool             `json:"includeContent"`
}

// Individual search result
type FTSResult struct {
    WorkID   int     `json:"workId"`
    Title    string  `json:"title"`
    Type     string  `json:"type"`
    Year     string  `json:"year"`
    Status   string  `json:"status"`
    Snippet  string  `json:"snippet"`
    Rank     float64 `json:"rank"`
    Content  string  `json:"content,omitempty"`
}

// Index build report
type IndexReport struct {
    Success       bool     `json:"success"`
    DocumentCount int      `json:"documentCount"`
    WordCount     int      `json:"wordCount"`
    Duration      float64  `json:"duration"` // seconds
    Errors        []string `json:"errors"`
}
```

### 9.3 Progress Events

Index building emits runtime events:

```go
// Emit progress during build
runtime.EventsEmit(ctx, "fts:progress", IndexProgress{
    Phase:       "extracting",
    Current:     847,
    Total:       1993,
    CurrentFile: "100 Poems/aPoem - 2015 - November Fugue.docx",
})

// Emit completion
runtime.EventsEmit(ctx, "fts:complete", IndexReport{...})

// Emit error
runtime.EventsEmit(ctx, "fts:error", "Failed to extract: file not found")
```

Frontend subscribes:
```typescript
runtime.EventsOn("fts:progress", (progress: IndexProgress) => {
    setProgress(progress);
});
```

---

## 10. Error Handling

### 10.1 Extraction Errors

| Error | Handling | User Message |
|-------|----------|--------------|
| File not found | Skip, log, continue | "3 files not found (see details)" |
| Corrupt docx | Skip, log, continue | "2 files could not be read" |
| Unsupported format | Skip, log | "5 files skipped (unsupported format)" |
| Permission denied | Skip, log | "1 file not readable" |

**Principle**: Never abort the entire build for individual file failures.

### 10.2 Database Errors

| Error | Handling | User Message |
|-------|----------|--------------|
| fulltext.db locked | Retry with backoff | "Database busy, retrying..." |
| Disk full | Abort, clean up | "Not enough disk space for index" |
| Corruption detected | Offer rebuild | "Index corrupted. Rebuild?" |

### 10.3 Query Errors

| Error | Handling | User Message |
|-------|----------|--------------|
| Invalid FTS syntax | Return helpful error | "Invalid search: unbalanced quotes" |
| No results | Empty result set | "No matches found" |
| Index not available | Prompt to build | "Content search requires index" |

---

## 11. Performance Requirements

### 11.1 Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Full index build (2000 docs) | 30 seconds | 60 seconds |
| Incremental update (50 docs) | 3 seconds | 10 seconds |
| Search query | 10 ms | 50 ms |
| Open fulltext.db | 50 ms | 200 ms |
| Staleness check (2000 docs) | 100 ms | 500 ms |

### 11.2 Memory

| Operation | Target Memory |
|-----------|--------------|
| Index build | < 100 MB peak |
| Search | < 50 MB |
| Idle (FTS not in use) | 0 MB (not loaded) |

### 11.3 Optimization Strategies

1. **Batch inserts**: Use transactions for bulk content insertion
2. **Prepared statements**: Reuse query plans
3. **ATTACH vs. open**: Keep fulltext.db attached, not separate connection
4. **FTS5 automerge**: Let SQLite optimize index structure
5. **WAL mode**: Enable for concurrent read during builds

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Component | Tests |
|-----------|-------|
| Docx extraction | Known file → expected text |
| Markdown extraction | Raw file → text |
| FTS query building | Query struct → SQL |
| Staleness detection | Mtime comparison logic |

### 12.2 Integration Tests

| Scenario | Verification |
|----------|-------------|
| Full build | Creates valid fulltext.db, all docs indexed |
| Incremental | Only stale docs re-extracted |
| Search | Returns expected results with ranking |
| Concurrent access | Search during build doesn't crash |
| Rebuild | Old index replaced cleanly |

### 12.3 Performance Tests

| Test | Assertion |
|------|-----------|
| Build 2000 docs | < 60 seconds |
| Search 1000x | < 10ms average |
| Memory during build | < 100 MB |

### 12.4 Test Data

Create fixtures:
- 10 sample docx files (various sizes)
- 5 markdown files
- 2 xlsx files
- 1 corrupt file (for error handling)

---

## 13. Migration & Rollout

### 13.1 Phase 1: Infrastructure

- [ ] Create `internal/fts/` package
- [ ] Implement `fulltext.db` schema creation
- [ ] Implement docx text extraction
- [ ] Implement markdown extraction
- [ ] Implement index build (full)
- [ ] Implement staleness detection
- [ ] Add basic Wails bindings

### 13.2 Phase 2: User Interface

- [ ] Add FTS toggle to Cmd+K modal
- [ ] Implement search results display
- [ ] Add "Build Index" UI
- [ ] Add progress indicator
- [ ] Add Settings panel section

### 13.3 Phase 3: AI Integration

- [ ] Add batch content retrieval
- [ ] Add term frequency endpoint
- [ ] Expose via MCP server (if applicable)
- [ ] Document AI query patterns

### 13.4 Rollout

1. **Alpha**: Developer testing with real corpus
2. **Beta**: Enable for power users with setting
3. **GA**: Available to all, opt-in indexing

---

## 14. Future Considerations

### 14.1 Semantic Search (Embeddings)

FTS5 is keyword-based. Future enhancement could add:
- Vector embeddings for semantic similarity
- "Find pieces similar to this one"
- Cluster by meaning, not just words

Would require:
- Embedding model (local or API)
- Vector storage (sqlite-vec or separate)
- Significant complexity increase

### 14.2 OCR for Scanned Documents

Some older works may be scanned images or image-based PDFs:
- Integrate Tesseract OCR
- Store OCR'd text in content table
- Flag as "ocr_extracted" for quality awareness

### 14.3 Version History

Track text changes over time:
- Store previous versions of extracted text
- Enable "how has this piece evolved" queries
- Significant storage increase

### 14.4 Cross-Reference Detection

Detect self-references across works:
- Find shared phrases
- Identify allusions
- Build intertextuality graph

---

## Appendix A: File Layout

```
internal/
└── fts/
    ├── doc.go           # Package documentation
    ├── database.go      # fulltext.db management
    ├── extract.go       # Text extraction (docx, md, etc.)
    ├── extract_test.go  # Extraction tests
    ├── index.go         # Build, update, rebuild
    ├── search.go        # Query execution
    ├── search_test.go   # Search tests
    └── types.go         # Shared type definitions
```

## Appendix B: SQL Reference

```sql
-- Check index status
SELECT key, value FROM fts_meta;

-- Search with snippet
SELECT w.workID, w.title, 
       snippet(content_fts, 0, '<mark>', '</mark>', '...', 64) as snippet,
       bm25(content_fts) as rank
FROM content_fts f
JOIN Works w ON f.rowid = w.workID
WHERE content_fts MATCH 'morning light'
ORDER BY rank
LIMIT 20;

-- Get stale documents
SELECT w.workID, w.title, w.file_mtime, c.source_mtime
FROM Works w
LEFT JOIN fulltext.content c ON w.workID = c.work_id
WHERE c.work_id IS NULL 
   OR w.file_mtime > c.source_mtime;

-- Term frequency
SELECT term, COUNT(*) as freq
FROM content_fts_vocab
WHERE col = 'text_content'
GROUP BY term
ORDER BY freq DESC
LIMIT 100;

-- Rebuild FTS index
INSERT INTO content_fts(content_fts) VALUES('rebuild');
```

---

*Document created: January 13, 2026*
