package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"
)

const (
	statusOK      = "✓"
	statusMissing = "✗ MISSING"
)

func main() {
	manifestPath := flag.String("manifest", "", "Path to JSON manifest file")
	collectionID := flag.Int64("collection", 0, "Collection ID to build (requires database)")
	outputPath := flag.String("output", "", "Output PDF path")
	headerFont := flag.String("header-font", "Times New Roman", "Font for running headers")
	headerSize := flag.Int("header-size", 10, "Size for running headers")
	pageNumFont := flag.String("page-number-font", "Times New Roman", "Font for page numbers")
	pageNumSize := flag.Int("page-number-size", 10, "Size for page numbers")
	dryRun := flag.Bool("dry-run", false, "Show plan without building")
	maxEssays := flag.Int("max-essays", 0, "Limit overlays to first N essays (0 = all, for testing)")
	flag.Parse()

	if *manifestPath == "" && *collectionID == 0 {
		fmt.Fprintln(os.Stderr, "Error: either --manifest or --collection is required")
		flag.Usage()
		os.Exit(1)
	}

	if *manifestPath != "" && *collectionID != 0 {
		fmt.Fprintln(os.Stderr, "Error: cannot specify both --manifest and --collection")
		os.Exit(1)
	}

	var manifest *bookbuild.Manifest
	var err error

	if *manifestPath != "" {
		manifest, err = bookbuild.LoadManifest(*manifestPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading manifest: %v\n", err)
			os.Exit(1)
		}
	} else {
		manifest, err = generateManifestFromCollection(*collectionID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error generating manifest: %v\n", err)
			os.Exit(1)
		}
	}

	if *outputPath != "" {
		manifest.OutputPath = *outputPath
	}

	manifest.Typography = bookbuild.Typography{
		HeaderFont:     *headerFont,
		HeaderSize:     *headerSize,
		PageNumberFont: *pageNumFont,
		PageNumberSize: *pageNumSize,
	}

	if *dryRun {
		printDryRun(manifest)
		return
	}

	startTime := time.Now()

	result, err := bookbuild.Build(bookbuild.BuildOptions{
		Manifest:  manifest,
		MaxEssays: *maxEssays,
		OnProgress: func(stage string, current, total int, message string) {
			fmt.Printf("[%d/%d] %s: %s\n", current, total, stage, message)
		},
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Build failed: %v\n", err)
		os.Exit(1)
	}

	duration := time.Since(startTime).Round(time.Millisecond)

	fmt.Println()
	fmt.Println("Build complete!")
	fmt.Printf("  Output: %s\n", result.OutputPath)
	fmt.Printf("  Pages:  %d\n", result.TotalPages)
	fmt.Printf("  Works:  %d\n", result.WorkCount)
	fmt.Printf("  Time:   %s\n", duration)

	if len(result.Warnings) > 0 {
		fmt.Println()
		fmt.Println("Warnings:")
		for _, w := range result.Warnings {
			fmt.Printf("  - %s\n", w)
		}
	}
}

func generateManifestFromCollection(collID int64) (*bookbuild.Manifest, error) {
	home, _ := os.UserHomeDir()
	dbPath := filepath.Join(home, ".works", "works.db")

	database, err := db.New(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	defer database.Close()

	coll, err := database.GetCollection(collID)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection: %w", err)
	}

	book, err := database.GetBookByCollection(collID)
	if err != nil || book == nil {
		return nil, fmt.Errorf("collection %d is not configured as a book", collID)
	}

	works, err := database.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works")
	}

	settingsMgr := settings.NewManager()
	pdfPreviewPath := settingsMgr.Get().PDFPreviewPath
	buildDir := filepath.Join(home, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		OutputPath: filepath.Join(home, "Desktop", sanitizeFilename(book.Title)+".pdf"),
		Typography: bookbuild.DefaultTypography(),
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	manifest.FrontMatter = buildFrontMatter(book, buildDir)
	manifest.Works = buildWorksList(works, pdfPreviewPath)
	manifest.BackMatter = buildBackMatter(book, buildDir)

	return manifest, nil
}

func buildFrontMatter(_ *models.Book, buildDir string) []bookbuild.FrontMatterItem {
	var items []bookbuild.FrontMatterItem

	frontMatterPDF := filepath.Join(buildDir, "front-matter.pdf")
	if fileExists(frontMatterPDF) {
		items = append(items, bookbuild.FrontMatterItem{Type: "front-matter", PDF: frontMatterPDF})
	}

	items = append(items, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	return items
}

func buildWorksList(works []models.CollectionWork, pdfPreviewPath string) []bookbuild.Work {
	result := make([]bookbuild.Work, 0, len(works))

	for _, w := range works {
		pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
		result = append(result, bookbuild.Work{
			ID:    w.WorkID,
			Title: w.Title,
			PDF:   pdfPath,
		})
	}

	return result
}

func buildBackMatter(_ *models.Book, buildDir string) []bookbuild.BackMatterItem {
	var items []bookbuild.BackMatterItem

	backMatterPDF := filepath.Join(buildDir, "back-matter.pdf")
	if fileExists(backMatterPDF) {
		items = append(items, bookbuild.BackMatterItem{Type: "back-matter", PDF: backMatterPDF})
	}

	return items
}

func printDryRun(manifest *bookbuild.Manifest) {
	fmt.Println("=== DRY RUN ===")
	fmt.Println()
	fmt.Printf("Book: %s\n", manifest.Title)
	fmt.Printf("Author: %s\n", manifest.Author)
	fmt.Printf("Output: %s\n", manifest.OutputPath)
	fmt.Println()

	fmt.Println("Front Matter:")
	for _, fm := range manifest.FrontMatter {
		if fm.Placeholder {
			fmt.Printf("  - [%s] (generated)\n", fm.Type)
		} else {
			status := statusOK
			if !fileExists(bookbuild.ExpandPath(fm.PDF)) {
				status = statusMissing
			}
			fmt.Printf("  - [%s] %s %s\n", fm.Type, fm.PDF, status)
		}
	}

	fmt.Println()
	fmt.Println("Works:")
	for i, w := range manifest.AllWorks() {
		status := statusOK
		if !fileExists(bookbuild.ExpandPath(w.PDF)) {
			status = statusMissing
		}
		fmt.Printf("  %d. %s %s\n", i+1, w.Title, status)
	}

	if len(manifest.BackMatter) > 0 {
		fmt.Println()
		fmt.Println("Back Matter:")
		for _, bm := range manifest.BackMatter {
			status := statusOK
			if !fileExists(bookbuild.ExpandPath(bm.PDF)) {
				status = statusMissing
			}
			fmt.Printf("  - [%s] %s %s\n", bm.Type, bm.PDF, status)
		}
	}

	fmt.Println()
	fmt.Println("Typography:")
	fmt.Printf("  Header: %s %dpt\n", manifest.Typography.HeaderFont, manifest.Typography.HeaderSize)
	fmt.Printf("  Page #: %s %dpt\n", manifest.Typography.PageNumberFont, manifest.Typography.PageNumberSize)

	data, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Println()
	fmt.Println("Manifest JSON:")
	fmt.Println(string(data))
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func sanitizeFilename(name string) string {
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "-")
	}
	return result
}
