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

	_, err = conn.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

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
