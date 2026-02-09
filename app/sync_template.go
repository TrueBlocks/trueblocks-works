package app

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
)

func (a *App) SyncWorkTemplate(workID int64) error {
	work, err := a.db.GetWork(workID)
	if err != nil {
		return fmt.Errorf("get work: %w", err)
	}
	if work == nil {
		return fmt.Errorf("work not found: %d", workID)
	}

	docxPath, err := a.fileOps.FindWorkFile(work)
	if err != nil {
		return fmt.Errorf("find work file: %w", err)
	}
	if docxPath == "" {
		return fmt.Errorf("no document file found for work")
	}
	if !strings.HasSuffix(strings.ToLower(docxPath), ".docx") {
		return fmt.Errorf("document is not a .docx file")
	}

	templatePath, err := a.GetWorkTemplatePath(workID)
	if err != nil {
		return fmt.Errorf("get template path: %w", err)
	}
	if templatePath == "" {
		return fmt.Errorf("no template found for this work's book")
	}

	if err := backupDocx(docxPath); err != nil {
		return fmt.Errorf("backup failed: %w", err)
	}

	if err := fileops.SyncTemplateToDocument(templatePath, docxPath); err != nil {
		return fmt.Errorf("sync template failed: %w", err)
	}

	if err := syncThemeFromTemplate(templatePath, docxPath); err != nil {
		return fmt.Errorf("sync theme failed: %w", err)
	}

	if err := cleanUnknownStyles(templatePath, docxPath); err != nil {
		return fmt.Errorf("clean unknown styles failed: %w", err)
	}

	if err := convertDirectFormatting(docxPath); err != nil {
		return fmt.Errorf("convert direct formatting failed: %w", err)
	}

	return nil
}

// BatchSyncWorkTemplateResult holds the outcome of a batch template sync
type BatchSyncWorkTemplateResult struct {
	Succeeded int      `json:"succeeded"`
	Failed    int      `json:"failed"`
	Errors    []string `json:"errors"`
}

// BatchSyncWorkTemplate applies the template to multiple works
func (a *App) BatchSyncWorkTemplate(workIDs []int64) BatchSyncWorkTemplateResult {
	result := BatchSyncWorkTemplateResult{
		Errors: []string{},
	}

	for _, workID := range workIDs {
		if err := a.SyncWorkTemplate(workID); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Work %d: %v", workID, err))
		} else {
			result.Succeeded++
		}
	}

	return result
}

func backupDocx(docxPath string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("get home dir: %w", err)
	}

	backupDir := filepath.Join(homeDir, ".works", "backups", "works")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("create backup dir: %w", err)
	}

	filename := filepath.Base(docxPath)
	backupPath := filepath.Join(backupDir, filename)

	src, err := os.Open(docxPath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return fmt.Errorf("create backup: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("copy file: %w", err)
	}

	return nil
}

const wordThemeXML = "word/theme/theme1.xml"

func syncThemeFromTemplate(templatePath, docxPath string) error {
	themeData, err := extractFileFromZip(templatePath, wordThemeXML)
	if err != nil {
		return fmt.Errorf("extract theme from template: %w", err)
	}

	if err := replaceFileInZip(docxPath, wordThemeXML, themeData); err != nil {
		return fmt.Errorf("replace theme in document: %w", err)
	}

	return nil
}

func extractFileFromZip(zipPath, fileName string) ([]byte, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == fileName {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}

	return nil, fmt.Errorf("%s not found in zip", fileName)
}

func replaceFileInZip(zipPath, fileName string, newContent []byte) error {
	zipData, err := os.ReadFile(zipPath)
	if err != nil {
		return err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return err
	}

	outFile, err := os.CreateTemp(filepath.Dir(zipPath), "docx-theme-*.docx")
	if err != nil {
		return err
	}
	tempPath := outFile.Name()

	zipWriter := zip.NewWriter(outFile)

	for _, f := range zipReader.File {
		fh := f.FileHeader
		w, err := zipWriter.CreateHeader(&fh)
		if err != nil {
			outFile.Close()
			os.Remove(tempPath)
			return err
		}

		if f.Name == fileName {
			if _, werr := w.Write(newContent); werr != nil {
				outFile.Close()
				os.Remove(tempPath)
				return werr
			}
		} else {
			rc, rerr := f.Open()
			if rerr != nil {
				outFile.Close()
				os.Remove(tempPath)
				return rerr
			}
			if _, cerr := io.Copy(w, rc); cerr != nil {
				rc.Close()
				outFile.Close()
				os.Remove(tempPath)
				return cerr
			}
			rc.Close()
		}
	}

	if err := zipWriter.Close(); err != nil {
		outFile.Close()
		os.Remove(tempPath)
		return err
	}
	outFile.Close()

	if err := os.Rename(tempPath, zipPath); err != nil {
		os.Remove(tempPath)
		return err
	}

	return nil
}

func cleanUnknownStyles(templatePath, docxPath string) error {
	templateStyles := make(map[string]bool)
	styles, err := extractDOCXStyles(templatePath)
	if err == nil {
		for _, s := range styles {
			templateStyles[s.Name] = true
			templateStyles[s.StyleID] = true
		}
	}

	usedStyles, err := extractUsedStyles(docxPath)
	if err != nil {
		return fmt.Errorf("extract used styles: %w", err)
	}

	_, err = removeUnusedStyles(docxPath, templateStyles, usedStyles)
	if err != nil {
		return fmt.Errorf("remove unused styles: %w", err)
	}

	return nil
}

const wordDocumentXMLPath = "word/document.xml"

func convertDirectFormatting(docxPath string) error {
	docContent, err := extractFileFromZip(docxPath, wordDocumentXMLPath)
	if err != nil {
		return fmt.Errorf("extract document.xml: %w", err)
	}

	content := string(docContent)
	modified := convertBoldAndItalicToStyles(content)
	modified = stripEastAsiaFontAttributes(modified)

	if modified == content {
		return nil
	}

	if err := replaceFileInZip(docxPath, wordDocumentXMLPath, []byte(modified)); err != nil {
		return fmt.Errorf("replace document.xml: %w", err)
	}

	return nil
}

func stripEastAsiaFontAttributes(content string) string {
	// Remove w:eastAsia="..." attributes from rFonts elements
	// Matches: w:eastAsia="Times New Roman" (with optional leading space)
	re := regexp.MustCompile(`\s*w:eastAsia="[^"]*"`)
	return re.ReplaceAllString(content, "")
}

func convertBoldAndItalicToStyles(content string) string {
	rPrRegex := regexp.MustCompile(`<w:rPr>([\s\S]*?)</w:rPr>`)

	return rPrRegex.ReplaceAllStringFunc(content, func(match string) string {
		if strings.Contains(match, "<w:rStyle") {
			return match
		}

		hasBold := strings.Contains(match, "<w:b/>") || strings.Contains(match, "<w:b ") || strings.Contains(match, "<w:bCs")
		hasItalic := strings.Contains(match, "<w:i/>") || strings.Contains(match, "<w:i ") || strings.Contains(match, "<w:iCs")

		if hasBold && hasItalic {
			return match
		}

		if !hasBold && !hasItalic {
			return match
		}

		result := match

		if hasBold && !hasItalic {
			result = removeBoldTags(result)
			result = insertRStyle(result, "Strong")
		} else if hasItalic && !hasBold {
			result = removeItalicTags(result)
			result = insertRStyle(result, "Emphasis")
		}

		return result
	})
}

func removeBoldTags(rPr string) string {
	patterns := []string{
		`<w:b/>`,
		`<w:b [^>]*/>`,
		`<w:bCs/>`,
		`<w:bCs [^>]*/>`,
	}
	for _, p := range patterns {
		re := regexp.MustCompile(p)
		rPr = re.ReplaceAllString(rPr, "")
	}
	return rPr
}

func removeItalicTags(rPr string) string {
	patterns := []string{
		`<w:i/>`,
		`<w:i [^>]*/>`,
		`<w:iCs/>`,
		`<w:iCs [^>]*/>`,
	}
	for _, p := range patterns {
		re := regexp.MustCompile(p)
		rPr = re.ReplaceAllString(rPr, "")
	}
	return rPr
}

func insertRStyle(rPr, styleName string) string {
	rStyleTag := fmt.Sprintf(`<w:rStyle w:val="%s"/>`, styleName)
	return strings.Replace(rPr, "<w:rPr>", "<w:rPr>"+rStyleTag, 1)
}
