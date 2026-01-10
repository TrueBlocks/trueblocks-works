package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func main() {
	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatal("Failed to get home directory:", err)
	}

	dbPath := filepath.Join(home, ".works", "works.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	workID := int64(23596)

	// Delete from FTS table first
	_, err = db.Exec(`DELETE FROM works_fts WHERE rowid = ?`, workID)
	if err != nil {
		log.Fatalf("Failed to delete from works_fts: %v", err)
	}
	fmt.Printf("✅ Deleted work %d from works_fts\n", workID)

	// Then delete from Works table
	_, err = db.Exec(`DELETE FROM Works WHERE workID = ?`, workID)
	if err != nil {
		log.Fatalf("Failed to delete from Works: %v", err)
	}
	fmt.Printf("✅ Deleted work %d from Works\n", workID)

	// Verify it's gone
	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM Works WHERE workID = ?`, workID).Scan(&count)
	if err != nil {
		log.Fatalf("Failed to verify deletion: %v", err)
	}

	if count == 0 {
		fmt.Printf("✅ Verified: placeholder record permanently deleted\n")
	} else {
		fmt.Printf("❌ ERROR: record still exists!\n")
	}
}
