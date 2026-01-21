package app

import (
	"fmt"
	"slices"
)

var allowedEnumFields = map[string][]string{
	"Works":         {"status", "type", "quality", "doc_type"},
	"Organizations": {"status", "type", "my_interest"},
	"Collections":   {"type"},
	"Notes":         {"type"},
	"Submissions":   {"submission_type", "response_type"},
}

func (a *App) GetDistinctValues(table, column string) ([]string, error) {
	allowedColumns, ok := allowedEnumFields[table]
	if !ok {
		return nil, fmt.Errorf("table %q not allowed for enum queries", table)
	}
	if !slices.Contains(allowedColumns, column) {
		return nil, fmt.Errorf("column %q not allowed for table %q", column, table)
	}

	query := fmt.Sprintf(
		`SELECT DISTINCT COALESCE(%s, '') as val FROM %s WHERE %s != '' ORDER BY val`,
		column, table, column,
	)

	rows, err := a.db.Conn().Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var val string
		if rows.Scan(&val) == nil && val != "" {
			values = append(values, val)
		}
	}
	return values, nil
}

type EnumLists struct {
	StatusList   []string `json:"statusList"`
	QualityList  []string `json:"qualityList"`
	WorkTypeList []string `json:"workTypeList"`
	YearList     []string `json:"yearList"`
}

func (a *App) GetEnumLists() EnumLists {
	statusList, _ := a.GetDistinctValues("Works", "status")
	qualityList, _ := a.GetDistinctValues("Works", "quality")
	workTypeList, _ := a.GetDistinctValues("Works", "type")

	// Get distinct years from Works table
	var yearList []string
	rows, err := a.db.Conn().Query(`SELECT DISTINCT year FROM Works WHERE year IS NOT NULL AND year != '' ORDER BY year DESC`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var year string
			if rows.Scan(&year) == nil {
				yearList = append(yearList, year)
			}
		}
	}

	return EnumLists{
		StatusList:   statusList,
		QualityList:  qualityList,
		WorkTypeList: workTypeList,
		YearList:     yearList,
	}
}

func (a *App) RenameFieldValue(table, column, oldValue, newValue string) (int64, error) {
	allowedColumns, ok := allowedEnumFields[table]
	if !ok {
		return 0, fmt.Errorf("table %q not allowed for enum updates", table)
	}
	if !slices.Contains(allowedColumns, column) {
		return 0, fmt.Errorf("column %q not allowed for table %q", column, table)
	}
	if oldValue == "" || newValue == "" {
		return 0, fmt.Errorf("old and new values must be non-empty")
	}
	if oldValue == newValue {
		return 0, nil
	}

	query := fmt.Sprintf(`UPDATE %s SET %s = ? WHERE %s = ?`, table, column, column)
	result, err := a.db.Conn().Exec(query, newValue, oldValue)
	if err != nil {
		return 0, fmt.Errorf("update failed: %w", err)
	}
	return result.RowsAffected()
}

// WorksFilterOptions contains distinct values from the Works table for filtering
type WorksFilterOptions struct {
	Years     []string `json:"years"`
	Types     []string `json:"types"`
	Statuses  []string `json:"statuses"`
	Qualities []string `json:"qualities"`
}

// GetWorksFilterOptions returns distinct values from the Works table for filtering
func (a *App) GetWorksFilterOptions() WorksFilterOptions {
	opts := WorksFilterOptions{
		Years:     []string{},
		Types:     []string{},
		Statuses:  []string{},
		Qualities: []string{},
	}

	// Get distinct years (include empty if any exist)
	rows, err := a.db.Conn().Query(`SELECT DISTINCT COALESCE(year, '') as year FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') ORDER BY year DESC`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var year string
			if rows.Scan(&year) == nil {
				opts.Years = append(opts.Years, year)
			}
		}
	}

	// Get distinct types (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(type, '') as type FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') ORDER BY type`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			if rows.Scan(&t) == nil {
				opts.Types = append(opts.Types, t)
			}
		}
	}

	// Get distinct statuses (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(status, '') as status FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') ORDER BY status`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			if rows.Scan(&s) == nil {
				opts.Statuses = append(opts.Statuses, s)
			}
		}
	}

	// Get distinct qualities (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(quality, '') as quality FROM Works WHERE (attributes IS NULL OR attributes NOT LIKE '%deleted%') ORDER BY quality`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var q string
			if rows.Scan(&q) == nil {
				opts.Qualities = append(opts.Qualities, q)
			}
		}
	}

	return opts
}

// OrgsFilterOptions holds distinct values for Organizations table filters
type OrgsFilterOptions struct {
	Statuses []string `json:"statuses"`
	Types    []string `json:"types"`
	Timings  []string `json:"timings"`
}

// GetOrgsFilterOptions returns distinct values from the Organizations table for filtering
func (a *App) GetOrgsFilterOptions() OrgsFilterOptions {
	opts := OrgsFilterOptions{
		Statuses: []string{},
		Types:    []string{},
		Timings:  []string{},
	}

	// Get distinct statuses (include empty if any exist)
	rows, err := a.db.Conn().Query(`SELECT DISTINCT COALESCE(status, '') as status FROM Organizations ORDER BY status`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			if rows.Scan(&s) == nil {
				opts.Statuses = append(opts.Statuses, s)
			}
		}
	}

	// Get distinct types (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(type, '') as type FROM Organizations ORDER BY type`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			if rows.Scan(&t) == nil {
				opts.Types = append(opts.Types, t)
			}
		}
	}

	// Get distinct timings (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(timing, '') as timing FROM Organizations ORDER BY timing`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			if rows.Scan(&t) == nil {
				opts.Timings = append(opts.Timings, t)
			}
		}
	}

	return opts
}

// SubmissionsFilterOptions holds distinct values for Submissions table filters
type SubmissionsFilterOptions struct {
	Types     []string `json:"types"`
	Responses []string `json:"responses"`
	Statuses  []string `json:"statuses"`
}

// GetSubmissionsFilterOptions returns distinct values from the Submissions table for filtering
func (a *App) GetSubmissionsFilterOptions() SubmissionsFilterOptions {
	opts := SubmissionsFilterOptions{
		Types:     []string{},
		Responses: []string{},
		Statuses:  []string{"Active", "Closed"},
	}

	// Get distinct submission types (include empty if any exist)
	rows, err := a.db.Conn().Query(`SELECT DISTINCT COALESCE(submission_type, '') as submission_type FROM Submissions ORDER BY submission_type`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			if rows.Scan(&t) == nil {
				opts.Types = append(opts.Types, t)
			}
		}
	}

	// Get distinct response types (include empty if any exist)
	rows, err = a.db.Conn().Query(`SELECT DISTINCT COALESCE(response_type, '') as response_type FROM Submissions ORDER BY response_type`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var r string
			if rows.Scan(&r) == nil {
				opts.Responses = append(opts.Responses, r)
			}
		}
	}

	return opts
}
