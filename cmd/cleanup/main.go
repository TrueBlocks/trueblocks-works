package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func main() {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".works", "works.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Printf("Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Hard delete the duplicate works
	duplicateIDs := []int64{23605, 23753, 23754, 23755, 23756, 23757}

	for _, id := range duplicateIDs {
		// Delete from FTS first
		_, err = db.Exec("DELETE FROM works_fts WHERE rowid = ?", id)
		if err != nil {
			fmt.Printf("Warning: Could not delete from FTS for work %d: %v\n", id, err)
		}

		// Delete from Works table
		_, err = db.Exec("DELETE FROM Works WHERE workID = ?", id)
		if err != nil {
			fmt.Printf("Error deleting work %d: %v\n", id, err)
		} else {
			fmt.Printf("✅ Deleted work %d\n", id)
		}
	}

	// Verify
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM Works WHERE workID IN (23605, 23753, 23754, 23755, 23756, 23757)").Scan(&count)
	if err != nil {
		fmt.Printf("Error counting: %v\n", err)
	} else {
		fmt.Printf("\n%d duplicates remaining (should be 0)\n", count)
	}

	// Check total
	err = db.QueryRow("SELECT COUNT(*) FROM Works").Scan(&count)
	if err != nil {
		fmt.Printf("Error counting total: %v\n", err)
	} else {
		fmt.Printf("Total works: %d (was 1911)\n", count)
	}
}
