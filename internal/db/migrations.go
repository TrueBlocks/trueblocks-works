package db

import (
	"database/sql"
	"fmt"
)

// Migration represents a database schema migration.
// Migrations are applied in order by version number.
type Migration struct {
	Version int
	Name    string
	Up      func(*sql.Tx) error
}

// migrations contains all migrations to be applied.
// Note: Migrations 1-10 have been squashed into the initial schema (001_initial_schema.sql).
// New databases start with all migrations pre-applied via INSERT statements in the schema file.
// Future migrations should start at version 11+.
var migrations = []Migration{
	{
		Version: 11,
		Name:    "fts_notes_and_submissions",
		Up:      migrateFTSNotesAndSubmissions,
	},
}

// RunMigrations applies any pending migrations to the database.
func (db *DB) RunMigrations() error {
	if err := db.ensureMigrationsTable(); err != nil {
		return fmt.Errorf("ensure migrations table: %w", err)
	}

	for _, m := range migrations {
		applied, err := db.isMigrationApplied(m.Version)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", m.Version, err)
		}
		if applied {
			continue
		}

		if err := db.runMigrationInTransaction(m); err != nil {
			return fmt.Errorf("run migration %d (%s): %w", m.Version, m.Name, err)
		}
	}

	return nil
}

func (db *DB) runMigrationInTransaction(m Migration) error {
	// Disable foreign keys during migration to allow table recreation
	_, _ = db.conn.Exec(`PRAGMA foreign_keys = OFF`)
	defer func() { _, _ = db.conn.Exec(`PRAGMA foreign_keys = ON`) }()

	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := m.Up(tx); err != nil {
		return err
	}

	_, err = tx.Exec("INSERT INTO schema_migrations (version, description) VALUES (?, ?)", m.Version, m.Name)
	if err != nil {
		return fmt.Errorf("mark migration applied: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

func (db *DB) ensureMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
			description TEXT
		)
	`
	_, err := db.conn.Exec(query)
	return err
}

func (db *DB) isMigrationApplied(version int) (bool, error) {
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func migrateFTSNotesAndSubmissions(tx *sql.Tx) error {
	// Drop old notes_fts (was not properly configured as content table)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS notes_fts`)

	// Create notes_fts as content table linked to Notes
	_, err := tx.Exec(`
		CREATE VIRTUAL TABLE notes_fts USING fts5(
			note,
			type,
			content='Notes',
			content_rowid='id',
			tokenize='porter'
		)
	`)
	if err != nil {
		return fmt.Errorf("create notes_fts: %w", err)
	}

	// Populate notes_fts from existing Notes
	_, err = tx.Exec(`INSERT INTO notes_fts(rowid, note, type) SELECT id, note, type FROM Notes`)
	if err != nil {
		return fmt.Errorf("populate notes_fts: %w", err)
	}

	// Create triggers to keep notes_fts in sync
	_, err = tx.Exec(`
		CREATE TRIGGER notes_fts_ai AFTER INSERT ON Notes BEGIN
			INSERT INTO notes_fts(rowid, note, type) VALUES (NEW.id, NEW.note, NEW.type);
		END
	`)
	if err != nil {
		return fmt.Errorf("create notes_fts_ai trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER notes_fts_ad AFTER DELETE ON Notes BEGIN
			INSERT INTO notes_fts(notes_fts, rowid, note, type) VALUES ('delete', OLD.id, OLD.note, OLD.type);
		END
	`)
	if err != nil {
		return fmt.Errorf("create notes_fts_ad trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER notes_fts_au AFTER UPDATE ON Notes BEGIN
			INSERT INTO notes_fts(notes_fts, rowid, note, type) VALUES ('delete', OLD.id, OLD.note, OLD.type);
			INSERT INTO notes_fts(rowid, note, type) VALUES (NEW.id, NEW.note, NEW.type);
		END
	`)
	if err != nil {
		return fmt.Errorf("create notes_fts_au trigger: %w", err)
	}

	// Create submissions_fts for searching submissions
	_, err = tx.Exec(`
		CREATE VIRTUAL TABLE submissions_fts USING fts5(
			contest_name,
			content='Submissions',
			content_rowid='submissionID',
			tokenize='porter'
		)
	`)
	if err != nil {
		return fmt.Errorf("create submissions_fts: %w", err)
	}

	// Populate submissions_fts from existing Submissions
	_, err = tx.Exec(`INSERT INTO submissions_fts(rowid, contest_name) SELECT submissionID, contest_name FROM Submissions`)
	if err != nil {
		return fmt.Errorf("populate submissions_fts: %w", err)
	}

	// Create triggers to keep submissions_fts in sync
	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_ai AFTER INSERT ON Submissions BEGIN
			INSERT INTO submissions_fts(rowid, contest_name) VALUES (NEW.submissionID, NEW.contest_name);
		END
	`)
	if err != nil {
		return fmt.Errorf("create submissions_fts_ai trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_ad AFTER DELETE ON Submissions BEGIN
			INSERT INTO submissions_fts(submissions_fts, rowid, contest_name) VALUES ('delete', OLD.submissionID, OLD.contest_name);
		END
	`)
	if err != nil {
		return fmt.Errorf("create submissions_fts_ad trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_au AFTER UPDATE ON Submissions BEGIN
			INSERT INTO submissions_fts(submissions_fts, rowid, contest_name) VALUES ('delete', OLD.submissionID, OLD.contest_name);
			INSERT INTO submissions_fts(rowid, contest_name) VALUES (NEW.submissionID, NEW.contest_name);
		END
	`)
	if err != nil {
		return fmt.Errorf("create submissions_fts_au trigger: %w", err)
	}

	return nil
}
