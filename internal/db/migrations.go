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
