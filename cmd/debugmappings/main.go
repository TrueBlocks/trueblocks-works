package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/bookbuild"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"
)

func main() {
	collID := int64(50073)
	if len(os.Args) > 1 {
		if id, err := strconv.ParseInt(os.Args[1], 10, 64); err == nil {
			collID = id
		}
	}

	manifest, err := generateManifest(collID)
	if err != nil {
		fmt.Println("Error generating manifest:", err)
		return
	}

	analysis, err := bookbuild.AnalyzeManifest(manifest)
	if err != nil {
		fmt.Println("Error analyzing:", err)
		return
	}

	fmt.Printf("=== ANALYSIS ===\n")
	fmt.Printf("Items: %d, Front: %d pages, Body: %d pages, Back: %d pages, Total: %d pages\n\n",
		len(analysis.Items), analysis.FrontMatterPages, analysis.BodyPages,
		analysis.BackMatterPages, analysis.TotalPages)

	typeNames := map[bookbuild.ContentType]string{
		bookbuild.ContentTypeFrontMatter: "FrontMatter",
		bookbuild.ContentTypeTOC:         "TOC",
		bookbuild.ContentTypePartDivider: "PartDivider",
		bookbuild.ContentTypeWork:        "Work",
		bookbuild.ContentTypeBackMatter:  "BackMatter",
		bookbuild.ContentTypeBlank:       "Blank",
	}

	for i, item := range analysis.Items {
		typeName := typeNames[item.Type]
		fmt.Printf("[%3d] %-12s pages %3d-%3d (%d pages) %q\n",
			i, typeName, item.StartPage, item.EndPage, item.PageCount, item.Title)
		if i > 20 {
			fmt.Println("... (truncated)")
			break
		}
	}

	fmt.Printf("\n=== PAGE MAPPINGS (first 30) ===\n")

	buildDir := "/tmp/debug-build"
	_ = os.MkdirAll(buildDir, 0755)

	mergeResult, err := bookbuild.MergePDFsWithTracking(analysis, buildDir, "/tmp/debug-merged.pdf")
	if err != nil {
		fmt.Println("Error merging:", err)
		return
	}

	styleNames := map[bookbuild.NumberStyle]string{
		bookbuild.NumberStyleNone:   "None",
		bookbuild.NumberStyleRoman:  "Roman",
		bookbuild.NumberStyleArabic: "Arabic",
	}

	for i, m := range mergeResult.PageMappings {
		if i >= 30 {
			fmt.Println("... (truncated)")
			break
		}

		typeName := "nil"
		title := ""
		if m.ContentItem != nil {
			typeName = typeNames[m.ContentItem.Type]
			title = m.ContentItem.Title
		}

		versoRecto := "verso"
		if m.IsRecto() {
			versoRecto = "recto"
		}

		fmt.Printf("Phys %3d: %-12s page %d of item, %s, showNum=%v (%s), showHdr=%v, title=%q\n",
			m.PhysicalPage, typeName, m.PageInItem, versoRecto,
			m.ShouldShowPageNumber(), styleNames[m.GetNumberStyle()],
			m.ShouldShowHeader(), title)
	}
}

func generateManifest(collID int64) (*bookbuild.Manifest, error) {
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

	settingsMgr := settings.NewManager()
	pdfPreviewPath := settingsMgr.Get().PDFPreviewPath
	buildDir := filepath.Join(home, ".works", "book-builds", fmt.Sprintf("coll-%d", collID))

	manifest := &bookbuild.Manifest{
		Title:      book.Title,
		Author:     book.Author,
		Typography: bookbuild.DefaultTypography(),
	}

	if manifest.Title == "" {
		manifest.Title = coll.CollectionName
	}

	manifest.FrontMatter = buildFrontMatter(buildDir)
	manifest.Works = buildWorksList(works, pdfPreviewPath)
	manifest.BackMatter = buildBackMatter(buildDir)

	return manifest, nil
}

func buildFrontMatter(buildDir string) []bookbuild.FrontMatterItem {
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

func buildBackMatter(buildDir string) []bookbuild.BackMatterItem {
	var items []bookbuild.BackMatterItem

	backMatterPDF := filepath.Join(buildDir, "back-matter.pdf")
	if fileExists(backMatterPDF) {
		items = append(items, bookbuild.BackMatterItem{Type: "back-matter", PDF: backMatterPDF})
	}

	return items
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
