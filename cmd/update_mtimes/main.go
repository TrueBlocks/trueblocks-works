package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

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

	baseFolder := filepath.Join(home, "Documents", "Home")

	// Get all works with non-empty paths
	rows, err := db.Query(`
		SELECT workID, path, file_mtime
		FROM Works
		WHERE path IS NOT NULL AND path != ''
		ORDER BY workID
	`)
	if err != nil {
		log.Fatal("Failed to query works:", err)
	}
	defer rows.Close()

	updated := 0
	skipped := 0
	missing := 0

	for rows.Next() {
		var workID int64
		var path string
		var dbMtime sql.NullInt64

		if err := rows.Scan(&workID, &path, &dbMtime); err != nil {
			log.Printf("Failed to scan row: %v", err)
			continue
		}

		// Build full file path
		fullPath := filepath.Join(baseFolder, path)

		// Get file info
		info, err := os.Stat(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				missing++
				continue
			}
			log.Printf("Work %d: stat error: %v", workID, err)
			skipped++
			continue
		}

		fileMtime := info.ModTime().Unix()

		// Check if update needed
		if dbMtime.Valid && dbMtime.Int64 == fileMtime {
			// Already matches, skip
			skipped++
			continue
		}

		// Update the database
		_, err = db.Exec(`UPDATE Works SET file_mtime = ? WHERE workID = ?`, fileMtime, workID)
		if err != nil {
			log.Printf("Work %d: update failed: %v", workID, err)
			continue
		}

		if dbMtime.Valid {
			dbTime := time.Unix(dbMtime.Int64, 0)
			fileTime := time.Unix(fileMtime, 0)
			fmt.Printf("✅ Updated work %d: %s → %s\n",
				workID,
				dbTime.Format("2006-01-02 15:04:05"),
				fileTime.Format("2006-01-02 15:04:05"))
		} else {
			fileTime := time.Unix(fileMtime, 0)
			fmt.Printf("✅ Set work %d: (null) → %s\n",
				workID,
				fileTime.Format("2006-01-02 15:04:05"))
		}
		updated++
	}

	fmt.Printf("\n")
	fmt.Printf("Summary:\n")
	fmt.Printf("  Updated: %d\n", updated)
	fmt.Printf("  Skipped (already correct): %d\n", skipped)
	fmt.Printf("  Skipped (file missing): %d\n", missing)
	fmt.Printf("  Total: %d\n", updated+skipped+missing)
}
