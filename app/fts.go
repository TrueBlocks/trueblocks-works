package app

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fts"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/models"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	ftsDB     *fts.Database
	ftsDBOnce sync.Once
)

func (a *App) getFTSDB() *fts.Database {
	ftsDBOnce.Do(func() {
		ftsDB = fts.NewDatabase()
	})
	return ftsDB
}

func (a *App) FTSGetStatus() (*fts.Status, error) {
	db := a.getFTSDB()

	status := &fts.Status{
		Available: db.Exists(),
	}

	if !status.Available {
		return status, nil
	}

	if err := db.Open(); err != nil {
		return status, nil
	}

	conn := db.Conn()
	if conn == nil {
		return status, nil
	}

	_ = conn.QueryRow("SELECT COUNT(*) FROM content").Scan(&status.DocumentCount)
	_ = conn.QueryRow("SELECT COALESCE(SUM(word_count), 0) FROM content").Scan(&status.TotalWords)

	info, err := os.Stat(db.Path())
	if err == nil {
		status.IndexSize = info.Size()
		status.LastUpdated = info.ModTime()
	}

	if lastUpdate, err := db.GetMeta("last_updated"); err == nil && lastUpdate != "" {
		if t, err := time.Parse(time.RFC3339, lastUpdate); err == nil {
			status.LastUpdated = t
		}
	}

	builder := fts.NewIndexBuilder(db, a.db.Conn(), a.settings.Get().BaseFolderPath)
	if staleness, err := builder.CheckStaleness(); err == nil {
		status.StaleCount = staleness.StaleWorks
		status.MissingCount = staleness.MissingWorks
	}

	return status, nil
}

func (a *App) FTSBuildIndex() (*fts.BuildReport, error) {
	db := a.getFTSDB()
	builder := fts.NewIndexBuilder(db, a.db.Conn(), a.settings.Get().BaseFolderPath)

	builder.SetProgressCallback(func(p fts.BuildProgress) {
		runtime.EventsEmit(a.ctx, "fts:progress", p)
	})

	runtime.EventsEmit(a.ctx, "fts:started", nil)

	report, err := builder.BuildFull()
	if err != nil {
		runtime.EventsEmit(a.ctx, "fts:error", err.Error())
		return nil, err
	}

	if err := db.SetMeta("last_updated", time.Now().Format(time.RFC3339)); err != nil {
		return nil, err
	}

	runtime.EventsEmit(a.ctx, "fts:complete", report)
	return report, nil
}

func (a *App) FTSUpdateIndex() (*fts.BuildReport, error) {
	db := a.getFTSDB()
	builder := fts.NewIndexBuilder(db, a.db.Conn(), a.settings.Get().BaseFolderPath)

	builder.SetProgressCallback(func(p fts.BuildProgress) {
		runtime.EventsEmit(a.ctx, "fts:progress", p)
	})

	runtime.EventsEmit(a.ctx, "fts:started", nil)

	report, err := builder.UpdateIncremental()
	if err != nil {
		runtime.EventsEmit(a.ctx, "fts:error", err.Error())
		return nil, err
	}

	if err := db.SetMeta("last_updated", time.Now().Format(time.RFC3339)); err != nil {
		return nil, err
	}

	runtime.EventsEmit(a.ctx, "fts:complete", report)
	return report, nil
}

func (a *App) FTSSearch(query fts.Query) (*fts.SearchResponse, error) {
	db := a.getFTSDB()

	if !db.Exists() {
		return &fts.SearchResponse{
			Query:   query,
			Results: []fts.Result{},
		}, nil
	}

	searcher := fts.NewSearcher(db, a.db.Conn())

	startTime := time.Now()
	resp, err := searcher.Search(query)
	if err != nil {
		return nil, err
	}

	resp.QueryTime = time.Since(startTime).Seconds()
	return resp, nil
}

func (a *App) FTSGetContent(workID int) (*fts.ExtractionResult, error) {
	db := a.getFTSDB()

	if !db.Exists() {
		return nil, nil
	}

	searcher := fts.NewSearcher(db, a.db.Conn())
	return searcher.GetDocumentContent(workID)
}

func (a *App) FTSBatchContent(workIDs []int) ([]fts.ExtractionResult, error) {
	db := a.getFTSDB()

	if !db.Exists() {
		return []fts.ExtractionResult{}, nil
	}

	searcher := fts.NewSearcher(db, a.db.Conn())
	return searcher.BatchGetContent(workIDs)
}

func (a *App) FTSDeleteIndex() error {
	db := a.getFTSDB()
	return db.Delete()
}

func (a *App) FTSCheckStaleness() (*fts.StalenessReport, error) {
	db := a.getFTSDB()
	builder := fts.NewIndexBuilder(db, a.db.Conn(), a.settings.Get().BaseFolderPath)
	return builder.CheckStaleness()
}

type HeadingAnalysisResult struct {
	WorkID        int64             `json:"workId"`
	Title         string            `json:"title"`
	Success       bool              `json:"success"`
	Headings      []fts.HeadingInfo `json:"headings,omitempty"`
	Dateline      string            `json:"dateline,omitempty"`
	UnknownStyles []string          `json:"unknownStyles,omitempty"`
	Error         string            `json:"error,omitempty"`
}

type CollectionHeadingAnalysisResult struct {
	TotalWorks        int                     `json:"totalWorks"`
	Successful        int                     `json:"successful"`
	Failed            int                     `json:"failed"`
	TotalHeadings     int                     `json:"totalHeadings"`
	WorksWithHeadings int                     `json:"worksWithHeadings"`
	WorksWithDateline int                     `json:"worksWithDateline"`
	FirstError        *HeadingAnalysisResult  `json:"firstError,omitempty"`
	Results           []HeadingAnalysisResult `json:"results"`
}

func (a *App) AnalyzeCollectionHeadings(collID int64) (*CollectionHeadingAnalysisResult, error) {
	// Get book for template path
	book, _ := a.db.GetBookByCollection(collID)
	templatePath := ""
	if book != nil && book.TemplatePath != nil && *book.TemplatePath != "" {
		templatePath = *book.TemplatePath
	} else {
		// Fallback to default template
		homeDir, _ := os.UserHomeDir()
		templatePath = filepath.Join(homeDir, ".works", "templates", "book-template.dotm")
	}

	validStyles, err := fts.LoadTemplateStyles(templatePath)
	if err != nil {
		return nil, err
	}

	works, err := a.db.GetCollectionWorks(collID, false)
	if err != nil {
		return nil, err
	}

	// Filter out suppressed works - they are excluded from PDF export
	var includedWorks []models.CollectionWork
	for _, w := range works {
		if !w.IsSuppressed {
			includedWorks = append(includedWorks, w)
		}
	}

	basePath := a.settings.Get().BaseFolderPath
	ftsDB := a.getFTSDB()
	if err := ftsDB.Open(); err != nil {
		return nil, err
	}

	result := &CollectionHeadingAnalysisResult{
		TotalWorks: len(includedWorks),
		Results:    make([]HeadingAnalysisResult, 0, len(includedWorks)),
	}

	for _, w := range includedWorks {
		workResult := HeadingAnalysisResult{
			WorkID: w.WorkID,
			Title:  w.Title,
		}

		if w.SkipAudits {
			workResult.Success = true
			result.Successful++
			result.Results = append(result.Results, workResult)
			continue
		}

		if w.Path == nil || *w.Path == "" {
			workResult.Error = "No file path"
			result.Failed++
			result.Results = append(result.Results, workResult)
			if result.FirstError == nil {
				result.FirstError = &workResult
			}
			continue
		}

		fullPath := filepath.Join(basePath, *w.Path)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			workResult.Error = "File not found"
			result.Failed++
			result.Results = append(result.Results, workResult)
			if result.FirstError == nil {
				result.FirstError = &workResult
			}
			continue
		}

		headings, err := fts.ExtractHeadings(fullPath, validStyles)
		if err != nil {
			workResult.Error = err.Error()
			result.Failed++
			result.Results = append(result.Results, workResult)
			if result.FirstError == nil {
				result.FirstError = &workResult
			}
			continue
		}

		if len(headings.UnknownStyles) > 0 {
			workResult.UnknownStyles = headings.UnknownStyles
			workResult.Error = "Unknown styles found"
			result.Failed++
			result.Results = append(result.Results, workResult)
			if result.FirstError == nil {
				result.FirstError = &workResult
			}
			return result, nil
		}

		workResult.Success = true
		workResult.Headings = headings.Headings
		workResult.Dateline = headings.Dateline

		// Update statistics
		if len(headings.Headings) > 0 {
			result.WorksWithHeadings++
			result.TotalHeadings += len(headings.Headings)
		}
		if headings.Dateline != "" {
			result.WorksWithDateline++
		}

		headingsJSON, _ := json.Marshal(headings.Headings)
		if err := ftsDB.UpdateWorkHeadings(w.WorkID, string(headingsJSON), headings.Dateline); err != nil {
			workResult.Error = err.Error()
			workResult.Success = false
			result.Failed++
		} else {
			result.Successful++
		}

		result.Results = append(result.Results, workResult)
	}

	return result, nil
}

func init() {
	_ = (*sql.DB)(nil)
}
