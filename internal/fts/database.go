package fts

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type Database struct {
	mu   sync.RWMutex
	conn *sql.DB
	path string
}

func NewDatabase() *Database {
	homeDir, _ := os.UserHomeDir()
	return &Database{
		path: filepath.Join(homeDir, ".works", "fulltext.db"),
	}
}

func (db *Database) Path() string {
	return db.path
}

func (db *Database) IsOpen() bool {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.conn != nil
}

func (db *Database) Exists() bool {
	_, err := os.Stat(db.path)
	return err == nil
}

func (db *Database) Open() error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.conn != nil {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(db.path), 0755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}

	conn, err := sql.Open("sqlite", db.path)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	conn.SetMaxOpenConns(1)

	if _, err := conn.Exec("PRAGMA journal_mode=WAL"); err != nil {
		conn.Close()
		return fmt.Errorf("set WAL mode: %w", err)
	}

	if err := db.createSchema(conn); err != nil {
		conn.Close()
		return fmt.Errorf("create schema: %w", err)
	}

	db.conn = conn
	return nil
}

func (db *Database) Close() error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.conn == nil {
		return nil
	}

	err := db.conn.Close()
	db.conn = nil
	return err
}

func (db *Database) ensureOpen() error {
	if db.IsOpen() {
		return nil
	}
	return db.Open()
}

func (db *Database) Delete() error {
	if err := db.Close(); err != nil {
		return err
	}

	if err := os.Remove(db.path); err != nil && !os.IsNotExist(err) {
		return err
	}

	walPath := db.path + "-wal"
	if err := os.Remove(walPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	shmPath := db.path + "-shm"
	if err := os.Remove(shmPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func (db *Database) createSchema(conn *sql.DB) error {
	schema := `
		CREATE TABLE IF NOT EXISTS fts_meta (
			key TEXT PRIMARY KEY,
			value TEXT
		);

		CREATE TABLE IF NOT EXISTS content (
			work_id INTEGER PRIMARY KEY,
			text_content TEXT NOT NULL,
			word_count INTEGER,
			extracted_at TEXT NOT NULL,
			source_mtime INTEGER NOT NULL,
			source_size INTEGER,
			headings TEXT,
			dateline TEXT
		);
	`

	if _, err := conn.Exec(schema); err != nil {
		return err
	}

	if err := db.migrateSchema(conn); err != nil {
		return err
	}

	var ftsExists int
	err := conn.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master 
		WHERE type='table' AND name='content_fts'
	`).Scan(&ftsExists)
	if err != nil {
		return err
	}

	if ftsExists == 0 {
		ftsSchema := `
			CREATE VIRTUAL TABLE content_fts USING fts5(
				text_content,
				content='content',
				content_rowid='work_id',
				tokenize='porter unicode61'
			);

			CREATE TRIGGER IF NOT EXISTS content_ai AFTER INSERT ON content BEGIN
				INSERT INTO content_fts(rowid, text_content) 
				VALUES (NEW.work_id, NEW.text_content);
			END;

			CREATE TRIGGER IF NOT EXISTS content_ad AFTER DELETE ON content BEGIN
				INSERT INTO content_fts(content_fts, rowid, text_content) 
				VALUES ('delete', OLD.work_id, OLD.text_content);
			END;

			CREATE TRIGGER IF NOT EXISTS content_au AFTER UPDATE ON content BEGIN
				INSERT INTO content_fts(content_fts, rowid, text_content) 
				VALUES ('delete', OLD.work_id, OLD.text_content);
				INSERT INTO content_fts(rowid, text_content) 
				VALUES (NEW.work_id, NEW.text_content);
			END;
		`
		if _, err := conn.Exec(ftsSchema); err != nil {
			return err
		}
	}

	return db.initMeta(conn)
}

func (db *Database) migrateSchema(conn *sql.DB) error {
	columns := []string{"headings", "dateline"}
	for _, col := range columns {
		var count int
		err := conn.QueryRow(`
			SELECT COUNT(*) FROM pragma_table_info('content') WHERE name = ?
		`, col).Scan(&count)
		if err != nil {
			return fmt.Errorf("check column %s: %w", col, err)
		}
		if count == 0 {
			_, err = conn.Exec(fmt.Sprintf("ALTER TABLE content ADD COLUMN %s TEXT", col))
			if err != nil {
				return fmt.Errorf("add column %s: %w", col, err)
			}
		}
	}
	return nil
}

func (db *Database) initMeta(conn *sql.DB) error {
	var count int
	err := conn.QueryRow("SELECT COUNT(*) FROM fts_meta WHERE key='version'").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		now := time.Now().Format(time.RFC3339)
		_, err = conn.Exec(`
			INSERT INTO fts_meta (key, value) VALUES 
			('version', '1'),
			('created_at', ?),
			('document_count', '0'),
			('total_words', '0')
		`, now)
		return err
	}

	return nil
}

func (db *Database) GetMeta(key string) (string, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if db.conn == nil {
		return "", fmt.Errorf("database not open")
	}

	var value string
	err := db.conn.QueryRow("SELECT value FROM fts_meta WHERE key=?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func (db *Database) SetMeta(key, value string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.conn == nil {
		return fmt.Errorf("database not open")
	}

	_, err := db.conn.Exec(`
		INSERT INTO fts_meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value
	`, key, value)
	return err
}

func (db *Database) Conn() *sql.DB {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.conn
}

func (db *Database) Size() (int64, error) {
	info, err := os.Stat(db.path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	return info.Size(), nil
}

func (db *Database) UpdateWorkHeadings(workID int64, headingsJSON string, dateline string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.conn == nil {
		return fmt.Errorf("database not open")
	}

	_, err := db.conn.Exec(`
		UPDATE content SET headings = ?, dateline = ? WHERE work_id = ?
	`, headingsJSON, dateline, workID)
	return err
}
