package migrate

import (
	"encoding/csv"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"works/internal/db"
	"works/internal/models"
)

type Importer struct {
	db         *db.DB
	importsDir string
}

func NewImporter(database *db.DB, importsDir string) *Importer {
	return &Importer{db: database, importsDir: importsDir}
}

func parseInt(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

func parseIntPtr(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	s = strings.ReplaceAll(s, ",", "")
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

func strPtr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

var yearRegex = regexp.MustCompile(`\b(19|20)\d{2}\b`)

func extractYearFromPath(path string) *string {
	if match := yearRegex.FindString(path); match != "" {
		return &match
	}
	return nil
}

func (i *Importer) readCSV(filename string) ([]map[string]string, error) {
	path := i.importsDir + "/" + filename
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", filename, err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", filename, err)
	}

	if len(records) < 2 {
		return nil, nil
	}

	headers := records[0]
	rows := make([]map[string]string, 0, len(records)-1)
	for _, record := range records[1:] {
		row := make(map[string]string)
		for j, header := range headers {
			if j < len(record) {
				row[header] = strings.TrimSpace(record[j])
			}
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func (i *Importer) ImportAll() error {
	if err := i.ImportCollections(); err != nil {
		return fmt.Errorf("import collections: %w", err)
	}
	if err := i.ImportWorks(); err != nil {
		return fmt.Errorf("import works: %w", err)
	}
	if err := i.ImportOrganizations(); err != nil {
		return fmt.Errorf("import organizations: %w", err)
	}
	if err := i.ImportSubmissions(); err != nil {
		return fmt.Errorf("import submissions: %w", err)
	}
	if err := i.ImportCollectionDetails(); err != nil {
		return fmt.Errorf("import collection details: %w", err)
	}
	if err := i.ImportWorkNotes(); err != nil {
		return fmt.Errorf("import work notes: %w", err)
	}
	if err := i.ImportJournalNotes(); err != nil {
		return fmt.Errorf("import journal notes: %w", err)
	}
	return nil
}

func (i *Importer) ImportCollections() error {
	rows, err := i.readCSV("Collections.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		collID := parseInt(row["Collection ID"])
		query := "INSERT OR IGNORE INTO Collections (collID, collection_name, is_status, type) VALUES (?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, collID, row["Collection Name"], strPtr(row["isStatus"]), strPtr(row["Type"]))
		if err != nil {
			return fmt.Errorf("insert collection %d: %w", collID, err)
		}
	}
	return nil
}

func (i *Importer) ImportWorks() error {
	rows, err := i.readCSV("Works.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		workID := parseInt(row["workID"])
		path := row["Path"]
		year := extractYearFromPath(path)
		query := "INSERT INTO Works (workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, is_blog, is_printed, is_prose_poem, is_revised, mark, access_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, workID, row["Title"], row["Type"], year, row["Status"], row["Quality"], row["DocType"], strPtr(path), strPtr(row["Draft"]), parseIntPtr(row["nWords"]), strPtr(row["CourseName"]), strPtr(row["isBlog"]), strPtr(row["isPrinted"]), strPtr(row["isProsePoem"]), strPtr(row["isRevised"]), strPtr(row["Mark"]), strPtr(row["accessDate"]))
		if err != nil {
			return fmt.Errorf("insert work %d: %w", workID, err)
		}
	}
	return nil
}

func (i *Importer) ImportOrganizations() error {
	rows, err := i.readCSV("Organizations.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		orgID := parseInt(row["orgID"])
		query := "INSERT INTO Organizations (orgID, name, other_name, url, other_url, status, type, timing, submission_types, accepts, my_interest, ranking, source, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, contest_ends, contest_fee, contest_prize, contest_prize_2, date_added, date_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, orgID, row["Name"], strPtr(row["Other Name"]), strPtr(row["URL"]), strPtr(row["Other URL"]), row["Status"], row["Type"], strPtr(row["Timing"]), strPtr(row["Submission Types"]), strPtr(row["Accepts"]), strPtr(row["My Interest"]), parseIntPtr(row["Ranking"]), strPtr(row["Source"]), strPtr(row["Website Menu"]), parseIntPtr(row["Doutrope Num"]), int(parseInt(row["nPushFiction"])), int(parseInt(row["nPushNonFiction"])), int(parseInt(row["nPushPoetry"])), strPtr(row["Contest Ends"]), strPtr(row["Contest Fee"]), strPtr(row["Contest Prize"]), strPtr(row["Contest Prize 2"]), strPtr(row["Date Added"]), strPtr(row["Date Modified"]))
		if err != nil {
			return fmt.Errorf("insert org %d: %w", orgID, err)
		}
	}
	return nil
}

func (i *Importer) ImportSubmissions() error {
	rows, err := i.readCSV("Submissions.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		subID := parseInt(row["submissionID"])
		var cost *float64
		if c := row["Cost"]; c != "" {
			if v, err := strconv.ParseFloat(c, 64); err == nil {
				cost = &v
			}
		}
		query := "INSERT INTO Submissions (submissionID, workID, orgID, draft, submission_date, submission_type, query_date, response_date, response_type, contest_name, cost, user_id, password, web_address, mark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, subID, parseInt(row["workID"]), parseInt(row["orgID"]), row["Draft"], strPtr(row["Submission Date"]), strPtr(row["Submission Type"]), strPtr(row["Query Date"]), strPtr(row["Response Date"]), strPtr(row["Response Type"]), strPtr(row["Contest Name"]), cost, strPtr(row["User ID"]), strPtr(row["Password"]), strPtr(row["Web Address"]), strPtr(row["Mark"]))
		if err != nil {
			return fmt.Errorf("insert submission %d: %w", subID, err)
		}
	}
	return nil
}

func (i *Importer) ImportCollectionDetails() error {
	rows, err := i.readCSV("CollectionDetails.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		query := "INSERT INTO CollectionDetails (collID, workID, collection_name) VALUES (?, ?, ?)"
		_, _ = i.db.Conn().Exec(query, parseInt(row["collID"]), parseInt(row["WorkID"]), row["Collection Name"])
	}
	return nil
}

func (i *Importer) ImportWorkNotes() error {
	rows, err := i.readCSV("WorkNotes.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		n := &models.WorkNote{
			WorkID:       parseInt(row["workID"]),
			Type:         strPtr(row["Type"]),
			Note:         strPtr(row["Note"]),
			ModifiedDate: strPtr(row["Modifed Date"]),
		}
		_ = i.db.CreateWorkNote(n)
	}
	return nil
}

func (i *Importer) ImportJournalNotes() error {
	rows, err := i.readCSV("JournalNotes.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		n := &models.JournalNote{
			OrgID:        parseInt(row["orgID"]),
			Type:         strPtr(row["Type"]),
			Note:         strPtr(row["Note"]),
			ModifiedDate: strPtr(row["Modifed Date"]),
		}
		_ = i.db.CreateJournalNote(n)
	}
	return nil
}
