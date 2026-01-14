package fts

import (
	"archive/zip"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T, dir string) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(dir, "works.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	_, err = db.Exec(`
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

	return db
}

func createTestDocxFile(t *testing.T, dir, name, text string) {
	t.Helper()
	path := filepath.Join(dir, name)

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

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

func TestIndexBuilderBuildFull(t *testing.T) {
	dir := t.TempDir()
	docDir := filepath.Join(dir, "docs")
	os.MkdirAll(docDir, 0755)

	mainDB := setupTestDB(t, dir)
	defer mainDB.Close()

	createTestDocxFile(t, docDir, "poem1.docx", "The morning light")
	createTestDocxFile(t, docDir, "poem2.docx", "Water flows beneath")

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem 1', 'Poem', '2020', 'Active', 'docx', 'poem1.docx')`)
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (2, 'Poem 2', 'Poem', '2021', 'Active', 'docx', 'poem2.docx')`)

	ftsDB := &Database{path: filepath.Join(dir, "fulltext.db")}

	builder := NewIndexBuilder(ftsDB, mainDB, docDir)

	var progressCalls int
	builder.SetProgressCallback(func(p BuildProgress) {
		progressCalls++
	})

	report, err := builder.BuildFull()
	if err != nil {
		t.Fatalf("BuildFull failed: %v", err)
	}

	if !report.Success {
		t.Error("expected success")
	}
	if report.DocumentCount != 2 {
		t.Errorf("expected 2 documents, got %d", report.DocumentCount)
	}
	if report.WordCount < 5 {
		t.Errorf("expected at least 5 words, got %d", report.WordCount)
	}
	if progressCalls == 0 {
		t.Error("expected progress callbacks")
	}

	var count int
	ftsDB.Conn().QueryRow("SELECT COUNT(*) FROM content").Scan(&count)
	if count != 2 {
		t.Errorf("expected 2 content rows, got %d", count)
	}

	var nWords int
	mainDB.QueryRow("SELECT n_words FROM Works WHERE workID = 1").Scan(&nWords)
	if nWords == 0 {
		t.Error("expected n_words to be updated")
	}

	ftsDB.Close()
}

func TestIndexBuilderCheckStaleness(t *testing.T) {
	dir := t.TempDir()
	docDir := filepath.Join(dir, "docs")
	os.MkdirAll(docDir, 0755)

	mainDB := setupTestDB(t, dir)
	defer mainDB.Close()

	createTestDocxFile(t, docDir, "poem1.docx", "Content one")
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem 1', 'Poem', '2020', 'Active', 'docx', 'poem1.docx')`)

	ftsDB := &Database{path: filepath.Join(dir, "fulltext.db")}
	builder := NewIndexBuilder(ftsDB, mainDB, docDir)

	report, err := builder.CheckStaleness()
	if err != nil {
		t.Fatalf("CheckStaleness failed: %v", err)
	}

	if report.TotalWorks != 1 {
		t.Errorf("expected 1 total work, got %d", report.TotalWorks)
	}
	if report.MissingWorks != 1 {
		t.Errorf("expected 1 missing work, got %d", report.MissingWorks)
	}

	builder.BuildFull()

	report, err = builder.CheckStaleness()
	if err != nil {
		t.Fatalf("CheckStaleness after build failed: %v", err)
	}

	if report.MissingWorks != 0 {
		t.Errorf("expected 0 missing works after build, got %d", report.MissingWorks)
	}
	if report.IndexedWorks != 1 {
		t.Errorf("expected 1 indexed work, got %d", report.IndexedWorks)
	}

	ftsDB.Close()
}

func TestIndexBuilderUpdateIncremental(t *testing.T) {
	dir := t.TempDir()
	docDir := filepath.Join(dir, "docs")
	os.MkdirAll(docDir, 0755)

	mainDB := setupTestDB(t, dir)
	defer mainDB.Close()

	createTestDocxFile(t, docDir, "poem1.docx", "Original content")
	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Poem 1', 'Poem', '2020', 'Active', 'docx', 'poem1.docx')`)

	ftsDB := &Database{path: filepath.Join(dir, "fulltext.db")}
	builder := NewIndexBuilder(ftsDB, mainDB, docDir)

	builder.BuildFull()

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (2, 'Poem 2', 'Poem', '2021', 'Active', 'docx', 'poem2.docx')`)
	createTestDocxFile(t, docDir, "poem2.docx", "New content")

	report, err := builder.UpdateIncremental()
	if err != nil {
		t.Fatalf("UpdateIncremental failed: %v", err)
	}

	if !report.Success {
		t.Error("expected success")
	}
	if report.DocumentCount != 1 {
		t.Errorf("expected 1 document updated, got %d", report.DocumentCount)
	}

	var count int
	ftsDB.Conn().QueryRow("SELECT COUNT(*) FROM content").Scan(&count)
	if count != 2 {
		t.Errorf("expected 2 total content rows, got %d", count)
	}

	ftsDB.Close()
}

func TestIndexBuilderMissingFile(t *testing.T) {
	dir := t.TempDir()
	docDir := filepath.Join(dir, "docs")
	os.MkdirAll(docDir, 0755)

	mainDB := setupTestDB(t, dir)
	defer mainDB.Close()

	mainDB.Exec(`INSERT INTO Works (workID, title, type, year, status, doc_type, path) VALUES (1, 'Missing', 'Poem', '2020', 'Active', 'docx', 'nonexistent.docx')`)

	ftsDB := &Database{path: filepath.Join(dir, "fulltext.db")}
	builder := NewIndexBuilder(ftsDB, mainDB, docDir)

	report, err := builder.BuildFull()
	if err != nil {
		t.Fatalf("BuildFull failed: %v", err)
	}

	if !report.Success {
		t.Error("expected success even with errors")
	}
	if len(report.Errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(report.Errors))
	}
	if report.DocumentCount != 0 {
		t.Errorf("expected 0 documents, got %d", report.DocumentCount)
	}

	ftsDB.Close()
}
