package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"works/internal/db"
	"works/internal/fileops"
	"works/internal/models"
)

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting home dir: %v\n", err)
		os.Exit(1)
	}

	dbPath := filepath.Join(homeDir, ".works", "works.db")
	database, err := db.New(dbPath)
	if err != nil {
		fmt.Printf("Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()

	cfg := fileops.Config{
		BaseFolderPath: filepath.Join(homeDir, "Documents", "Home"),
		PDFPreviewPath: filepath.Join(homeDir, ".works", "previews"),
	}
	fops := fileops.New(cfg)

	works, err := getAllWorks(database)
	if err != nil {
		fmt.Printf("Error getting works: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Checking %d works...\n\n", len(works))

	var pathMismatches []mismatchResult
	var missingFiles []missingResult
	var missingPreviews []missingResult

	for _, w := range works {
		generatedPath := fops.GeneratePath(&w)
		storedPath := derefString(w.Path)

		storedWithoutExt := stripExtension(storedPath)
		generatedWithoutExt := stripExtension(generatedPath)

		if storedWithoutExt != generatedWithoutExt {
			pathMismatches = append(pathMismatches, mismatchResult{
				WorkID:    w.WorkID,
				Title:     w.Title,
				Stored:    storedPath,
				Generated: generatedPath,
			})
		}

		fullPath := filepath.Join(cfg.BaseFolderPath, storedPath)
		if !fileExists(fullPath) {
			missingFiles = append(missingFiles, missingResult{
				WorkID: w.WorkID,
				Title:  w.Title,
				Path:   storedPath,
			})
		}

		previewPath := filepath.Join(cfg.PDFPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
		if !fileExists(previewPath) {
			missingPreviews = append(missingPreviews, missingResult{
				WorkID: w.WorkID,
				Title:  w.Title,
				Path:   previewPath,
			})
		}
	}

	fmt.Println("=" + strings.Repeat("=", 99))
	fmt.Println("A) PATH MISMATCHES (stored path != generated path)")
	fmt.Println("=" + strings.Repeat("=", 99))
	if len(pathMismatches) == 0 {
		fmt.Println("  ✅ All paths match their generated values!")
	} else {
		fmt.Printf("  ❌ Found %d mismatches:\n\n", len(pathMismatches))
		for i, m := range pathMismatches {
			if i >= 20 {
				fmt.Printf("  ... and %d more\n", len(pathMismatches)-20)
				break
			}
			fmt.Printf("  [%d] %s\n", m.WorkID, m.Title)
			fmt.Printf("      Stored:    %s\n", m.Stored)
			fmt.Printf("      Generated: %s\n\n", m.Generated)
		}
	}

	fmt.Println()
	fmt.Println("=" + strings.Repeat("=", 99))
	fmt.Println("B) MISSING FILES (file does not exist on disk)")
	fmt.Println("=" + strings.Repeat("=", 99))
	if len(missingFiles) == 0 {
		fmt.Println("  ✅ All files exist on disk!")
	} else {
		fmt.Printf("  ❌ Found %d missing files:\n\n", len(missingFiles))
		for i, m := range missingFiles {
			if i >= 20 {
				fmt.Printf("  ... and %d more\n", len(missingFiles)-20)
				break
			}
			fmt.Printf("  [%d] %s\n", m.WorkID, m.Title)
			fmt.Printf("      Path: %s\n\n", m.Path)
		}
	}

	fmt.Println()
	fmt.Println("=" + strings.Repeat("=", 99))
	fmt.Println("C) MISSING PREVIEWS (PDF preview does not exist)")
	fmt.Println("=" + strings.Repeat("=", 99))
	if len(missingPreviews) == 0 {
		fmt.Println("  ✅ All preview files exist!")
	} else {
		fmt.Printf("  ⚠️  Found %d missing previews (this is normal if not generated yet):\n\n", len(missingPreviews))
		fmt.Printf("  First 10 missing:\n")
		for i, m := range missingPreviews {
			if i >= 10 {
				fmt.Printf("  ... and %d more\n", len(missingPreviews)-10)
				break
			}
			fmt.Printf("  [%d] %s\n", m.WorkID, truncate(m.Title, 50))
		}
	}

	fmt.Println()
	fmt.Println("=" + strings.Repeat("=", 99))
	fmt.Println("SUMMARY")
	fmt.Println("=" + strings.Repeat("=", 99))
	fmt.Printf("  Total works:       %d\n", len(works))
	fmt.Printf("  Path mismatches:   %d\n", len(pathMismatches))
	fmt.Printf("  Missing files:     %d\n", len(missingFiles))
	fmt.Printf("  Missing previews:  %d\n", len(missingPreviews))
}

type mismatchResult struct {
	WorkID    int64
	Title     string
	Stored    string
	Generated string
}

type missingResult struct {
	WorkID int64
	Title  string
	Path   string
}

func getAllWorks(database *db.DB) ([]models.Work, error) {
	rows, err := database.Conn().Query(`
		SELECT workID, title, type, year, status, quality, doc_type, path, draft, 
		       n_words, course_name, is_blog, is_printed, is_prose_poem, is_revised, 
		       mark, access_date, created_at, modified_at
		FROM Works
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []models.Work
	for rows.Next() {
		var w models.Work
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality, &w.DocType,
			&w.Path, &w.Draft, &w.NWords, &w.CourseName, &w.IsBlog, &w.IsPrinted,
			&w.IsProsePoem, &w.IsRevised, &w.Mark, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt,
		)
		if err != nil {
			return nil, err
		}
		works = append(works, w)
	}
	return works, nil
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func stripExtension(path string) string {
	ext := filepath.Ext(path)
	if ext == ".docx" || ext == ".rtf" || ext == ".txt" || ext == ".pdf" {
		return path[:len(path)-len(ext)]
	}
	return path
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
