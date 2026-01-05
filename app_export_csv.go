package main

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

	// Header matches original exactly
	header := []string{"CourseName", "DocType", "Draft", "isBlog", "isPrinted", "isProsePoem", "isRevised", "Mark", "Path", "Quality", "Status", "Title", "Type", "nWords", "workID", "accessDate"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT course_name, doc_type, draft, is_blog, is_printed, is_prose_poem, is_revised, mark, path, quality, status, title, type, n_words, workID, access_date FROM Works`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var courseName, docType, draft, isBlog, isPrinted, isProsePoem, isRevised, mark, path, quality, status, title, workType, accessDate *string
		var nWords *int
		var workID int64

		if err := rows.Scan(&courseName, &docType, &draft, &isBlog, &isPrinted, &isProsePoem, &isRevised, &mark, &path, &quality, &status, &title, &workType, &nWords, &workID, &accessDate); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(courseName),
			strPtrToCSV(docType),
			strPtrToCSV(draft),
			strPtrToCSV(isBlog),
			strPtrToCSV(isPrinted),
			strPtrToCSV(isProsePoem),
			strPtrToCSV(isRevised),
			strPtrToCSV(mark),
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

	// Header matches original exactly (note typo "Doutrope" preserved)
	// Note: "Mark" column exists in original CSV but not in DB schema - export as empty
	// Note: "Date Modified" removed - not needed for round-trip
	header := []string{"Accepts", "Contest Fee", "Contest Prize", "Contest Prize 2", "Mark", "My Interest", "Name", "Other Name", "Other URL", "Source", "Status", "Submission Types", "Timing", "Type", "URL", "Website Menu", "Doutrope Num", "nPushFiction", "nPushNonFiction", "nPushPoetry", "orgID", "Ranking", "Contest Ends", "Date Added"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT accepts, contest_fee, contest_prize, contest_prize_2, my_interest, name, other_name, other_url, source, status, submission_types, timing, type, url, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, orgID, ranking, contest_ends, date_added FROM Organizations`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var accepts, contestFee, contestPrize, contestPrize2, myInterest, otherName, otherURL, source, status, submissionTypes, timing, orgType, url, websiteMenu, contestEnds, dateAdded *string
		var name string
		var duotropeNum, nPushFiction, nPushNonfiction, nPushPoetry, ranking *int
		var orgID int64

		if err := rows.Scan(&accepts, &contestFee, &contestPrize, &contestPrize2, &myInterest, &name, &otherName, &otherURL, &source, &status, &submissionTypes, &timing, &orgType, &url, &websiteMenu, &duotropeNum, &nPushFiction, &nPushNonfiction, &nPushPoetry, &orgID, &ranking, &contestEnds, &dateAdded); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(accepts),
			strPtrToCSV(contestFee),
			strPtrToCSV(contestPrize),
			strPtrToCSV(contestPrize2),
			"", // Mark column not in DB, export as empty
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

	// Header matches original exactly
	header := []string{"Contest Name", "Draft", "Mark", "Password", "Response Type", "Submission Type", "User ID", "Web Address", "Cost", "orgID", "submissionID", "workID", "Query Date", "Response Date", "Submission Date"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT contest_name, draft, mark, password, response_type, submission_type, user_id, web_address, cost, orgID, submissionID, workID, query_date, response_date, submission_date FROM Submissions`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var contestName, draft, mark, password, responseType, submissionType, userID, webAddress, queryDate, responseDate, submissionDate *string
		var cost *float64
		var orgID, submissionID, workID int64

		if err := rows.Scan(&contestName, &draft, &mark, &password, &responseType, &submissionType, &userID, &webAddress, &cost, &orgID, &submissionID, &workID, &queryDate, &responseDate, &submissionDate); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(contestName),
			strPtrToCSV(draft),
			strPtrToCSV(mark),
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

	// Header matches original exactly
	header := []string{"Collection Name", "isStatus", "Type", "Collection ID", "statusList", "nItems"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	// Note: statusList is derived from isStatus, nItems is computed from CollectionDetails count
	rows, err := a.db.Conn().Query(`
		SELECT c.collection_name, c.is_status, c.type, c.collID,
			CASE WHEN c.is_status = 'yes' THEN c.collection_name ELSE 'None' END as statusList,
			COALESCE((SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID), 0) as nItems
		FROM Collections c`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var collectionName string
		var isStatus, collType *string
		var collID int64
		var statusList string
		var nItems int

		if err := rows.Scan(&collectionName, &isStatus, &collType, &collID, &statusList, &nItems); err != nil {
			return 0, err
		}

		nItemsStr := ""
		if nItems > 0 {
			nItemsStr = strconv.Itoa(nItems)
		}

		record := []string{
			collectionName,
			strPtrToCSV(isStatus),
			strPtrToCSV(collType),
			strconv.FormatInt(collID, 10),
			statusList,
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

	// Header matches original exactly
	header := []string{"Collection Name", "WorkID", "collID"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT collection_name, workID, collID FROM CollectionDetails`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var collectionName *string
		var workID, collID int64

		if err := rows.Scan(&collectionName, &workID, &collID); err != nil {
			return 0, err
		}

		record := []string{
			strPtrToCSV(collectionName),
			strconv.FormatInt(workID, 10),
			strconv.FormatInt(collID, 10),
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

func (a *App) exportNotesCSV(importsPath string) (int, error) {
	file, err := os.Create(filepath.Join(importsPath, "Notes.csv"))
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := newQuotedCSVWriter(file)

	header := []string{"entity_type", "entity_id", "type", "note", "modified_date"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	rows, err := a.db.Conn().Query(`SELECT entity_type, entity_id, type, note, modified_date FROM Notes ORDER BY entity_type, entity_id`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records [][]string
	for rows.Next() {
		var entityType string
		var entityID int64
		var noteType, note, modifiedDate *string

		if err := rows.Scan(&entityType, &entityID, &noteType, &note, &modifiedDate); err != nil {
			return 0, err
		}

		record := []string{
			entityType,
			strconv.FormatInt(entityID, 10),
			strPtrToCSV(noteType),
			strPtrToCSV(note),
			strPtrToCSV(modifiedDate),
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
func strPtrToCSV(s *string) string {
	if s == nil {
		return ""
	}
	return *s
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
