package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: tocdebug <collectionID>")
		os.Exit(1)
	}
	collID, _ := strconv.ParseInt(os.Args[1], 10, 64)

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
	book, _ := database.GetBookByCollection(collID)
	coll, _ := database.GetCollection(collID)
	cacheDir := bookbuild.GetCacheDir(collID)

	manifest, _ := buildManifestWithParts(database, fops, collID, book, coll, cacheDir, "/tmp/test.pdf")
	analysis, _ := bookbuild.AnalyzeManifest(manifest)

	fmt.Printf("Analysis has %d items:\n", len(analysis.Items))
	for i, item := range analysis.Items {
		fmt.Printf("  [%d] Type=%d Title='%s' Pages=%d\n", i, item.Type, item.Title, item.PageCount)
	}

	config := bookbuild.DefaultOverlayConfig(manifest.Title)
	entries, _ := bookbuild.GenerateTOC(analysis, config)
	fmt.Printf("\nTOC has %d entries:\n", len(entries))
	for i, e := range entries {
		fmt.Printf("  [%d] '%s' page=%d isPart=%v\n", i, e.Title, e.PageNumber, e.IsPart)
	}
}

func buildManifestWithParts(database *db.DB, fops *fileops.FileOps, collID int64, book *models.Book, _ *models.Collection, _, outputPath string) (*bookbuild.Manifest, error) {
	works, _ := database.GetCollectionWorks(collID, false)
	pdfPreviewPath := fops.Config.PDFPreviewPath

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		OutputPath: outputPath,
	}

	manifest.FrontMatter = append(manifest.FrontMatter, bookbuild.FrontMatterItem{Type: "toc", Placeholder: true})

	var currentPart *bookbuild.Part
	for _, w := range works {
		if w.Type == "Section" {
			if currentPart != nil {
				manifest.Parts = append(manifest.Parts, *currentPart)
			}
			currentPart = &bookbuild.Part{
				Title: w.Title,
				PDF:   filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID)),
				Works: []bookbuild.Work{},
			}
		} else if currentPart != nil {
			currentPart.Works = append(currentPart.Works, bookbuild.Work{
				ID:    w.WorkID,
				Title: w.Title,
				PDF:   filepath.Join(pdfPreviewPath, fmt.Sprintf("%d.pdf", w.WorkID)),
			})
		}
	}
	if currentPart != nil {
		manifest.Parts = append(manifest.Parts, *currentPart)
	}

	return manifest, nil
}
