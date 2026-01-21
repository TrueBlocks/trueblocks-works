package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

const (
	whereNotDeleted = ` WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')`
	andNotDeleted   = ` AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')`
)

type DB struct {
	conn *sql.DB
	path string
}

func New(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Force single connection to ensure PRAGMA foreign_keys is always active
	// This prevents connection pool issues where new connections don't have the pragma set
	conn.SetMaxOpenConns(1)
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(0) // connections never expire

	// Enable foreign keys
	_, err = conn.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	// Enable trusted schema for FTS triggers
	_, err = conn.Exec("PRAGMA trusted_schema = ON")
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("enable trusted schema: %w", err)
	}

	// Set WAL mode
	_, err = conn.Exec("PRAGMA journal_mode = WAL")
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}

	return &DB{conn: conn, path: dbPath}, nil
}

func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

func (db *DB) Conn() *sql.DB {
	return db.conn
}

func (db *DB) Path() string {
	return db.path
}

func (db *DB) IsInitialized() (bool, error) {
	var count int
	query := "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Works'"
	err := db.conn.QueryRow(query).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
