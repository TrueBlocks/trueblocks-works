package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"

	_ "modernc.org/sqlite"
)

type AuditReport struct {
	TotalWorks              int
	DuplicateGeneratedPaths []DuplicateGroup
	MissingFiles            []models.Work
	MtimeMismatches         []MtimeMismatch
	PathGeneratedMismatches []PathMismatch
	EmptyPaths              []models.Work
}

type DuplicateGroup struct {
	GeneratedPath string
	Works         []models.Work
}

type MtimeMismatch struct {
	Work       models.Work
	DBMtime    int64
	FileMtime  int64
	Difference int64
}

type PathMismatch struct {
	Work          models.Work
	StoredPath    string
	GeneratedPath string
	FileExists    bool
}

func main() {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".works", "works.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Printf("Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	settingsMgr := settings.NewManager()
	settings := settingsMgr.Get()
	fileOps := fileops.New(fileops.Config{
		BaseFolderPath:       settings.BaseFolderPath,
		PDFPreviewPath:       settings.PDFPreviewPath,
		SubmissionExportPath: settings.SubmissionExportPath,
		TemplateFolderPath:   settings.TemplateFolderPath,
	})

	report := &AuditReport{}

	// Load all works
	works, err := loadWorks(db)
	if err != nil {
		fmt.Printf("Error loading works: %v\n", err)
		os.Exit(1)
	}
	report.TotalWorks = len(works)

	// Build generatedPath index to find duplicates
	pathMap := make(map[string][]models.Work)
	for _, work := range works {
		genPath := fileOps.GeneratePath(&work)
		pathMap[genPath] = append(pathMap[genPath], work)
	}

	// Find duplicates
	for path, workList := range pathMap {
		if len(workList) > 1 {
			report.DuplicateGeneratedPaths = append(report.DuplicateGeneratedPaths, DuplicateGroup{
				GeneratedPath: path,
				Works:         workList,
			})
		}
	}

	// Check each work for file issues
	for _, work := range works {
		// Check empty paths
		if work.Path == nil || *work.Path == "" {
			report.EmptyPaths = append(report.EmptyPaths, work)
			continue
		}

		fullPath := fileOps.GetFilename(*work.Path)
		actualPath, err := fileops.FindFileWithExtension(fullPath)

		// Check missing files
		if err != nil {
			report.MissingFiles = append(report.MissingFiles, work)
			continue
		}

		// Check mtime mismatches
		if work.FileMtime != nil {
			fileInfo, err := os.Stat(actualPath)
			if err == nil {
				fileMtime := fileInfo.ModTime().Unix()
				if fileMtime != *work.FileMtime {
					report.MtimeMismatches = append(report.MtimeMismatches, MtimeMismatch{
						Work:       work,
						DBMtime:    *work.FileMtime,
						FileMtime:  fileMtime,
						Difference: fileMtime - *work.FileMtime,
					})
				}
			}
		}

		// Check path vs generatedPath mismatches
		genPath := fileOps.GeneratePath(&work)
		if *work.Path != genPath {
			genFullPath := fileOps.GetFullPath(&work)
			_, genErr := fileops.FindFileWithExtension(genFullPath)
			report.PathGeneratedMismatches = append(report.PathGeneratedMismatches, PathMismatch{
				Work:          work,
				StoredPath:    *work.Path,
				GeneratedPath: genPath,
				FileExists:    genErr == nil,
			})
		}
	}

	printReport(report)
}

func loadWorks(db *sql.DB) ([]models.Work, error) {
	query := `SELECT workID, title, type, year, status, quality, doc_type,
		path, draft, n_words, course_name, attributes, access_date, created_at, modified_at, file_mtime
		FROM Works`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []models.Work
	for rows.Next() {
		var w models.Work
		err := rows.Scan(
			&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.Quality,
			&w.DocType, &w.Path, &w.Draft, &w.NWords, &w.CourseName,
			&w.Attributes, &w.AccessDate, &w.CreatedAt, &w.ModifiedAt, &w.FileMtime,
		)
		if err != nil {
			return nil, err
		}
		works = append(works, w)
	}
	return works, nil
}

func printReport(r *AuditReport) {
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("                   DATA AUDIT REPORT")
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("\nTotal Works: %d\n", r.TotalWorks)

	// Duplicate Generated Paths
	fmt.Println("\n" + strings.Repeat("─", 60))
	fmt.Printf("DUPLICATE GENERATED PATHS: %d groups\n", len(r.DuplicateGeneratedPaths))
	fmt.Println(strings.Repeat("─", 60))
	if len(r.DuplicateGeneratedPaths) > 0 {
		for _, dup := range r.DuplicateGeneratedPaths {
			fmt.Printf("\n⚠️  Path: %s\n", dup.GeneratedPath)
			fmt.Printf("   Count: %d works with same generated path\n", len(dup.Works))
			for _, w := range dup.Works {
				fmt.Printf("   - ID %d: %s\n", w.WorkID, w.Title)
			}
		}
	} else {
		fmt.Println("✅ No duplicates found")
	}

	// Missing Files
	fmt.Println("\n" + strings.Repeat("─", 60))
	fmt.Printf("MISSING FILES: %d works\n", len(r.MissingFiles))
	fmt.Println(strings.Repeat("─", 60))
	if len(r.MissingFiles) > 0 {
		for i, w := range r.MissingFiles {
			if i >= 20 {
				fmt.Printf("... and %d more\n", len(r.MissingFiles)-20)
				break
			}
			path := "NULL"
			if w.Path != nil {
				path = *w.Path
			}
			fmt.Printf("⚠️  ID %d: %s\n   Path: %s\n", w.WorkID, w.Title, path)
		}
	} else {
		fmt.Println("✅ All works have files")
	}

	// Mtime Mismatches
	fmt.Println("\n" + strings.Repeat("─", 60))
	fmt.Printf("MTIME MISMATCHES: %d works\n", len(r.MtimeMismatches))
	fmt.Println(strings.Repeat("─", 60))
	if len(r.MtimeMismatches) > 0 {
		for i, m := range r.MtimeMismatches {
			if i >= 20 {
				fmt.Printf("... and %d more\n", len(r.MtimeMismatches)-20)
				break
			}
			fmt.Printf("⚠️  ID %d: %s\n", m.Work.WorkID, m.Work.Title)
			fmt.Printf("   DB mtime:   %d\n", m.DBMtime)
			fmt.Printf("   File mtime: %d (difference: %d seconds)\n", m.FileMtime, m.Difference)
		}
	} else {
		fmt.Println("✅ All mtimes match")
	}

	// Path Mismatches (needs move)
	fmt.Println("\n" + strings.Repeat("─", 60))
	fmt.Printf("PATH vs GENERATED PATH MISMATCHES: %d works\n", len(r.PathGeneratedMismatches))
	fmt.Println(strings.Repeat("─", 60))
	if len(r.PathGeneratedMismatches) > 0 {
		fmt.Println("(These works have 'needsMove' button)")
		for i, m := range r.PathGeneratedMismatches {
			if i >= 20 {
				fmt.Printf("... and %d more\n", len(r.PathGeneratedMismatches)-20)
				break
			}
			fileStatus := "file exists at generated path"
			if !m.FileExists {
				fileStatus = "file at stored path only"
			}
			fmt.Printf("⚠️  ID %d: %s\n", m.Work.WorkID, m.Work.Title)
			fmt.Printf("   Stored:    %s\n", m.StoredPath)
			fmt.Printf("   Generated: %s\n", m.GeneratedPath)
			fmt.Printf("   Status:    %s\n", fileStatus)
		}
	} else {
		fmt.Println("✅ All paths match generated paths")
	}

	// Empty Paths
	fmt.Println("\n" + strings.Repeat("─", 60))
	fmt.Printf("EMPTY PATHS: %d works\n", len(r.EmptyPaths))
	fmt.Println(strings.Repeat("─", 60))
	if len(r.EmptyPaths) > 0 {
		for _, w := range r.EmptyPaths {
			fmt.Printf("⚠️  ID %d: %s\n", w.WorkID, w.Title)
		}
	} else {
		fmt.Println("✅ All works have paths")
	}

	// Summary
	fmt.Println("\n" + strings.Repeat("═", 60))
	fmt.Println("SUMMARY")
	fmt.Println(strings.Repeat("═", 60))
	issues := 0
	if len(r.DuplicateGeneratedPaths) > 0 {
		fmt.Printf("❌ %d duplicate generated path groups (CRITICAL - file overwrite risk)\n", len(r.DuplicateGeneratedPaths))
		issues++
	}
	if len(r.MissingFiles) > 0 {
		fmt.Printf("❌ %d missing files\n", len(r.MissingFiles))
		issues++
	}
	if len(r.MtimeMismatches) > 0 {
		fmt.Printf("⚠️  %d mtime mismatches (files modified externally)\n", len(r.MtimeMismatches))
	}
	if len(r.PathGeneratedMismatches) > 0 {
		fmt.Printf("ℹ️  %d works need to be moved\n", len(r.PathGeneratedMismatches))
	}
	if len(r.EmptyPaths) > 0 {
		fmt.Printf("❌ %d works with empty paths\n", len(r.EmptyPaths))
		issues++
	}

	if issues == 0 {
		fmt.Println("✅ No critical issues found!")
	} else {
		fmt.Printf("\n⚠️  Found %d critical issue types that need attention\n", issues)
	}
	fmt.Println(strings.Repeat("═", 60))
}
