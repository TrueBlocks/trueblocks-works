package app

import (
	"database/sql"
	"os"
	"sync"
	"time"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/fts"

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

func init() {
	_ = (*sql.DB)(nil)
}
