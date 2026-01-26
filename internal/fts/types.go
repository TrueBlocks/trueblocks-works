package fts

import "time"

type Status struct {
	Available     bool      `json:"available"`
	DocumentCount int       `json:"documentCount"`
	StaleCount    int       `json:"staleCount"`
	MissingCount  int       `json:"missingCount"`
	IndexSize     int64     `json:"indexSize"`
	LastUpdated   time.Time `json:"lastUpdated"`
	TotalWords    int       `json:"totalWords"`
}

type Filters struct {
	Types    []string `json:"types,omitempty"`
	Years    []string `json:"years,omitempty"`
	Statuses []string `json:"statuses,omitempty"`
	WorkIDs  []int    `json:"workIds,omitempty"`
}

type Query struct {
	Text           string  `json:"text"`
	Filters        Filters `json:"filters"`
	Limit          int     `json:"limit"`
	Offset         int     `json:"offset"`
	IncludeContent bool    `json:"includeContent"`
}

type Result struct {
	WorkID      int     `json:"workId"`
	Title       string  `json:"title"`
	Type        string  `json:"type"`
	Year        string  `json:"year"`
	Status      string  `json:"status"`
	Snippet     string  `json:"snippet"`
	Rank        float32 `json:"rank"`
	TextContent string  `json:"textContent,omitempty"`
	WordCount   int     `json:"wordCount"`
}

type SearchResponse struct {
	Query      Query    `json:"query"`
	Results    []Result `json:"results"`
	TotalCount int      `json:"totalCount"`
	QueryTime  float64  `json:"queryTime"`
}

type ExtractionResult struct {
	WorkID      int
	TextContent string
	WordCount   int
	ExtractedAt time.Time
	SourceMtime int64
	SourceSize  int64
	Error       error
}

type StalenessReport struct {
	TotalWorks     int
	IndexedWorks   int
	StaleWorks     int
	MissingWorks   int
	OrphanedWorks  int
	StaleWorkIDs   []int
	MissingWorkIDs []int
}

type BuildProgress struct {
	Phase       string   `json:"phase"`
	Current     int      `json:"current"`
	Total       int      `json:"total"`
	CurrentFile string   `json:"currentFile"`
	Errors      []string `json:"errors"`
}

type BuildReport struct {
	Success       bool         `json:"success"`
	DocumentCount int          `json:"documentCount"`
	WordCount     int          `json:"wordCount"`
	Duration      float64      `json:"duration"`
	Errors        []string     `json:"errors"`
	FailedWorks   []FailedWork `json:"failedWorks"`
}

type FailedWork struct {
	WorkID int    `json:"workID"`
	Title  string `json:"title"`
	Path   string `json:"path"`
	Error  string `json:"error"`
}

type WorkInfo struct {
	WorkID  int
	Title   string
	Type    string
	Year    string
	Status  string
	DocType string
	Path    string
}

type HeadingInfo struct {
	Pos   int    `json:"pos"`
	Level int    `json:"level"`
	Style string `json:"style"`
	Text  string `json:"text"`
}

type HeadingsResult struct {
	Headings      []HeadingInfo `json:"headings"`
	Dateline      string        `json:"dateline"`
	UnknownStyles []string      `json:"unknownStyles"`
}
