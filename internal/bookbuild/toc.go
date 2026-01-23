package bookbuild

import (
	"fmt"
	"os"
	"strings"
)

type TOCEntry struct {
	Title        string
	PageNumber   int
	IsPart       bool
	IsBackMatter bool
}

func GenerateTOC(analysis *AnalysisResult, _ OverlayConfig) ([]TOCEntry, error) {
	var entries []TOCEntry

	bodyPageNum := 1
	backMatterPageNum := 1
	inBackMatter := false

	for _, item := range analysis.Items {
		switch item.Type {
		case ContentTypeFrontMatter, ContentTypeTOC:
			continue

		case ContentTypeBlank:
			if !inBackMatter {
				bodyPageNum++
			} else {
				backMatterPageNum++
			}

		case ContentTypePartDivider:
			entries = append(entries, TOCEntry{
				Title:      item.Title,
				PageNumber: bodyPageNum,
				IsPart:     true,
			})
			bodyPageNum += item.PageCount

		case ContentTypeWork:
			entries = append(entries, TOCEntry{
				Title:      item.Title,
				PageNumber: bodyPageNum,
				IsPart:     false,
			})
			bodyPageNum += item.PageCount

		case ContentTypeBackMatter:
			if !inBackMatter {
				inBackMatter = true
				backMatterPageNum = 1
			}
			entries = append(entries, TOCEntry{
				Title:        item.Title,
				PageNumber:   backMatterPageNum,
				IsBackMatter: true,
			})
			backMatterPageNum += item.PageCount
		}
	}

	return entries, nil
}

func CreateTOCPDF(entries []TOCEntry, outputPath string, config OverlayConfig) error {
	content := buildTOCContent(entries, config)
	return createTextPDF(outputPath, content, config)
}

func buildTOCContent(entries []TOCEntry, _ OverlayConfig) string {
	lines := make([]string, 0, len(entries)+10)

	lines = append(lines, "CONTENTS")
	lines = append(lines, "")

	currentPart := ""
	for _, entry := range entries {
		if entry.IsPart {
			if currentPart != "" {
				lines = append(lines, "")
			}
			currentPart = entry.Title
			lines = append(lines, entry.Title)
			lines = append(lines, "")
			continue
		}

		if entry.IsBackMatter {
			if currentPart != "" {
				lines = append(lines, "")
				currentPart = ""
			}
			lines = append(lines, formatTOCLine(entry.Title, entry.PageNumber, false))
			continue
		}

		indent := currentPart != ""
		lines = append(lines, formatTOCLine(entry.Title, entry.PageNumber, indent))
	}

	return strings.Join(lines, "\n")
}

func formatTOCLine(title string, pageNum int, indent bool) string {
	maxTitleLen := 50
	if indent {
		maxTitleLen = 46
	}

	displayTitle := title
	if len(displayTitle) > maxTitleLen {
		displayTitle = displayTitle[:maxTitleLen-3] + "..."
	}

	prefix := ""
	if indent {
		prefix = "    "
	}

	pageStr := fmt.Sprintf("%d", pageNum)
	lineWidth := 60
	usedWidth := len(prefix) + len(displayTitle) + 1 + len(pageStr)
	dotsNeeded := lineWidth - usedWidth
	if dotsNeeded < 3 {
		dotsNeeded = 3
	}
	dots := strings.Repeat(".", dotsNeeded)

	return fmt.Sprintf("%s%s %s %s", prefix, displayTitle, dots, pageStr)
}

func createTextPDF(outputPath, content string, config OverlayConfig) error {
	lines := strings.Split(content, "\n")
	lineHeight := 14.0
	fontSize := 11
	marginTop := 72.0
	marginLeftOdd := 54.0  // Odd pages (1,3): smaller left margin
	marginLeftEven := 90.0 // Even pages (2,4): larger left margin (gutter)
	marginBottom := 72.0

	linesPerPage := int((config.PageHeight - marginTop - marginBottom) / lineHeight)
	pageCount := (len(lines) + linesPerPage - 1) / linesPerPage
	if pageCount == 0 {
		pageCount = 1
	}

	var pdfContent strings.Builder
	pdfContent.WriteString("%PDF-1.4\n")

	objectNum := 1
	var objectOffsets []int

	// Object 1: Catalog
	objectOffsets = append(objectOffsets, pdfContent.Len())
	pdfContent.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n", objectNum))
	objectNum++

	// Object 2: Pages - kids start at object 4 (after Font at object 3)
	// Each page has 2 objects: Page + Content stream
	objectOffsets = append(objectOffsets, pdfContent.Len())
	var kids []string
	for i := 0; i < pageCount; i++ {
		kids = append(kids, fmt.Sprintf("%d 0 R", 4+i*2)) // Pages at 4, 6, 8, ...
	}
	pdfContent.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Pages /Kids [%s] /Count %d >>\nendobj\n",
		objectNum, strings.Join(kids, " "), pageCount))
	objectNum++

	// Object 3: Font - use Courier (monospace) for proper alignment
	fontObjNum := objectNum
	objectOffsets = append(objectOffsets, pdfContent.Len())
	pdfContent.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n", objectNum))
	objectNum++

	// Objects 4+: Pages and their content streams
	for page := 0; page < pageCount; page++ {
		startLine := page * linesPerPage
		endLine := startLine + linesPerPage
		if endLine > len(lines) {
			endLine = len(lines)
		}
		pageLines := lines[startLine:endLine]

		// Alternate margins: odd pages (0,2,4...) have smaller left margin
		marginLeft := marginLeftOdd
		if page%2 == 1 {
			marginLeft = marginLeftEven
		}

		var streamContent strings.Builder
		streamContent.WriteString("BT\n")
		streamContent.WriteString(fmt.Sprintf("/F1 %d Tf\n", fontSize))

		y := config.PageHeight - marginTop
		prevX := 0.0
		for i, line := range pageLines {
			escapedLine := escapeForPDF(line)
			var x float64
			if line == "CONTENTS" {
				x = (config.PageWidth - float64(len(line)*6)) / 2
			} else {
				x = marginLeft
			}
			if i == 0 {
				// First line: absolute position
				streamContent.WriteString(fmt.Sprintf("%.2f %.2f Td\n", x, y))
			} else {
				// Subsequent lines: move in both x and y to handle CONTENTS centering
				deltaX := x - prevX
				streamContent.WriteString(fmt.Sprintf("%.2f %.2f Td\n", deltaX, -lineHeight))
			}
			prevX = x
			streamContent.WriteString(fmt.Sprintf("(%s) Tj\n", escapedLine))
		}
		streamContent.WriteString("ET\n")

		streamBytes := streamContent.String()

		objectOffsets = append(objectOffsets, pdfContent.Len())
		pdfContent.WriteString(fmt.Sprintf("%d 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> >>\nendobj\n",
			objectNum, config.PageWidth, config.PageHeight, objectNum+1, fontObjNum))
		objectNum++

		objectOffsets = append(objectOffsets, pdfContent.Len())
		pdfContent.WriteString(fmt.Sprintf("%d 0 obj\n<< /Length %d >>\nstream\n%sendstream\nendobj\n",
			objectNum, len(streamBytes), streamBytes))
		objectNum++
	}

	xrefOffset := pdfContent.Len()
	pdfContent.WriteString(fmt.Sprintf("xref\n0 %d\n", objectNum))
	pdfContent.WriteString("0000000000 65535 f \n")
	for _, offset := range objectOffsets {
		pdfContent.WriteString(fmt.Sprintf("%010d 00000 n \n", offset))
	}

	pdfContent.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\n", objectNum))
	pdfContent.WriteString(fmt.Sprintf("startxref\n%d\n%%%%EOF\n", xrefOffset))

	return os.WriteFile(outputPath, []byte(pdfContent.String()), 0644)
}

func escapeForPDF(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "(", "\\(")
	s = strings.ReplaceAll(s, ")", "\\)")
	return s
}

func EstimateTOCPageCount(entries []TOCEntry) int {
	lineCount := 2
	hasParts := false

	for _, entry := range entries {
		if entry.IsPart {
			hasParts = true
			lineCount += 3
		} else {
			lineCount++
		}
	}

	if hasParts {
		lineCount += 2
	}

	linesPerPage := 45
	pages := (lineCount + linesPerPage - 1) / linesPerPage
	if pages == 0 {
		pages = 1
	}

	return pages
}
