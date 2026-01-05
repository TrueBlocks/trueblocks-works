package db

import (
	"fmt"
	"regexp"
)

type Migration struct {
	Version int
	Name    string
	Up      func(*DB) error
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

		if err := m.Up(db); err != nil {
			return fmt.Errorf("run migration %d (%s): %w", m.Version, m.Name, err)
		}

		if err := db.markMigrationApplied(m.Version, m.Name); err != nil {
			return fmt.Errorf("mark migration %d applied: %w", m.Version, err)
		}
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

func (db *DB) markMigrationApplied(version int, name string) error {
	_, err := db.conn.Exec("INSERT INTO schema_migrations (version, description) VALUES (?, ?)", version, name)
	return err
}

func migratePopulateYearFromPath(db *DB) error {
	yearRegex := regexp.MustCompile(`\b(19|20)\d{2}\b`)

	rows, err := db.conn.Query("SELECT workID, path FROM Works WHERE (year IS NULL OR year = '') AND path IS NOT NULL AND path != ''")
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
		_, err := db.conn.Exec("UPDATE Works SET year = ? WHERE workID = ?", u.year, u.workID)
		if err != nil {
			return fmt.Errorf("update work %d: %w", u.workID, err)
		}
	}

	return nil
}

func migrateConsolidateNotes(db *DB) error {
	_, err := db.conn.Exec(`
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

	_, err = db.conn.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_entity ON Notes(entity_type, entity_id)`)
	if err != nil {
		return fmt.Errorf("create notes entity index: %w", err)
	}

	_, err = db.conn.Exec(`CREATE INDEX IF NOT EXISTS idx_notes_type ON Notes(type)`)
	if err != nil {
		return fmt.Errorf("create notes type index: %w", err)
	}

	var workNotesExist int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='WorkNotes'").Scan(&workNotesExist); err != nil {
		return fmt.Errorf("check WorkNotes table: %w", err)
	}
	if workNotesExist > 0 {
		_, err = db.conn.Exec(`
			INSERT INTO Notes (entity_type, entity_id, type, note, modified_date, created_at)
			SELECT 'work', workID, type, note, modified_date, created_at FROM WorkNotes
		`)
		if err != nil {
			return fmt.Errorf("migrate work notes: %w", err)
		}
		_, _ = db.conn.Exec("DROP TABLE WorkNotes")
	}

	var journalNotesExist int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='JournalNotes'").Scan(&journalNotesExist); err != nil {
		return fmt.Errorf("check JournalNotes table: %w", err)
	}
	if journalNotesExist > 0 {
		_, err = db.conn.Exec(`
			INSERT INTO Notes (entity_type, entity_id, type, note, modified_date, created_at)
			SELECT 'journal', orgID, type, note, modified_date, created_at FROM JournalNotes
		`)
		if err != nil {
			return fmt.Errorf("migrate journal notes: %w", err)
		}
		_, _ = db.conn.Exec("DROP TABLE JournalNotes")
	}

	return nil
}

func migrateAddPositionColumn(db *DB) error {
	_, err := db.conn.Exec(`ALTER TABLE CollectionDetails ADD COLUMN position INTEGER DEFAULT 0`)
	if err != nil {
		return fmt.Errorf("add position column: %w", err)
	}

	_, err = db.conn.Exec(`CREATE INDEX IF NOT EXISTS idx_collection_position ON CollectionDetails(collID, position)`)
	if err != nil {
		return fmt.Errorf("create position index: %w", err)
	}

	return nil
}

func migrateDropCollectionName(db *DB) error {
	_, _ = db.conn.Exec(`DROP TABLE IF EXISTS CollectionDetails_new`)

	_, err := db.conn.Exec(`
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

	_, err = db.conn.Exec(`
		INSERT INTO CollectionDetails_new (id, collID, workID, position)
		SELECT id, collID, workID, position FROM CollectionDetails
	`)
	if err != nil {
		return fmt.Errorf("copy data: %w", err)
	}

	_, err = db.conn.Exec(`DROP TABLE CollectionDetails`)
	if err != nil {
		return fmt.Errorf("drop old table: %w", err)
	}

	_, err = db.conn.Exec(`ALTER TABLE CollectionDetails_new RENAME TO CollectionDetails`)
	if err != nil {
		return fmt.Errorf("rename table: %w", err)
	}

	_, err = db.conn.Exec(`CREATE INDEX IF NOT EXISTS idx_collection_position ON CollectionDetails(collID, position)`)
	if err != nil {
		return fmt.Errorf("recreate index: %w", err)
	}

	return nil
}

func migratePopulatePositionFromTitle(db *DB) error {
	_, err := db.conn.Exec(`
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
