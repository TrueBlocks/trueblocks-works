package main

import (
	"time"
)

const defaultUnknown = "Unknown"

// DashboardStats contains aggregated statistics for the dashboard
type DashboardStats struct {
	Works         WorksStats         `json:"works"`
	Organizations OrganizationsStats `json:"organizations"`
	Submissions   SubmissionsStats   `json:"submissions"`
	Collections   CollectionsStats   `json:"collections"`
	YearProgress  YearProgressStats  `json:"yearProgress"`
	RecentItems   []RecentItem       `json:"recentItems"`
	PendingAlerts []PendingAlert     `json:"pendingAlerts"`
}

type WorksStats struct {
	Total     int            `json:"total"`
	ByType    map[string]int `json:"byType"`
	ByStatus  map[string]int `json:"byStatus"`
	ByYear    map[string]int `json:"byYear"`
	ByQuality map[string]int `json:"byQuality"`
	Sparkline []int          `json:"sparkline"`
}

type OrganizationsStats struct {
	Total        int              `json:"total"`
	ByStatus     map[string]int   `json:"byStatus"`
	ByType       map[string]int   `json:"byType"`
	TopSubmitted []OrgSubmitCount `json:"topSubmitted"`
	Sparkline    []int            `json:"sparkline"`
}

type OrgSubmitCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type SubmissionsStats struct {
	Total      int            `json:"total"`
	Pending    int            `json:"pending"`
	ThisYear   int            `json:"thisYear"`
	ByResponse map[string]int `json:"byResponse"`
	ByMonth    map[string]int `json:"byMonth"`
	AcceptRate float64        `json:"acceptRate"`
	Sparkline  []int          `json:"sparkline"`
}

type CollectionsStats struct {
	Total     int              `json:"total"`
	Largest   []CollectionSize `json:"largest"`
	Sparkline []int            `json:"sparkline"`
}

type CollectionSize struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type YearProgressStats struct {
	Year        int     `json:"year"`
	Submissions int     `json:"submissions"`
	Acceptances int     `json:"acceptances"`
	SuccessRate float64 `json:"successRate"`
}

type RecentItem struct {
	EntityType string `json:"entityType"`
	EntityID   int64  `json:"entityID"`
	Name       string `json:"name"`
	CreatedAt  string `json:"createdAt"`
}

type PendingAlert struct {
	SubmissionID int64  `json:"submissionID"`
	WorkTitle    string `json:"workTitle"`
	OrgName      string `json:"orgName"`
	DaysWaiting  int    `json:"daysWaiting"`
}

func (a *App) GetDashboardStats() (DashboardStats, error) {
	stats := DashboardStats{}
	currentYear := time.Now().Year()

	// Works stats
	stats.Works = a.getWorksStats()

	// Organizations stats
	stats.Organizations = a.getOrganizationsStats()

	// Submissions stats
	stats.Submissions = a.getSubmissionsStats(currentYear)

	// Collections stats
	stats.Collections = a.getCollectionsStats()

	// Year progress
	stats.YearProgress = a.getYearProgress(currentYear)

	// Recent items (created, not modified)
	stats.RecentItems = a.getRecentItems(5)

	// Pending alerts (submissions waiting 60+ days)
	stats.PendingAlerts = a.getPendingAlerts(60)

	return stats, nil
}

func (a *App) getWorksStats() WorksStats {
	stats := WorksStats{
		ByType:    make(map[string]int),
		ByStatus:  make(map[string]int),
		ByYear:    make(map[string]int),
		ByQuality: make(map[string]int),
		Sparkline: make([]int, 30),
	}

	// Total
	row := a.db.Conn().QueryRow("SELECT COUNT(*) FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&stats.Total)

	// By type
	rows, _ := a.db.Conn().Query("SELECT COALESCE(type, '" + defaultUnknown + "'), COUNT(*) FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY type")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			var c int
			_ = rows.Scan(&t, &c)
			if t == "" {
				t = defaultUnknown
			}
			stats.ByType[t] = c
		}
	}

	// By status
	rows, _ = a.db.Conn().Query("SELECT COALESCE(status, '" + defaultUnknown + "'), COUNT(*) FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY status")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			var c int
			_ = rows.Scan(&s, &c)
			if s == "" {
				s = defaultUnknown
			}
			stats.ByStatus[s] = c
		}
	}

	// By year (top 10)
	rows, _ = a.db.Conn().Query("SELECT COALESCE(year, '" + defaultUnknown + "'), COUNT(*) FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY year ORDER BY year DESC LIMIT 10")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var y string
			var c int
			_ = rows.Scan(&y, &c)
			if y == "" {
				y = defaultUnknown
			}
			stats.ByYear[y] = c
		}
	}

	// By quality
	rows, _ = a.db.Conn().Query("SELECT COALESCE(quality, '" + defaultUnknown + "'), COUNT(*) FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY quality")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var q string
			var c int
			_ = rows.Scan(&q, &c)
			if q == "" {
				q = defaultUnknown
			}
			stats.ByQuality[q] = c
		}
	}

	// Sparkline: works created per day for last 30 days
	rows, _ = a.db.Conn().Query(`
		SELECT date(created_at), COUNT(*) 
		FROM Works 
		WHERE created_at >= date('now', '-30 days')
		  AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		GROUP BY date(created_at)
		ORDER BY date(created_at)
	`)
	if rows != nil {
		defer rows.Close()
		sparkData := make(map[string]int)
		for rows.Next() {
			var d string
			var c int
			_ = rows.Scan(&d, &c)
			sparkData[d] = c
		}
		// Fill in the 30-day array
		for i := 0; i < 30; i++ {
			day := time.Now().AddDate(0, 0, -29+i).Format("2006-01-02")
			stats.Sparkline[i] = sparkData[day]
		}
	}

	return stats
}

func (a *App) getOrganizationsStats() OrganizationsStats {
	stats := OrganizationsStats{
		ByStatus:     make(map[string]int),
		ByType:       make(map[string]int),
		TopSubmitted: []OrgSubmitCount{},
		Sparkline:    make([]int, 30),
	}

	// Total
	row := a.db.Conn().QueryRow("SELECT COUNT(*) FROM Organizations WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&stats.Total)

	// By status
	rows, _ := a.db.Conn().Query("SELECT COALESCE(status, '" + defaultUnknown + "'), COUNT(*) FROM Organizations WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY status")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			var c int
			_ = rows.Scan(&s, &c)
			if s == "" {
				s = defaultUnknown
			}
			stats.ByStatus[s] = c
		}
	}

	// By type
	rows, _ = a.db.Conn().Query("SELECT COALESCE(type, '" + defaultUnknown + "'), COUNT(*) FROM Organizations WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY type")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			var c int
			_ = rows.Scan(&t, &c)
			if t == "" {
				t = defaultUnknown
			}
			stats.ByType[t] = c
		}
	}

	// Top submitted orgs
	rows, _ = a.db.Conn().Query(`
		SELECT o.name, COUNT(s.submissionID) as cnt
		FROM Organizations o
		JOIN Submissions s ON o.orgID = s.orgID
		WHERE (o.attributes IS NULL OR o.attributes NOT LIKE '%deleted%')
		  AND (s.attributes IS NULL OR s.attributes NOT LIKE '%deleted%')
		GROUP BY o.orgID
		ORDER BY cnt DESC
		LIMIT 5
	`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var count int
			_ = rows.Scan(&name, &count)
			stats.TopSubmitted = append(stats.TopSubmitted, OrgSubmitCount{Name: name, Count: count})
		}
	}

	// Sparkline: orgs added per day for last 30 days
	rows, _ = a.db.Conn().Query(`
		SELECT date(date_added), COUNT(*) 
		FROM Organizations 
		WHERE date_added >= date('now', '-30 days')
		  AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		GROUP BY date(date_added)
		ORDER BY date(date_added)
	`)
	if rows != nil {
		defer rows.Close()
		sparkData := make(map[string]int)
		for rows.Next() {
			var d string
			var c int
			_ = rows.Scan(&d, &c)
			sparkData[d] = c
		}
		for i := 0; i < 30; i++ {
			day := time.Now().AddDate(0, 0, -29+i).Format("2006-01-02")
			stats.Sparkline[i] = sparkData[day]
		}
	}

	return stats
}

func (a *App) getSubmissionsStats(year int) SubmissionsStats {
	stats := SubmissionsStats{
		ByResponse: make(map[string]int),
		ByMonth:    make(map[string]int),
		Sparkline:  make([]int, 30),
	}

	// Total
	row := a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&stats.Total)

	// Pending (no response)
	row = a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE (response_type IS NULL OR response_type = '' OR response_type = 'Waiting') AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&stats.Pending)

	// This year
	row = a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE submission_date >= ? AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')", time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02"))
	_ = row.Scan(&stats.ThisYear)

	// By response
	rows, _ := a.db.Conn().Query("SELECT COALESCE(response_type, 'Pending'), COUNT(*) FROM Submissions WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') GROUP BY response_type")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var r string
			var c int
			_ = rows.Scan(&r, &c)
			if r == "" {
				r = "Pending"
			}
			stats.ByResponse[r] = c
		}
	}

	// By month (last 12 months)
	rows, _ = a.db.Conn().Query(`
		SELECT strftime('%Y-%m', submission_date), COUNT(*) 
		FROM Submissions 
		WHERE submission_date >= date('now', '-12 months')
		  AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		GROUP BY strftime('%Y-%m', submission_date)
		ORDER BY strftime('%Y-%m', submission_date)
	`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var m string
			var c int
			_ = rows.Scan(&m, &c)
			stats.ByMonth[m] = c
		}
	}

	// Accept rate (all time)
	var accepted, total int
	row = a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE response_type = 'Accepted' AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&accepted)
	row = a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE response_type IS NOT NULL AND response_type != '' AND response_type != 'Waiting' AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&total)
	if total > 0 {
		stats.AcceptRate = float64(accepted) / float64(total) * 100
	}

	// Sparkline: submissions per day for last 30 days
	rows, _ = a.db.Conn().Query(`
		SELECT date(submission_date), COUNT(*) 
		FROM Submissions 
		WHERE submission_date >= date('now', '-30 days')
		  AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		GROUP BY date(submission_date)
		ORDER BY date(submission_date)
	`)
	if rows != nil {
		defer rows.Close()
		sparkData := make(map[string]int)
		for rows.Next() {
			var d string
			var c int
			_ = rows.Scan(&d, &c)
			sparkData[d] = c
		}
		for i := 0; i < 30; i++ {
			day := time.Now().AddDate(0, 0, -29+i).Format("2006-01-02")
			stats.Sparkline[i] = sparkData[day]
		}
	}

	return stats
}

func (a *App) getCollectionsStats() CollectionsStats {
	stats := CollectionsStats{
		Largest:   []CollectionSize{},
		Sparkline: make([]int, 30),
	}

	// Total
	row := a.db.Conn().QueryRow("SELECT COUNT(*) FROM Collections WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%')")
	_ = row.Scan(&stats.Total)

	// Largest collections
	rows, _ := a.db.Conn().Query(`
		SELECT c.collection_name, COUNT(cd.workID) as cnt
		FROM Collections c
		LEFT JOIN CollectionDetails cd ON c.collID = cd.collID
		LEFT JOIN Works w ON cd.workID = w.workID
		WHERE (c.attributes IS NULL OR c.attributes NOT LIKE '%deleted%')
		  AND (w.workID IS NULL OR w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')
		GROUP BY c.collID
		ORDER BY cnt DESC
		LIMIT 5
	`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var count int
			_ = rows.Scan(&name, &count)
			stats.Largest = append(stats.Largest, CollectionSize{Name: name, Count: count})
		}
	}

	// Sparkline: collections created per day for last 30 days
	rows, _ = a.db.Conn().Query(`
		SELECT date(created_at), COUNT(*) 
		FROM Collections 
		WHERE created_at >= date('now', '-30 days')
		  AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		GROUP BY date(created_at)
		ORDER BY date(created_at)
	`)
	if rows != nil {
		defer rows.Close()
		sparkData := make(map[string]int)
		for rows.Next() {
			var d string
			var c int
			_ = rows.Scan(&d, &c)
			sparkData[d] = c
		}
		for i := 0; i < 30; i++ {
			day := time.Now().AddDate(0, 0, -29+i).Format("2006-01-02")
			stats.Sparkline[i] = sparkData[day]
		}
	}

	return stats
}

func (a *App) getYearProgress(year int) YearProgressStats {
	stats := YearProgressStats{Year: year}
	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")

	// Submissions this year
	row := a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE submission_date >= ? AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')", startDate)
	_ = row.Scan(&stats.Submissions)

	// Acceptances this year
	row = a.db.Conn().QueryRow("SELECT COUNT(*) FROM Submissions WHERE submission_date >= ? AND response_type = 'Accepted' AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')", startDate)
	_ = row.Scan(&stats.Acceptances)

	// Success rate
	if stats.Submissions > 0 {
		stats.SuccessRate = float64(stats.Acceptances) / float64(stats.Submissions) * 100
	}

	return stats
}

func (a *App) getRecentItems(limit int) []RecentItem {
	items := []RecentItem{}

	rows, _ := a.db.Conn().Query(`
		SELECT entity_type, entity_id, name, created_at FROM (
			SELECT 'work' as entity_type, workID as entity_id, title as name, created_at
			FROM Works WHERE created_at IS NOT NULL AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
			UNION ALL
			SELECT 'organization', orgID, name, date_added as created_at
			FROM Organizations WHERE date_added IS NOT NULL AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
			UNION ALL
			SELECT 'submission', submissionID, 
				(SELECT title FROM Works WHERE workID = s.workID) as name, created_at
			FROM Submissions s WHERE created_at IS NOT NULL AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
			UNION ALL
			SELECT 'collection', collID, collection_name as name, created_at
			FROM Collections WHERE created_at IS NOT NULL AND (attributes IS NULL OR attributes NOT LIKE '%deleted%')
		)
		ORDER BY datetime(created_at) DESC
		LIMIT ?
	`, limit)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var item RecentItem
			var name *string
			_ = rows.Scan(&item.EntityType, &item.EntityID, &name, &item.CreatedAt)
			if name != nil {
				item.Name = *name
			}
			items = append(items, item)
		}
	}

	return items
}

func (a *App) getPendingAlerts(daysThreshold int) []PendingAlert {
	alerts := []PendingAlert{}

	cutoffDate := time.Now().AddDate(0, 0, -daysThreshold).Format("2006-01-02")
	rows, _ := a.db.Conn().Query(`
		SELECT s.submissionID, w.title, o.name, 
			julianday('now') - julianday(s.submission_date) as days_waiting
		FROM Submissions s
		JOIN Works w ON s.workID = w.workID
		JOIN Organizations o ON s.orgID = o.orgID
		WHERE (s.response_type IS NULL OR s.response_type = '' OR s.response_type = 'Waiting')
		AND s.submission_date <= ?
		AND (s.attributes IS NULL OR s.attributes NOT LIKE '%deleted%')
		AND (w.attributes IS NULL OR w.attributes NOT LIKE '%deleted%')
		AND (o.attributes IS NULL OR o.attributes NOT LIKE '%deleted%')
		ORDER BY s.submission_date ASC
	`, cutoffDate)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var alert PendingAlert
			var daysFloat float64
			_ = rows.Scan(&alert.SubmissionID, &alert.WorkTitle, &alert.OrgName, &daysFloat)
			alert.DaysWaiting = int(daysFloat)
			alerts = append(alerts, alert)
		}
	}

	return alerts
}
