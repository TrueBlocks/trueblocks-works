package db

import (
	"fmt"
	"os"
)

func (db *DB) InitSchemaFromFile(schemaPath string) error {
	schemaSQL, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("read schema file: %w", err)
	}

	_, err = db.conn.Exec(string(schemaSQL))
	if err != nil {
		return fmt.Errorf("execute schema: %w", err)
	}

	return nil
}
