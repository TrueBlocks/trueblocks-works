# Collection Text Extraction

> **Document:** collection-text-extraction.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Flow](#2-data-flow)
3. [SQL Queries](#3-sql-queries)
4. [Existing Components](#4-existing-components)
5. [Implementation Steps](#5-implementation-steps)
6. [Error Handling](#6-error-handling)
7. [Output Formats](#7-output-formats)

---

## 1. Overview

This document describes how to read the entire textual contents of all works included in a single collection. The process involves:

1. Identifying the collection by name or ID
2. Retrieving all works in that collection (ordered by position)
3. Resolving each work's file path on disk
4. Extracting plain text from each file (docx, md, or txt)
5. Concatenating all content with appropriate separators

---

## 2. Data Flow

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────┐
│   Collections   │────▶│ CollectionDetails │────▶│    Works    │
│   (collID)      │     │ (collID, workID)  │     │  (workID)   │
└─────────────────┘     └───────────────────┘     └─────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ Work Metadata:      │
                                              │ - title, type, year │
                                              │ - quality, status   │
                                              │ - doc_type, path    │
                                              └─────────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ fileOps.GetFullPath │
                                              │ → absolute file path│
                                              └─────────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ fts.ExtractByType   │
                                              │ → plain text content│
                                              └─────────────────────┘
```

---

## 3. SQL Queries

### 3.1 Find Collection by Name

```sql
SELECT collID, collection_name, type, attributes
FROM Collections
WHERE collection_name = ?
```

### 3.2 Get Works in Collection (Ordered)

```sql
SELECT w.workID, w.title, w.type, w.year, w.status, w.quality,
       w.doc_type, w.path, cd.position, cd.is_suppressed
FROM Works w
INNER JOIN CollectionDetails cd ON w.workID = cd.workID
WHERE cd.collID = ?
  AND (w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')
ORDER BY cd.position, w.title
```

**Note:** The `is_suppressed` flag indicates works that should be excluded from book assembly. Depending on use case, you may want to filter these out.

---

## 4. Existing Components

### 4.1 Database Layer

| Function                                     | Location                     | Purpose                                     |
| -------------------------------------------- | ---------------------------- | ------------------------------------------- |
| `db.GetCollection(id)`                       | `internal/db/collections.go` | Get collection by ID                        |
| `db.GetCollectionWorks(collID, showDeleted)` | `internal/db/collections.go` | Get all works in a collection with metadata |

### 4.2 File Operations

| Function                        | Location                    | Purpose                                                       |
| ------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `fileOps.GeneratePath(work)`    | `internal/fileops/paths.go` | Generate relative path from work metadata                     |
| `fileOps.GetFullPath(work)`     | `internal/fileops/paths.go` | Generate absolute path (base + relative)                      |
| `fileOps.Config.BaseFolderPath` | `internal/fileops/paths.go` | Root folder for all work files (default: `~/Documents/Home/`) |

### 4.3 Text Extraction

| Function                           | Location                  | Purpose                        |
| ---------------------------------- | ------------------------- | ------------------------------ |
| `fts.ExtractByType(path, docType)` | `internal/fts/extract.go` | Route to appropriate extractor |
| `fts.ExtractDocx(path)`            | `internal/fts/extract.go` | Parse DOCX → plain text        |
| `fts.ExtractMarkdown(path)`        | `internal/fts/extract.go` | Read Markdown file             |
| `fts.ExtractPlainText(path)`       | `internal/fts/extract.go` | Read plain text file           |

### 4.4 Path Generation Logic

The path is computed from work metadata:

```
{folder}/{qualityMark}{Type} - {Year} - {Title}.{ext}
```

**Folder Selection Rules:**

- Ideas → `35 Open Ideas/`
- Travel → `100 Travel/`
- Book → `100 Books/`
- Published → `150 Published/`
- Active statuses (Focus, Active, Out, Working) with year ≥ 2026 → `34 Current Work/`
- Otherwise → `100 {PluralizedType}/`

**Quality Marks:**
| Quality | Mark |
|---------|------|
| Best | `aa` |
| Better | `a` |
| Good | `b` |
| Okay | `c` |
| Poor | `d` |
| Bad | `e` |
| Worst | `f` |
| Unknown | `z` |

---

## 5. Implementation Steps

### Step 1: Get Collection ID

```go
// If you have collection name, find the ID first
coll, err := db.GetCollectionByName(collectionName)
if err != nil || coll == nil {
    return fmt.Errorf("collection not found: %s", collectionName)
}
collID := coll.CollID
```

### Step 2: Retrieve Works

```go
works, err := db.GetCollectionWorks(collID, false) // false = exclude deleted
if err != nil {
    return fmt.Errorf("get collection works: %w", err)
}
```

### Step 3: Extract Text from Each Work

```go
var allContent strings.Builder

for _, work := range works {
    // Skip suppressed works if desired
    if work.IsSuppressed {
        continue
    }

    // Generate full file path
    fullPath := fileOps.GetFullPath(&work.Work)

    // Extract text content
    text, err := fts.ExtractByType(fullPath, work.DocType)
    if err != nil {
        // Handle error: log and continue, or fail
        log.Printf("Warning: could not extract %s: %v", work.Title, err)
        continue
    }

    // Add separator and content
    if allContent.Len() > 0 {
        allContent.WriteString("\n\n---\n\n")
    }
    allContent.WriteString(text)
}
```

### Step 4: Return Combined Content

```go
return allContent.String(), nil
```

---

## 6. Error Handling

### 6.1 Missing Files

Works may reference files that no longer exist on disk:

```go
if _, err := os.Stat(fullPath); os.IsNotExist(err) {
    // Option A: Skip and continue
    log.Printf("File not found: %s", fullPath)
    continue

    // Option B: Return error
    return "", fmt.Errorf("file not found for work %d (%s): %s", work.WorkID, work.Title, fullPath)
}
```

### 6.2 Unsupported Document Types

The `fts.ExtractByType` function only supports `docx`, `md`, and `txt`:

```go
text, err := fts.ExtractByType(fullPath, work.DocType)
if err != nil {
    if strings.Contains(err.Error(), "unsupported document type") {
        log.Printf("Skipping unsupported type %s for: %s", work.DocType, work.Title)
        continue
    }
    return "", err
}
```

### 6.3 Corrupted DOCX Files

DOCX extraction can fail if the file is corrupted or not a valid ZIP archive:

```go
text, err := fts.ExtractDocx(fullPath)
if err != nil {
    // Likely causes: not a ZIP, missing document.xml, malformed XML
    log.Printf("Could not parse DOCX: %s (%v)", work.Title, err)
}
```

---

## 7. Output Formats

### 7.1 Plain Text (Simple Concatenation)

```
[Text of Work 1]

---

[Text of Work 2]

---

[Text of Work 3]
```

### 7.2 With Metadata Headers

```
# Work 1 Title
Type: Poem | Year: 2024 | Quality: Better

[Text of Work 1]

---

# Work 2 Title
Type: Story | Year: 2023 | Quality: Good

[Text of Work 2]
```

### 7.3 JSON Structure

```json
{
  "collection": {
    "id": 40010,
    "name": "Spiral"
  },
  "works": [
    {
      "workID": 12345,
      "title": "Morning Light",
      "type": "Poem",
      "year": "2024",
      "content": "The morning light shines bright..."
    },
    {
      "workID": 12346,
      "title": "Evening Walk",
      "type": "Story",
      "year": "2023",
      "content": "She walked along the shore..."
    }
  ],
  "totalWorks": 2,
  "totalWords": 1547
}
```

---

## 8. Considerations

### 8.1 Performance

For large collections (100+ works), consider:

- Progress reporting for UI feedback
- Streaming output instead of building one large string
- Parallel extraction (with care for disk I/O)

### 8.2 Memory

DOCX extraction loads entire files into memory. For very large documents, this could be significant. The current implementation is suitable for typical creative writing works (< 100KB each).

### 8.3 Suppressed Works

The `is_suppressed` flag in `CollectionDetails` indicates works that should be excluded from book assembly. When extracting for book publishing, filter these out. When extracting for analysis or backup, include them.

---

_Last updated: January 30, 2026_
