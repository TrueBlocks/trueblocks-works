package app

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const unknownName = "Unknown"

type ReportIssue struct {
	ID          int64  `json:"id"`
	Description string `json:"description"`
	EntityType  string `json:"entityType"`
	EntityID    int64  `json:"entityID"`
	EntityName  string `json:"entityName"`
}

type ReportCategory struct {
	Name   string        `json:"name"`
	Icon   string        `json:"icon"`
	Issues []ReportIssue `json:"issues"`
	Count  int           `json:"count"`
	Checks []string      `json:"checks,omitempty"`
	Error  string        `json:"error,omitempty"`
}

// reportCache holds cached report results
type reportCache struct {
	mu      sync.RWMutex
	reports map[string]ReportCategory
}

var reportsCache = &reportCache{
	reports: make(map[string]ReportCategory),
}

// reportDefinitions maps report names to their generator functions and icons
var reportDefinitions = []struct {
	name string
	icon string
}{
	{"Recent Changes", "IconHistory"},
	{"Books", "IconBookmark"},
	{"Collections", "IconFolder"},
	{"Works", "IconBook"},
	{"Organizations", "IconBuilding"},
	{"Submissions", "IconSend"},
	{"Data Quality", "IconAlertTriangle"},
}

// GetReportNames returns the list of all report names in display order.
func (a *App) GetReportNames() []string {
	names := make([]string, len(reportDefinitions))
	for i, def := range reportDefinitions {
		names[i] = def.name
	}
	return names
}

// StartReportGeneration clears the cache and starts async generation of all reports.
// Each report emits a "report:ready" event when complete.
func (a *App) StartReportGeneration() {
	// Clear cache
	reportsCache.mu.Lock()
	reportsCache.reports = make(map[string]ReportCategory)
	reportsCache.mu.Unlock()

	// Launch goroutine for each report
	for _, def := range reportDefinitions {
		go a.generateReport(def.name, def.icon)
	}
}

// RefreshReport regenerates a single report (used for retry on error).
func (a *App) RefreshReport(name string) {
	// Find the icon for this report
	icon := "IconAlertTriangle"
	for _, def := range reportDefinitions {
		if def.name == name {
			icon = def.icon
			break
		}
	}
	go a.generateReport(name, icon)
}

// generateReport runs a single report and emits the result.
func (a *App) generateReport(name, icon string) {
	var category ReportCategory

	defer func() {
		if r := recover(); r != nil {
			category = ReportCategory{
				Name:   name,
				Icon:   icon,
				Issues: []ReportIssue{},
				Count:  0,
				Error:  fmt.Sprintf("panic: %v", r),
			}
		}

		// Cache the result
		reportsCache.mu.Lock()
		reportsCache.reports[name] = category
		reportsCache.mu.Unlock()

		// Emit event to frontend
		runtime.EventsEmit(a.ctx, "report:ready", category)
	}()

	switch name {
	case "Recent Changes":
		category = a.reportRecentChanges()
	case "Books":
		category = a.reportBooksIntegrity()
	case "Submissions":
		category = a.reportSubmissionsIntegrity()
	case "Works":
		category = a.reportWorksIntegrity()
	case "Collections":
		category = a.reportCollectionsIntegrity()
	case "Organizations":
		category = a.reportOrganizationsIntegrity()
	case "Data Quality":
		category = a.reportDataQuality()
	default:
		category = ReportCategory{
			Name:   name,
			Icon:   icon,
			Issues: []ReportIssue{},
			Count:  0,
			Error:  fmt.Sprintf("unknown report: %s", name),
		}
	}

	category.Count = len(category.Issues)
}

// reportRecentChanges returns recent changes as a report category.
func (a *App) reportRecentChanges() ReportCategory {
	issues := make([]ReportIssue, 0)

	changes, err := a.db.GetRecentlyChanged(50)
	if err != nil {
		return ReportCategory{
			Name:   "Recent Changes",
			Icon:   "IconHistory",
			Issues: []ReportIssue{},
			Count:  0,
			Error:  err.Error(),
		}
	}

	for _, c := range changes {
		issues = append(issues, ReportIssue{
			ID:          c.EntityID,
			Description: c.ModifiedAt,
			EntityType:  c.EntityType,
			EntityID:    c.EntityID,
			EntityName:  c.Name,
		})
	}

	return ReportCategory{
		Name:   "Recent Changes",
		Icon:   "IconHistory",
		Issues: issues,
	}
}

func (a *App) reportBooksIntegrity() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Empty books (no works assigned)",
		"Books without a template assigned",
		"Books with style audit issues (unknown styles or direct formatting)",
		"Books with heading analysis failures",
	}

	// Get all book collections
	rows, err := a.db.Conn().Query(`
		SELECT c.collID, c.collection_name, b.template_path,
			(SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) as workCount
		FROM Collections c 
		LEFT JOIN Books b ON b.collID = c.collID
		WHERE c.is_book = 1
		ORDER BY c.collection_name
	`)
	if err != nil {
		return ReportCategory{
			Name:   "Books",
			Icon:   "IconBookmark",
			Issues: issues,
			Checks: checks,
			Error:  err.Error(),
		}
	}
	defer rows.Close()

	type bookInfo struct {
		id           int64
		name         string
		templatePath sql.NullString
		workCount    int
	}
	var books []bookInfo

	for rows.Next() {
		var b bookInfo
		if err := rows.Scan(&b.id, &b.name, &b.templatePath, &b.workCount); err == nil {
			books = append(books, b)
		}
	}

	for _, book := range books {
		// Check: Empty book
		if book.workCount == 0 {
			issues = append(issues, ReportIssue{
				ID:          book.id,
				Description: "Empty book (no works)",
				EntityType:  "Collection",
				EntityID:    book.id,
				EntityName:  book.name,
			})
			continue
		}

		// Check: No template assigned
		if !book.templatePath.Valid || book.templatePath.String == "" {
			issues = append(issues, ReportIssue{
				ID:          book.id,
				Description: "No template assigned",
				EntityType:  "Collection",
				EntityID:    book.id,
				EntityName:  book.name,
			})
		}

		// Check: Style audit issues
		auditSummary, err := a.AuditCollectionStyles(book.id)
		if err == nil && auditSummary != nil {
			if auditSummary.DirtyWorks > 0 {
				issues = append(issues, ReportIssue{
					ID:          book.id,
					Description: fmt.Sprintf("%d of %d works have style issues", auditSummary.DirtyWorks, auditSummary.TotalWorks),
					EntityType:  "Collection",
					EntityID:    book.id,
					EntityName:  book.name,
				})
			}
			if auditSummary.MissingFiles > 0 {
				issues = append(issues, ReportIssue{
					ID:          book.id,
					Description: fmt.Sprintf("%d works have missing files", auditSummary.MissingFiles),
					EntityType:  "Collection",
					EntityID:    book.id,
					EntityName:  book.name,
				})
			}
		}

		// Check: Heading analysis issues
		headingResult, err := a.AnalyzeCollectionHeadings(book.id)
		if err == nil && headingResult != nil {
			if headingResult.Failed > 0 {
				issues = append(issues, ReportIssue{
					ID:          book.id,
					Description: fmt.Sprintf("%d of %d works failed heading analysis", headingResult.Failed, headingResult.TotalWorks),
					EntityType:  "Collection",
					EntityID:    book.id,
					EntityName:  book.name,
				})
			}
		}
	}

	return ReportCategory{
		Name:   "Books",
		Icon:   "IconBookmark",
		Issues: issues,
		Checks: checks,
	}
}

func (a *App) reportSubmissionsIntegrity() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Submissions with missing work reference",
		"Submissions with missing organization reference",
		"Submissions with no submission date",
		"Submissions marked as Waiting for more than 6 months",
	}

	// Submissions with missing work reference
	rows, err := a.db.Conn().Query(`
		SELECT s.submissionID, s.workID, o.name 
		FROM Submissions s 
		LEFT JOIN Works w ON s.workID = w.workID 
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE w.workID IS NULL
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, workID int64
			var orgName *string
			_ = rows.Scan(&id, &workID, &orgName)
			name := "Unknown org"
			if orgName != nil {
				name = *orgName
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("References non-existent work ID %d", workID),
				EntityType:  "submission",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Submissions with missing organization reference
	rows2, err := a.db.Conn().Query(`
		SELECT s.submissionID, s.orgID, w.title 
		FROM Submissions s 
		LEFT JOIN Organizations o ON s.orgID = o.orgID 
		LEFT JOIN Works w ON s.workID = w.workID
		WHERE o.orgID IS NULL
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id, orgID int64
			var title *string
			_ = rows2.Scan(&id, &orgID, &title)
			name := "Unknown work"
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("References non-existent org ID %d", orgID),
				EntityType:  "submission",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Submissions with no submission date
	rows3, err := a.db.Conn().Query(`
		SELECT s.submissionID, w.title, o.name 
		FROM Submissions s 
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE s.submission_date IS NULL OR s.submission_date = ''
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id int64
			var title, orgName *string
			_ = rows3.Scan(&id, &title, &orgName)
			name := unknownName
			if title != nil && orgName != nil {
				name = fmt.Sprintf("%s → %s", *title, *orgName)
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Missing submission date",
				EntityType:  "submission",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Submissions marked as "Waiting" for more than 6 months
	sixMonthsAgo := time.Now().AddDate(0, -6, 0).Format("2006-01-02")
	rows4, err := a.db.Conn().Query(`
		SELECT s.submissionID, w.title, o.name, s.submission_date
		FROM Submissions s 
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE s.response_type = 'Waiting' 
		AND s.submission_date IS NOT NULL 
		AND s.submission_date < ?
	`, sixMonthsAgo)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var id int64
			var title, orgName, subDate *string
			_ = rows4.Scan(&id, &title, &orgName, &subDate)
			name := unknownName
			if title != nil && orgName != nil {
				name = fmt.Sprintf("%s → %s", *title, *orgName)
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("Waiting since %s (>6 months)", *subDate),
				EntityType:  "submission",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	return ReportCategory{Name: "Submissions", Icon: "IconSend", Issues: issues, Checks: checks}
}

func (a *App) reportWorksIntegrity() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Works with missing year",
		"Works with missing type",
		"Works with missing status",
		"Works with duplicate titles (same title, year, and type)",
	}

	// Works with missing Year value
	rows, err := a.db.Conn().Query(`
		SELECT workID, title FROM Works 
		WHERE year IS NULL OR year = ''
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var title *string
			_ = rows.Scan(&id, &title)
			name := unknownName
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Missing year",
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Works with invalid/empty Type
	rows2, err := a.db.Conn().Query(`
		SELECT workID, title FROM Works 
		WHERE type IS NULL OR type = ''
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id int64
			var title *string
			_ = rows2.Scan(&id, &title)
			name := unknownName
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Missing type",
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Works with invalid/empty Status
	rows3, err := a.db.Conn().Query(`
		SELECT workID, title FROM Works 
		WHERE status IS NULL OR status = ''
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id int64
			var title *string
			_ = rows3.Scan(&id, &title)
			name := unknownName
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Missing status",
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Works with duplicate titles (same title, year, and type)
	rows4, err := a.db.Conn().Query(`
		SELECT w1.workID, w1.title, w1.year, w1.type, COUNT(*) as cnt
		FROM Works w1
		INNER JOIN Works w2 ON LOWER(w1.title) = LOWER(w2.title) 
			AND COALESCE(w1.year, '') = COALESCE(w2.year, '')
			AND LOWER(w1.type) = LOWER(w2.type)
			AND w1.workID < w2.workID
		GROUP BY LOWER(w1.title), COALESCE(w1.year, ''), LOWER(w1.type)
		HAVING cnt > 0
	`)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var id int64
			var title *string
			var year *string
			var workType *string
			var cnt int
			_ = rows4.Scan(&id, &title, &year, &workType, &cnt)
			name := unknownName
			if title != nil {
				name = *title
				if year != nil && *year != "" {
					name += " (" + *year + ")"
				}
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Potential duplicate title",
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	return ReportCategory{Name: "Works", Icon: "IconBook", Issues: issues, Checks: checks}
}

func (a *App) reportCollectionsIntegrity() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Empty collections (no works assigned)",
		"CollectionDetails referencing non-existent works",
		"CollectionDetails referencing non-existent collections",
	}

	// Empty collections (no works assigned)
	rows, err := a.db.Conn().Query(`
		SELECT c.collID, c.collection_name
		FROM Collections c
		LEFT JOIN CollectionDetails cd ON c.collID = cd.collID
		WHERE cd.id IS NULL
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var name string
			_ = rows.Scan(&id, &name)
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Empty collection (no works)",
				EntityType:  "collection",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// CollectionDetails referencing non-existent works
	rows2, err := a.db.Conn().Query(`
		SELECT cd.id, cd.workID, c.collection_name
		FROM CollectionDetails cd
		LEFT JOIN Works w ON cd.workID = w.workID
		LEFT JOIN Collections c ON cd.collID = c.collID
		WHERE w.workID IS NULL
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id, workID int64
			var collName *string
			_ = rows2.Scan(&id, &workID, &collName)
			name := "Unknown collection"
			if collName != nil {
				name = *collName
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("References non-existent work ID %d", workID),
				EntityType:  "collectionDetail",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// CollectionDetails referencing non-existent collections
	rows3, err := a.db.Conn().Query(`
		SELECT cd.id, cd.collID, w.title
		FROM CollectionDetails cd
		LEFT JOIN Collections c ON cd.collID = c.collID
		LEFT JOIN Works w ON cd.workID = w.workID
		WHERE c.collID IS NULL
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id, collID int64
			var title *string
			_ = rows3.Scan(&id, &collID, &title)
			name := "Unknown work"
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("References non-existent collection ID %d", collID),
				EntityType:  "collectionDetail",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	return ReportCategory{Name: "Collections", Icon: "IconFolder", Issues: issues, Checks: checks}
}

func (a *App) reportOrganizationsIntegrity() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Organizations with no URL, other URL, or Duotrope number",
		"Duplicate organization names",
	}

	// Organizations with no URL, other_url, or duotrope_num
	rows2, err := a.db.Conn().Query(`
		SELECT orgID, name FROM Organizations 
		WHERE (url IS NULL OR url = '') 
		AND (other_url IS NULL OR other_url = '')
		AND (duotrope_num IS NULL OR duotrope_num = 0)
		AND status != 'Defunct'
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id int64
			var name string
			_ = rows2.Scan(&id, &name)
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "No URL, other URL, or Duotrope number",
				EntityType:  "organization",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Duplicate organization names
	rows3, err := a.db.Conn().Query(`
		SELECT o1.orgID, o1.name, COUNT(*) as cnt
		FROM Organizations o1
		INNER JOIN Organizations o2 ON LOWER(o1.name) = LOWER(o2.name) AND o1.orgID < o2.orgID
		GROUP BY LOWER(o1.name)
		HAVING cnt > 0
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id int64
			var name string
			var cnt int
			_ = rows3.Scan(&id, &name, &cnt)
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: "Potential duplicate name",
				EntityType:  "organization",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	return ReportCategory{Name: "Organizations", Icon: "IconBuilding", Issues: issues, Checks: checks}
}

func (a *App) reportDataQuality() ReportCategory {
	issues := make([]ReportIssue, 0)
	checks := []string{
		"Works with very low word count (< 10 words, excludes Cartoons)",
		"Works with very high word count (> 50,000 words, excludes Books)",
		"Submissions with future dates",
	}

	// Works with very low word count (< 10 words) - exclude Cartoons
	rows, err := a.db.Conn().Query(`
		SELECT workID, title, n_words FROM Works 
		WHERE n_words IS NOT NULL AND n_words < 10 AND n_words > 0
		AND title NOT LIKE '%Needed'
		AND type NOT LIKE '%Chapter%'
		AND type != 'Cartoon'
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var title *string
			var nWords int
			_ = rows.Scan(&id, &title, &nWords)
			name := unknownName
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("Very low word count (%d words)", nWords),
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Works with very high word count (> 50000 words) - exclude Books
	rows2, err := a.db.Conn().Query(`
		SELECT workID, title, n_words FROM Works 
		WHERE n_words IS NOT NULL AND n_words > 50000 AND type NOT LIKE '%Book%'
		AND title NOT LIKE '%Needed'
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id int64
			var title *string
			var nWords int
			_ = rows2.Scan(&id, &title, &nWords)
			name := unknownName
			if title != nil {
				name = *title
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("Very high word count (%d words)", nWords),
				EntityType:  "work",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	// Submissions with future dates
	// Dates are stored as M/D/YYYY, need to convert for comparison
	today := time.Now().Format("2006-01-02")
	rows3, err := a.db.Conn().Query(`
		SELECT s.submissionID, w.title, o.name, s.submission_date
		FROM Submissions s
		LEFT JOIN Works w ON s.workID = w.workID
		LEFT JOIN Organizations o ON s.orgID = o.orgID
		WHERE s.submission_date IS NOT NULL 
		AND s.submission_date != ''
		AND date(
			substr(s.submission_date, -4) || '-' ||
			printf('%02d', CAST(substr(s.submission_date, 1, instr(s.submission_date, '/') - 1) AS INTEGER)) || '-' ||
			printf('%02d', CAST(substr(s.submission_date, instr(s.submission_date, '/') + 1, 
				instr(substr(s.submission_date, instr(s.submission_date, '/') + 1), '/') - 1) AS INTEGER))
		) > ?
	`, today)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var id int64
			var title, orgName, subDate *string
			_ = rows3.Scan(&id, &title, &orgName, &subDate)
			name := unknownName
			if title != nil && orgName != nil {
				name = fmt.Sprintf("%s → %s", *title, *orgName)
			}
			date := ""
			if subDate != nil {
				date = *subDate
			}
			issues = append(issues, ReportIssue{
				ID:          id,
				Description: fmt.Sprintf("Future submission date (%s)", date),
				EntityType:  "submission",
				EntityID:    id,
				EntityName:  name,
			})
		}
	}

	return ReportCategory{Name: "Data Quality", Icon: "IconAlertTriangle", Issues: issues, Checks: checks}
}

func (a *App) ReportFileSystemChecks() ReportCategory {
	issues := make([]ReportIssue, 0)

	// Works where the document file is missing from expected path
	rows, err := a.db.Conn().Query(`
		SELECT workID, title, path FROM Works 
		WHERE path IS NOT NULL AND path != ''
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var title, path *string
			_ = rows.Scan(&id, &title, &path)
			if path != nil && *path != "" {
				// Check if file exists
				fullPath := *path
				if !strings.HasPrefix(fullPath, "/") {
					// Relative path - would need base path from settings
					continue
				}
				if _, err := os.Stat(fullPath); os.IsNotExist(err) {
					name := unknownName
					if title != nil {
						name = *title
					}
					issues = append(issues, ReportIssue{
						ID:          id,
						Description: fmt.Sprintf("File not found: %s", filepath.Base(fullPath)),
						EntityType:  "work",
						EntityID:    id,
						EntityName:  name,
					})
				}
			}
		}
	}

	return ReportCategory{Name: "File System", Icon: "IconFile", Issues: issues}
}
