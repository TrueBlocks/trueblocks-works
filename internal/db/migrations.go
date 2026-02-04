package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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
	{
		Version: 16,
		Name:    "add_cascade_deletes",
		Up:      migrateAddCascadeDeletes,
	},
	{
		Version: 17,
		Name:    "delete_orphan_collection_details",
		Up:      migrateDeleteOrphanCollectionDetails,
	},
	{
		Version: 18,
		Name:    "add_n_notes_to_works_view",
		Up:      migrateAddNNotesToWorksView,
	},
	{
		Version: 19,
		Name:    "add_quality_at_publish",
		Up:      migrateAddQualityAtPublish,
	},
	{
		Version: 20,
		Name:    "add_book_publishing_support",
		Up:      migrateAddBookPublishingSupport,
	},
	{
		Version: 21,
		Name:    "add_book_typography_fields",
		Up:      migrateAddBookTypographyFields,
	},
	{
		Version: 22,
		Name:    "add_selected_parts_to_books",
		Up:      migrateAddSelectedPartsToBooks,
	},
	{
		Version: 23,
		Name:    "add_is_marked_to_works",
		Up:      migrateAddIsMarkedToWorks,
	},
	{
		Version: 24,
		Name:    "add_is_suppressed_to_collection_details",
		Up:      migrateAddIsSuppressedToCollectionDetails,
	},
	{
		Version: 25,
		Name:    "add_title_page_typography",
		Up:      migrateAddTitlePageTypography,
	},
	{
		Version: 26,
		Name:    "add_book_cover_fields",
		Up:      migrateAddBookCoverFields,
	},
	{
		Version: 27,
		Name:    "add_book_description_fields",
		Up:      migrateAddBookDescriptionFields,
	},
	{
		Version: 28,
		Name:    "add_title_page_offsets",
		Up:      migrateAddTitlePageOffsets,
	},
	{
		Version: 29,
		Name:    "add_book_cover_metadata",
		Up:      migrateAddBookCoverMetadata,
	},
	{
		Version: 30,
		Name:    "drop_deprecated_font_columns",
		Up:      migrateDropDeprecatedFontColumns,
	},
	{
		Version: 31,
		Name:    "add_part_id_to_collection_details",
		Up:      migrateAddPartIDToCollectionDetails,
	},
	{
		Version: 32,
		Name:    "add_kdp_publishing_fields",
		Up:      migrateAddKdpPublishingFields,
	},
	{
		Version: 33,
		Name:    "add_kdp_proof_ordered",
		Up:      migrateAddKdpProofOrdered,
	},
	{
		Version: 34,
		Name:    "add_skip_audits_to_works",
		Up:      migrateAddSkipAuditsToWorks,
	},
	{
		Version: 35,
		Name:    "add_page_numbers_flush_outside",
		Up:      migrateAddPageNumbersFlushOutside,
	},
	{
		Version: 36,
		Name:    "add_show_headers_to_books",
		Up:      migrateAddShowHeadersToBooks,
	},
	{
		Version: 37,
		Name:    "add_book_type_to_books",
		Up:      migrateAddBookTypeToBooks,
	},
	{
		Version: 38,
		Name:    "add_page_numbers_on_opening_pages",
		Up:      migrateAddPageNumbersOnOpeningPages,
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

func migrateAddCascadeDeletes(tx *sql.Tx) error {
	// Add CASCADE deletes to foreign keys in Submissions and CollectionDetails
	// This requires recreating the tables since SQLite doesn't support ALTER TABLE for FKs

	// Drop ALL dependent views that reference Submissions or CollectionDetails tables
	_, _ = tx.Exec(`DROP VIEW IF EXISTS SubmissionsView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS OrganizationsView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS WorksView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS CollectionsView`)

	// Drop FTS for Submissions (will recreate later)
	_, _ = tx.Exec(`DROP TRIGGER IF EXISTS submissions_fts_insert`)
	_, _ = tx.Exec(`DROP TRIGGER IF EXISTS submissions_fts_update`)
	_, _ = tx.Exec(`DROP TRIGGER IF EXISTS submissions_fts_delete`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS submissions_fts`)

	// Drop indexes on tables we're recreating
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_submissions_workid`)
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_submissions_orgid`)
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_submissions_response`)
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_submissions_date`)
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_colldet_collid`)
	_, _ = tx.Exec(`DROP INDEX IF EXISTS idx_colldet_workid`)

	// Recreate Submissions with CASCADE on both foreign keys
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Submissions_new`)
	_, err := tx.Exec(`
		CREATE TABLE Submissions_new (
			submissionID INTEGER PRIMARY KEY AUTOINCREMENT,
			workID INTEGER NOT NULL,
			orgID INTEGER NOT NULL,
			draft TEXT,
			submission_date TEXT,
			submission_type TEXT,
			query_date TEXT,
			response_date TEXT,
			response_type TEXT,
			contest_name TEXT,
			cost REAL,
			user_id TEXT,
			password TEXT,
			web_address TEXT,
			attributes TEXT DEFAULT '',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
			FOREIGN KEY (orgID) REFERENCES Organizations(orgID) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return fmt.Errorf("create Submissions_new: %w", err)
	}

	_, err = tx.Exec(`INSERT INTO Submissions_new SELECT * FROM Submissions`)
	if err != nil {
		return fmt.Errorf("copy Submissions data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Submissions`)
	if err != nil {
		return fmt.Errorf("drop old Submissions: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Submissions_new RENAME TO Submissions`)
	if err != nil {
		return fmt.Errorf("rename Submissions_new: %w", err)
	}

	// Recreate CollectionDetails with CASCADE on collID
	_, _ = tx.Exec(`DROP TABLE IF EXISTS CollectionDetails_new`)
	_, err = tx.Exec(`
		CREATE TABLE CollectionDetails_new (
			id INTEGER PRIMARY KEY,
			collID INTEGER NOT NULL,
			workID INTEGER NOT NULL,
			position INTEGER DEFAULT 0,
			FOREIGN KEY (collID) REFERENCES Collections(collID) ON DELETE CASCADE,
			FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
			UNIQUE(collID, workID)
		)
	`)
	if err != nil {
		return fmt.Errorf("create CollectionDetails_new: %w", err)
	}

	_, err = tx.Exec(`INSERT INTO CollectionDetails_new SELECT * FROM CollectionDetails`)
	if err != nil {
		return fmt.Errorf("copy CollectionDetails data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE CollectionDetails`)
	if err != nil {
		return fmt.Errorf("drop old CollectionDetails: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE CollectionDetails_new RENAME TO CollectionDetails`)
	if err != nil {
		return fmt.Errorf("rename CollectionDetails_new: %w", err)
	}

	// Recreate indexes
	_, _ = tx.Exec(`CREATE INDEX idx_submissions_workid ON Submissions(workID)`)
	_, _ = tx.Exec(`CREATE INDEX idx_submissions_orgid ON Submissions(orgID)`)
	_, _ = tx.Exec(`CREATE INDEX idx_submissions_response ON Submissions(response_type)`)
	_, _ = tx.Exec(`CREATE INDEX idx_submissions_date ON Submissions(submission_date)`)
	_, _ = tx.Exec(`CREATE INDEX idx_colldet_collid ON CollectionDetails(collID)`)
	_, _ = tx.Exec(`CREATE INDEX idx_colldet_workid ON CollectionDetails(workID)`)

	// Recreate SubmissionsView
	_, err = tx.Exec(`
		CREATE VIEW SubmissionsView AS
		SELECT 
			s.*,
			w.title AS title_of_work,
			o.name AS journal_name,
			COALESCE(o.status, 'Open') AS journal_status,
			CASE 
				WHEN s.response_date IS NULL AND (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting')
				THEN 'yes' 
				ELSE 'no' 
			END AS decision_pending
		FROM Submissions s
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
	`)
	if err != nil {
		return fmt.Errorf("recreate SubmissionsView: %w", err)
	}

	// Recreate FTS for Submissions
	_, err = tx.Exec(`
		CREATE VIRTUAL TABLE submissions_fts USING fts5(
			title_of_work,
			journal_name,
			draft,
			submission_type,
			response_type,
			contest_name,
			content=SubmissionsView,
			content_rowid=submissionID,
			tokenize='porter unicode61 remove_diacritics 2'
		)
	`)
	if err != nil {
		return fmt.Errorf("recreate submissions_fts: %w", err)
	}

	// Recreate FTS triggers for Submissions
	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_insert AFTER INSERT ON Submissions BEGIN
			INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
			SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
			FROM SubmissionsView WHERE submissionID = NEW.submissionID;
		END
	`)
	if err != nil {
		return fmt.Errorf("create insert trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_update AFTER UPDATE ON Submissions BEGIN
			DELETE FROM submissions_fts WHERE rowid = OLD.submissionID;
			INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
			SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
			FROM SubmissionsView WHERE submissionID = NEW.submissionID;
		END
	`)
	if err != nil {
		return fmt.Errorf("create update trigger: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TRIGGER submissions_fts_delete AFTER DELETE ON Submissions BEGIN
			DELETE FROM submissions_fts WHERE rowid = OLD.submissionID;
		END
	`)
	if err != nil {
		return fmt.Errorf("create delete trigger: %w", err)
	}

	// Rebuild FTS index
	_, err = tx.Exec(`
		INSERT INTO submissions_fts(rowid, title_of_work, journal_name, draft, submission_type, response_type, contest_name)
		SELECT submissionID, title_of_work, journal_name, draft, submission_type, response_type, contest_name
		FROM SubmissionsView
	`)
	if err != nil {
		return fmt.Errorf("rebuild FTS index: %w", err)
	}

	// Recreate OrganizationsView
	_, err = tx.Exec(`
		CREATE VIEW OrganizationsView AS
		SELECT 
			o.*,
			(o.n_push_fiction + o.n_push_nonfiction + o.n_push_poetry) AS n_pushcarts,
			(CASE WHEN o.n_push_poetry > 0 THEN 1000 ELSE 2000 END + COALESCE(o.ranking, 9999)) AS rating,
			(SELECT COUNT(*) FROM Submissions s WHERE s.orgID = o.orgID) AS n_submissions
		FROM Organizations o
	`)
	if err != nil {
		return fmt.Errorf("recreate OrganizationsView: %w", err)
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

	// Recreate CollectionsView
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

func migrateDeleteOrphanCollectionDetails(tx *sql.Tx) error {
	// Delete orphan CollectionDetails with invalid collID (0 or non-existent collections)
	result, err := tx.Exec(`DELETE FROM CollectionDetails WHERE collID = 0 OR collID NOT IN (SELECT collID FROM Collections)`)
	if err != nil {
		return fmt.Errorf("delete orphan collection details (invalid collID): %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Fprintf(os.Stderr, "INFO | Migration 017: Deleted %d orphan CollectionDetails records (invalid collID)\\n", rowsAffected)
	}

	// Delete orphan CollectionDetails with invalid workID (non-existent works)
	result, err = tx.Exec(`DELETE FROM CollectionDetails WHERE workID NOT IN (SELECT workID FROM Works)`)
	if err != nil {
		return fmt.Errorf("delete orphan collection details (invalid workID): %w", err)
	}

	rowsAffected, _ = result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Fprintf(os.Stderr, "INFO | Migration 017: Deleted %d orphan CollectionDetails records (invalid workID)\\n", rowsAffected)
	}

	return nil
}

func migrateAddNNotesToWorksView(tx *sql.Tx) error {
	_, _ = tx.Exec(`DROP VIEW IF EXISTS WorksView`)

	_, err := tx.Exec(`
		CREATE VIEW WorksView AS
		SELECT 
			w.*,
			CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
			(SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
			(SELECT COUNT(*) FROM Notes n WHERE n.entity_type = 'work' AND n.entity_id = w.workID) AS n_notes,
			(SELECT GROUP_CONCAT(c.collection_name, ', ') 
			 FROM CollectionDetails cd
			 JOIN Collections c ON cd.collID = c.collID
			 WHERE cd.workID = w.workID) AS collection_list
		FROM Works w
	`)
	if err != nil {
		return fmt.Errorf("recreate WorksView with n_notes: %w", err)
	}

	return nil
}

func migrateAddQualityAtPublish(tx *sql.Tx) error {
	// Add the new column
	_, err := tx.Exec(`ALTER TABLE Works ADD COLUMN quality_at_publish TEXT`)
	if err != nil {
		return fmt.Errorf("add quality_at_publish column: %w", err)
	}

	// For existing Published works: copy quality to quality_at_publish, set quality to "Published"
	_, err = tx.Exec(`UPDATE Works SET quality_at_publish = quality, quality = 'Published' WHERE status = 'Published'`)
	if err != nil {
		return fmt.Errorf("update existing published works: %w", err)
	}

	return nil
}

func migrateAddBookPublishingSupport(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Collections ADD COLUMN is_book INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add is_book column to Collections: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Works ADD COLUMN is_template_clean INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add is_template_clean column to Works: %w", err)
	}

	_, err = tx.Exec(`
		CREATE TABLE Books (
			bookID INTEGER PRIMARY KEY AUTOINCREMENT,
			collID INTEGER NOT NULL UNIQUE,
			title TEXT NOT NULL,
			subtitle TEXT,
			author TEXT DEFAULT 'Thomas Jay Rush',
			copyright TEXT,
			dedication TEXT,
			acknowledgements TEXT,
			about_author TEXT,
			cover_path TEXT,
			isbn TEXT,
			published_date TEXT,
			template_path TEXT,
			export_path TEXT,
			status TEXT DEFAULT 'draft',
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (collID) REFERENCES Collections(collID)
		)
	`)
	if err != nil {
		return fmt.Errorf("create Books table: %w", err)
	}

	_, err = tx.Exec(`CREATE INDEX idx_books_collid ON Books(collID)`)
	if err != nil {
		return fmt.Errorf("create index on Books.collID: %w", err)
	}

	return nil
}

func migrateAddBookTypographyFields(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN header_font TEXT`)
	if err != nil {
		return fmt.Errorf("add header_font column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN header_size INTEGER`)
	if err != nil {
		return fmt.Errorf("add header_size column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN page_num_font TEXT`)
	if err != nil {
		return fmt.Errorf("add page_num_font column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN page_num_size INTEGER`)
	if err != nil {
		return fmt.Errorf("add page_num_size column to Books: %w", err)
	}

	return nil
}

func migrateAddSelectedPartsToBooks(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN selected_parts TEXT`)
	if err != nil {
		return fmt.Errorf("add selected_parts column to Books: %w", err)
	}
	return nil
}

func migrateAddIsMarkedToWorks(tx *sql.Tx) error {
	// Add new is_marked column
	_, err := tx.Exec(`ALTER TABLE Works ADD COLUMN is_marked INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add is_marked column to Works: %w", err)
	}
	// Clear all marks (both old and new fields)
	_, _ = tx.Exec(`UPDATE Works SET is_marked = 0, is_template_clean = 0`)
	return nil
}

func migrateAddIsSuppressedToCollectionDetails(tx *sql.Tx) error {
	// Add is_suppressed column to CollectionDetails for per-collection suppression
	_, err := tx.Exec(`ALTER TABLE CollectionDetails ADD COLUMN is_suppressed INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add is_suppressed column to CollectionDetails: %w", err)
	}
	return nil
}

func migrateAddTitlePageTypography(tx *sql.Tx) error {
	// Title page typography
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN title_font TEXT`)
	if err != nil {
		return fmt.Errorf("add title_font column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN title_size INTEGER`)
	if err != nil {
		return fmt.Errorf("add title_size column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN subtitle_font TEXT`)
	if err != nil {
		return fmt.Errorf("add subtitle_font column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN subtitle_size INTEGER`)
	if err != nil {
		return fmt.Errorf("add subtitle_size column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN author_font TEXT`)
	if err != nil {
		return fmt.Errorf("add author_font column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN author_size INTEGER`)
	if err != nil {
		return fmt.Errorf("add author_size column to Books: %w", err)
	}

	// Layout options
	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN works_start_recto INTEGER DEFAULT 1`)
	if err != nil {
		return fmt.Errorf("add works_start_recto column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN show_page_numbers INTEGER DEFAULT 1`)
	if err != nil {
		return fmt.Errorf("add show_page_numbers column to Books: %w", err)
	}

	return nil
}

func migrateAddBookCoverFields(tx *sql.Tx) error {
	// Add front cover path
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN front_cover_path TEXT`)
	if err != nil {
		return fmt.Errorf("add front_cover_path column to Books: %w", err)
	}

	// Add back cover path
	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN back_cover_path TEXT`)
	if err != nil {
		return fmt.Errorf("add back_cover_path column to Books: %w", err)
	}

	// Add spine text (for full wraparound cover generation)
	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN spine_text TEXT`)
	if err != nil {
		return fmt.Errorf("add spine_text column to Books: %w", err)
	}

	// Copy existing cover_path to front_cover_path
	_, err = tx.Exec(`UPDATE Books SET front_cover_path = cover_path WHERE cover_path IS NOT NULL`)
	if err != nil {
		return fmt.Errorf("copy cover_path to front_cover_path: %w", err)
	}

	return nil
}

func migrateAddBookDescriptionFields(tx *sql.Tx) error {
	// Add short description
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN description_short TEXT`)
	if err != nil {
		return fmt.Errorf("add description_short column to Books: %w", err)
	}

	// Add long description
	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN description_long TEXT`)
	if err != nil {
		return fmt.Errorf("add description_long column to Books: %w", err)
	}

	return nil
}

func migrateAddTitlePageOffsets(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN title_offset_y INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add title_offset_y column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN subtitle_offset_y INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add subtitle_offset_y column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN author_offset_y INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add author_offset_y column to Books: %w", err)
	}

	return nil
}

func migrateAddBookCoverMetadata(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN publisher TEXT DEFAULT 'Stony Lane Press'`)
	if err != nil {
		return fmt.Errorf("add publisher column to Books: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Books ADD COLUMN background_color TEXT DEFAULT '#F5F5DC'`)
	if err != nil {
		return fmt.Errorf("add background_color column to Books: %w", err)
	}

	return nil
}

// migrateDropDeprecatedFontColumns removes font styling columns that are now derived from DOCX template
func migrateDropDeprecatedFontColumns(tx *sql.Tx) error {
	// SQLite doesn't support DROP COLUMN well, so we recreate the table
	// Per §17a: wrap in transaction (already done), use idempotent statements

	// Clean up any failed previous attempt
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Books_new`)

	// Create new table without the deprecated columns
	_, err := tx.Exec(`CREATE TABLE Books_new (
		bookID INTEGER PRIMARY KEY AUTOINCREMENT,
		collID INTEGER NOT NULL UNIQUE,
		title TEXT NOT NULL,
		subtitle TEXT,
		author TEXT DEFAULT 'Thomas Jay Rush',
		copyright TEXT,
		dedication TEXT,
		acknowledgements TEXT,
		about_author TEXT,
		cover_path TEXT,
		front_cover_path TEXT,
		back_cover_path TEXT,
		spine_text TEXT,
		description_short TEXT,
		description_long TEXT,
		isbn TEXT,
		published_date TEXT,
		template_path TEXT,
		export_path TEXT,
		status TEXT DEFAULT 'draft',
		title_offset_y INTEGER DEFAULT 0,
		subtitle_offset_y INTEGER DEFAULT 0,
		author_offset_y INTEGER DEFAULT 0,
		publisher TEXT DEFAULT 'Stony Lane Press',
		background_color TEXT DEFAULT '#F5F5DC',
		works_start_recto INTEGER DEFAULT 1,
		show_page_numbers INTEGER DEFAULT 1,
		selected_parts TEXT,
		created_at TEXT DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (collID) REFERENCES Collections(collID)
	)`)
	if err != nil {
		return fmt.Errorf("create Books_new: %w", err)
	}

	// Copy data (excluding deprecated columns)
	_, err = tx.Exec(`INSERT INTO Books_new (
		bookID, collID, title, subtitle, author, copyright, dedication,
		acknowledgements, about_author, cover_path, front_cover_path, back_cover_path,
		spine_text, description_short, description_long, isbn, published_date,
		template_path, export_path, status, title_offset_y, subtitle_offset_y,
		author_offset_y, publisher, background_color, works_start_recto,
		show_page_numbers, selected_parts, created_at, updated_at
	) SELECT
		bookID, collID, title, subtitle, author, copyright, dedication,
		acknowledgements, about_author, cover_path, front_cover_path, back_cover_path,
		spine_text, description_short, description_long, isbn, published_date,
		template_path, export_path, status, title_offset_y, subtitle_offset_y,
		author_offset_y, publisher, background_color, works_start_recto,
		show_page_numbers, selected_parts, created_at, updated_at
	FROM Books`)
	if err != nil {
		return fmt.Errorf("copy data to Books_new: %w", err)
	}

	// Drop old table
	_, err = tx.Exec(`DROP TABLE Books`)
	if err != nil {
		return fmt.Errorf("drop old Books table: %w", err)
	}

	// Rename new table
	_, err = tx.Exec(`ALTER TABLE Books_new RENAME TO Books`)
	if err != nil {
		return fmt.Errorf("rename Books_new to Books: %w", err)
	}

	// Recreate index
	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_books_collid ON Books(collID)`)
	if err != nil {
		return fmt.Errorf("recreate Books index: %w", err)
	}

	return nil
}

// migrateAddPartIDToCollectionDetails adds part_id column to CollectionDetails
// and populates it based on current collection ordering, then cleans old title-based caches.
func migrateAddPartIDToCollectionDetails(tx *sql.Tx) error {
	// Add part_id column
	_, err := tx.Exec(`ALTER TABLE CollectionDetails ADD COLUMN part_id INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add part_id column: %w", err)
	}

	// Get all collections
	rows, err := tx.Query(`SELECT DISTINCT collID FROM CollectionDetails`)
	if err != nil {
		return fmt.Errorf("get collections: %w", err)
	}
	defer rows.Close()

	var collIDs []int64
	for rows.Next() {
		var collID int64
		if err := rows.Scan(&collID); err != nil {
			return fmt.Errorf("scan collID: %w", err)
		}
		collIDs = append(collIDs, collID)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate collections: %w", err)
	}

	// For each collection, calculate and update part_id for each work
	for _, collID := range collIDs {
		if err := recalculatePartIDsForCollection(tx, collID); err != nil {
			return fmt.Errorf("recalculate part_ids for collection %d: %w", collID, err)
		}
	}

	// Clean up old title-based cache files
	homeDir, err := os.UserHomeDir()
	if err == nil {
		cacheBaseDir := filepath.Join(homeDir, ".works", "book-builds")
		if entries, err := os.ReadDir(cacheBaseDir); err == nil {
			for _, entry := range entries {
				if entry.IsDir() && strings.HasPrefix(entry.Name(), "coll-") {
					collCacheDir := filepath.Join(cacheBaseDir, entry.Name())
					cleanOldPartCaches(collCacheDir)
				}
			}
		}
	}

	return nil
}

// recalculatePartIDsForCollection updates part_id for all works in a collection
// based on their position relative to Section-type works.
func recalculatePartIDsForCollection(tx *sql.Tx, collID int64) error {
	// Get works ordered by position with their type
	rows, err := tx.Query(`
		SELECT cd.workID, w.type
		FROM CollectionDetails cd
		JOIN Works w ON cd.workID = w.workID
		WHERE cd.collID = ?
		ORDER BY cd.position`, collID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type workInfo struct {
		workID   int64
		workType string
	}
	var works []workInfo
	for rows.Next() {
		var w workInfo
		if err := rows.Scan(&w.workID, &w.workType); err != nil {
			return err
		}
		works = append(works, w)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Calculate part_id for each work
	// Works before any Section have part_id = 0
	// Works after a Section have part_id = that Section's workID
	var currentPartID int64 = 0
	for _, w := range works {
		if w.workType == "Section" {
			currentPartID = w.workID
		}
		_, err := tx.Exec(`UPDATE CollectionDetails SET part_id = ? WHERE collID = ? AND workID = ?`,
			currentPartID, collID, w.workID)
		if err != nil {
			return err
		}
	}

	return nil
}

// cleanOldPartCaches removes title-based cache files (non-numeric part names)
func cleanOldPartCaches(cacheDir string) {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return
	}

	// Match part-<something>-overlaid.pdf or part-<something>-merged.pdf
	// where <something> is NOT purely numeric
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, "part-") {
			continue
		}
		// Extract the middle part between "part-" and "-overlaid.pdf" or "-merged.pdf"
		var middle string
		if strings.HasSuffix(name, "-overlaid.pdf") {
			middle = strings.TrimSuffix(strings.TrimPrefix(name, "part-"), "-overlaid.pdf")
		} else if strings.HasSuffix(name, "-merged.pdf") {
			middle = strings.TrimSuffix(strings.TrimPrefix(name, "part-"), "-merged.pdf")
		} else {
			continue
		}

		// If middle is NOT a valid number, it's an old title-based cache - delete it
		if _, err := strconv.ParseInt(middle, 10, 64); err != nil {
			_ = os.Remove(filepath.Join(cacheDir, name))
		}
	}
}

func migrateAddKdpPublishingFields(tx *sql.Tx) error {
	columns := []string{
		`ALTER TABLE Books ADD COLUMN kdp_uploaded INTEGER DEFAULT 0`,
		`ALTER TABLE Books ADD COLUMN kdp_previewed INTEGER DEFAULT 0`,
		`ALTER TABLE Books ADD COLUMN kdp_published INTEGER DEFAULT 0`,
		`ALTER TABLE Books ADD COLUMN amazon_url TEXT`,
		`ALTER TABLE Books ADD COLUMN last_published TEXT`,
	}

	for _, col := range columns {
		if _, err := tx.Exec(col); err != nil {
			return fmt.Errorf("add kdp column: %w", err)
		}
	}

	return nil
}

func migrateAddKdpProofOrdered(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN kdp_proof_ordered INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add kdp_proof_ordered column: %w", err)
	}
	return nil
}

func migrateAddSkipAuditsToWorks(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Works ADD COLUMN skip_audits INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add skip_audits column: %w", err)
	}
	return nil
}

func migrateAddPageNumbersFlushOutside(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN page_numbers_flush_outside INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add page_numbers_flush_outside column: %w", err)
	}
	return nil
}

func migrateAddShowHeadersToBooks(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN show_headers INTEGER DEFAULT 1`)
	if err != nil {
		return fmt.Errorf("add show_headers column: %w", err)
	}
	return nil
}

func migrateAddBookTypeToBooks(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN book_type TEXT DEFAULT 'prose'`)
	if err != nil {
		return fmt.Errorf("add book_type column: %w", err)
	}
	return nil
}

func migrateAddPageNumbersOnOpeningPages(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Books ADD COLUMN page_numbers_on_opening_pages INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add page_numbers_on_opening_pages column: %w", err)
	}
	return nil
}
