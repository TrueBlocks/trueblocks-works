package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ExportResult struct {
	Table   string `json:"table"`
	Count   int    `json:"count"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type TableInfo struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func (a *App) GetExportTables() ([]TableInfo, error) {
	tables := []struct {
		name  string
		query string
	}{
		{"Works", "SELECT COUNT(*) FROM Works"},
		{"Organizations", "SELECT COUNT(*) FROM Organizations"},
		{"Submissions", "SELECT COUNT(*) FROM Submissions"},
		{"Collections", "SELECT COUNT(*) FROM Collections"},
		{"CollectionDetails", "SELECT COUNT(*) FROM CollectionDetails"},
		{"Notes", "SELECT COUNT(*) FROM Notes"},
	}

	result := make([]TableInfo, 0, len(tables))
	for _, t := range tables {
		var count int
		err := a.db.Conn().QueryRow(t.query).Scan(&count)
		if err != nil {
			count = 0
		}
		result = append(result, TableInfo{Name: t.name, Count: count})
	}
	return result, nil
}

func (a *App) SelectExportFolder() (string, error) {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Export Folder",
	})
	if err != nil {
		return "", err
	}
	if folder == "" {
		return "", nil
	}

	settings := a.settings.Get()
	settings.ExportFolderPath = folder
	if err := a.settings.Update(settings); err != nil {
		return "", err
	}

	return folder, nil
}

func (a *App) GetExportFolderPath() string {
	return a.settings.Get().ExportFolderPath
}

func (a *App) ExportAllTables() ([]ExportResult, error) {
	exportPath := a.settings.Get().ExportFolderPath
	if exportPath == "" {
		return nil, fmt.Errorf("export folder not configured")
	}

	if err := os.MkdirAll(exportPath, 0755); err != nil {
		return nil, fmt.Errorf("create export folder: %w", err)
	}

	var results []ExportResult

	// Export JSON files to configured export folder
	results = append(results, a.exportTable("Works", exportPath, a.exportWorks))
	results = append(results, a.exportTable("Organizations", exportPath, a.exportOrganizations))
	results = append(results, a.exportTable("Submissions", exportPath, a.exportSubmissions))
	results = append(results, a.exportTable("Collections", exportPath, a.exportCollections))
	results = append(results, a.exportTable("CollectionDetails", exportPath, a.exportCollectionDetails))
	results = append(results, a.exportTable("Notes", exportPath, a.exportNotes))

	// Also export CSV files to imports folder (for round-trip)
	csvResults := a.ExportAllCSV()
	results = append(results, csvResults...)

	return results, nil
}

type exportFunc func() (interface{}, int, error)

func (a *App) exportTable(name, exportPath string, fn exportFunc) ExportResult {
	data, count, err := fn()
	if err != nil {
		return ExportResult{Table: name, Count: 0, Success: false, Error: err.Error()}
	}

	export := map[string]interface{}{
		"table":   name,
		"count":   count,
		"records": data,
	}

	jsonData, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return ExportResult{Table: name, Count: count, Success: false, Error: err.Error()}
	}

	filePath := filepath.Join(exportPath, name+".json")
	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return ExportResult{Table: name, Count: count, Success: false, Error: err.Error()}
	}

	return ExportResult{Table: name, Count: count, Success: true}
}

func (a *App) exportWorks() (interface{}, int, error) {
	rows, err := a.db.Conn().Query(`SELECT workID, title, type, year, status, quality, doc_type, path, draft, n_words, course_name, attributes, access_date, created_at, modified_at FROM Works ORDER BY workID`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var workID int64
		var title, workType, year, status, quality, docType, path, draft, courseName, attributes, accessDate, createdAt, modifiedAt *string
		var nWords *int

		err := rows.Scan(&workID, &title, &workType, &year, &status, &quality, &docType, &path, &draft, &nWords, &courseName, &attributes, &accessDate, &createdAt, &modifiedAt)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, map[string]interface{}{
			"workID": workID, "title": title, "type": workType, "year": year, "status": status,
			"quality": quality, "docType": docType, "path": path, "draft": draft, "nWords": nWords,
			"courseName": courseName, "attributes": attributes, "accessDate": accessDate,
		})
	}
	return records, len(records), nil
}

func (a *App) exportOrganizations() (interface{}, int, error) {
	rows, err := a.db.Conn().Query(`SELECT orgID, name, other_name, url, other_url, status, type, timing, submission_types, accepts, my_interest, ranking, source, website_menu, duotrope_num, n_push_fiction, n_push_nonfiction, n_push_poetry, contest_ends, contest_fee, contest_prize, contest_prize_2, attributes, date_added, modified_at FROM Organizations ORDER BY orgID`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var orgID int64
		var name string
		var otherName, url, otherURL, status, orgType, timing, submissionTypes, accepts, myInterest, source, websiteMenu, contestEnds, contestFee, contestPrize, contestPrize2, attributes, dateAdded, modifiedAt *string
		var ranking, duotropeNum, nPushFiction, nPushNonfiction, nPushPoetry *int

		err := rows.Scan(&orgID, &name, &otherName, &url, &otherURL, &status, &orgType, &timing, &submissionTypes, &accepts, &myInterest, &ranking, &source, &websiteMenu, &duotropeNum, &nPushFiction, &nPushNonfiction, &nPushPoetry, &contestEnds, &contestFee, &contestPrize, &contestPrize2, &attributes, &dateAdded, &modifiedAt)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, map[string]interface{}{
			"orgID": orgID, "name": name, "otherName": otherName, "url": url, "otherURL": otherURL,
			"status": status, "type": orgType, "timing": timing, "submissionTypes": submissionTypes,
			"accepts": accepts, "myInterest": myInterest, "ranking": ranking, "source": source,
			"websiteMenu": websiteMenu, "duotropeNum": duotropeNum, "nPushFiction": nPushFiction,
			"nPushNonfiction": nPushNonfiction, "nPushPoetry": nPushPoetry, "contestEnds": contestEnds,
			"contestFee": contestFee, "contestPrize": contestPrize, "contestPrize2": contestPrize2,
			"attributes": attributes,
		})
	}
	return records, len(records), nil
}

func (a *App) exportSubmissions() (interface{}, int, error) {
	rows, err := a.db.Conn().Query(`SELECT submissionID, workID, orgID, draft, submission_date, submission_type, query_date, response_date, response_type, contest_name, cost, user_id, password, web_address, attributes, created_at, modified_at FROM Submissions ORDER BY submissionID`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var submissionID, workID, orgID int64
		var draft, submissionDate, submissionType, queryDate, responseDate, responseType, contestName, userID, password, webAddress, attributes, createdAt, modifiedAt *string
		var cost *float64

		err := rows.Scan(&submissionID, &workID, &orgID, &draft, &submissionDate, &submissionType, &queryDate, &responseDate, &responseType, &contestName, &cost, &userID, &password, &webAddress, &attributes, &createdAt, &modifiedAt)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, map[string]interface{}{
			"submissionID": submissionID, "workID": workID, "orgID": orgID, "draft": draft,
			"submissionDate": submissionDate, "submissionType": submissionType, "queryDate": queryDate,
			"responseDate": responseDate, "responseType": responseType, "contestName": contestName,
			"cost": cost, "userID": userID, "password": password, "webAddress": webAddress,
			"attributes": attributes,
		})
	}
	return records, len(records), nil
}

func (a *App) exportCollections() (interface{}, int, error) {
	rows, err := a.db.Conn().Query(`SELECT collID, collection_name, type, attributes, created_at, modified_at FROM Collections ORDER BY collID`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var collID int64
		var collectionName string
		var collType, attributes, createdAt, modifiedAt *string

		err := rows.Scan(&collID, &collectionName, &collType, &attributes, &createdAt, &modifiedAt)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, map[string]interface{}{
			"collID": collID, "collectionName": collectionName,
			"type": collType, "attributes": attributes,
		})
	}
	return records, len(records), nil
}

func (a *App) exportCollectionDetails() (interface{}, int, error) {
	rows, err := a.db.Conn().Query(`SELECT id, collID, workID, position FROM CollectionDetails ORDER BY collID, position`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, collID, workID, position int64

		err := rows.Scan(&id, &collID, &workID, &position)
		if err != nil {
			return nil, 0, err
		}

		records = append(records, map[string]interface{}{
			"collID": collID, "workID": workID, "position": position,
		})
	}
	return records, len(records), nil
}

func (a *App) exportNotes() (interface{}, int, error) {
	notes, err := a.db.GetAllNotes(true)
	if err != nil {
		return nil, 0, err
	}

	records := make([]map[string]interface{}, 0, len(notes))
	for _, n := range notes {
		records = append(records, map[string]interface{}{
			"id":         n.ID,
			"entityType": n.EntityType,
			"entityID":   n.EntityID,
			"type":       n.Type,
			"note":       n.Note,
			"attributes": n.Attributes,
			"modifiedAt": n.ModifiedAt,
			"createdAt":  n.CreatedAt,
		})
	}
	return records, len(records), nil
}

func (a *App) OpenExportFolder() error {
	exportPath := a.settings.Get().ExportFolderPath
	if exportPath == "" {
		return fmt.Errorf("export folder not configured")
	}
	runtime.BrowserOpenURL(a.ctx, "file://"+exportPath)
	return nil
}
