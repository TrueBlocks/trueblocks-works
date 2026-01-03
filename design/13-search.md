# Search Specification

> **Document:** 13-search.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Search Architecture](#2-search-architecture)
3. [Searchable Fields](#3-searchable-fields)
4. [Search UI](#4-search-ui)
5. [Implementation](#5-implementation)
6. [Performance](#6-performance)

---

## 1. Overview

### 1.1 Requirements

With 1,749 works, 755 organizations, and 246 submissions, users need fast, intuitive search:

| Requirement | Priority |
|-------------|----------|
| Find work by title (partial match) | Critical |
| Find work by content/first line | High |
| Find organization by name | Critical |
| Filter by multiple criteria (status + type + year) | High |
| Recent/frequent searches | Low |
| Full-text search across notes | Medium |

### 1.2 Search Scope

| Entity | Searchable Fields | Expected Results |
|--------|-------------------|------------------|
| Works | title, type, year, status, quality, notes | Primary use case |
| Organizations | name, other_name, url, accepts | Secondary |
| Submissions | journal name, work title, response type | Tertiary |
| Collections | collection_name | Rarely searched |

---

## 2. Search Architecture

### 2.1 Search Strategy

Use SQLite FTS5 (Full-Text Search) for:
- Fast partial matching
- Ranking by relevance
- Prefix searches ("poem*" matches "poems", "poetry")

```
┌─────────────────────────────────────────────────────────────┐
│                      Search Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Types      Query FTS5      Rank by Score     Display  │
│  ─────────► ─────────────────► ─────────────────► ────────► │
│  "sunset"        < 10ms             bm25()         Results  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> **Desktop Performance:** SQLite FTS5 queries return in under 10ms. No debouncing needed—search updates instantly as the user types.

### 2.2 FTS5 Schema

```sql
-- Full-text search virtual table for Works
CREATE VIRTUAL TABLE works_fts USING fts5(
    title,
    type,
    year,
    status,
    quality,
    course_name,
    content='Works',
    content_rowid='workID'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER works_ai AFTER INSERT ON Works BEGIN
    INSERT INTO works_fts(rowid, title, type, year, status, quality, course_name)
    VALUES (NEW.workID, NEW.title, NEW.type, NEW.year, NEW.status, NEW.quality, NEW.course_name);
END;

CREATE TRIGGER works_ad AFTER DELETE ON Works BEGIN
    INSERT INTO works_fts(works_fts, rowid, title, type, year, status, quality, course_name)
    VALUES ('delete', OLD.workID, OLD.title, OLD.type, OLD.year, OLD.status, OLD.quality, OLD.course_name);
END;

CREATE TRIGGER works_au AFTER UPDATE ON Works BEGIN
    INSERT INTO works_fts(works_fts, rowid, title, type, year, status, quality, course_name)
    VALUES ('delete', OLD.workID, OLD.title, OLD.type, OLD.year, OLD.status, OLD.quality, OLD.course_name);
    INSERT INTO works_fts(rowid, title, type, year, status, quality, course_name)
    VALUES (NEW.workID, NEW.title, NEW.type, NEW.year, NEW.status, NEW.quality, NEW.course_name);
END;

-- Full-text search for Organizations
CREATE VIRTUAL TABLE orgs_fts USING fts5(
    name,
    other_name,
    url,
    accepts,
    source,
    content='Organizations',
    content_rowid='orgID'
);

-- Similar triggers for Organizations...

-- Full-text search for Notes (combined)
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note,
    type,
    entity_type,  -- 'work' or 'journal'
    entity_id,
    tokenize='porter'  -- Stemming: "running" matches "run"
);
```

### 2.3 Rebuild FTS Index

Run after initial import or if index becomes corrupt:

```sql
-- Rebuild works FTS
INSERT INTO works_fts(works_fts) VALUES ('rebuild');

-- Rebuild orgs FTS
INSERT INTO orgs_fts(orgs_fts) VALUES ('rebuild');
```

---

## 3. Searchable Fields

### 3.1 Works Search

| Field | Weight | Match Type | Example |
|-------|--------|------------|---------|
| `title` | 10x | Prefix, contains | "sunset" matches "Sunset Boulevard" |
| `type` | 5x | Exact | "Poem" |
| `year` | 3x | Exact, range | "2024", "2020-2024" |
| `status` | 5x | Exact | "Active" |
| `quality` | 3x | Exact | "Best" |
| `course_name` | 2x | Contains | "MFA" |

### 3.2 Organizations Search

| Field | Weight | Match Type | Example |
|-------|--------|------------|---------|
| `name` | 10x | Prefix, contains | "Paris" matches "Paris Review" |
| `other_name` | 5x | Contains | Alternate names |
| `accepts` | 3x | Contains | "poetry" |
| `url` | 2x | Contains | Domain search |

### 3.3 Combined Search

Global search (`⌘K`) searches across all entities and returns the top 50 results for UI display:

```sql
-- Combined search query (top 50 for dropdown display)
SELECT 'work' as entity_type, workID as id, title as name, 
       bm25(works_fts) as score
FROM works_fts WHERE works_fts MATCH ?
UNION ALL
SELECT 'org' as entity_type, orgID as id, name, 
       bm25(orgs_fts) as score
FROM orgs_fts WHERE orgs_fts MATCH ?
ORDER BY score
LIMIT 50;
```

> **Note:** The LIMIT 50 is for UI usability (don't show 500 results in a dropdown), not performance. The full query executes in <20ms regardless.

---

## 4. Search UI

### 4.1 Global Search Bar

**Keyboard Shortcut:** `⌘F` or `⌘K` (spotlight-style)

```
┌────────────────────────────────────────────────────────────────┐
│ 🔍  Search works, organizations, submissions...          ⌘K   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Works                                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📄 Sunset Over the Harbor               Poem • 2024      │ │
│  │ 📄 Before Sunset                        Story • 2023     │ │
│  │ 📄 Sunset, Again                        Poem • 2022      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Organizations                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🏢 Sunset Literary Review               Journal • Open   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Press ↑↓ to navigate, Enter to open, Esc to close           │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 React Component

```typescript
// src/components/GlobalSearch.tsx
import { useState, useCallback } from 'react';
import { Modal, TextInput, Stack, Group, Text, Kbd, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconSearch, IconFile, IconBuilding } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { Search } from '../../wailsjs/go/main/App';

interface SearchResult {
  entityType: 'work' | 'org' | 'submission';
  id: number;
  name: string;
  subtitle: string;
  score: number;
}

export function GlobalSearch() {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Global hotkey to open search
  useHotkeys([
    ['mod+k', () => setOpened(true)],
    ['mod+f', () => setOpened(true)],
  ]);

  // Search instantly on each keystroke - SQLite FTS5 is fast enough
  const handleSearch = async (value: string) => {
    setQuery(value);
    
    if (value.length < 2) {
      setResults([]);
      return;
    }

    const res = await Search(value);
    setResults(res.data || []);
    setSelectedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          openResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setOpened(false);
        break;
    }
  }, [results, selectedIndex]);

  const openResult = (result: SearchResult) => {
    setOpened(false);
    setQuery('');
    switch (result.entityType) {
      case 'work':
        navigate(`/works/${result.id}`);
        break;
      case 'org':
        navigate(`/organizations/${result.id}`);
        break;
      case 'submission':
        navigate(`/submissions/${result.id}`);
        break;
    }
  };

  const iconForType = (type: string) => {
    switch (type) {
      case 'work': return <IconFile size={16} />;
      case 'org': return <IconBuilding size={16} />;
      default: return <IconFile size={16} />;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={null}
      withCloseButton={false}
      size="lg"
      padding={0}
      radius="md"
      styles={{ body: { padding: 0 } }}
    >
      <TextInput
        placeholder="Search works, organizations, submissions..."
        leftSection={<IconSearch size={18} />}
        rightSection={<Kbd size="xs">esc</Kbd>}
        value={query}
        onChange={(e) => handleSearch(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        size="lg"
        autoFocus
        styles={{
          input: { border: 'none', borderBottom: '1px solid #eee' },
        }}
      />

      {results.length > 0 && (
        <Stack gap={0} p="xs" mah={400} style={{ overflow: 'auto' }}>
          {results.map((result, index) => (
            <UnstyledButton
              key={`${result.entityType}-${result.id}`}
              onClick={() => openResult(result)}
              p="sm"
              style={{
                backgroundColor: index === selectedIndex ? '#f0f0f0' : 'transparent',
                borderRadius: 4,
              }}
            >
              <Group>
                {iconForType(result.entityType)}
                <div>
                  <Text size="sm" fw={500}>{result.name}</Text>
                  <Text size="xs" c="dimmed">{result.subtitle}</Text>
                </div>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}

      {query.length >= 2 && results.length === 0 && (
        <Text p="xl" ta="center" c="dimmed">
          No results found for "{query}"
        </Text>
      )}

      <Group p="xs" justify="center" bg="#f8f8f8">
        <Text size="xs" c="dimmed">
          <Kbd size="xs">↑↓</Kbd> navigate
          <Kbd size="xs" ml="md">↵</Kbd> open
          <Kbd size="xs" ml="md">esc</Kbd> close
        </Text>
      </Group>
    </Modal>
  );
}
```

### 4.3 Page-Specific Filters

Each page has its own filter bar for advanced filtering:

#### Works Page Filters

```typescript
interface WorksFilter {
  query: string;          // Text search
  status: Status[];       // Multi-select
  quality: Quality[];     // Multi-select
  type: WorkType[];       // Multi-select
  yearFrom: number | null;
  yearTo: number | null;
  hasNotes: boolean | null;
  isPublished: boolean | null;
}
```

#### Organizations Page Filters

```typescript
interface OrgsFilter {
  query: string;
  status: OrgStatus[];     // Open, Closed, Unknown
  myInterest: Quality[];   // Best, Better, Good, etc.
  accepts: string[];       // poetry, fiction, cnf, etc.
  hasPushcarts: boolean | null;
}
```

---

## 5. Implementation

### 5.1 Go Backend

```go
// internal/search/search.go
package search

import (
    "database/sql"
    "fmt"
    "strings"
)

type SearchResult struct {
    EntityType string `json:"entityType"`
    ID         int    `json:"id"`
    Name       string `json:"name"`
    Subtitle   string `json:"subtitle"`
    Score      float64 `json:"score"`
}

type SearchService struct {
    db *sql.DB
}

func NewSearchService(db *sql.DB) *SearchService {
    return &SearchService{db: db}
}

// Search performs a combined search across all entities
func (s *SearchService) Search(query string, limit int) ([]SearchResult, error) {
    if len(query) < 2 {
        return []SearchResult{}, nil
    }

    // Prepare FTS query (add prefix matching)
    ftsQuery := prepareFTSQuery(query)

    sql := `
        SELECT 'work' as entity_type, workID as id, title as name,
               type || ' • ' || year as subtitle,
               bm25(works_fts, 10.0, 5.0, 3.0, 5.0, 3.0, 2.0) as score
        FROM works_fts 
        WHERE works_fts MATCH ?
        
        UNION ALL
        
        SELECT 'org' as entity_type, orgID as id, name,
               type || ' • ' || COALESCE(status, 'Unknown') as subtitle,
               bm25(orgs_fts, 10.0, 5.0, 2.0, 3.0, 2.0) as score
        FROM orgs_fts 
        WHERE orgs_fts MATCH ?
        
        ORDER BY score
        LIMIT ?
    `

    rows, err := s.db.Query(sql, ftsQuery, ftsQuery, limit)
    if err != nil {
        return nil, fmt.Errorf("search query failed: %w", err)
    }
    defer rows.Close()

    var results []SearchResult
    for rows.Next() {
        var r SearchResult
        if err := rows.Scan(&r.EntityType, &r.ID, &r.Name, &r.Subtitle, &r.Score); err != nil {
            return nil, err
        }
        results = append(results, r)
    }

    return results, nil
}

// SearchWorks searches only works with advanced filters
func (s *SearchService) SearchWorks(filter WorksFilter) ([]Work, error) {
    var conditions []string
    var args []interface{}

    // Text search via FTS
    if filter.Query != "" && len(filter.Query) >= 2 {
        conditions = append(conditions, "workID IN (SELECT rowid FROM works_fts WHERE works_fts MATCH ?)")
        args = append(args, prepareFTSQuery(filter.Query))
    }

    // Status filter
    if len(filter.Status) > 0 {
        placeholders := make([]string, len(filter.Status))
        for i, s := range filter.Status {
            placeholders[i] = "?"
            args = append(args, s)
        }
        conditions = append(conditions, fmt.Sprintf("status IN (%s)", strings.Join(placeholders, ",")))
    }

    // Quality filter
    if len(filter.Quality) > 0 {
        placeholders := make([]string, len(filter.Quality))
        for i, q := range filter.Quality {
            placeholders[i] = "?"
            args = append(args, q)
        }
        conditions = append(conditions, fmt.Sprintf("quality IN (%s)", strings.Join(placeholders, ",")))
    }

    // Year range
    if filter.YearFrom != nil {
        conditions = append(conditions, "CAST(year AS INTEGER) >= ?")
        args = append(args, *filter.YearFrom)
    }
    if filter.YearTo != nil {
        conditions = append(conditions, "CAST(year AS INTEGER) <= ?")
        args = append(args, *filter.YearTo)
    }

    // Build query
    sql := "SELECT * FROM Works"
    if len(conditions) > 0 {
        sql += " WHERE " + strings.Join(conditions, " AND ")
    }
    sql += " ORDER BY status, quality, type, year DESC, title LIMIT 500"

    // Execute and return...
    return s.executeWorksQuery(sql, args)
}

// prepareFTSQuery converts user input to FTS5 query syntax
func prepareFTSQuery(input string) string {
    // Escape special characters
    input = strings.ReplaceAll(input, `"`, `""`)
    
    // Split into words and add prefix matching
    words := strings.Fields(input)
    for i, word := range words {
        // Add * for prefix matching on last word
        if i == len(words)-1 {
            words[i] = word + "*"
        }
    }
    
    return strings.Join(words, " ")
}
```

### 5.2 Wails Binding

```go
// app_search.go
func (a *App) Search(query string) Result[[]SearchResult] {
    results, err := a.searchService.Search(query, 50)
    if err != nil {
        return Fail[[]SearchResult](err, "SEARCH_FAILED")
    }
    return Ok(results)
}

func (a *App) SearchWorks(filter WorksFilter) Result[[]Work] {
    works, err := a.searchService.SearchWorks(filter)
    if err != nil {
        return Fail[[]Work](err, "SEARCH_FAILED")
    }
    return Ok(works)
}
```

---

## 6. Performance

### 6.1 Expected Performance

This is a single-user desktop app with ~2,000 records. SQLite FTS5 is extremely fast:

| Data Size | Query Type | Expected Time |
|-----------|------------|---------------|
| 1,749 works | Title prefix search | < 5ms |
| 1,749 works | Full-text search | < 10ms |
| Combined search | All entities | < 20ms |
| Complex filter | Multiple conditions | < 20ms |

> **No debouncing needed.** At <10ms response times, search feels instant. The app updates results on every keystroke.

### 6.2 FTS Maintenance

```go
// Run weekly or after bulk imports
func (s *SearchService) RebuildIndexes() error {
    _, err := s.db.Exec(`INSERT INTO works_fts(works_fts) VALUES ('rebuild')`)
    if err != nil {
        return err
    }
    _, err = s.db.Exec(`INSERT INTO orgs_fts(orgs_fts) VALUES ('rebuild')`)
    return err
}

// Check index health
func (s *SearchService) CheckIntegrity() (bool, error) {
    var result string
    err := s.db.QueryRow(`INSERT INTO works_fts(works_fts) VALUES ('integrity-check')`).Scan(&result)
    return result == "ok", err
}
```

---

## 7. Keyboard Shortcuts Summary

| Shortcut | Action | Context |
|----------|--------|---------|
| `⌘K` or `⌘F` | Open global search | Anywhere |
| `↑` / `↓` | Navigate results | Search modal |
| `Enter` | Open selected result | Search modal |
| `Esc` | Close search | Search modal |
| `⌘⇧F` | Focus page filter | Any list page |

---

*End of Search Specification*
