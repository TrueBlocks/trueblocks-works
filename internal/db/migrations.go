package db

import (
	"database/sql"
	"fmt"
	"regexp"
)

type Migration struct {
	Version int
	Name    string
	Up      func(*sql.Tx) error
}

var migrations = []Migration{
	{
		Version: 2,
		Name:    "populate_year_from_path",
		Up:      migratePopulateYearFromPath,
	},
	{
		Version: 3,
		Name:    "consolidate_notes_tables",
		Up:      migrateConsolidateNotes,
	},
	{
		Version: 4,
		Name:    "add_position_to_collection_details",
		Up:      migrateAddPositionColumn,
	},
	{
		Version: 5,
		Name:    "drop_collection_name_from_details",
		Up:      migrateDropCollectionName,
	},
	{
		Version: 6,
		Name:    "populate_position_from_title",
		Up:      migratePopulatePositionFromTitle,
	},
	{
		Version: 7,
		Name:    "add_attributes_and_mark",
		Up:      migrateAddAttributesAndMark,
	},
	{
		Version: 8,
		Name:    "populate_attributes_from_booleans",
		Up:      migratePopulateAttributesFromBooleans,
	},
	{
		Version: 9,
		Name:    "drop_boolean_columns",
		Up:      migrateDropBooleanColumns,
	},
	{
		Version: 10,
		Name:    "drop_mark_column",
		Up:      migrateDropMarkColumn,
	},
}

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

func migratePopulateYearFromPath(tx *sql.Tx) error {
	yearRegex := regexp.MustCompile(`\b(19|20)\d{2}\b`)

	rows, err := tx.Query("SELECT workID, path FROM Works WHERE (year IS NULL OR year = '') AND path IS NOT NULL AND path != ''")
	if err != nil {
		return fmt.Errorf("query works: %w", err)
	}
	defer rows.Close()

	type update struct {
		workID int
		year   string
	}
	var updates []update

	for rows.Next() {
		var workID int
		var path string
		if err := rows.Scan(&workID, &path); err != nil {
			return fmt.Errorf("scan row: %w", err)
		}

		if match := yearRegex.FindString(path); match != "" {
			updates = append(updates, update{workID: workID, year: match})
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate rows: %w", err)
	}

	for _, u := range updates {
		_, err := tx.Exec("UPDATE Works SET year = ? WHERE workID = ?", u.year, u.workID)
		if err != nil {
			return fmt.Errorf("update work %d: %w", u.workID, err)
		}
	}

	return nil
}

func migrateConsolidateNotes(tx *sql.Tx) error {
	_, err := tx.Exec(`
		CREATE TABLE IF NOT EXISTS Notes (
			id INTEGER PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id INTEGER NOT NULL,
			type TEXT,
			note TEXT,
			modified_date TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("create Notes table: %w", err)
	}

	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_entity ON Notes(entity_type, entity_id)`)
	if err != nil {
		return fmt.Errorf("create notes entity index: %w", err)
	}

	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_type ON Notes(type)`)
	if err != nil {
		return fmt.Errorf("create notes type index: %w", err)
	}

	var workNotesExist int
	if err := tx.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='WorkNotes'").Scan(&workNotesExist); err != nil {
		return fmt.Errorf("check WorkNotes table: %w", err)
	}
	if workNotesExist > 0 {
		_, err = tx.Exec(`
			INSERT INTO Notes (entity_type, entity_id, type, note, modified_date, created_at)
			SELECT 'work', workID, type, note, modified_date, created_at FROM WorkNotes
		`)
		if err != nil {
			return fmt.Errorf("migrate work notes: %w", err)
		}
		_, _ = tx.Exec("DROP TABLE WorkNotes")
	}

	var journalNotesExist int
	if err := tx.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='JournalNotes'").Scan(&journalNotesExist); err != nil {
		return fmt.Errorf("check JournalNotes table: %w", err)
	}
	if journalNotesExist > 0 {
		_, err = tx.Exec(`
			INSERT INTO Notes (entity_type, entity_id, type, note, modified_date, created_at)
			SELECT 'journal', orgID, type, note, modified_date, created_at FROM JournalNotes
		`)
		if err != nil {
			return fmt.Errorf("migrate journal notes: %w", err)
		}
		_, _ = tx.Exec("DROP TABLE JournalNotes")
	}

	return nil
}

func migrateAddPositionColumn(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE CollectionDetails ADD COLUMN position INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add position column: %w", err)
	}

	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_collection_position ON CollectionDetails(collID, position)`)
	if err != nil {
		return fmt.Errorf("create position index: %w", err)
	}

	return nil
}

func migrateDropCollectionName(tx *sql.Tx) error {
	_, _ = tx.Exec(`DROP TABLE IF EXISTS CollectionDetails_new`)

	_, err := tx.Exec(`
		CREATE TABLE CollectionDetails_new (
			id INTEGER PRIMARY KEY,
			collID INTEGER NOT NULL,
			workID INTEGER NOT NULL,
			position INTEGER DEFAULT 0,
			FOREIGN KEY (collID) REFERENCES Collections(collID),
			FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
			UNIQUE(collID, workID)
		)
	`)
	if err != nil {
		return fmt.Errorf("create new table: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO CollectionDetails_new (id, collID, workID, position)
		SELECT id, collID, workID, position FROM CollectionDetails
	`)
	if err != nil {
		return fmt.Errorf("copy data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE CollectionDetails`)
	if err != nil {
		return fmt.Errorf("drop old table: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE CollectionDetails_new RENAME TO CollectionDetails`)
	if err != nil {
		return fmt.Errorf("rename table: %w", err)
	}

	_, err = tx.Exec(`CREATE INDEX IF NOT EXISTS idx_collection_position ON CollectionDetails(collID, position)`)
	if err != nil {
		return fmt.Errorf("recreate index: %w", err)
	}

	return nil
}

func migratePopulatePositionFromTitle(tx *sql.Tx) error {
	_, err := tx.Exec(`
		UPDATE CollectionDetails
		SET position = (
			SELECT COUNT(*)
			FROM CollectionDetails cd2
			INNER JOIN Works w2 ON cd2.workID = w2.workID
			INNER JOIN Works w1 ON CollectionDetails.workID = w1.workID
			WHERE cd2.collID = CollectionDetails.collID
			AND (w2.title < w1.title OR (w2.title = w1.title AND cd2.id < CollectionDetails.id))
		)
	`)
	if err != nil {
		return fmt.Errorf("populate position from title: %w", err)
	}

	return nil
}

func migrateAddAttributesAndMark(tx *sql.Tx) error {
	_, err := tx.Exec(`ALTER TABLE Works ADD COLUMN attributes TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add attributes to Works: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Collections ADD COLUMN attributes TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add attributes to Collections: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Collections ADD COLUMN mark TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add mark to Collections: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Organizations ADD COLUMN attributes TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add attributes to Organizations: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Organizations ADD COLUMN mark TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add mark to Organizations: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Submissions ADD COLUMN attributes TEXT DEFAULT ''`)
	if err != nil {
		return fmt.Errorf("add attributes to Submissions: %w", err)
	}

	_, err = tx.Exec(`UPDATE Works SET mark = '' WHERE mark IS NULL`)
	if err != nil {
		return fmt.Errorf("set Works mark to empty: %w", err)
	}

	_, err = tx.Exec(`UPDATE Submissions SET mark = '' WHERE mark IS NULL`)
	if err != nil {
		return fmt.Errorf("set Submissions mark to empty: %w", err)
	}

	return nil
}

func migratePopulateAttributesFromBooleans(tx *sql.Tx) error {
	query := `
		UPDATE Works 
		SET attributes = (
			SELECT GROUP_CONCAT(attr, ',') FROM (
				SELECT 'blog' AS attr WHERE is_blog = 'yes'
				UNION ALL
				SELECT 'printed' AS attr WHERE is_printed = 'yes'
				UNION ALL
				SELECT 'prose_poem' AS attr WHERE is_prose_poem = 'yes'
				UNION ALL
				SELECT 'revised' AS attr WHERE is_revised = 'yes'
			)
		)
		WHERE is_blog = 'yes' OR is_printed = 'yes' OR is_prose_poem = 'yes' OR is_revised = 'yes'
	`
	_, err := tx.Exec(query)
	if err != nil {
		return fmt.Errorf("populate attributes from booleans: %w", err)
	}

	return nil
}

func migrateDropBooleanColumns(tx *sql.Tx) error {
	_, _ = tx.Exec(`DROP VIEW IF EXISTS WorksView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS SubmissionsView`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Works_new`)

	_, err := tx.Exec(`
		CREATE TABLE Works_new (
			workID INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			type TEXT NOT NULL,
			year TEXT,
			status TEXT NOT NULL DEFAULT '',
			quality TEXT NOT NULL DEFAULT '',
			doc_type TEXT NOT NULL DEFAULT '',
			path TEXT,
			draft TEXT,
			n_words INTEGER,
			course_name TEXT,
			mark TEXT DEFAULT '',
			attributes TEXT DEFAULT '',
			access_date TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			modified_at TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("create Works_new table: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO Works_new (workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, mark, attributes, access_date, created_at, modified_at)
		SELECT workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, mark, attributes, access_date, created_at, modified_at FROM Works
	`)
	if err != nil {
		return fmt.Errorf("copy data to Works_new: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Works`)
	if err != nil {
		return fmt.Errorf("drop old Works table: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Works_new RENAME TO Works`)
	if err != nil {
		return fmt.Errorf("rename Works_new to Works: %w", err)
	}

	_, err = tx.Exec(`
		CREATE VIEW WorksView AS
		SELECT 
			w.*,
			CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
			(SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
			(SELECT GROUP_CONCAT(cd.collection_name, ', ') 
			 FROM CollectionDetails cd 
			 WHERE cd.workID = w.workID) AS collection_list
		FROM Works w
	`)
	if err != nil {
		return fmt.Errorf("recreate WorksView: %w", err)
	}

	_, err = tx.Exec(`
		CREATE VIEW SubmissionsView AS
		SELECT 
			s.*,
			w.title AS title_of_work,
			o.name AS journal_name,
			CASE 
				WHEN s.response_type IS NOT NULL AND s.response_type != 'Waiting' 
				THEN 'no' 
				ELSE 'yes' 
			END AS decision_pending
		FROM Submissions s
		JOIN Works w ON s.workID = w.workID
		JOIN Organizations o ON s.orgID = o.orgID
	`)
	if err != nil {
		return fmt.Errorf("recreate SubmissionsView: %w", err)
	}

	return nil
}

func migrateDropMarkColumn(tx *sql.Tx) error {
	// Drop ALL views that depend on any of the 4 tables
	_, _ = tx.Exec(`DROP VIEW IF EXISTS WorksView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS SubmissionsView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS OrganizationsView`)
	_, _ = tx.Exec(`DROP VIEW IF EXISTS CollectionsView`)

	// Clean up any failed previous attempts
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Works_new`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Collections_new`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Organizations_new`)
	_, _ = tx.Exec(`DROP TABLE IF EXISTS Submissions_new`)

	// 1. Recreate Works without mark column
	_, err := tx.Exec(`
		CREATE TABLE Works_new (
			workID INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			type TEXT NOT NULL,
			year TEXT,
			status TEXT NOT NULL DEFAULT '',
			quality TEXT NOT NULL DEFAULT '',
			doc_type TEXT NOT NULL DEFAULT '',
			path TEXT,
			draft TEXT,
			n_words INTEGER,
			course_name TEXT,
			attributes TEXT DEFAULT '',
			access_date TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			modified_at TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("create Works_new: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO Works_new (workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, attributes, access_date, created_at, modified_at)
		SELECT workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, attributes, access_date, created_at, modified_at FROM Works
	`)
	if err != nil {
		return fmt.Errorf("copy Works data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Works`)
	if err != nil {
		return fmt.Errorf("drop Works: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Works_new RENAME TO Works`)
	if err != nil {
		return fmt.Errorf("rename Works_new: %w", err)
	}

	// 2. Recreate Collections without mark column
	_, err = tx.Exec(`
		CREATE TABLE Collections_new (
			collID INTEGER PRIMARY KEY AUTOINCREMENT,
			collection_name TEXT NOT NULL,
			is_status TEXT,
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
		INSERT INTO Collections_new (collID, collection_name, is_status, type, attributes, created_at, modified_at)
		SELECT collID, collection_name, is_status, type, attributes, created_at, modified_at FROM Collections
	`)
	if err != nil {
		return fmt.Errorf("copy Collections data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Collections`)
	if err != nil {
		return fmt.Errorf("drop Collections: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Collections_new RENAME TO Collections`)
	if err != nil {
		return fmt.Errorf("rename Collections_new: %w", err)
	}

	// 3. Recreate Organizations without mark column
	_, err = tx.Exec(`
		CREATE TABLE Organizations_new (
			orgID INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			other_name TEXT,
			url TEXT,
			other_url TEXT,
			status TEXT NOT NULL DEFAULT '',
			type TEXT NOT NULL DEFAULT '',
			timing TEXT,
			submission_types TEXT,
			accepts TEXT,
			my_interest TEXT,
			ranking INTEGER,
			source TEXT,
			website_menu TEXT,
			duotrope_num INTEGER,
			n_push_fiction INTEGER DEFAULT 0,
			n_push_nonfiction INTEGER DEFAULT 0,
			n_push_poetry INTEGER DEFAULT 0,
			contest_ends TEXT,
			contest_fee TEXT,
			contest_prize TEXT,
			contest_prize_2 TEXT,
			attributes TEXT DEFAULT '',
			date_added TEXT,
			date_modified TEXT
		)
	`)
	if err != nil {
		return fmt.Errorf("create Organizations_new: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO Organizations_new (orgID, name, other_name, url, other_url, status, type, timing, submission_types, accepts, my_interest, ranking, source, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, contest_ends, contest_fee, contest_prize, contest_prize_2, attributes, date_added, date_modified)
		SELECT orgID, name, other_name, url, other_url, status, type, timing, submission_types, accepts, my_interest, ranking, source, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, contest_ends, contest_fee, contest_prize, contest_prize_2, attributes, date_added, date_modified FROM Organizations
	`)
	if err != nil {
		return fmt.Errorf("copy Organizations data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Organizations`)
	if err != nil {
		return fmt.Errorf("drop Organizations: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Organizations_new RENAME TO Organizations`)
	if err != nil {
		return fmt.Errorf("rename Organizations_new: %w", err)
	}

	// 4. Recreate Submissions without mark column
	_, err = tx.Exec(`
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
			FOREIGN KEY (workID) REFERENCES Works(workID),
			FOREIGN KEY (orgID) REFERENCES Organizations(orgID)
		)
	`)
	if err != nil {
		return fmt.Errorf("create Submissions_new: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO Submissions_new (submissionID, workID, orgID, draft, submission_date, submission_type, query_date, response_date, response_type, contest_name, cost, user_id, password, web_address, attributes, created_at, modified_at)
		SELECT submissionID, workID, orgID, draft, submission_date, submission_type, query_date, response_date, response_type, contest_name, cost, user_id, password, web_address, attributes, created_at, modified_at FROM Submissions
	`)
	if err != nil {
		return fmt.Errorf("copy Submissions data: %w", err)
	}

	_, err = tx.Exec(`DROP TABLE Submissions`)
	if err != nil {
		return fmt.Errorf("drop Submissions: %w", err)
	}

	_, err = tx.Exec(`ALTER TABLE Submissions_new RENAME TO Submissions`)
	if err != nil {
		return fmt.Errorf("rename Submissions_new: %w", err)
	}

	// Recreate all views
	_, err = tx.Exec(`
		CREATE VIEW WorksView AS
		SELECT 
			w.*,
			CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
			(SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
			(SELECT GROUP_CONCAT(cd.collection_name, ', ') 
			 FROM CollectionDetails cd 
			 WHERE cd.workID = w.workID) AS collection_list
		FROM Works w
	`)
	if err != nil {
		return fmt.Errorf("recreate WorksView: %w", err)
	}

	_, err = tx.Exec(`
		CREATE VIEW SubmissionsView AS
		SELECT 
			s.*,
			w.title AS title_of_work,
			o.name AS journal_name,
			CASE 
				WHEN s.response_type IS NOT NULL AND s.response_type != 'Waiting' 
				THEN 'no' 
				ELSE 'yes' 
			END AS decision_pending
		FROM Submissions s
		JOIN Works w ON s.workID = w.workID
		JOIN Organizations o ON s.orgID = o.orgID
	`)
	if err != nil {
		return fmt.Errorf("recreate SubmissionsView: %w", err)
	}

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

	_, err = tx.Exec(`
		CREATE VIEW CollectionsView AS
		SELECT 
			c.*,
			CASE WHEN c.is_status = 'yes' THEN c.collection_name ELSE 'None' END AS status_list,
			(SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) AS n_items
		FROM Collections c
	`)
	if err != nil {
		return fmt.Errorf("recreate CollectionsView: %w", err)
	}

	return nil
}
