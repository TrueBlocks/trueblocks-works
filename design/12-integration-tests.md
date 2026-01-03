# Integration Tests Specification

> **Document:** 12-integration-tests.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Test Categories](#2-test-categories)
3. [Critical Workflow Tests](#3-critical-workflow-tests)
4. [Data Integrity Tests](#4-data-integrity-tests)
5. [UI Interaction Tests](#5-ui-interaction-tests)
6. [File System Tests](#6-file-system-tests)
7. [Test Infrastructure](#7-test-infrastructure)
8. [Comparison Tests](#8-comparison-tests)

---

## 1. Overview

### 1.1 Test Philosophy

1. **Test workflows, not just functions** — End-to-end user scenarios
2. **Compare against FileMaker** — New app should produce same results
3. **Test edge cases explicitly** — Empty values, invalid data, concurrent operations
4. **Automate everything possible** — Manual testing is for exploratory only
5. **Fast feedback** — Tests should run in under 5 minutes

### 1.2 Test Pyramid

```
                    ┌─────────────────┐
                    │    E2E Tests    │  ← Few, slow, high confidence
                    │  (UI + Backend) │
                    ├─────────────────┤
                    │                 │
              ┌─────┤  Integration    ├─────┐  ← More, medium speed
              │     │     Tests       │     │
              │     │ (API + Database)│     │
              │     ├─────────────────┤     │
              │     │                 │     │
        ┌─────┴─────┤   Unit Tests    ├─────┴─────┐  ← Many, fast
        │           │  (Pure Logic)   │           │
        │           └─────────────────┘           │
        └─────────────────────────────────────────┘
```

### 1.3 Test Data Strategy

| Data Set | Purpose | Records |
|----------|---------|---------|
| **Production Copy** | Real-world testing | Full dataset |
| **Minimal Set** | Fast unit tests | ~50 records |
| **Edge Cases Set** | Specific scenarios | ~20 records |
| **Empty Database** | Initialization tests | 0 records |

---

## 2. Test Categories

### 2.1 Go Backend Tests

```bash
# Run all Go tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/db/...
```

### 2.2 React Frontend Tests

```bash
# Run React tests
cd frontend && yarn test

# Run with coverage
yarn test --coverage

# Run E2E tests (requires running app)
yarn e2e
```

### 2.3 Test File Naming

| Type | Location | Pattern |
|------|----------|---------|
| Go unit tests | Same as source | `*_test.go` |
| Go integration tests | `internal/test/` | `*_integration_test.go` |
| React unit tests | Same as source | `*.test.tsx` |
| React E2E tests | `frontend/e2e/` | `*.spec.ts` |

---

## 3. Critical Workflow Tests

These test complete user workflows that MUST work correctly.

### 3.1 Work Creation Workflow

**Scenario:** User creates a new work from scratch

```go
// internal/test/workflow_work_create_test.go
func TestWorkCreationWorkflow(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Step 1: Create new work with minimal data
    work := models.Work{
        Title:   "Test Poem",
        Type:    "Poem",
        Year:    "2024",
    }
    
    result := app.CreateWork(work)
    require.True(t, result.Success, "Work creation failed: %v", result.Error)
    
    createdWork := result.Data
    
    // Step 2: Verify defaults were applied
    assert.Equal(t, "Gestating", createdWork.Status, "Default status not applied")
    assert.Equal(t, "Okay", createdWork.Quality, "Default quality not applied")
    assert.Equal(t, "rtf", createdWork.DocType, "Default doctype not applied")
    
    // Step 3: Verify file was created
    expectedPath := app.fileOps.GetWorkFullPath(createdWork)
    assert.FileExists(t, expectedPath, "Work file not created")
    
    // Step 4: Verify work appears in Gestating collection
    collections := app.GetWorkCollections(createdWork.WorkID)
    assert.Contains(t, collectionsNames(collections), "Gestating")
    
    // Step 5: Verify work can be retrieved
    fetched := app.GetWork(createdWork.WorkID)
    assert.Equal(t, createdWork.Title, fetched.Data.Title)
}
```

### 3.2 Status Change Workflow

**Scenario:** User changes work status, which triggers collection membership change

```go
func TestStatusChangeWorkflow(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Setup: Create a work in "Working" status
    work := createTestWork(t, app, "Working")
    
    // Verify initial collection membership
    colls := app.GetWorkCollections(work.WorkID)
    assert.Contains(t, collectionsNames(colls), "Working")
    
    // Step 1: Change status to "Active"
    work.Status = "Active"
    result := app.SaveWork(work)
    require.True(t, result.Success)
    
    // Step 2: Verify collection membership changed
    colls = app.GetWorkCollections(work.WorkID)
    assert.Contains(t, collectionsNames(colls), "Active")
    assert.NotContains(t, collectionsNames(colls), "Working")
    
    // Step 3: Verify access date updated
    fetched := app.GetWork(work.WorkID)
    assert.WithinDuration(t, time.Now(), fetched.Data.AccessDate, time.Minute)
}
```

### 3.3 Submission Workflow

**Scenario:** User submits work to journal, receives response

```go
func TestSubmissionWorkflow(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Setup
    work := createTestWork(t, app, "Active")
    org := createTestOrg(t, app, "Test Journal")
    
    // Step 1: Create submission
    sub := models.Submission{
        WorkID:         work.WorkID,
        OrgID:          org.OrgID,
        SubmissionDate: time.Now(),
        ResponseType:   "Waiting",
    }
    
    result := app.CreateSubmission(sub)
    require.True(t, result.Success)
    
    // Step 2: Work status should change to "Out"
    fetchedWork := app.GetWork(work.WorkID)
    assert.Equal(t, "Out", fetchedWork.Data.Status)
    
    // Step 3: Record acceptance
    sub.ResponseType = "Accepted"
    sub.ResponseDate = time.Now().Add(30 * 24 * time.Hour) // 30 days later
    
    result = app.SaveSubmission(sub)
    require.True(t, result.Success)
    
    // Step 4: Work status should change to "Published"
    fetchedWork = app.GetWork(work.WorkID)
    assert.Equal(t, "Published", fetchedWork.Data.Status)
    
    // Step 5: Work should have note about acceptance
    notes := app.GetWorkNotes(work.WorkID)
    assert.True(t, hasNoteContaining(notes, "accepted"))
}
```

### 3.4 Collection Filter Workflow

**Scenario:** User filters collections list

```go
func TestCollectionFilterWorkflow(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Setup: Create works in different statuses
    createTestWork(t, app, "Active")
    createTestWork(t, app, "Active")
    createTestWork(t, app, "Dead")
    createTestWork(t, app, "Sleeping")
    
    // Test: Filter to "Active" only
    app.SetActiveFilter("active")
    
    collections := app.GetCollections()
    collNames := collectionsNames(collections.Data)
    
    // Should see Active collections
    assert.Contains(t, collNames, "Active")
    
    // Should NOT see Dead collections
    assert.NotContains(t, collNames, "Dead")
    assert.NotContains(t, collNames, "Sleeping")
    
    // Test: Filter to "all"
    app.SetActiveFilter("all")
    
    collections = app.GetCollections()
    collNames = collectionsNames(collections.Data)
    
    // Should see everything
    assert.Contains(t, collNames, "Active")
    assert.Contains(t, collNames, "Dead")
}
```

### 3.5 File Move Workflow

**Scenario:** User changes work metadata, file needs to move

```go
func TestFileMoveWorkflow(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Setup: Create work with file
    work := createTestWork(t, app, "Active")
    originalPath := app.fileOps.GetWorkFullPath(work)
    require.FileExists(t, originalPath)
    
    // Step 1: Change quality (which changes filename prefix)
    work.Quality = "Best"
    result := app.SaveWork(work)
    require.True(t, result.Success)
    
    // Step 2: Verify file moved
    newPath := app.fileOps.GetWorkFullPath(work)
    assert.NotEqual(t, originalPath, newPath, "Path should have changed")
    assert.FileExists(t, newPath, "File should exist at new path")
    assert.NoFileExists(t, originalPath, "File should not exist at old path")
    
    // Step 3: Check field reflects new path
    fetched := app.GetWork(work.WorkID)
    assert.Equal(t, "", fetched.Data.Check, "Check should be empty (no issues)")
}
```

---

## 4. Data Integrity Tests

### 4.1 Foreign Key Integrity

```go
func TestForeignKeyIntegrity(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Test: Cannot create submission with invalid workID
    sub := models.Submission{
        WorkID: 999999, // Does not exist
        OrgID:  1,
    }
    
    result := app.CreateSubmission(sub)
    assert.False(t, result.Success)
    assert.Equal(t, "DB_CONSTRAINT", result.Error.Code)
    
    // Test: Cannot create CollectionDetails with invalid collID
    detail := models.CollectionDetail{
        CollID: 999999,
        WorkID: 1,
    }
    
    result = app.CreateCollectionDetail(detail)
    assert.False(t, result.Success)
}
```

### 4.2 Cascade Delete Tests

```go
func TestCascadeDeletes(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Setup: Create work with notes and submissions
    work := createTestWork(t, app, "Active")
    note := createTestNote(t, app, work.WorkID)
    sub := createTestSubmission(t, app, work.WorkID)
    
    // Step 1: Delete work
    result := app.DeleteWork(work.WorkID)
    require.True(t, result.Success)
    
    // Step 2: Verify notes were deleted
    notes := app.GetWorkNotes(work.WorkID)
    assert.Empty(t, notes.Data)
    
    // Step 3: Verify submissions were deleted
    subs := app.GetWorkSubmissions(work.WorkID)
    assert.Empty(t, subs.Data)
    
    // Step 4: Verify collection details were deleted
    details := app.GetCollectionDetailsForWork(work.WorkID)
    assert.Empty(t, details.Data)
}
```

### 4.3 Unique Constraint Tests

```go
func TestUniqueConstraints(t *testing.T) {
    db := setupTestDB(t)
    app := NewApp(db)
    
    // Test: Cannot create duplicate collection name
    coll1 := models.Collection{CollectionName: "Test Collection"}
    result := app.CreateCollection(coll1)
    require.True(t, result.Success)
    
    coll2 := models.Collection{CollectionName: "Test Collection"}
    result = app.CreateCollection(coll2)
    assert.False(t, result.Success)
    assert.Equal(t, "VAL_DUPLICATE", result.Error.Code)
    
    // Test: Cannot add work to same collection twice
    work := createTestWork(t, app, "Active")
    
    result = app.AddWorkToCollection(work.WorkID, result.Data.CollID)
    require.True(t, result.Success)
    
    result = app.AddWorkToCollection(work.WorkID, result.Data.CollID)
    assert.False(t, result.Success) // Should fail on duplicate
}
```

---

## 5. UI Interaction Tests

### 5.1 Keyboard Navigation Tests

```typescript
// frontend/e2e/keyboard.spec.ts
import { test, expect } from '@playwright/test';

test('Cmd+1-4 navigates between pages', async ({ page }) => {
  await page.goto('/');
  
  // Start on Collections
  await expect(page.locator('h1')).toContainText('Collections');
  
  // Cmd+2 goes to Works
  await page.keyboard.press('Meta+2');
  await expect(page.locator('h1')).toContainText('Works');
  
  // Cmd+3 goes to Submissions
  await page.keyboard.press('Meta+3');
  await expect(page.locator('h1')).toContainText('Submissions');
  
  // Cmd+4 goes to Organizations
  await page.keyboard.press('Meta+4');
  await expect(page.locator('h1')).toContainText('Organizations');
  
  // Cmd+1 goes back to Collections
  await page.keyboard.press('Meta+1');
  await expect(page.locator('h1')).toContainText('Collections');
});

test('Cmd+1 cycles filters when on Collections', async ({ page }) => {
  await page.goto('/');
  
  // Should start with "all" filter
  await expect(page.locator('[data-filter="all"]')).toHaveClass(/active/);
  
  // Cmd+1 again cycles to "active"
  await page.keyboard.press('Meta+1');
  await expect(page.locator('[data-filter="active"]')).toHaveClass(/active/);
  
  // Cmd+1 again cycles to "process"
  await page.keyboard.press('Meta+1');
  await expect(page.locator('[data-filter="process"]')).toHaveClass(/active/);
});

test('Arrow keys navigate records', async ({ page }) => {
  await page.goto('/works');
  
  // Click first row
  await page.click('table tbody tr:first-child');
  const firstTitle = await page.locator('table tbody tr:first-child td:nth-child(2)').textContent();
  
  // Down arrow moves to second row
  await page.keyboard.press('ArrowDown');
  const selected = await page.locator('table tbody tr.selected');
  const secondTitle = await selected.locator('td:nth-child(2)').textContent();
  
  expect(firstTitle).not.toEqual(secondTitle);
});
```

### 5.2 Form Validation Tests

```typescript
// frontend/e2e/forms.spec.ts
test('Work form requires title', async ({ page }) => {
  await page.goto('/works/new');
  
  // Try to save without title
  await page.click('button:has-text("Save")');
  
  // Should show error
  await expect(page.locator('text=Title is required')).toBeVisible();
  
  // Fill in title
  await page.fill('input[name="title"]', 'Test Work');
  
  // Error should disappear
  await expect(page.locator('text=Title is required')).not.toBeVisible();
});

test('Submission form validates dates', async ({ page }) => {
  await page.goto('/submissions/new');
  
  // Set response date before submission date
  await page.fill('input[name="submissionDate"]', '2024-06-01');
  await page.fill('input[name="responseDate"]', '2024-05-01');
  
  await page.click('button:has-text("Save")');
  
  // Should show error
  await expect(page.locator('text=Response date cannot be before submission date')).toBeVisible();
});
```

### 5.3 Table Interaction Tests

```typescript
test('Works table sorting', async ({ page }) => {
  await page.goto('/works');
  
  // Click Status header to sort
  await page.click('th:has-text("Status")');
  
  // Verify sorted (first row should be "Out" or similar high-priority status)
  const firstStatus = await page.locator('table tbody tr:first-child td.status').textContent();
  expect(['Out', 'Focus', 'Active']).toContain(firstStatus);
  
  // Click again to reverse sort
  await page.click('th:has-text("Status")');
  
  const newFirstStatus = await page.locator('table tbody tr:first-child td.status').textContent();
  expect(['Dead', 'Done', 'Dying']).toContain(newFirstStatus);
});
```

---

## 6. File System Tests

### 6.1 File Existence Tests

```go
func TestFileExistence(t *testing.T) {
    db := setupTestDBWithData(t) // Load real data
    app := NewApp(db)
    
    works := app.GetAllWorks()
    
    missing := []string{}
    for _, work := range works.Data {
        path := app.fileOps.GetWorkFullPath(work)
        if !fileExists(path) {
            missing = append(missing, fmt.Sprintf("%d: %s (%s)", 
                work.WorkID, work.Title, path))
        }
    }
    
    if len(missing) > 0 {
        t.Errorf("Missing files:\n%s", strings.Join(missing, "\n"))
    }
}
```

### 6.2 Path Generation Tests

```go
func TestPathGeneration(t *testing.T) {
    tests := []struct {
        name     string
        work     models.Work
        expected string
    }{
        {
            name: "Active poem, good quality, recent year",
            work: models.Work{
                Type: "Poem", Year: "2024", Title: "My Sonnet",
                Quality: "Good", Status: "Active",
            },
            expected: "34 Current Work/bPoem - 2024 - My Sonnet",
        },
        {
            name: "Sleeping story, best quality, old year",
            work: models.Work{
                Type: "Story", Year: "2010", Title: "Old Tale",
                Quality: "Best", Status: "Sleeping",
            },
            expected: "100 Stories/aaStory - 2010 - Old Tale",
        },
        {
            name: "Published poem",
            work: models.Work{
                Type: "Poem", Year: "2020", Title: "Winner",
                Quality: "Best", Status: "Published",
            },
            expected: "150 Published/aaPoem - 2020 - Winner",
        },
        {
            name: "Idea type",
            work: models.Work{
                Type: "Poem Idea", Year: "2024", Title: "Future Work",
                Quality: "Okay", Status: "Gestating",
            },
            expected: "35 Open Ideas/cPoem Idea - 2024 - Future Work",
        },
        {
            name: "Title with slash",
            work: models.Work{
                Type: "Poem", Year: "2024", Title: "Before/After",
                Quality: "Good", Status: "Working",
            },
            expected: "34 Current Work/bPoem - 2024 - Before~After",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := GeneratePath(&tt.work)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

### 6.3 File Operation Edge Cases

```go
func TestFileMoveEdgeCases(t *testing.T) {
    app := setupTestApp(t)
    
    t.Run("Move when destination exists", func(t *testing.T) {
        // Create two works with same generated name
        work1 := createTestWork(t, app, "Active")
        work2 := createTestWork(t, app, "Active")
        work2.Title = work1.Title // Same title
        
        result := app.SaveWork(work2)
        // Should fail or rename
        if result.Success {
            // Verify files have different names
            path1 := app.fileOps.GetWorkFullPath(work1)
            path2 := app.fileOps.GetWorkFullPath(work2)
            assert.NotEqual(t, path1, path2)
        }
    })
    
    t.Run("Move when source is locked", func(t *testing.T) {
        work := createTestWork(t, app, "Active")
        path := app.fileOps.GetWorkFullPath(work)
        
        // Open file to lock it
        f, _ := os.Open(path)
        defer f.Close()
        
        // Try to move
        work.Quality = "Best"
        result := app.SaveWork(work)
        
        // Should return appropriate error
        if !result.Success {
            assert.Equal(t, "FILE_IN_USE", result.Error.Code)
        }
    })
}
```

---

## 7. Test Infrastructure

### 7.1 Test Database Setup

```go
// internal/test/helpers.go
package test

import (
    "database/sql"
    "os"
    "testing"
    
    _ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    
    // Create temp file
    f, err := os.CreateTemp("", "submissions-test-*.db")
    require.NoError(t, err)
    f.Close()
    
    // Open database
    db, err := sql.Open("sqlite", f.Name())
    require.NoError(t, err)
    
    // Apply schema
    schema, err := os.ReadFile("../../schema.sql")
    require.NoError(t, err)
    _, err = db.Exec(string(schema))
    require.NoError(t, err)
    
    // Cleanup on test end
    t.Cleanup(func() {
        db.Close()
        os.Remove(f.Name())
    })
    
    return db
}

func setupTestDBWithData(t *testing.T) *sql.DB {
    t.Helper()
    
    db := setupTestDB(t)
    
    // Load minimal test data
    testData, err := os.ReadFile("../../testdata/minimal.sql")
    require.NoError(t, err)
    _, err = db.Exec(string(testData))
    require.NoError(t, err)
    
    return db
}
```

### 7.2 Test Fixtures

```go
// internal/test/fixtures.go
func createTestWork(t *testing.T, app *App, status string) models.Work {
    t.Helper()
    
    work := models.Work{
        Title:   fmt.Sprintf("Test Work %d", rand.Int()),
        Type:    "Poem",
        Year:    "2024",
        Status:  status,
        Quality: "Okay",
    }
    
    result := app.CreateWork(work)
    require.True(t, result.Success, "Failed to create test work: %v", result.Error)
    
    return result.Data
}

func createTestOrg(t *testing.T, app *App, name string) models.Organization {
    t.Helper()
    
    org := models.Organization{
        Name:       name,
        Status:     "Open",
        Type:       "Journal",
        MyInterest: "Unknown",
    }
    
    result := app.CreateOrganization(org)
    require.True(t, result.Success)
    
    return result.Data
}
```

### 7.3 E2E Test Setup

```typescript
// frontend/e2e/global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Start the Wails app in dev mode
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Wait for app to be ready
  await page.goto('http://localhost:34115');
  await page.waitForSelector('[data-ready="true"]', { timeout: 30000 });
  
  await browser.close();
}

export default globalSetup;
```

---

## 8. Comparison Tests

### 8.1 FileMaker Parity Tests

Compare new app behavior against documented FileMaker behavior:

```go
func TestFileMakerParity_Sorting(t *testing.T) {
    // Documented FileMaker sort order for Works layout:
    // 1. Status (custom order)
    // 2. Quality (custom order)
    // 3. Type (custom order)
    // 4. Year (descending)
    // 5. Title (ascending)
    
    db := setupTestDBWithRealData(t)
    app := NewApp(db)
    
    // Export expected sort order from FileMaker (golden file)
    expected := loadGoldenFile(t, "testdata/works_sorted_expected.json")
    
    // Get actual sort from new app
    works := app.GetWorksSorted()
    
    for i, work := range works.Data {
        if i >= len(expected) {
            t.Fatalf("More works than expected")
        }
        assert.Equal(t, expected[i].WorkID, work.WorkID, 
            "Mismatch at position %d", i)
    }
}
```

### 8.2 Data Export Comparison

```go
func TestDataExportMatchesFileMaker(t *testing.T) {
    db := setupTestDBWithRealData(t)
    app := NewApp(db)
    
    // Export from new app
    actual := app.ExportWorksCSV()
    
    // Compare against FileMaker export
    expected, _ := os.ReadFile("testdata/fm_works_export.csv")
    
    // Parse and compare (ignoring order, whitespace)
    actualRecords := parseCSV(actual)
    expectedRecords := parseCSV(string(expected))
    
    assert.Equal(t, len(expectedRecords), len(actualRecords),
        "Record count mismatch")
    
    for id, expectedRow := range expectedRecords {
        actualRow, ok := actualRecords[id]
        require.True(t, ok, "Missing record: %v", id)
        
        for field, expectedVal := range expectedRow {
            assert.Equal(t, expectedVal, actualRow[field],
                "Field %s mismatch for ID %v", field, id)
        }
    }
}
```

---

## 9. Test Checklist

### 9.1 Pre-Release Test Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Data import from FileMaker CSV succeeds
- [ ] All 1,749 works are accessible
- [ ] All 755 organizations are accessible
- [ ] File paths resolve correctly
- [ ] Sorting matches FileMaker behavior
- [ ] Filtering works correctly
- [ ] Keyboard shortcuts work
- [ ] Form validation works
- [ ] Error messages are user-friendly
- [ ] State persists across restarts
- [ ] Window position/size persists
- [ ] App starts in under 3 seconds
- [ ] No memory leaks after 1 hour of use

### 9.2 Manual Test Scenarios

These should be tested manually before each release:

1. **First-run experience**
   - Fresh install, no existing data
   - Settings dialog appears
   - Can configure base path
   - Import completes successfully

2. **Daily workflow**
   - Open app, resume where left off
   - Navigate to work, edit status
   - Create new submission
   - Check organization website

3. **Error recovery**
   - Move a file outside the app
   - App shows "file missing" warning
   - Use "Relocate File" to fix
   - File path updates correctly

4. **Performance**
   - Open Collections with 100+ works
   - Scroll through list smoothly
   - Switch between pages quickly
   - Type in search without lag

---

*End of Integration Tests Specification*
