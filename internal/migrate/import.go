package migrate

import (
	"encoding/csv"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"
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

const yesValue = "yes"

func buildAttributesFromRow(row map[string]string) string {
	if attrs := row["Attributes"]; attrs != "" {
		return attrs
	}
	var attrs []string
	if row["isBlog"] == yesValue {
		attrs = append(attrs, "blog")
	}
	if row["isPrinted"] == yesValue {
		attrs = append(attrs, "printed")
	}
	if row["isProsePoem"] == yesValue {
		attrs = append(attrs, "prose_poem")
	}
	if row["isRevised"] == yesValue {
		attrs = append(attrs, "revised")
	}
	return strings.Join(attrs, ",")
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

// decodeFromCSV restores newlines from magic text placeholders that were
// encoded during CSV export. This ensures round-trip integrity.
func decodeFromCSV(s string) string {
	s = strings.ReplaceAll(s, "[[CRLF]]", "\r\n")
	s = strings.ReplaceAll(s, "[[NEWLINE]]", "\n")
	s = strings.ReplaceAll(s, "[[RETURN]]", "\r")
	return s
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
				row[header] = decodeFromCSV(strings.TrimSpace(record[j]))
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
	if err := i.ImportNotes(); err != nil {
		return fmt.Errorf("import notes: %w", err)
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
		query := "INSERT OR IGNORE INTO Collections (collID, collection_name, type, attributes) VALUES (?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, collID, row["Collection Name"], strPtr(row["Type"]), row["Attributes"])
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
		attributes := buildAttributesFromRow(row)
		query := "INSERT INTO Works (workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, attributes, access_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, workID, row["Title"], row["Type"], year, row["Status"], row["Quality"], row["DocType"], strPtr(path), strPtr(row["Draft"]), parseIntPtr(row["nWords"]), strPtr(row["CourseName"]), attributes, strPtr(row["accessDate"]))
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
		query := "INSERT INTO Organizations (orgID, name, other_name, url, other_url, status, type, timing, submission_types, accepts, my_interest, ranking, source, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, contest_ends, contest_fee, contest_prize, contest_prize_2, attributes, date_added, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, orgID, row["Name"], strPtr(row["Other Name"]), strPtr(row["URL"]), strPtr(row["Other URL"]), row["Status"], row["Type"], strPtr(row["Timing"]), strPtr(row["Submission Types"]), strPtr(row["Accepts"]), strPtr(row["My Interest"]), parseIntPtr(row["Ranking"]), strPtr(row["Source"]), strPtr(row["Website Menu"]), parseIntPtr(row["Doutrope Num"]), int(parseInt(row["nPushFiction"])), int(parseInt(row["nPushNonFiction"])), int(parseInt(row["nPushPoetry"])), strPtr(row["Contest Ends"]), strPtr(row["Contest Fee"]), strPtr(row["Contest Prize"]), strPtr(row["Contest Prize 2"]), row["Attributes"], strPtr(row["Date Added"]), strPtr(row["Date Modified"]))
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
		query := "INSERT INTO Submissions (submissionID, workID, orgID, draft, submission_date, submission_type, query_date, response_date, response_type, contest_name, cost, user_id, password, web_address, attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
		_, err := i.db.Conn().Exec(query, subID, parseInt(row["workID"]), parseInt(row["orgID"]), row["Draft"], strPtr(row["Submission Date"]), strPtr(row["Submission Type"]), strPtr(row["Query Date"]), strPtr(row["Response Date"]), strPtr(row["Response Type"]), strPtr(row["Contest Name"]), cost, strPtr(row["User ID"]), strPtr(row["Password"]), strPtr(row["Web Address"]), row["Attributes"])
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
		query := "INSERT INTO CollectionDetails (collID, workID, position) VALUES (?, ?, ?)"
		_, _ = i.db.Conn().Exec(query, parseInt(row["collID"]), parseInt(row["workID"]), parseInt(row["position"]))
	}
	return nil
}

func (i *Importer) ImportNotes() error {
	rows, err := i.readCSV("Notes.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		n := &models.Note{
			EntityType: row["entity_type"],
			EntityID:   parseInt(row["entity_id"]),
			Type:       strPtr(row["type"]),
			Note:       strPtr(row["note"]),
			ModifiedAt: strPtr(row["modified_at"]),
		}
		_, _ = i.db.CreateNote(n)
	}
	return nil
}
