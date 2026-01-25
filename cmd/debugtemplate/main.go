package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const wordDocumentXML = "word/document.xml"
const wordRelsPath = "word/_rels/document.xml.rels"
const imageRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
const hyperlinkRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"

type HyperlinkRef struct {
	SourceRelID string
	OutputRelID string
	Target      string
}

type ImageRef struct {
	SourceRelID string
	OutputRelID string
	MediaPath   string
	LocalPath   string
	DrawingXML  string
	IsLinked    bool
	Hyperlinks  []HyperlinkRef
}

type ParagraphContent struct {
	Text   string
	Images []ImageRef
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <work-id> [template-path]")
		fmt.Println("\nDebug tool for ApplyTemplate failures")
		fmt.Println("Tests each step of the ApplyTemplateToWork flow")
		os.Exit(1)
	}

	workID := os.Args[1]

	home, _ := os.UserHomeDir()
	dbPath := filepath.Join(home, ".works", "works.db")

	fmt.Println("=== DEBUG: ApplyTemplateToWork ===")
	fmt.Printf("Work ID: %s\n", workID)
	fmt.Printf("Database: %s\n", dbPath)
	fmt.Println()

	fmt.Println("--- STEP 1: Database lookup ---")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Printf("❌ Failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	var title string
	var path sql.NullString
	err = db.QueryRow(`SELECT title, path FROM Works WHERE workId = ?`, workID).Scan(&title, &path)
	if err != nil {
		fmt.Printf("❌ Work not found: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Title: %s\n", title)
	fmt.Printf("✓ Path: %v\n", path.String)

	// Get collection ID from CollectionDetails junction table
	var collID sql.NullInt64
	err = db.QueryRow(`SELECT collID FROM CollectionDetails WHERE workID = ? LIMIT 1`, workID).Scan(&collID)
	if err != nil && err != sql.ErrNoRows {
		fmt.Printf("⚠ Could not get collection: %v\n", err)
	}
	if collID.Valid {
		fmt.Printf("✓ Collection ID: %v\n", collID.Int64)
	} else {
		fmt.Println("  (not in any collection)")
	}

	if !path.Valid || path.String == "" {
		fmt.Println("❌ Work has no file path")
		os.Exit(1)
	}

	// Load config from JSON file
	configPath := filepath.Join(home, ".works", "config.json")
	configData, err := os.ReadFile(configPath)
	if err != nil {
		fmt.Printf("❌ Could not read config file: %v\n", err)
		os.Exit(1)
	}
	var config struct {
		BaseFolderPath string `json:"baseFolderPath"`
	}
	if err := json.Unmarshal(configData, &config); err != nil {
		fmt.Printf("❌ Could not parse config: %v\n", err)
		os.Exit(1)
	}
	basePath := config.BaseFolderPath
	fmt.Printf("✓ Base folder: %s\n", basePath)

	fullPath := filepath.Join(basePath, path.String)
	fmt.Printf("✓ Full path: %s\n", fullPath)

	fmt.Println("\n--- STEP 2: File existence check ---")
	info, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		fmt.Printf("❌ File not found: %s\n", fullPath)
		os.Exit(1)
	}
	if err != nil {
		fmt.Printf("❌ Error checking file: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ File exists, size: %d bytes\n", info.Size())

	if !strings.HasSuffix(strings.ToLower(fullPath), ".docx") {
		fmt.Printf("❌ Not a DOCX file: %s\n", fullPath)
		os.Exit(1)
	}
	fmt.Println("✓ File has .docx extension")

	fmt.Println("\n--- STEP 3: Template resolution ---")
	var templatePath string
	if len(os.Args) > 2 {
		templatePath = os.Args[2]
		fmt.Printf("✓ Template from args: %s\n", templatePath)
	} else if collID.Valid {
		var tPath sql.NullString
		err = db.QueryRow(`SELECT templatePath FROM Collections WHERE collectionId = ?`, collID.Int64).Scan(&tPath)
		if err == nil && tPath.Valid {
			templatePath = tPath.String
			fmt.Printf("✓ Template from collection: %s\n", templatePath)
		}
	}

	if templatePath == "" {
		fmt.Println("⚠ No template specified - would fail in actual apply")
		fmt.Println("  Continuing analysis without template comparison...")
	} else {
		if _, err := os.Stat(templatePath); os.IsNotExist(err) {
			fmt.Printf("❌ Template not found: %s\n", templatePath)
		} else {
			fmt.Println("✓ Template file exists")
		}
	}

	fmt.Println("\n--- STEP 4: ZIP structure validation ---")
	reader, err := zip.OpenReader(fullPath)
	if err != nil {
		fmt.Printf("❌ Cannot open as ZIP: %v\n", err)
		fmt.Println("  This file may be corrupted or not a valid DOCX")
		os.Exit(1)
	}
	defer reader.Close()
	fmt.Printf("✓ Valid ZIP archive with %d files\n", len(reader.File))

	fmt.Println("\n--- STEP 5: DOCX contents ---")
	hasDocXML := false
	hasRels := false
	hasContentTypes := false
	var mediaFiles []string

	for _, file := range reader.File {
		switch file.Name {
		case "[Content_Types].xml":
			hasContentTypes = true
		case "word/document.xml":
			hasDocXML = true
		case "word/_rels/document.xml.rels":
			hasRels = true
		}
		if strings.HasPrefix(file.Name, "word/media/") {
			mediaFiles = append(mediaFiles, file.Name)
		}
	}

	if hasContentTypes {
		fmt.Println("✓ [Content_Types].xml present")
	} else {
		fmt.Println("❌ [Content_Types].xml MISSING")
	}

	if hasDocXML {
		fmt.Println("✓ word/document.xml present")
	} else {
		fmt.Println("❌ word/document.xml MISSING")
	}

	if hasRels {
		fmt.Println("✓ word/_rels/document.xml.rels present")
	} else {
		fmt.Println("❌ word/_rels/document.xml.rels MISSING")
	}

	fmt.Printf("✓ Media files: %d\n", len(mediaFiles))
	for _, mf := range mediaFiles {
		fmt.Printf("    %s\n", mf)
	}

	fmt.Println("\n--- STEP 6: document.xml analysis ---")
	var docContent []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				fmt.Printf("❌ Cannot open document.xml: %v\n", err)
				os.Exit(1)
			}
			docContent, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				fmt.Printf("❌ Cannot read document.xml: %v\n", err)
				os.Exit(1)
			}
			break
		}
	}

	if docContent == nil {
		fmt.Println("❌ document.xml content is nil")
		os.Exit(1)
	}
	fmt.Printf("✓ document.xml size: %d bytes\n", len(docContent))

	contentStr := string(docContent)
	if strings.Contains(contentStr, "<w:document") {
		fmt.Println("✓ Contains <w:document> element")
	} else {
		fmt.Println("❌ Missing <w:document> element")
	}

	if strings.Contains(contentStr, "</w:document>") {
		fmt.Println("✓ Contains </w:document> closing tag")
	} else {
		fmt.Println("❌ Missing </w:document> closing tag")
	}

	if strings.Contains(contentStr, "<w:body>") || strings.Contains(contentStr, "<w:body ") {
		fmt.Println("✓ Contains <w:body> element")
	} else {
		fmt.Println("❌ Missing <w:body> element")
	}

	if strings.Contains(contentStr, "</w:body>") {
		fmt.Println("✓ Contains </w:body> closing tag")
	} else {
		fmt.Println("❌ Missing </w:body> closing tag")
	}

	fmt.Println("\n--- STEP 7: XML validation ---")
	decoder := xml.NewDecoder(bytes.NewReader(docContent))
	tokenCount := 0
	xmlErr := ""
	for {
		_, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			xmlErr = err.Error()
			break
		}
		tokenCount++
	}
	if xmlErr == "" {
		fmt.Printf("✓ Valid XML with %d tokens\n", tokenCount)
	} else {
		fmt.Printf("❌ XML parsing error: %s\n", xmlErr)
	}

	fmt.Println("\n--- STEP 8: Relationships analysis ---")
	rels, err := parseRelationships(fullPath)
	if err != nil {
		fmt.Printf("❌ Cannot parse relationships: %v\n", err)
	} else {
		fmt.Printf("✓ Found %d relationships (images/hyperlinks)\n", len(rels))
		for id, target := range rels {
			fmt.Printf("    %s -> %s\n", id, target)
		}
	}

	fmt.Println("\n--- STEP 9: Paragraph extraction ---")
	paragraphs, err := extractParagraphsWithImages(fullPath)
	if err != nil {
		fmt.Printf("❌ Failed to extract paragraphs: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Extracted %d paragraphs\n", len(paragraphs))

	imagesFound := 0
	linkedImages := 0
	hyperlinksInDrawings := 0
	for i, para := range paragraphs {
		if len(para.Images) > 0 {
			fmt.Printf("  Paragraph %d: %d images\n", i+1, len(para.Images))
			for _, img := range para.Images {
				imagesFound++
				if img.IsLinked {
					linkedImages++
					fmt.Printf("    ⚠ LINKED image: relID=%s, path=%s\n", img.SourceRelID, img.MediaPath)
				} else {
					fmt.Printf("    Embedded image: relID=%s, path=%s\n", img.SourceRelID, img.MediaPath)
				}
				if len(img.Hyperlinks) > 0 {
					hyperlinksInDrawings += len(img.Hyperlinks)
					for _, hl := range img.Hyperlinks {
						fmt.Printf("      🔗 Hyperlink in drawing: relID=%s, target=%s\n", hl.SourceRelID, hl.Target)
					}
				}
			}
		}
		if para.Text != "" && len(para.Text) > 0 {
			preview := para.Text
			if len(preview) > 80 {
				preview = preview[:80] + "..."
			}
			if i < 5 || len(para.Images) > 0 {
				fmt.Printf("  Paragraph %d: \"%s\"\n", i+1, preview)
			}
		}
	}
	fmt.Printf("✓ Total images: %d (embedded: %d, linked: %d)\n", imagesFound, imagesFound-linkedImages, linkedImages)
	if hyperlinksInDrawings > 0 {
		fmt.Printf("✓ Hyperlinks in drawings: %d (these must be added to output rels!)\n", hyperlinksInDrawings)
	}

	fmt.Println("\n--- STEP 10: Drawing element analysis ---")
	drawingCount := strings.Count(contentStr, "<w:drawing")
	pictCount := strings.Count(contentStr, "<w:pict")
	blipCount := strings.Count(contentStr, "r:embed=")
	linkCount := strings.Count(contentStr, "r:link=")

	fmt.Printf("  <w:drawing> elements: %d\n", drawingCount)
	fmt.Printf("  <w:pict> elements: %d (legacy)\n", pictCount)
	fmt.Printf("  r:embed references: %d\n", blipCount)
	fmt.Printf("  r:link references: %d (linked images)\n", linkCount)

	if pictCount > 0 {
		fmt.Println("  ⚠ Document contains legacy <w:pict> elements - may not be handled correctly")
	}

	fmt.Println("\n--- STEP 11: Problematic content check ---")
	var issues []string

	if strings.Contains(contentStr, "<o:OLEObject") {
		issues = append(issues, "OLE objects detected")
	}
	if strings.Contains(contentStr, "<w:fldChar") {
		issues = append(issues, "Complex field codes detected")
	}
	if strings.Contains(contentStr, "<w:commentReference") {
		issues = append(issues, "Comment references detected")
	}
	if strings.Contains(contentStr, "<w:ins ") || strings.Contains(contentStr, "<w:del ") {
		issues = append(issues, "Tracked changes detected")
	}
	if strings.Contains(contentStr, "<m:oMath") {
		issues = append(issues, "Math equations detected")
	}
	if strings.Contains(contentStr, "<dgm:") {
		issues = append(issues, "SmartArt diagrams detected")
	}
	if strings.Contains(contentStr, "<c:chart") {
		issues = append(issues, "Charts detected")
	}
	if strings.Contains(contentStr, "<w:txbxContent") {
		issues = append(issues, "Text boxes detected")
	}
	if strings.Contains(contentStr, "<w:footnoteReference") {
		issues = append(issues, "Footnote references detected")
	}
	if strings.Contains(contentStr, "<w:endnoteReference") {
		issues = append(issues, "Endnote references detected")
	}
	if strings.Contains(contentStr, "<w:bookmarkStart") {
		bookmarkCount := strings.Count(contentStr, "<w:bookmarkStart")
		issues = append(issues, fmt.Sprintf("%d bookmarks detected", bookmarkCount))
	}
	if strings.Contains(contentStr, "<w:hyperlink") {
		hyperlinkCount := strings.Count(contentStr, "<w:hyperlink")
		issues = append(issues, fmt.Sprintf("%d hyperlinks detected", hyperlinkCount))
	}

	if len(issues) == 0 {
		fmt.Println("✓ No problematic content detected")
	} else {
		fmt.Printf("⚠ Found %d potential issues:\n", len(issues))
		for _, issue := range issues {
			fmt.Printf("    - %s\n", issue)
		}
	}

	// Step 11.5: Test linked image downloads
	if linkedImages > 0 {
		fmt.Println("\n--- STEP 11.5: Testing linked image downloads ---")
		for i, para := range paragraphs {
			for _, img := range para.Images {
				if img.IsLinked && img.MediaPath != "" {
					fmt.Printf("  Testing URL: %s\n", img.MediaPath)
					err := testImageDownload(img.MediaPath)
					if err != nil {
						fmt.Printf("    ❌ FAILED: %v\n", err)
						fmt.Printf("    (Paragraph %d)\n", i+1)
					} else {
						fmt.Printf("    ✓ OK\n")
					}
				}
			}
		}
	}

	if templatePath != "" {
		fmt.Println("\n--- STEP 12: Template comparison ---")
		if _, err := os.Stat(templatePath); err == nil {
			maxRelID, err := getMaxRelationshipID(templatePath)
			if err != nil {
				fmt.Printf("❌ Cannot get max rel ID from template: %v\n", err)
			} else {
				fmt.Printf("✓ Template max relationship ID: rId%d\n", maxRelID)
				fmt.Printf("  New images would start at: rId%d\n", maxRelID+1)
			}
		}
	}

	// Step 13: Simulate the full ApplyTemplate flow
	if templatePath != "" {
		fmt.Println("\n--- STEP 13: Simulating ApplyTemplate flow ---")
		simulateApplyTemplate(fullPath, templatePath, paragraphs)
	}

	fmt.Println("\n=== SUMMARY ===")
	if xmlErr != "" {
		fmt.Println("❌ Document has invalid XML - this will cause ApplyTemplate to fail")
	} else if !hasDocXML || !hasRels || !hasContentTypes {
		fmt.Println("❌ Document is missing required DOCX components")
	} else if len(issues) > 0 {
		fmt.Println("⚠ Document has complex content that may not be fully preserved")
	} else {
		fmt.Println("✓ Document appears to be a valid, simple DOCX")
	}

	// Step 14: Generate actual output using the same code as ApplyTemplateToWork
	if templatePath != "" {
		fmt.Println("\n--- STEP 14: Generate actual test output ---")
		outputPath := "/tmp/debug-template-output.docx"

		// Download linked images (same as real code)
		processedParagraphs := downloadLinkedImagesDebug(paragraphs, fullPath)

		// Remap image relationships
		maxRelID, err := getMaxRelationshipID(templatePath)
		if err != nil {
			fmt.Printf("❌ Failed to get max rel ID: %v\n", err)
		} else {
			remappedParagraphs, idMap := remapImageRelationshipsDebug(processedParagraphs, maxRelID)

			fmt.Printf("  ID remappings:\n")
			for old, newID := range idMap {
				fmt.Printf("    %s -> %s\n", old, newID)
			}

			// Build document XML
			newDocXML, err := buildDocumentXMLWithImagesDebug(templatePath, remappedParagraphs)
			if err != nil {
				fmt.Printf("❌ Failed to build document.xml: %v\n", err)
			} else {
				// Write document.xml for inspection
				_ = os.WriteFile(outputPath+".document.xml", newDocXML, 0644)
				fmt.Printf("  ✓ Wrote document.xml (%d bytes) to %s\n", len(newDocXML), outputPath+".document.xml")

				// Validate XML
				decoder := xml.NewDecoder(bytes.NewReader(newDocXML))
				tokenCount := 0
				xmlValid := true
				for {
					_, err := decoder.Token()
					if err == io.EOF {
						break
					}
					if err != nil {
						fmt.Printf("❌ Invalid XML at token %d: %v\n", tokenCount, err)
						xmlValid = false
						break
					}
					tokenCount++
				}
				if xmlValid {
					fmt.Printf("  ✓ XML valid (%d tokens)\n", tokenCount)
				}

				// Create output file
				if err := replaceDocumentXMLWithImagesDebug(templatePath, fullPath, outputPath, newDocXML, remappedParagraphs); err != nil {
					fmt.Printf("❌ Failed to create output: %v\n", err)
				} else {
					// Also write the rels file for inspection
					extractRelsFromDocx(outputPath)

					fmt.Printf("\n  ✓ Output written to: %s\n", outputPath)
					fmt.Println("  Try opening this file in Word to test.")
				}
			}
		}
	}
}

func parseRelationships(docxPath string) (map[string]string, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == wordRelsPath {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open rels: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("read rels: %w", err)
			}

			return parseRelsXML(content)
		}
	}

	return make(map[string]string), nil
}

func parseRelsXML(content []byte) (map[string]string, error) {
	type Relationship struct {
		ID     string `xml:"Id,attr"`
		Type   string `xml:"Type,attr"`
		Target string `xml:"Target,attr"`
	}
	type Relationships struct {
		Rels []Relationship `xml:"Relationship"`
	}

	var rels Relationships
	if err := xml.Unmarshal(content, &rels); err != nil {
		return nil, fmt.Errorf("parse rels xml: %w", err)
	}

	result := make(map[string]string)
	for _, rel := range rels.Rels {
		if rel.Type == imageRelType || rel.Type == hyperlinkRelType {
			result[rel.ID] = rel.Target
		}
	}
	return result, nil
}

func extractParagraphsWithImages(docxPath string) ([]ParagraphContent, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return nil, fmt.Errorf("open docx: %w", err)
	}
	defer reader.Close()

	var docContent []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			docContent, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if docContent == nil {
		return nil, fmt.Errorf("document.xml not found in docx")
	}

	rels, err := parseRelationships(docxPath)
	if err != nil {
		return nil, fmt.Errorf("parse relationships: %w", err)
	}

	return parseParagraphsWithImages(docContent, rels)
}

func parseParagraphsWithImages(content []byte, rels map[string]string) ([]ParagraphContent, error) {
	contentStr := string(content)
	var paragraphs []ParagraphContent

	pStart := 0
	for {
		openTag := strings.Index(contentStr[pStart:], "<w:p>")
		if openTag == -1 {
			openTag = strings.Index(contentStr[pStart:], "<w:p ")
		}
		if openTag == -1 {
			break
		}
		openTag += pStart

		closeTag := strings.Index(contentStr[openTag:], "</w:p>")
		if closeTag == -1 {
			break
		}
		closeTag += openTag + 6

		paraXML := contentStr[openTag:closeTag]
		para := parseSingleParagraph(paraXML, rels)
		paragraphs = append(paragraphs, para)

		pStart = closeTag
	}

	return paragraphs, nil
}

func parseSingleParagraph(paraXML string, rels map[string]string) ParagraphContent {
	var result ParagraphContent
	var textBuilder strings.Builder

	remaining := paraXML
	for len(remaining) > 0 {
		drawingStart := strings.Index(remaining, "<w:drawing>")
		if drawingStart == -1 {
			drawingStart = strings.Index(remaining, "<w:drawing ")
		}

		if drawingStart == -1 {
			textBuilder.WriteString(extractTextFromXML(remaining))
			break
		}

		textBuilder.WriteString(extractTextFromXML(remaining[:drawingStart]))

		drawingEnd := strings.Index(remaining[drawingStart:], "</w:drawing>")
		if drawingEnd == -1 {
			break
		}
		drawingEnd += drawingStart + 12

		drawingXML := remaining[drawingStart:drawingEnd]
		img := extractImageRef(drawingXML, rels)
		if img.DrawingXML != "" {
			result.Images = append(result.Images, img)
		}

		remaining = remaining[drawingEnd:]
	}

	result.Text = strings.TrimSpace(textBuilder.String())
	return result
}

func extractTextFromXML(xmlStr string) string {
	var result strings.Builder
	decoder := xml.NewDecoder(strings.NewReader(xmlStr))

	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		if charData, ok := token.(xml.CharData); ok {
			result.WriteString(string(charData))
		}
	}
	return result.String()
}

func extractImageRef(drawingXML string, rels map[string]string) ImageRef {
	var relID string
	var isLinked bool

	embedStart := strings.Index(drawingXML, "r:embed=\"")
	if embedStart != -1 {
		embedStart += 9
		embedEnd := strings.Index(drawingXML[embedStart:], "\"")
		if embedEnd != -1 {
			relID = drawingXML[embedStart : embedStart+embedEnd]
		}
	}

	if relID == "" {
		linkStart := strings.Index(drawingXML, "r:link=\"")
		if linkStart != -1 {
			linkStart += 8
			linkEnd := strings.Index(drawingXML[linkStart:], "\"")
			if linkEnd != -1 {
				relID = drawingXML[linkStart : linkStart+linkEnd]
				isLinked = true
			}
		}
	}

	if relID == "" {
		return ImageRef{}
	}

	mediaPath := rels[relID]

	// Extract hyperlinks from the drawing (e.g., a:hlinkClick r:id="rId12")
	var hyperlinks []HyperlinkRef
	remaining := drawingXML
	for {
		ridStart := strings.Index(remaining, "r:id=\"")
		if ridStart == -1 {
			break
		}
		ridStart += 6
		ridEnd := strings.Index(remaining[ridStart:], "\"")
		if ridEnd == -1 {
			break
		}
		rid := remaining[ridStart : ridStart+ridEnd]
		remaining = remaining[ridStart+ridEnd:]

		// Skip if this is our image relID
		if rid == relID {
			continue
		}

		// Check if this r:id is a hyperlink in rels
		if target, ok := rels[rid]; ok {
			if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
				hyperlinks = append(hyperlinks, HyperlinkRef{
					SourceRelID: rid,
					Target:      target,
				})
			}
		}
	}

	return ImageRef{
		SourceRelID: relID,
		MediaPath:   mediaPath,
		DrawingXML:  drawingXML,
		IsLinked:    isLinked,
		Hyperlinks:  hyperlinks,
	}
}

func getMaxRelationshipID(templatePath string) (int, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return 0, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	maxID := 0
	for _, file := range reader.File {
		if file.Name == wordRelsPath {
			rc, err := file.Open()
			if err != nil {
				continue
			}
			content, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}

			type Relationship struct {
				ID string `xml:"Id,attr"`
			}
			type Relationships struct {
				Rels []Relationship `xml:"Relationship"`
			}

			var allRels Relationships
			if err := xml.Unmarshal(content, &allRels); err != nil {
				continue
			}

			for _, rel := range allRels.Rels {
				if strings.HasPrefix(rel.ID, "rId") {
					numStr := strings.TrimPrefix(rel.ID, "rId")
					var num int
					_, err := fmt.Sscanf(numStr, "%d", &num)
					if err == nil && num > maxID {
						maxID = num
					}
				}
			}
		}
	}

	return maxID, nil
}

func testImageDownload(url string) error {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d %s", resp.StatusCode, resp.Status)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	fmt.Printf("    Content-Type: %s, Size: %d bytes\n", contentType, len(data))

	return nil
}

func simulateApplyTemplate(_, templatePath string, paragraphs []ParagraphContent) {
	// Step A: Download linked images (simulation)
	fmt.Println("  A. Simulating downloadLinkedImages...")
	hasLinkedImages := false
	for _, para := range paragraphs {
		for _, img := range para.Images {
			if img.IsLinked {
				hasLinkedImages = true
				break
			}
		}
	}
	if hasLinkedImages {
		fmt.Println("    ⚠ Document has linked images - will attempt to download and embed")
	} else {
		fmt.Println("    ✓ No linked images to download")
	}

	// Step B: Get max relationship ID
	fmt.Println("  B. Getting max relationship ID from template...")
	maxRelID, err := getMaxRelationshipID(templatePath)
	if err != nil {
		fmt.Printf("    ❌ Failed: %v\n", err)
		return
	}
	fmt.Printf("    ✓ Max rel ID: rId%d\n", maxRelID)

	// Step C: Try to build document.xml
	fmt.Println("  C. Building document.xml with remapped images...")
	newDocXML, err := buildDocumentXML(templatePath, paragraphs)
	if err != nil {
		fmt.Printf("    ❌ Failed: %v\n", err)
		return
	}
	fmt.Printf("    ✓ Built document.xml (%d bytes)\n", len(newDocXML))

	// Step D: Validate the new document.xml
	fmt.Println("  D. Validating new document.xml...")
	decoder := xml.NewDecoder(bytes.NewReader(newDocXML))
	tokenCount := 0
	for {
		_, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			fmt.Printf("    ❌ Invalid XML: %v\n", err)
			// Show context around the error
			fmt.Printf("    First 500 chars of document.xml:\n    %s\n", string(newDocXML[:min(500, len(newDocXML))]))
			return
		}
		tokenCount++
	}
	fmt.Printf("    ✓ Valid XML with %d tokens\n", tokenCount)

	// Step E: Create test output
	fmt.Println("  E. Test output generation would occur here...")
	fmt.Println("    ✓ Simulation complete - ApplyTemplate should work")
}

func buildDocumentXML(templatePath string, paragraphs []ParagraphContent) ([]byte, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	var templateDocXML []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			templateDocXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if templateDocXML == nil {
		return nil, fmt.Errorf("document.xml not found in template")
	}

	content := string(templateDocXML)

	bodyStart := strings.Index(content, "<w:body>")
	if bodyStart == -1 {
		bodyStart = strings.Index(content, "<w:body ")
	}
	if bodyStart == -1 {
		return nil, fmt.Errorf("no <w:body> found in template")
	}

	bodyEnd := strings.Index(content, "</w:body>")
	if bodyEnd == -1 {
		return nil, fmt.Errorf("no </w:body> found in template")
	}

	bodyTagEnd := strings.Index(content[bodyStart:], ">")
	if bodyTagEnd == -1 {
		return nil, fmt.Errorf("malformed <w:body> tag")
	}
	bodyTagEnd += bodyStart + 1

	sectPrStart := strings.LastIndex(content[:bodyEnd], "<w:sectPr")
	var sectPr string
	if sectPrStart != -1 {
		sectPr = content[sectPrStart:bodyEnd]
	}

	var buf bytes.Buffer
	buf.WriteString(content[:bodyTagEnd])

	for _, para := range paragraphs {
		escaped := escapeXML(para.Text)
		buf.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
		buf.WriteString(escaped)
		buf.WriteString(`</w:t></w:r>`)
		for _, img := range para.Images {
			buf.WriteString(`<w:r>`)
			buf.WriteString(img.DrawingXML)
			buf.WriteString(`</w:r>`)
		}
		buf.WriteString(`</w:p>`)
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func downloadLinkedImagesDebug(paragraphs []ParagraphContent, workPath string) []ParagraphContent {
	dir := filepath.Dir(workPath)
	base := filepath.Base(workPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	supportingDir := filepath.Join(dir, "Supporting", name)

	result := make([]ParagraphContent, len(paragraphs))
	downloadedURLs := make(map[string]string)
	imageNum := 1

	for i, para := range paragraphs {
		result[i].Text = para.Text
		for _, img := range para.Images {
			if !img.IsLinked || img.MediaPath == "" {
				result[i].Images = append(result[i].Images, img)
				continue
			}

			if localPath, exists := downloadedURLs[img.MediaPath]; exists {
				newImg := img
				newImg.LocalPath = localPath
				newImg.IsLinked = false
				newImg.DrawingXML = strings.Replace(img.DrawingXML, "r:link=", "r:embed=", 1)
				result[i].Images = append(result[i].Images, newImg)
				continue
			}

			fmt.Printf("  Downloading: %s\n", img.MediaPath)
			localPath, err := downloadImageDebug(img.MediaPath, supportingDir, imageNum)
			if err != nil {
				fmt.Printf("    ⚠ Failed: %v (keeping as linked)\n", err)
				result[i].Images = append(result[i].Images, img)
				imageNum++
				continue
			}

			downloadedURLs[img.MediaPath] = localPath
			imageNum++
			fmt.Printf("    ✓ Saved to: %s\n", localPath)

			newImg := img
			newImg.LocalPath = localPath
			newImg.IsLinked = false
			newImg.DrawingXML = strings.Replace(img.DrawingXML, "r:link=", "r:embed=", 1)
			result[i].Images = append(result[i].Images, newImg)
		}
	}

	return result
}

func downloadImageDebug(url, supportingDir string, imageNum int) (string, error) {
	if err := os.MkdirAll(supportingDir, 0755); err != nil {
		return "", fmt.Errorf("create supporting dir: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("http status: %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	extVal := detectImageExt(data, resp.Header.Get("Content-Type"))
	filename := fmt.Sprintf("image%d%s", imageNum, extVal)
	localPath := filepath.Join(supportingDir, filename)

	if err := os.WriteFile(localPath, data, 0644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	return localPath, nil
}

const extPNG = ".png"

func detectImageExt(data []byte, contentType string) string {
	if len(data) >= 8 {
		if data[0] == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G' {
			return extPNG
		}
		if data[0] == 0xFF && data[1] == 0xD8 {
			return ".jpg"
		}
		if data[0] == 'G' && data[1] == 'I' && data[2] == 'F' {
			return ".gif"
		}
	}
	if strings.Contains(contentType, "png") {
		return extPNG
	}
	if strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg") {
		return ".jpg"
	}
	return extPNG
}

func remapImageRelationshipsDebug(paragraphs []ParagraphContent, startID int) ([]ParagraphContent, map[string]string) {
	idMap := make(map[string]string)
	result := make([]ParagraphContent, len(paragraphs))
	nextID := startID + 1

	for i, para := range paragraphs {
		result[i].Text = para.Text
		for _, img := range para.Images {
			if img.SourceRelID == "" {
				result[i].Images = append(result[i].Images, img)
				continue
			}

			newRelID := fmt.Sprintf("rId%d", nextID)
			idMap[img.SourceRelID] = newRelID
			nextID++

			newImg := img
			newImg.OutputRelID = newRelID

			newDrawingXML := img.DrawingXML
			if img.IsLinked {
				newDrawingXML = strings.Replace(newDrawingXML, fmt.Sprintf("r:link=\"%s\"", img.SourceRelID), fmt.Sprintf("r:embed=\"%s\"", newRelID), 1)
			} else {
				newDrawingXML = strings.Replace(newDrawingXML, fmt.Sprintf("r:embed=\"%s\"", img.SourceRelID), fmt.Sprintf("r:embed=\"%s\"", newRelID), 1)
			}
			newImg.DrawingXML = newDrawingXML

			result[i].Images = append(result[i].Images, newImg)
		}
	}

	return result, idMap
}

func buildDocumentXMLWithImagesDebug(templatePath string, paragraphs []ParagraphContent) ([]byte, error) {
	reader, err := zip.OpenReader(templatePath)
	if err != nil {
		return nil, fmt.Errorf("open template: %w", err)
	}
	defer reader.Close()

	var templateDocXML []byte
	for _, file := range reader.File {
		if file.Name == wordDocumentXML {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open document.xml: %w", err)
			}
			templateDocXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read document.xml: %w", err)
			}
			break
		}
	}

	if templateDocXML == nil {
		return nil, fmt.Errorf("document.xml not found in template")
	}

	content := string(templateDocXML)

	bodyStart := strings.Index(content, "<w:body>")
	if bodyStart == -1 {
		bodyStart = strings.Index(content, "<w:body ")
	}
	if bodyStart == -1 {
		return nil, fmt.Errorf("no <w:body> found in template")
	}

	bodyEnd := strings.Index(content, "</w:body>")
	if bodyEnd == -1 {
		return nil, fmt.Errorf("no </w:body> found in template")
	}

	bodyTagEnd := strings.Index(content[bodyStart:], ">")
	if bodyTagEnd == -1 {
		return nil, fmt.Errorf("malformed <w:body> tag")
	}
	bodyTagEnd += bodyStart + 1

	sectPrStart := strings.LastIndex(content[:bodyEnd], "<w:sectPr")
	var sectPr string
	if sectPrStart != -1 {
		sectPr = content[sectPrStart:bodyEnd]
	}

	var buf bytes.Buffer
	buf.WriteString(content[:bodyTagEnd])

	for _, para := range paragraphs {
		escaped := escapeXML(para.Text)
		buf.WriteString(`<w:p><w:r><w:t xml:space="preserve">`)
		buf.WriteString(escaped)
		buf.WriteString(`</w:t></w:r>`)
		for _, img := range para.Images {
			buf.WriteString(`<w:r>`)
			buf.WriteString(img.DrawingXML)
			buf.WriteString(`</w:r>`)
		}
		buf.WriteString(`</w:p>`)
	}

	if sectPr != "" {
		buf.WriteString(sectPr)
	}

	buf.WriteString(content[bodyEnd:])

	return buf.Bytes(), nil
}

func replaceDocumentXMLWithImagesDebug(templatePath, sourcePath, outputPath string, newDocXML []byte, paragraphs []ParagraphContent) error {
	templateReader, err := zip.OpenReader(templatePath)
	if err != nil {
		return fmt.Errorf("open template: %w", err)
	}
	defer templateReader.Close()

	sourceReader, err := zip.OpenReader(sourcePath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer sourceReader.Close()

	// Collect source media files
	sourceMedia := make(map[string]*zip.File)
	for _, file := range sourceReader.File {
		if strings.HasPrefix(file.Name, "word/media/") {
			sourceMedia[file.Name] = file
		}
	}

	// Determine which media files we need
	type mediaEntry struct {
		localPath string
		zipFile   *zip.File
	}
	neededMedia := make(map[string]mediaEntry)
	neededExtensions := make(map[string]bool)
	mediaCounter := 1

	for _, para := range paragraphs {
		for _, img := range para.Images {
			if img.LocalPath != "" {
				extVal := filepath.Ext(img.LocalPath)
				mediaName := fmt.Sprintf("word/media/image%d%s", mediaCounter, extVal)
				neededMedia[mediaName] = mediaEntry{localPath: img.LocalPath}
				neededExtensions[strings.ToLower(strings.TrimPrefix(extVal, "."))] = true
				mediaCounter++
			} else if img.MediaPath != "" {
				mediaPath := img.MediaPath
				if !strings.HasPrefix(mediaPath, "word/") {
					mediaPath = "word/" + mediaPath
				}
				if srcFile, ok := sourceMedia[mediaPath]; ok {
					neededMedia[mediaPath] = mediaEntry{zipFile: srcFile}
					extVal := filepath.Ext(mediaPath)
					neededExtensions[strings.ToLower(strings.TrimPrefix(extVal, "."))] = true
				}
			}
		}
	}

	fmt.Printf("  Media files needed: %d\n", len(neededMedia))
	for name, entry := range neededMedia {
		if entry.localPath != "" {
			fmt.Printf("    %s (from local: %s)\n", name, entry.localPath)
		} else {
			fmt.Printf("    %s (from source zip)\n", name)
		}
	}

	// Create output file
	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}

	zipWriter := zip.NewWriter(outputFile)

	// Copy files from template, replacing document.xml and rels
	for _, file := range templateReader.File {
		switch file.Name {
		case wordDocumentXML:
			header := &zip.FileHeader{
				Name:     file.Name,
				Method:   zip.Deflate,
				Modified: file.Modified,
			}
			w, err := zipWriter.CreateHeader(header)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create document.xml: %w", err)
			}
			if _, err := w.Write(newDocXML); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write document.xml: %w", err)
			}
			fmt.Println("  ✓ Wrote document.xml")

		case wordRelsPath:
			mergedRels, err := mergeRelationshipsDebug(file, paragraphs)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("merge relationships: %w", err)
			}

			// Write merged rels for inspection
			relsPath := outputPath + ".rels.xml"
			_ = os.WriteFile(relsPath, mergedRels, 0644)
			fmt.Printf("  ✓ Wrote rels to: %s\n", relsPath)

			header := &zip.FileHeader{
				Name:     file.Name,
				Method:   zip.Deflate,
				Modified: file.Modified,
			}
			w, err := zipWriter.CreateHeader(header)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create rels: %w", err)
			}
			if _, err := w.Write(mergedRels); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write rels: %w", err)
			}
			fmt.Println("  ✓ Wrote document.xml.rels")

		case "[Content_Types].xml":
			if err := copyZipFileWithContentTypeFix(zipWriter, file, neededExtensions); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
			fmt.Println("  ✓ Copied [Content_Types].xml")

		default:
			if strings.HasPrefix(file.Name, "word/media/") {
				continue // Skip template media
			}
			if err := copyZipFile(zipWriter, file); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy %s: %w", file.Name, err)
			}
		}
	}

	// Add needed media files
	for mediaPath, entry := range neededMedia {
		if entry.localPath != "" {
			data, err := os.ReadFile(entry.localPath)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("read local media %s: %w", entry.localPath, err)
			}
			w, err := zipWriter.Create(mediaPath)
			if err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("create media %s: %w", mediaPath, err)
			}
			if _, err := w.Write(data); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("write media %s: %w", mediaPath, err)
			}
			fmt.Printf("  ✓ Added media: %s\n", mediaPath)
		} else if entry.zipFile != nil {
			if err := copyZipFile(zipWriter, entry.zipFile); err != nil {
				zipWriter.Close()
				outputFile.Close()
				return fmt.Errorf("copy media %s: %w", mediaPath, err)
			}
			fmt.Printf("  ✓ Copied media: %s\n", mediaPath)
		}
	}

	if err := zipWriter.Close(); err != nil {
		outputFile.Close()
		return fmt.Errorf("close zip writer: %w", err)
	}
	if err := outputFile.Close(); err != nil {
		return fmt.Errorf("close output file: %w", err)
	}

	return nil
}

func mergeRelationshipsDebug(templateRelsFile *zip.File, paragraphs []ParagraphContent) ([]byte, error) {
	rc, err := templateRelsFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open template rels: %w", err)
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("read template rels: %w", err)
	}

	contentStr := string(content)

	// Find the closing tag
	closeTag := "</Relationships>"
	closeIdx := strings.LastIndex(contentStr, closeTag)
	if closeIdx == -1 {
		return nil, fmt.Errorf("no closing </Relationships> tag found")
	}

	var buf bytes.Buffer
	buf.WriteString(contentStr[:closeIdx])

	// Add new relationships for images
	mediaCounter := 1
	for _, para := range paragraphs {
		for _, img := range para.Images {
			if img.OutputRelID == "" {
				continue
			}

			// Handle linked (external) images - they need TargetMode="External"
			if img.IsLinked && img.MediaPath != "" {
				rel := fmt.Sprintf(`<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="%s" TargetMode="External"/>`,
					img.OutputRelID, img.MediaPath)
				buf.WriteString(rel)
				fmt.Printf("  Added rel: %s -> %s (External)\n", img.OutputRelID, img.MediaPath)
				continue
			}

			var target string
			if img.LocalPath != "" {
				extVal := filepath.Ext(img.LocalPath)
				target = fmt.Sprintf("media/image%d%s", mediaCounter, extVal)
				mediaCounter++
			} else if img.MediaPath != "" {
				target = strings.TrimPrefix(img.MediaPath, "word/")
			}

			rel := fmt.Sprintf(`<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="%s"/>`,
				img.OutputRelID, target)
			buf.WriteString(rel)
			fmt.Printf("  Added rel: %s -> %s\n", img.OutputRelID, target)
		}
	}

	buf.WriteString(closeTag)
	return buf.Bytes(), nil
}

func copyZipFile(zw *zip.Writer, file *zip.File) error {
	rc, err := file.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	header := file.FileHeader
	w, err := zw.CreateHeader(&header)
	if err != nil {
		return err
	}

	_, err = io.Copy(w, rc)
	return err
}

func copyZipFileWithContentTypeFix(zw *zip.Writer, file *zip.File, neededExtensions map[string]bool) error {
	rc, err := file.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	content, err := io.ReadAll(rc)
	if err != nil {
		return err
	}

	// Fix content type if it's a .dotm template
	contentStr := string(content)
	dotmType := "application/vnd.ms-word.template.macroEnabledTemplate.main+xml"
	docxType := "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
	contentStr = strings.Replace(contentStr, dotmType, docxType, 1)

	// Add content types for images if needed
	closeTag := "</Types>"
	if idx := strings.LastIndex(contentStr, closeTag); idx != -1 {
		var additions strings.Builder
		extensionContentTypes := map[string]string{
			"png":  "image/png",
			"jpeg": "image/jpeg",
			"jpg":  "image/jpeg",
			"gif":  "image/gif",
			"bmp":  "image/bmp",
			"tiff": "image/tiff",
			"emf":  "image/x-emf",
			"wmf":  "image/x-wmf",
		}
		for ext := range neededExtensions {
			ext = strings.TrimPrefix(ext, ".")
			ext = strings.ToLower(ext)
			if contentType, ok := extensionContentTypes[ext]; ok {
				if !strings.Contains(contentStr, fmt.Sprintf(`Extension="%s"`, ext)) {
					additions.WriteString(fmt.Sprintf(`<Default Extension="%s" ContentType="%s"/>`, ext, contentType))
				}
			}
		}
		if additions.Len() > 0 {
			contentStr = contentStr[:idx] + additions.String() + closeTag
		}
	}

	header := file.FileHeader
	w, err := zw.CreateHeader(&header)
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(contentStr))
	return err
}

func extractRelsFromDocx(docxPath string) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		fmt.Printf("  ⚠ Cannot open output for inspection: %v\n", err)
		return
	}
	defer reader.Close()

	for _, file := range reader.File {
		if file.Name == wordRelsPath {
			rc, err := file.Open()
			if err != nil {
				fmt.Printf("  ⚠ Cannot read rels from output: %v\n", err)
				return
			}
			content, _ := io.ReadAll(rc)
			rc.Close()
			_ = os.WriteFile(docxPath+".embedded-rels.xml", content, 0644)
			fmt.Printf("  ✓ Wrote embedded rels to: %s\n", docxPath+".embedded-rels.xml")
			return
		}
	}
}
