package db

import (
	"database/sql"
	"fmt"
	"os"
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
	{
		Version: 12,
		Name:    "rename_modified_columns",
		Up:      migrateRenameModifiedColumns,
	},
	{
		Version: 13,
		Name:    "drop_is_status_column",
		Up:      migrateDropIsStatusColumn,
	},
	{
		Version: 14,
		Name:    "add_notes_attributes",
		Up:      migrateAddNotesAttributes,
	},
	{
		Version: 15,
		Name:    "add_file_mtime_and_fix_dates",
		Up:      migrateAddFileMtimeAndFixDates,
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

// migrateRenameModifiedColumns renames date_modified to modified_at in Organizations
// and modified_date to modified_at in Notes for consistency across all tables.
func migrateRenameModifiedColumns(tx *sql.Tx) error {
	// SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
	// Rename Organizations.date_modified -> modified_at
	_, err := tx.Exec(`ALTER TABLE Organizations RENAME COLUMN date_modified TO modified_at`)
	if err != nil {
		return fmt.Errorf("rename Organizations.date_modified: %w", err)
	}

	// Rename Notes.modified_date -> modified_at
	_, err = tx.Exec(`ALTER TABLE Notes RENAME COLUMN modified_date TO modified_at`)
	if err != nil {
		return fmt.Errorf("rename Notes.modified_date: %w", err)
	}

	return nil
}

func migrateDropIsStatusColumn(tx *sql.Tx) error {
	// Drop views that depend on Collections table
	_, _ = tx.Exec(`DROP VIEW IF EXISTS WorksView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS CollectionsView`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Collections_new`)

	_, err := tx.Exec(`
		CREATE TABLE Collections_new (
			collID INTEGER PRIMARY KEY AUTOINCREMENT,
			collection_name TEXT NOT NULL,
			type TEXT,
			attributes TEXT DEFAULT '',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			modified_at TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("create Collections_new: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO Collections_new (collID, collection_name, type, attributes, created_at, modified_at)
		SELECT collID, collection_name, type, attributes, created_at, modified_at
		FROM Collections
	`)
	if err != nil {
		return fmt.Errorf("copy data to Collections_new: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Collections`)
	if err != nil {
		return fmt.Errorf("drop old Collections: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Collections_new RENAME TO Collections`)
	if err != nil {
		return fmt.Errorf("rename Collections_new: %w", err)
	}

	// Recreate WorksView
	_, err = tx.Exec(`
		CREATE VIEW WorksView AS
		SELECT 
			w.*,
			CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
			(SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
			(SELECT GROUP_CONCAT(c.collection_name, ', ') 
			 FROM CollectionDetails cd
			 JOIN Collections c ON cd.collID = c.collID
			 WHERE cd.workID = w.workID) AS collection_list
		FROM Works w
	`)
	if err != nil {
		return fmt.Errorf("recreate WorksView: %w", err)
	}

	// Recreate CollectionsView without is_status/status_list
	_, err = tx.Exec(`
		CREATE VIEW CollectionsView AS
		SELECT 
			c.*,
			(SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) AS n_items
		FROM Collections c
	`)
	if err != nil {
		return fmt.Errorf("recreate CollectionsView: %w", err)
	}

	return nil
}

func migrateAddNotesAttributes(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Notes ADD COLUMN attributes TEXT NOT NULL DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add attributes column to Notes: %w", err)
	}
	return nil
}

func migrateAddFileMtimeAndFixDates(tx *sql.Tx) error {
	// Add file_mtime column
	_, err := tx.Exec(`ALTER TABLE Works ADD COLUMN file_mtime INTEGER`)
	if err != nil {
		return fmt.Errorf("add file_mtime column: %w", err)
	}

	// Populate file_mtime from actual files on disk
	rows, err := tx.Query(`SELECT workID, path FROM Works WHERE path IS NOT NULL`)
	if err != nil {
		return fmt.Errorf("query works with paths: %w", err)
	}
	defer rows.Close()

	type workPath struct {
		workID int64
		path   string
	}
	var workPaths []workPath
	for rows.Next() {
		var wp workPath
		if err := rows.Scan(&wp.workID, &wp.path); err != nil {
			return fmt.Errorf("scan work path: %w", err)
		}
		workPaths = append(workPaths, wp)
	}
	rows.Close()

	// Update file_mtime for each work that has a file
	for _, wp := range workPaths {
		if fileInfo, err := os.Stat(wp.path); err == nil {
			mtime := fileInfo.ModTime().Unix()
			_, _ = tx.Exec(`UPDATE Works SET file_mtime = ? WHERE workID = ?`, mtime, wp.workID)
		}
		// Ignore errors - file might not exist anymore
	}

	// Standardize date formats across all tables
	// Note: Organizations has date_added (not created_at), Submissions has submission_date/response_date (not submitted_at/responded_at)
	dateFixQueries := []string{
		`UPDATE Works SET created_at = datetime(created_at) WHERE created_at LIKE '%T%'`,
		`UPDATE Works SET modified_at = datetime(modified_at) WHERE modified_at LIKE '%T%'`,
		`UPDATE Collections SET created_at = datetime(created_at) WHERE created_at LIKE '%T%'`,
		`UPDATE Collections SET modified_at = datetime(modified_at) WHERE modified_at LIKE '%T%'`,
		`UPDATE Organizations SET modified_at = datetime(modified_at) WHERE modified_at LIKE '%T%'`,
		`UPDATE Organizations SET date_added = datetime(date_added) WHERE date_added LIKE '%T%'`,
		`UPDATE Submissions SET created_at = datetime(created_at) WHERE created_at LIKE '%T%'`,
		`UPDATE Submissions SET modified_at = datetime(modified_at) WHERE modified_at LIKE '%T%'`,
		`UPDATE Submissions SET submission_date = datetime(submission_date) WHERE submission_date LIKE '%T%'`,
		`UPDATE Submissions SET response_date = datetime(response_date) WHERE response_date LIKE '%T%'`,
		`UPDATE Notes SET created_at = datetime(created_at) WHERE created_at LIKE '%T%'`,
		`UPDATE Notes SET modified_at = datetime(modified_at) WHERE modified_at LIKE '%T%'`,
	}

	for _, query := range dateFixQueries {
		if _, err := tx.Exec(query); err != nil {
			return fmt.Errorf("fix dates: %w", err)
		}
	}

	return nil
}
