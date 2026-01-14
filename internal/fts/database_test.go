package fts

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewDatabase(t *testing.T) {
	db := NewDatabase()
	if db == nil {
		t.Fatal("NewDatabase returned nil")
	}

	homeDir, _ := os.UserHomeDir()
	expected := filepath.Join(homeDir, ".works", "fulltext.db")
	if db.Path() != expected {
		t.Errorf("expected path %s, got %s", expected, db.Path())
	}
}

func TestDatabaseOpenClose(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	if db.IsOpen() {
		t.Error("database should not be open initially")
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	if !db.IsOpen() {
		t.Error("database should be open after Open()")
	}

	if !db.Exists() {
		t.Error("database file should exist after Open()")
	}

	if err := db.Open(); err != nil {
		t.Errorf("second Open should be no-op, got: %v", err)
	}

	if err := db.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	if db.IsOpen() {
		t.Error("database should not be open after Close()")
	}
}

func TestDatabaseSchema(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	conn := db.Conn()

	tables := []string{"fts_meta", "content", "content_fts"}
	for _, table := range tables {
		var count int
		err := conn.QueryRow(`
			SELECT COUNT(*) FROM sqlite_master 
			WHERE type='table' AND name=?
		`, table).Scan(&count)
		if err != nil {
			t.Errorf("query for table %s failed: %v", table, err)
		}
		if count == 0 {
			t.Errorf("table %s should exist", table)
		}
	}

	triggers := []string{"content_ai", "content_ad", "content_au"}
	for _, trigger := range triggers {
		var count int
		err := conn.QueryRow(`
			SELECT COUNT(*) FROM sqlite_master 
			WHERE type='trigger' AND name=?
		`, trigger).Scan(&count)
		if err != nil {
			t.Errorf("query for trigger %s failed: %v", trigger, err)
		}
		if count == 0 {
			t.Errorf("trigger %s should exist", trigger)
		}
	}
}

func TestDatabaseMeta(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	version, err := db.GetMeta("version")
	if err != nil {
		t.Errorf("GetMeta version failed: %v", err)
	}
	if version != "1" {
		t.Errorf("expected version '1', got '%s'", version)
	}

	if err := db.SetMeta("test_key", "test_value"); err != nil {
		t.Errorf("SetMeta failed: %v", err)
	}

	value, err := db.GetMeta("test_key")
	if err != nil {
		t.Errorf("GetMeta test_key failed: %v", err)
	}
	if value != "test_value" {
		t.Errorf("expected 'test_value', got '%s'", value)
	}

	if err := db.SetMeta("test_key", "updated_value"); err != nil {
		t.Errorf("SetMeta update failed: %v", err)
	}

	value, err = db.GetMeta("test_key")
	if err != nil {
		t.Errorf("GetMeta after update failed: %v", err)
	}
	if value != "updated_value" {
		t.Errorf("expected 'updated_value', got '%s'", value)
	}
}

func TestDatabaseDelete(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	if !db.Exists() {
		t.Error("database should exist after Open()")
	}

	if err := db.Delete(); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if db.Exists() {
		t.Error("database should not exist after Delete()")
	}

	if db.IsOpen() {
		t.Error("database should be closed after Delete()")
	}
}

func TestDatabaseSize(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	size, err := db.Size()
	if err != nil {
		t.Errorf("Size on non-existent db failed: %v", err)
	}
	if size != 0 {
		t.Errorf("expected size 0 for non-existent db, got %d", size)
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	size, err = db.Size()
	if err != nil {
		t.Errorf("Size failed: %v", err)
	}
	if size == 0 {
		t.Error("expected non-zero size after Open()")
	}
}

func TestFTS5Functionality(t *testing.T) {
	db := &Database{
		path: filepath.Join(t.TempDir(), "test_fulltext.db"),
	}

	if err := db.Open(); err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	conn := db.Conn()

	_, err := conn.Exec(`
		INSERT INTO content (work_id, text_content, word_count, extracted_at, source_mtime, source_size)
		VALUES (1, 'The morning light falls on the water', 7, datetime('now'), 1000, 500)
	`)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	var count int
	err = conn.QueryRow(`
		SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH 'morning'
	`).Scan(&count)
	if err != nil {
		t.Fatalf("FTS search failed: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 match for 'morning', got %d", count)
	}

	err = conn.QueryRow(`
		SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH 'light water'
	`).Scan(&count)
	if err != nil {
		t.Fatalf("FTS multi-term search failed: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 match for 'light water', got %d", count)
	}

	err = conn.QueryRow(`
		SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH 'nonexistent'
	`).Scan(&count)
	if err != nil {
		t.Fatalf("FTS no-match search failed: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 matches for 'nonexistent', got %d", count)
	}
}
