package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

const collID = 50073
const workTypeSection = "Section"

func main() {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".works", "works.db")

	database, err := db.New(dbPath)
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()

	cfg := fileops.DefaultConfig()
	cfg.PDFPreviewPath = filepath.Join(homeDir, ".works", "previews")
	fops := fileops.New(cfg)

	cacheDir := bookbuild.GetCacheDir(collID)
	fmt.Printf("Cache dir: %s\n", cacheDir)

	book, _ := database.GetBookByCollection(collID)
	coll, _ := database.GetCollection(collID)

	fmt.Printf("Book: %s\n", book.Title)
	fmt.Printf("Collection: %s\n", coll.CollectionName)

	manifest, err := buildManifestWithParts(database, fops, collID, book, coll, cacheDir, "/tmp/test.pdf")
	if err != nil {
		fmt.Printf("Failed to build manifest: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nManifest Parts: %d\n", len(manifest.Parts))
	for i, p := range manifest.Parts {
		fmt.Printf("  Part %d: %s (%d works)\n", i, p.Title, len(p.Works))
	}

	analysis, err := bookbuild.AnalyzeManifest(manifest)
	if err != nil {
		fmt.Printf("Failed to analyze: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nAnalysis PartAnalyses: %d\n", len(analysis.PartAnalyses))
	for i, pa := range analysis.PartAnalyses {
		fmt.Printf("  PartAnalysis %d: %s (pages %d-%d, %d works, items %d-%d)\n",
			i, pa.PartTitle, pa.StartPage, pa.EndPage, pa.WorkCount, pa.ItemStartIndex, pa.ItemEndIndex)

		items := analysis.GetPartItems(i)
		fmt.Printf("    GetPartItems returned %d items\n", len(items))
		if len(items) > 0 {
			fmt.Printf("    First item: type=%v, title=%s\n", items[0].Type, items[0].Title)
		}
	}

	fmt.Printf("\n--- Trying BuildWithParts ---\n")

	result, err := bookbuild.BuildWithParts(bookbuild.PipelineOptions{
		Manifest:      manifest,
		CollectionID:  collID,
		CacheDir:      cacheDir,
		OutputPath:    "/tmp/debug-test.pdf",
		SelectedParts: []int{0},
		RebuildAll:    false,
		OnProgress: func(stage string, current, total int, message string) {
			fmt.Printf("[%s %d/%d] %s\n", stage, current, total, message)
		},
	})

	if err != nil {
		fmt.Printf("BuildWithParts failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nResult: Success=%v, WorkCount=%d, TotalPages=%d\n",
		result.Success, result.WorkCount, result.TotalPages)
	fmt.Printf("PartsBuilt=%d, PartsCached=%d\n", result.PartsBuilt, result.PartsCached)
	for _, w := range result.Warnings {
		fmt.Printf("Warning: %s\n", w)
	}
}

func buildManifestWithParts(database *db.DB, fops *fileops.FileOps, collID int64, book *models.Book, coll *models.Collection, buildDir, outputPath string) (*bookbuild.Manifest, error) {
	works, err := database.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get collection works: %w", err)
	}

	if len(works) == 0 {
		return nil, fmt.Errorf("collection has no works")
	}

	pdfPreviewPath := fops.Config.PDFPreviewPath

	typography := bookbuild.DefaultTypography()
	if book.HeaderFont != nil && *book.HeaderFont != "" {
		typography.HeaderFont = *book.HeaderFont
	}
	if book.HeaderSize != nil && *book.HeaderSize > 0 {
		typography.HeaderSize = *book.HeaderSize
	}
	if book.PageNumFont != nil && *book.PageNumFont != "" {
		typography.PageNumberFont = *book.PageNumFont
	}
	if book.PageNumSize != nil && *book.PageNumSize > 0 {
		typography.PageNumberSize = *book.PageNumSize
	}

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		OutputPath: outputPath,
		Typography: typography,
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	frontMatterPDF := filepath.Join(buildDir, "front-matter.pdf")
	if fileExists(frontMatterPDF) {
		manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "front-matter", PDF: frontMatterPDF})
	}

	manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	var currentPart *bookbuild.Part
	hasParts := false

	for _, w := range works {
		if w.Type == workTypeSection {
			hasParts = true
			if currentPart != nil {
				manifest.Parts = append(manifest.Parts, *currentPart)
			}
			partDividerPDF := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			currentPart = &bookbuild.Part{
				Title: w.Title,
				PDF:   partDividerPDF,
				Works: []bookbuild.Work{},
			}
		} else if currentPart != nil {
			pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			currentPart.Works = append(currentPart.Works, bookbuild.Work{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   pdfPath,
			})
		} else {
			pdfPath := filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID))
			manifest.Works = append(manifest.Works, bookbuild.Work{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   pdfPath,
			})
		}
	}

	if currentPart != nil {
		manifest.Parts = append(manifest.Parts, *currentPart)
	}

	if !hasParts {
		return nil, fmt.Errorf("collection has no parts (no Section type works)")
	}

	backMatterPDF := filepath.Join(buildDir, "back-matter.pdf")
	if fileExists(backMatterPDF) {
		manifest.BackMatter = append(manifest.BackMatter, bookbuild.BackMatterItem{Type: "back-matter", PDF: backMatterPDF})
	}

	data, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Printf("Manifest JSON (first 2000 chars):\n%s\n", string(data)[:min(2000, len(data))])

	return manifest, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
