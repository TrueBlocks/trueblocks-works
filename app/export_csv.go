package app

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

func (a *App) ExportAllCSV() []ExportResult {
	importsPath := filepath.Join("imports")
	var results []ExportResult

	results = append(results, a.exportCSVTable("Works.csv", importsPath, a.exportWorksCSV))
	results = append(results, a.exportCSVTable("Organizations.csv", importsPath, a.exportOrganizationsCSV))
	results = append(results, a.exportCSVTable("Submissions.csv", importsPath, a.exportSubmissionsCSV))
	results = append(results, a.exportCSVTable("Collections.csv", importsPath, a.exportCollectionsCSV))
	results = append(results, a.exportCSVTable("CollectionDetails.csv", importsPath, a.exportCollectionDetailsCSV))
	results = append(results, a.exportCSVTable("Notes.csv", importsPath, a.exportNotesCSV))

	return results
}

type csvExportFunc func(string) (int, error)

func (a *App) exportCSVTable(name, importsPath string, fn csvExportFunc) ExportResult {
	count, err := fn(importsPath)
	if err != nil {
		return ExportResult{Table: name, Count: 0, Success: false, Error: err.Error()}
	}
	return ExportResult{Table: name, Count: count, Success: true}
}

func (a *App) exportWorksCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Works.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	// Header matches original format with attributes field
	header := []string{"CourseName", "DocType", "Draft", "Attributes", "Path", "Quality", "Status", "Title", "Type", "nWords", "workID", "accessDate"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT course_name, doc_type, draft, attributes, path, quality, status, title, type, n_words, workID, access_date FROM Works`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var courseName, docType, draft, attributes, path, quality, status, title, workType, accessDate *string
		var nWords *int
		var workID int64

		if err := rows.Scan(&courseName, &docType, &draft, &attributes, &path, &quality, &status, &title, &workType, &nWords, &workID, &accessDate); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(courseName),
			strPtrToCSV(docType),
			strPtrToCSV(draft),
			strPtrToCSV(attributes),
			strPtrToCSV(path),
			strPtrToCSV(quality),
			strPtrToCSV(status),
			strPtrToCSV(title),
			strPtrToCSV(workType),
			intPtrToCSV(nWords),
			strconv.FormatInt(workID, 10),
			strPtrToCSV(accessDate),
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Sort by stringified line
	sort.Slice(records, func(i, j int) bool {
		return strings.Join(records[i], ",") < strings.Join(records[j], ",")
	})

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

func (a *App) exportOrganizationsCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Organizations.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	// Header matches original exactly (note typo "Doutrope" preserved) plus new attributes field
	header := []string{"Accepts", "Contest Fee", "Contest Prize", "Contest Prize 2", "Attributes", "My Interest", "Name", "Other Name", "Other URL", "Source", "Status", "Submission Types", "Timing", "Type", "URL", "Website Menu", "Doutrope Num", "nPushFiction", "nPushNonFiction", "nPushPoetry", "orgID", "Ranking", "Contest Ends", "Date Added"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT accepts, contest_fee, contest_prize, contest_prize_2, attributes, my_interest, name, other_name, other_url, source, status, submission_types, timing, type, url, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, orgID, ranking, contest_ends, date_added FROM Organizations`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var accepts, contestFee, contestPrize, contestPrize2, attributes, myInterest, otherName, otherURL, source, status, submissionTypes, timing, orgType, url, websiteMenu, contestEnds, dateAdded *string
		var name string
		var duotropeNum, nPushFiction, nPushNonfiction, nPushPoetry, ranking *int
		var orgID int64

		if err := rows.Scan(&accepts, &contestFee, &contestPrize, &contestPrize2, &attributes, &myInterest, &name, &otherName, &otherURL, &source, &status, &submissionTypes, &timing, &orgType, &url, &websiteMenu, &duotropeNum, &nPushFiction, &nPushNonfiction, &nPushPoetry, &orgID, &ranking, &contestEnds, &dateAdded); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(accepts),
			strPtrToCSV(contestFee),
			strPtrToCSV(contestPrize),
			strPtrToCSV(contestPrize2),
			strPtrToCSV(attributes),
			strPtrToCSV(myInterest),
			name,
			strPtrToCSV(otherName),
			strPtrToCSV(otherURL),
			strPtrToCSV(source),
			strPtrToCSV(status),
			strPtrToCSV(submissionTypes),
			strPtrToCSV(timing),
			strPtrToCSV(orgType),
			strPtrToCSV(url),
			strPtrToCSV(websiteMenu),
			intPtrToCSV(duotropeNum),
			intPtrToCSV(nPushFiction),
			intPtrToCSV(nPushNonfiction),
			intPtrToCSV(nPushPoetry),
			strconv.FormatInt(orgID, 10),
			intPtrToCSV(ranking),
			strPtrToCSV(contestEnds),
			strPtrToCSV(dateAdded),
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sort.Slice(records, func(i, j int) bool {
		return strings.Join(records[i], ",") < strings.Join(records[j], ",")
	})

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

func (a *App) exportSubmissionsCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Submissions.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	// Header matches original exactly plus new attributes field
	header := []string{"Contest Name", "Draft", "Attributes", "Password", "Response Type", "Submission Type", "User ID", "Web Address", "Cost", "orgID", "submissionID", "workID", "Query Date", "Response Date", "Submission Date"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT contest_name, draft, attributes, password, response_type, submission_type, user_id, web_address, cost, orgID, submissionID, workID, query_date, response_date, submission_date FROM Submissions`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var contestName, draft, attributes, password, responseType, submissionType, userID, webAddress, queryDate, responseDate, submissionDate *string
		var cost *float64
		var orgID, submissionID, workID int64

		if err := rows.Scan(&contestName, &draft, &attributes, &password, &responseType, &submissionType, &userID, &webAddress, &cost, &orgID, &submissionID, &workID, &queryDate, &responseDate, &submissionDate); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(contestName),
			strPtrToCSV(draft),
			strPtrToCSV(attributes),
			strPtrToCSV(password),
			strPtrToCSV(responseType),
			strPtrToCSV(submissionType),
			strPtrToCSV(userID),
			strPtrToCSV(webAddress),
			floatPtrToCSV(cost),
			strconv.FormatInt(orgID, 10),
			strconv.FormatInt(submissionID, 10),
			strconv.FormatInt(workID, 10),
			strPtrToCSV(queryDate),
			strPtrToCSV(responseDate),
			strPtrToCSV(submissionDate),
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sort.Slice(records, func(i, j int) bool {
		return strings.Join(records[i], ",") < strings.Join(records[j], ",")
	})

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

func (a *App) exportCollectionsCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Collections.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	header := []string{"Collection Name", "Type", "Attributes", "Collection ID", "nItems"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`
		SELECT c.collection_name, c.type, c.attributes, c.collID,
			COALESCE((SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID), 0) as nItems
		FROM Collections c`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var collectionName string
		var collType, attributes *string
		var collID int64
		var nItems int

		if err := rows.Scan(&collectionName, &collType, &attributes, &collID, &nItems); err != nil {
			return 0, err
		}

		nItemsStr := ""
		if nItems > 0 {
			nItemsStr = strconv.Itoa(nItems)
		}

		record := []string{
			collectionName,
			strPtrToCSV(collType),
			strPtrToCSV(attributes),
			strconv.FormatInt(collID, 10),
			nItemsStr,
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sort.Slice(records, func(i, j int) bool {
		return strings.Join(records[i], ",") < strings.Join(records[j], ",")
	})

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

func (a *App) exportCollectionDetailsCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "CollectionDetails.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	header := []string{"collID", "workID", "position"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT collID, workID, position FROM CollectionDetails ORDER BY collID, position`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var collID, workID, position int64

		if err := rows.Scan(&collID, &workID, &position); err != nil {
			return 0, err
		}

		record := []string{
			strconv.FormatInt(collID, 10),
			strconv.FormatInt(workID, 10),
			strconv.FormatInt(position, 10),
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

func (a *App) exportNotesCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Notes.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	header := []string{"entity_type", "entity_id", "type", "note", "attributes", "modified_at"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT entity_type, entity_id, type, note, attributes, modified_at FROM Notes ORDER BY entity_type, entity_id`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var entityType string
		var entityID int64
		var noteType, note, attributes, modifiedAt *string

		if err := rows.Scan(&entityType, &entityID, &noteType, &note, &attributes, &modifiedAt); err != nil {
			return 0, err
		}

		record := []string{
			entityType,
			strconv.FormatInt(entityID, 10),
			strPtrToCSV(noteType),
			strPtrToCSV(note),
			strPtrToCSV(attributes),
			strPtrToCSV(modifiedAt),
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sort.Slice(records, func(i, j int) bool {
		return strings.Join(records[i], ",") < strings.Join(records[j], ",")
	})

	for _, record := range records {
		if err := writer.Write(record); err != nil {
			return 0, err
		}
	}
	return len(records), nil
}

// quotedCSVWriter writes CSV with all fields quoted
type quotedCSVWriter struct {
	w io.Writer
}

func newQuotedCSVWriter(w io.Writer) *quotedCSVWriter {
	return &quotedCSVWriter{w: w}
}

func (q *quotedCSVWriter) Write(record []string) error {
	quoted := make([]string, len(record))
	for i, field := range record {
		// Escape any quotes in the field by doubling them
		escaped := strings.ReplaceAll(field, `"`, `""`)
		quoted[i] = `"` + escaped + `"`
	}
	_, err := fmt.Fprintln(q.w, strings.Join(quoted, ","))
	return err
}

// Helper functions for CSV conversion

// encodeForCSV replaces newlines with magic text placeholders to ensure
// CSV rows stay on single lines. Use decodeFromCSV on import to restore.
func encodeForCSV(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "[[CRLF]]")
	s = strings.ReplaceAll(s, "\n", "[[NEWLINE]]")
	s = strings.ReplaceAll(s, "\r", "[[RETURN]]")
	return s
}

func strPtrToCSV(s *string) string {
	if s == nil {
		return ""
	}
	return encodeForCSV(*s)
}

func intPtrToCSV(i *int) string {
	if i == nil {
		return ""
	}
	return strconv.Itoa(*i)
}

func floatPtrToCSV(f *float64) string {
	if f == nil {
		return ""
	}
	return strconv.FormatFloat(*f, 'f', -1, 64)
}
