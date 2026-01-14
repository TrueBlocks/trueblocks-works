package fts

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type ProgressCallback func(progress BuildProgress)

type IndexBuilder struct {
	ftsDB      *Database
	mainDB     *sql.DB
	basePath   string
	onProgress ProgressCallback
}

func NewIndexBuilder(ftsDB *Database, mainDB *sql.DB, basePath string) *IndexBuilder {
	return &IndexBuilder{
		ftsDB:    ftsDB,
		mainDB:   mainDB,
		basePath: basePath,
	}
}

func (b *IndexBuilder) SetProgressCallback(cb ProgressCallback) {
	b.onProgress = cb
}

func (b *IndexBuilder) emitProgress(progress BuildProgress) {
	if b.onProgress != nil {
		b.onProgress(progress)
	}
}

func (b *IndexBuilder) BuildFull() (*BuildReport, error) {
	start := time.Now()
	report := &BuildReport{Errors: []string{}}

	if err := b.ftsDB.Open(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	works, err := b.getWorks()
	if err != nil {
		return nil, fmt.Errorf("get works: %w", err)
	}

	b.emitProgress(BuildProgress{
		Phase: "preparing",
		Total: len(works),
	})

	conn := b.ftsDB.Conn()
	if _, err := conn.Exec("DELETE FROM content"); err != nil {
		return nil, fmt.Errorf("clear content: %w", err)
	}

	tx, err := conn.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.Prepare(`
		INSERT INTO content (work_id, text_content, word_count, extracted_at, source_mtime, source_size)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	var totalWords int
	for i, work := range works {
		b.emitProgress(BuildProgress{
			Phase:       "extracting",
			Current:     i + 1,
			Total:       len(works),
			CurrentFile: work.Path,
			Errors:      report.Errors,
		})

		result := b.extractWork(work)
		if result.Error != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", work.Path, result.Error))
			continue
		}

		_, err := stmt.Exec(
			result.WorkID,
			result.TextContent,
			result.WordCount,
			result.ExtractedAt.Format(time.RFC3339),
			result.SourceMtime,
			result.SourceSize,
		)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: insert failed: %v", work.Path, err))
			continue
		}

		totalWords += result.WordCount
		report.DocumentCount++

		if err := b.updateWordCount(work.WorkID, result.WordCount); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: update n_words failed: %v", work.Path, err))
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	report.WordCount = totalWords
	report.Duration = time.Since(start).Seconds()
	report.Success = true

	now := time.Now().Format(time.RFC3339)
	_ = b.ftsDB.SetMeta("last_full_build", now)
	_ = b.ftsDB.SetMeta("document_count", strconv.Itoa(report.DocumentCount))
	_ = b.ftsDB.SetMeta("total_words", strconv.Itoa(totalWords))

	b.emitProgress(BuildProgress{
		Phase:   "complete",
		Current: len(works),
		Total:   len(works),
		Errors:  report.Errors,
	})

	return report, nil
}

func (b *IndexBuilder) UpdateIncremental() (*BuildReport, error) {
	start := time.Now()
	report := &BuildReport{Errors: []string{}}

	if err := b.ftsDB.Open(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	staleness, err := b.CheckStaleness()
	if err != nil {
		return nil, fmt.Errorf("check staleness: %w", err)
	}

	toUpdate := append(staleness.StaleWorkIDs, staleness.MissingWorkIDs...)
	if len(toUpdate) == 0 {
		report.Success = true
		return report, nil
	}

	works, err := b.getWorksByIDs(toUpdate)
	if err != nil {
		return nil, fmt.Errorf("get works: %w", err)
	}

	b.emitProgress(BuildProgress{
		Phase: "updating",
		Total: len(works),
	})

	conn := b.ftsDB.Conn()
	var totalWords int

	for i, work := range works {
		b.emitProgress(BuildProgress{
			Phase:       "extracting",
			Current:     i + 1,
			Total:       len(works),
			CurrentFile: work.Path,
			Errors:      report.Errors,
		})

		result := b.extractWork(work)
		if result.Error != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", work.Path, result.Error))
			continue
		}

		_, err := conn.Exec(`
			INSERT INTO content (work_id, text_content, word_count, extracted_at, source_mtime, source_size)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(work_id) DO UPDATE SET
				text_content = excluded.text_content,
				word_count = excluded.word_count,
				extracted_at = excluded.extracted_at,
				source_mtime = excluded.source_mtime,
				source_size = excluded.source_size
		`,
			result.WorkID,
			result.TextContent,
			result.WordCount,
			result.ExtractedAt.Format(time.RFC3339),
			result.SourceMtime,
			result.SourceSize,
		)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: upsert failed: %v", work.Path, err))
			continue
		}

		totalWords += result.WordCount
		report.DocumentCount++

		if err := b.updateWordCount(work.WorkID, result.WordCount); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: update n_words failed: %v", work.Path, err))
		}
	}

	report.WordCount = totalWords
	report.Duration = time.Since(start).Seconds()
	report.Success = true

	b.emitProgress(BuildProgress{
		Phase:   "complete",
		Current: len(works),
		Total:   len(works),
		Errors:  report.Errors,
	})

	return report, nil
}

func (b *IndexBuilder) CheckStaleness() (*StalenessReport, error) {
	report := &StalenessReport{}

	works, err := b.getWorks()
	if err != nil {
		return nil, fmt.Errorf("get works: %w", err)
	}
	report.TotalWorks = len(works)

	if !b.ftsDB.Exists() {
		report.MissingWorks = len(works)
		for _, w := range works {
			report.MissingWorkIDs = append(report.MissingWorkIDs, w.WorkID)
		}
		return report, nil
	}

	if err := b.ftsDB.Open(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	indexed := make(map[int]int64)
	rows, err := b.ftsDB.Conn().Query("SELECT work_id, source_mtime FROM content")
	if err != nil {
		return nil, fmt.Errorf("query content: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var workID int
		var mtime int64
		if err := rows.Scan(&workID, &mtime); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		indexed[workID] = mtime
		report.IndexedWorks++
	}

	workIDs := make(map[int]bool)
	for _, work := range works {
		workIDs[work.WorkID] = true
		indexedMtime, exists := indexed[work.WorkID]
		if !exists {
			report.MissingWorks++
			report.MissingWorkIDs = append(report.MissingWorkIDs, work.WorkID)
			continue
		}

		fullPath := filepath.Join(b.basePath, work.Path)
		info, err := os.Stat(fullPath)
		if err != nil {
			continue
		}

		if info.ModTime().Unix() > indexedMtime {
			report.StaleWorks++
			report.StaleWorkIDs = append(report.StaleWorkIDs, work.WorkID)
		}
	}

	for workID := range indexed {
		if !workIDs[workID] {
			report.OrphanedWorks++
		}
	}

	return report, nil
}

func (b *IndexBuilder) extractWork(work WorkInfo) ExtractionResult {
	fullPath := filepath.Join(b.basePath, work.Path)

	info, err := os.Stat(fullPath)
	if err != nil {
		return ExtractionResult{WorkID: work.WorkID, Error: err}
	}

	text, err := ExtractByType(fullPath, work.DocType)
	if err != nil {
		return ExtractionResult{WorkID: work.WorkID, Error: err}
	}

	return ExtractionResult{
		WorkID:      work.WorkID,
		TextContent: text,
		WordCount:   CountWords(text),
		ExtractedAt: time.Now(),
		SourceMtime: info.ModTime().Unix(),
		SourceSize:  info.Size(),
	}
}

func (b *IndexBuilder) getWorks() ([]WorkInfo, error) {
	rows, err := b.mainDB.Query(`
		SELECT workID, title, type, year, status, doc_type, path
		FROM Works
		WHERE path IS NOT NULL AND path != ''
		AND doc_type IN ('docx', 'md', 'txt')
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []WorkInfo
	for rows.Next() {
		var w WorkInfo
		if err := rows.Scan(&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.DocType, &w.Path); err != nil {
			return nil, err
		}
		works = append(works, w)
	}

	return works, rows.Err()
}

func (b *IndexBuilder) getWorksByIDs(ids []int) ([]WorkInfo, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	query := `
		SELECT workID, title, type, year, status, doc_type, path
		FROM Works
		WHERE workID IN (`
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		if i > 0 {
			query += ","
		}
		query += "?"
		args[i] = id
	}
	query += ")"

	rows, err := b.mainDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var works []WorkInfo
	for rows.Next() {
		var w WorkInfo
		if err := rows.Scan(&w.WorkID, &w.Title, &w.Type, &w.Year, &w.Status, &w.DocType, &w.Path); err != nil {
			return nil, err
		}
		works = append(works, w)
	}

	return works, rows.Err()
}

func (b *IndexBuilder) updateWordCount(workID, wordCount int) error {
	_, err := b.mainDB.Exec("UPDATE Works SET n_words = ? WHERE workID = ?", wordCount, workID)
	return err
}

func (b *IndexBuilder) UpdateSingleWork(workID int64) (*BuildReport, error) {
	report := &BuildReport{Errors: []string{}}

	if err := b.ftsDB.Open(); err != nil {
		return nil, fmt.Errorf("open fts database: %w", err)
	}

	works, err := b.getWorksByIDs([]int{int(workID)})
	if err != nil {
		return nil, fmt.Errorf("get work: %w", err)
	}
	if len(works) == 0 {
		return report, nil
	}

	work := works[0]
	result := b.extractWork(work)
	if result.Error != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", work.Path, result.Error))
		return report, nil
	}

	conn := b.ftsDB.Conn()
	_, err = conn.Exec(`
		INSERT INTO content (work_id, text_content, word_count, extracted_at, source_mtime, source_size)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(work_id) DO UPDATE SET
			text_content = excluded.text_content,
			word_count = excluded.word_count,
			extracted_at = excluded.extracted_at,
			source_mtime = excluded.source_mtime,
			source_size = excluded.source_size
	`,
		result.WorkID,
		result.TextContent,
		result.WordCount,
		result.ExtractedAt.Format(time.RFC3339),
		result.SourceMtime,
		result.SourceSize,
	)
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("%s: insert failed: %v", work.Path, err))
		return report, nil
	}

	if err := b.updateWordCount(int(workID), result.WordCount); err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("%s: update n_words failed: %v", work.Path, err))
	}

	report.DocumentCount = 1
	report.WordCount = result.WordCount
	report.Success = true
	return report, nil
}
