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
	// Future migrations go here, starting at version 11
	// Example:
	// {
	// 	Version: 11,
	// 	Name:    "add_some_feature",
	// 	Up:      migrateAddSomeFeature,
	// },
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
