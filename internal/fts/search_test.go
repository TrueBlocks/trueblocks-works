package fts

import (
	"archive/zip"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func setupSearchTest(t *testing.T, dir string) (*Database, *sql.DB, string) {
	t.Helper()
	docDir := filepath.Join(dir, "docs")
	os.MkdirAll(docDir, 0755)

	dbPath := filepath.Join(dir, "works.db")
	mainDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open main db: %v", err)
	}

	_, err = mainDB.Exec(`
		CREATE TABLE Works (
			workID INTEGER PRIMARY KEY,
			title TEXT,
			type TEXT,
			year TEXT,
			status TEXT,
			doc_type TEXT,
			path TEXT,
			n_words INTEGER
		)
	`)
	if err != nil {
		t.Fatalf("create table: %v", err)
	}

	ftsDB := &Database{path: filepath.Join(dir, "fulltext.db")}

	return ftsDB, mainDB, docDir
}

func createSearchTestDocx(t *testing.T, dir, name, text string) {
	t.Helper()
	path := filepath.Join(dir, name)
	os.MkdirAll(filepath.Dir(path), 0755)

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create file: %v", err)
	}
	defer f.Close()

	w := zip.NewWriter(f)
	docXML := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>` + text + `</w:t></w:r></w:p></w:body>
</w:document>`

	docFile, _ := w.Create("word/document.xml")
	docFile.Write([]byte(docXML))
	w.Close()
}

func TestSearcherSearch(t *testing.T) {
	dir := t.TempDir()
	ftsDB, mainDB, docDir := setupSearchTest(t, dir)
	defer mainDB.Close()
	defer ftsDB.Close()

	createSearchTestDocx(t, docDir, "poem1.docx", "The morning light shines bright")
	createSearchTestDocx(t, docDir, "poem2.docx", "Water flows beneath the bridge")
	createSearchTestDocx(t, docDir, "story.docx", "Once upon a time in the morning")

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Morning Poem', 'Poem', '2020', 'Active', 'docx', 'poem1.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (2, 'Water Poem', 'Poem', '2021', 'Active', 'docx', 'poem2.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (3, 'Morning Story', 'Story', '2022', 'Draft', 'docx', 'story.docx')`)

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)
	_, err := builder.BuildFull()
	if err != nil {
		t.Fatalf("build index: %v", err)
	}

	searcher := NewSearcher(ftsDB, mainDB)

	resp, err := searcher.Search(Query{Text: "morning"})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(resp.Results) != 2 {
		t.Errorf("expected 2 results for 'morning', got %d", len(resp.Results))
	}
	if resp.TotalCount != 2 {
		t.Errorf("expected total count 2, got %d", resp.TotalCount)
	}

	resp, err = searcher.Search(Query{Text: "water"})
	if err != nil {
		t.Fatalf("search water failed: %v", err)
	}
	if len(resp.Results) != 1 {
		t.Errorf("expected 1 result for 'water', got %d", len(resp.Results))
	}

	resp, err = searcher.Search(Query{Text: "xyznotfound"})
	if err != nil {
		t.Fatalf("search notfound failed: %v", err)
	}
	if len(resp.Results) != 0 {
		t.Errorf("expected 0 results for nonexistent term, got %d", len(resp.Results))
	}
}

func TestSearcherSearchWithFilters(t *testing.T) {
	dir := t.TempDir()
	ftsDB, mainDB, docDir := setupSearchTest(t, dir)
	defer mainDB.Close()
	defer ftsDB.Close()

	createSearchTestDocx(t, docDir, "poem.docx", "The morning light")
	createSearchTestDocx(t, docDir, "story.docx", "The morning story")

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem', 'Poem', '2020', 'Active', 'docx', 'poem.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (2, 'Story', 'Story', '2021', 'Draft', 'docx', 'story.docx')`)

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)
	builder.BuildFull()

	searcher := NewSearcher(ftsDB, mainDB)

	resp, err := searcher.Search(Query{
		Text:    "morning",
		Filters: Filters{Types: []string{"Poem"}},
	})
	if err != nil {
		t.Fatalf("filtered search failed: %v", err)
	}
	if len(resp.Results) != 1 {
		t.Errorf("expected 1 result with Poem filter, got %d", len(resp.Results))
	}
	if len(resp.Results) > 0 && resp.Results[0].Type != "Poem" {
		t.Errorf("expected type Poem, got %s", resp.Results[0].Type)
	}

	resp, err = searcher.Search(Query{
		Text:    "morning",
		Filters: Filters{Years: []string{"2021"}},
	})
	if err != nil {
		t.Fatalf("year filtered search failed: %v", err)
	}
	if len(resp.Results) != 1 {
		t.Errorf("expected 1 result with 2021 filter, got %d", len(resp.Results))
	}
}

func TestSearcherGetDocumentContent(t *testing.T) {
	dir := t.TempDir()
	ftsDB, mainDB, docDir := setupSearchTest(t, dir)
	defer mainDB.Close()
	defer ftsDB.Close()

	createSearchTestDocx(t, docDir, "poem.docx", "Full content of poem here")
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem', 'Poem', '2020', 'Active', 'docx', 'poem.docx')`)

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)
	builder.BuildFull()

	searcher := NewSearcher(ftsDB, mainDB)

	result, err := searcher.GetDocumentContent(1)
	if err != nil {
		t.Fatalf("GetDocumentContent failed: %v", err)
	}
	if result == nil {
		t.Fatal("expected result, got nil")
	}
	if result.WorkID != 1 {
		t.Errorf("expected work ID 1, got %d", result.WorkID)
	}
	if result.TextContent == "" {
		t.Error("expected text content, got empty")
	}

	result, err = searcher.GetDocumentContent(999)
	if err != nil {
		t.Fatalf("GetDocumentContent for missing work failed: %v", err)
	}
	if result != nil {
		t.Errorf("expected nil for missing work, got %+v", result)
	}
}

func TestSearcherBatchGetContent(t *testing.T) {
	dir := t.TempDir()
	ftsDB, mainDB, docDir := setupSearchTest(t, dir)
	defer mainDB.Close()
	defer ftsDB.Close()

	createSearchTestDocx(t, docDir, "poem1.docx", "Content one")
	createSearchTestDocx(t, docDir, "poem2.docx", "Content two")
	createSearchTestDocx(t, docDir, "poem3.docx", "Content three")

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem 1', 'Poem', '2020', 'Active', 'docx', 'poem1.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (2, 'Poem 2', 'Poem', '2021', 'Active', 'docx', 'poem2.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (3, 'Poem 3', 'Poem', '2022', 'Active', 'docx', 'poem3.docx')`)

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)
	builder.BuildFull()

	searcher := NewSearcher(ftsDB, mainDB)

	results, err := searcher.BatchGetContent([]int{1, 3})
	if err != nil {
		t.Fatalf("BatchGetContent failed: %v", err)
	}
	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}

	results, err = searcher.BatchGetContent([]int{})
	if err != nil {
		t.Fatalf("BatchGetContent empty failed: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results for empty input, got %d", len(results))
	}
}

func TestBuildFTSQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"  ", ""},
		{"morning", `"morning"*`},
		{"morning light", `"morning"* "light"*`},
		{`word"with"quotes`, `"word""with""quotes"*`},
	}

	for _, tt := range tests {
		result := buildFTSQuery(tt.input)
		if result != tt.expected {
			t.Errorf("buildFTSQuery(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestSearcherSnippets(t *testing.T) {
	dir := t.TempDir()
	ftsDB, mainDB, docDir := setupSearchTest(t, dir)
	defer mainDB.Close()
	defer ftsDB.Close()

	longText := "The quick brown fox jumps over the lazy dog. " +
		"Morning light fills the room with warmth. " +
		"The fox watches silently from the window."
	createSearchTestDocx(t, docDir, "story.docx", longText)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Story', 'Story', '2020', 'Active', 'docx', 'story.docx')`)

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)
	builder.BuildFull()

	searcher := NewSearcher(ftsDB, mainDB)

	resp, err := searcher.Search(Query{Text: "morning"})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(resp.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Results))
	}

	snippet := resp.Results[0].Snippet
	if snippet == "" {
		t.Error("expected snippet, got empty")
	}
	if !strings.Contains(strings.ToLower(snippet), "morning") && !strings.Contains(snippet, "<mark>") {
		t.Errorf("snippet should contain search term or highlight, got: %s", snippet)
	}
}
