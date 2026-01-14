package main

import (
	"archive/zip"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

type FileInfo struct {
	Name string
	Size int64
}

type Match struct {
	Size  int64
	Dated string
	New   string
}

func main() {
	reverse := flag.Bool("reverse", false, "Output CSV of docx filenames and their first lines from imports/files")
	rename := flag.Bool("rename", false, "Rename Fixed files to match imports/files names (requires --reverse)")
	flag.Parse()

	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting home directory: %v\n", err)
		os.Exit(1)
	}

	if *reverse {
		importsFiles := filepath.Join(home, "Development", "trueblocks-art", "works", "imports", "files")
		fixedDir := filepath.Join(home, "Documents", "Home", "100 zzVoiceMemos", "Fixed")
		runReverse(importsFiles, fixedDir, *rename)
		return
	}

	newVoiceMemos := filepath.Join(home, "Documents", "Home", "100 zzVoiceMemos", "New Voice Memos")
	datedVoiceMemos := filepath.Join(home, "Documents", "Home", "100 zzVoiceMemos", "Dated Voice Memos")
	fixedVoiceMemos := filepath.Join(home, "Documents", "Home", "100 zzVoiceMemos", "Fixed")

	// Create Fixed directory if it doesn't exist
	if err := os.MkdirAll(fixedVoiceMemos, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating Fixed directory: %v\n", err)
		os.Exit(1)
	}

	// Read both directories
	newFiles, err := readM4AFiles(newVoiceMemos)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading New Voice Memos: %v\n", err)
		os.Exit(1)
	}

	datedFiles, err := readM4AFiles(datedVoiceMemos)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading Dated Voice Memos: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("New Voice Memos: %d files\n", len(newFiles))
	fmt.Printf("Dated Voice Memos: %d files\n", len(datedFiles))
	fmt.Println()

	// Build size maps
	newBySize := make(map[int64][]FileInfo)
	for _, f := range newFiles {
		newBySize[f.Size] = append(newBySize[f.Size], f)
	}

	datedBySize := make(map[int64][]FileInfo)
	for _, f := range datedFiles {
		datedBySize[f.Size] = append(datedBySize[f.Size], f)
	}

	// Collect all unique sizes
	allSizes := make(map[int64]bool)
	for size := range newBySize {
		allSizes[size] = true
	}
	for size := range datedBySize {
		allSizes[size] = true
	}

	sizes := make([]int64, 0, len(allSizes))
	for size := range allSizes {
		sizes = append(sizes, size)
	}
	sort.Slice(sizes, func(i, j int) bool { return sizes[i] < sizes[j] })

	// Categorize
	var matches []Match
	var datedOnly []FileInfo
	var newOnly []FileInfo
	var ambiguous []Match

	for _, size := range sizes {
		datedList := datedBySize[size]
		newList := newBySize[size]

		if len(datedList) == 0 {
			newOnly = append(newOnly, newList...)
		} else if len(newList) == 0 {
			datedOnly = append(datedOnly, datedList...)
		} else if len(datedList) == 1 && len(newList) == 1 {
			matches = append(matches, Match{
				Size:  size,
				Dated: datedList[0].Name,
				New:   newList[0].Name,
			})
		} else {
			for _, d := range datedList {
				for _, n := range newList {
					ambiguous = append(ambiguous, Match{
						Size:  size,
						Dated: d.Name,
						New:   n.Name,
					})
				}
			}
		}
	}

	// Print results
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Println("TABLE 1: MATCHED FILES (by size)")
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	if len(matches) == 0 {
		fmt.Println("None")
	} else {
		fmt.Printf("%-12s %-40s %s\n", "Size", "Dated (Original)", "New (Renamed)")
		fmt.Println(strings.Repeat("-", 100))
		for _, m := range matches {
			fmt.Printf("%-12d %-40s %s\n", m.Size, truncate(m.Dated, 40), m.New)
		}
	}
	fmt.Printf("\nTotal matches: %d\n\n", len(matches))

	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Println("TABLE 2: In Dated Voice Memos ONLY (no match)")
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	if len(datedOnly) == 0 {
		fmt.Println("None")
	} else {
		fmt.Printf("%-12s %s\n", "Size", "Filename")
		fmt.Println(strings.Repeat("-", 60))
		for _, f := range datedOnly {
			fmt.Printf("%-12d %s\n", f.Size, f.Name)
		}
	}
	fmt.Printf("\nTotal: %d\n\n", len(datedOnly))

	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Println("TABLE 3: In New Voice Memos ONLY (no match)")
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	if len(newOnly) == 0 {
		fmt.Println("None")
	} else {
		fmt.Printf("%-12s %s\n", "Size", "Filename")
		fmt.Println(strings.Repeat("-", 60))
		for _, f := range newOnly {
			fmt.Printf("%-12d %s\n", f.Size, f.Name)
		}
	}
	fmt.Printf("\nTotal: %d\n\n", len(newOnly))

	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Println("TABLE 4: AMBIGUOUS (same size, multiple files)")
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	if len(ambiguous) == 0 {
		fmt.Println("None")
	} else {
		fmt.Printf("%-12s %-40s %s\n", "Size", "Dated", "New")
		fmt.Println(strings.Repeat("-", 100))
		for _, m := range ambiguous {
			fmt.Printf("%-12d %-40s %s\n", m.Size, truncate(m.Dated, 40), m.New)
		}
	}
	fmt.Printf("\nTotal ambiguous pairs: %d\n\n", len(ambiguous))

	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Println("SUMMARY")
	fmt.Println("═══════════════════════════════════════════════════════════════════════════════")
	fmt.Printf("Matched pairs:      %d\n", len(matches))
	fmt.Printf("Dated only:         %d\n", len(datedOnly))
	fmt.Printf("New only:           %d\n", len(newOnly))
	fmt.Printf("Ambiguous pairs:    %d\n", len(ambiguous))

	if len(datedOnly) == 0 && len(newOnly) == 0 && len(ambiguous) == 0 {
		fmt.Println("\n✅ Perfect 1:1 match — every file corresponds exactly!")

		// Copy matched files to Fixed folder
		fmt.Println("\n═══════════════════════════════════════════════════════════════════════════════")
		fmt.Println("COPYING FILES TO FIXED FOLDER")
		fmt.Println("═══════════════════════════════════════════════════════════════════════════════")

		for _, m := range matches {
			newName, fileTime, err := buildNewFilename(m.Dated, m.New)
			if err != nil {
				fmt.Printf("❌ Error parsing date from %s: %v\n", m.Dated, err)
				continue
			}

			srcPath := filepath.Join(newVoiceMemos, m.New)
			dstPath := filepath.Join(fixedVoiceMemos, newName)

			if err := copyFile(srcPath, dstPath); err != nil {
				fmt.Printf("❌ Error copying %s: %v\n", m.New, err)
				continue
			}

			if err := setFileDates(dstPath, fileTime); err != nil {
				fmt.Printf("⚠️  Copied %s but failed to set dates: %v\n", newName, err)
				continue
			}

			fmt.Printf("✓ %s\n", newName)
		}

		fmt.Printf("\n✅ Copied %d files to %s\n", len(matches), fixedVoiceMemos)
	}
}

func readM4AFiles(dir string) ([]FileInfo, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".m4a") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, FileInfo{
			Name: name,
			Size: info.Size(),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Size < files[j].Size
	})

	return files, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// buildNewFilename creates the new filename format: YYYY-MM-DD-HH-MM-SS - Name.m4a
func buildNewFilename(datedName, newName string) (string, time.Time, error) {
	// Dated format: "20151011 201127-F44354AE.m4a"
	// Extract: YYYYMMDD HHMMSS
	if len(datedName) < 15 {
		return "", time.Time{}, fmt.Errorf("dated filename too short: %s", datedName)
	}

	dateStr := datedName[:8]   // "20151011"
	timeStr := datedName[9:15] // "201127"

	// Parse the timestamp
	t, err := time.Parse("20060102150405", dateStr+timeStr)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to parse date/time: %w", err)
	}

	// Format as YYYY-MM-DD-HH-MM-SS
	formatted := t.Format("2006-01-02-15-04-05")

	// Get the descriptive name (without extension)
	ext := filepath.Ext(newName)
	baseName := strings.TrimSuffix(newName, ext)

	// Build final filename: YYYY-MM-DD-HH-MM-SS - Name.m4a
	finalName := fmt.Sprintf("%s - %s%s", formatted, baseName, ext)

	return finalName, t, nil
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// setFileDates sets both modification and creation dates on macOS
func setFileDates(path string, t time.Time) error {
	// Set modification time using os.Chtimes
	if err := os.Chtimes(path, t, t); err != nil {
		return fmt.Errorf("failed to set mtime: %w", err)
	}

	// Set creation time using SetFile (macOS specific)
	dateStr := t.Format("01/02/2006 15:04:05")
	cmd := exec.Command("SetFile", "-d", dateStr, path)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set creation date: %w", err)
	}

	return nil
}

func runReverse(importsDir, fixedDir string, doRename bool) {
	entries, err := os.ReadDir(importsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading imports/files: %v\n", err)
		os.Exit(1)
	}

	var renamed, skipped, failed int

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".docx") {
			continue
		}

		docxPath := filepath.Join(importsDir, entry.Name())
		firstLine := extractFirstLine(docxPath)

		// Normalize smart quotes to straight quotes
		firstLine = normalizeQuotes(firstLine)

		// Check if both .docx and .m4a exist in Fixed
		fixedDocx := filepath.Join(fixedDir, firstLine+".docx")
		fixedM4a := filepath.Join(fixedDir, firstLine+".m4a")

		docxExists := fileExists(fixedDocx)
		m4aExists := fileExists(fixedM4a)

		var status string
		if docxExists && m4aExists {
			status = "BOTH"
		} else if docxExists {
			status = "DOCX_ONLY"
		} else if m4aExists {
			status = "M4A_ONLY"
		} else {
			status = "NONE"
		}

		if doRename {
			if status != "BOTH" {
				fmt.Printf("SKIP: %s (status=%s)\n", entry.Name(), status)
				skipped++
				continue
			}

			// Target names
			targetDocx := filepath.Join(fixedDir, entry.Name())
			targetM4a := filepath.Join(fixedDir, strings.TrimSuffix(entry.Name(), ".docx")+".m4a")

			// Check if target already exists (would overwrite)
			if fileExists(targetDocx) || fileExists(targetM4a) {
				fmt.Printf("SKIP: %s (target already exists)\n", entry.Name())
				skipped++
				continue
			}

			// Rename docx
			if err := os.Rename(fixedDocx, targetDocx); err != nil {
				fmt.Printf("FAIL: %s -> %s: %v\n", firstLine+".docx", entry.Name(), err)
				failed++
				continue
			}

			// Rename m4a
			if err := os.Rename(fixedM4a, targetM4a); err != nil {
				fmt.Printf("FAIL: %s -> %s: %v\n", firstLine+".m4a", strings.TrimSuffix(entry.Name(), ".docx")+".m4a", err)
				failed++
				continue
			}

			fmt.Printf("OK: %s -> %s\n", firstLine, entry.Name())
			renamed++
		} else {
			fmt.Printf("\"%s\",\"%s\",\"%s\"\n", entry.Name(), firstLine, status)
		}
	}

	if doRename {
		fmt.Printf("\nRenamed: %d, Skipped: %d, Failed: %d\n", renamed, skipped, failed)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func extractFirstLine(docxPath string) string {
	r, err := zip.OpenReader(docxPath)
	if err != nil {
		return ""
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return ""
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return ""
			}

			// Strip XML tags
			re := regexp.MustCompile(`<[^>]*>`)
			text := re.ReplaceAllString(string(content), "")
			text = strings.TrimSpace(text)

			// Get first line (up to "Recorded:" which marks the header end)
			if idx := strings.Index(text, "Recorded:"); idx > 0 {
				text = strings.TrimSpace(text[:idx])
			}

			return text
		}
	}
	return ""
}

func normalizeQuotes(s string) string {
	// Replace smart quotes with straight quotes
	s = strings.ReplaceAll(s, "\u2019", "'")  // right single quote
	s = strings.ReplaceAll(s, "\u2018", "'")  // left single quote
	s = strings.ReplaceAll(s, "\u201C", "\"") // left double quote
	s = strings.ReplaceAll(s, "\u201D", "\"") // right double quote
	s = strings.ReplaceAll(s, "&amp;", "&")   // HTML entity
	return s
}
