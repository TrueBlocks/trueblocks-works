package watcher

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type ChangeHandler func(workID int64, filePath string)
type LogFunc func(msg string)

type Watcher struct {
	basePath      string
	db            *sql.DB
	debounceDelay time.Duration
	onPDFNeeded   ChangeHandler
	onFTSNeeded   ChangeHandler
	logFunc       LogFunc

	watcher  *fsnotify.Watcher
	stopChan chan struct{}
	wg       sync.WaitGroup

	mu       sync.Mutex
	debounce map[string]*time.Timer
}

func New(basePath string, db *sql.DB) *Watcher {
	return &Watcher{
		basePath:      basePath,
		db:            db,
		debounceDelay: 3 * time.Second,
		stopChan:      make(chan struct{}),
		debounce:      make(map[string]*time.Timer),
		logFunc:       func(msg string) { fmt.Println(msg) },
	}
}

func (w *Watcher) SetLogFunc(f LogFunc) {
	w.logFunc = f
}

func (w *Watcher) log(format string, args ...interface{}) {
	if w.logFunc != nil {
		w.logFunc(fmt.Sprintf(format, args...))
	}
}

func (w *Watcher) SetPDFHandler(handler ChangeHandler) {
	w.onPDFNeeded = handler
}

func (w *Watcher) SetFTSHandler(handler ChangeHandler) {
	w.onFTSNeeded = handler
}

func (w *Watcher) getWorkDirectories() ([]string, error) {
	rows, err := w.db.Query(`SELECT DISTINCT path FROM Works WHERE path IS NOT NULL AND path != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dirSet := make(map[string]bool)
	for rows.Next() {
		var relPath string
		if err := rows.Scan(&relPath); err != nil {
			continue
		}
		dir := filepath.Dir(relPath)
		absDir := filepath.Join(w.basePath, dir)
		if _, err := os.Stat(absDir); err == nil {
			dirSet[absDir] = true
		}
	}

	dirs := make([]string, 0, len(dirSet))
	for dir := range dirSet {
		dirs = append(dirs, dir)
	}
	return dirs, nil
}

func (w *Watcher) Start() error {
	w.log("[watcher] Starting file watcher...")

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		w.log("[watcher] Failed to create watcher: %v", err)
		return err
	}
	w.watcher = watcher

	dirs, err := w.getWorkDirectories()
	if err != nil {
		w.log("[watcher] Failed to get work directories: %v", err)
		watcher.Close()
		return err
	}

	for _, dir := range dirs {
		if err := watcher.Add(dir); err != nil {
			w.log("[watcher] Failed to watch %s: %v", dir, err)
			// } else {
			// 	w.log("[watcher] Watching: %s", dir)
		}
	}

	w.log("[watcher] Watching %d directories", len(dirs))
	w.wg.Add(1)
	go w.processEvents()

	return nil
}

func (w *Watcher) Stop() {
	close(w.stopChan)
	if w.watcher != nil {
		w.watcher.Close()
	}
	w.wg.Wait()

	w.mu.Lock()
	for _, timer := range w.debounce {
		timer.Stop()
	}
	w.debounce = make(map[string]*time.Timer)
	w.mu.Unlock()
}

func (w *Watcher) processEvents() {
	defer w.wg.Done()

	for {
		select {
		case <-w.stopChan:
			return
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) != 0 {
				w.handleEvent(event.Name)
			}
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			w.log("[watcher] Error: %v", err)
		}
	}
}

func (w *Watcher) handleEvent(path string) {
	filename := filepath.Base(path)
	if strings.HasPrefix(filename, "~") || strings.HasPrefix(filename, ".~") {
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		return
	}
	if info.IsDir() {
		return
	}

	w.mu.Lock()
	_, inCooldown := w.debounce[path]
	if inCooldown {
		w.mu.Unlock()
		return
	}
	w.debounce[path] = time.AfterFunc(w.debounceDelay, func() {
		w.mu.Lock()
		delete(w.debounce, path)
		w.mu.Unlock()
	})
	w.mu.Unlock()

	go w.processFileChange(path)
}

func (w *Watcher) processFileChange(path string) {
	// Skip temp files and staging files used during atomic replacement
	filename := filepath.Base(path)
	if strings.HasSuffix(filename, ".tmp") || strings.HasSuffix(filename, ".new") || strings.HasSuffix(filename, ".bak.docx") {
		return
	}

	workID, err := w.lookupWorkByPath(path)
	if err != nil {
		return
	}
	if workID == 0 {
		return
	}

	// Verify file is accessible and complete before processing
	// This helps avoid race conditions during atomic file replacement
	if !w.isFileAccessible(path) {
		w.log("[watcher] File not accessible yet, skipping: %s", path)
		return
	}

	if err := w.updateFileMtime(workID, path); err != nil {
		w.log("[watcher] Failed to update mtime: %v", err)
		return
	}

	if w.onPDFNeeded != nil {
		go w.onPDFNeeded(workID, path)
	}

	if w.onFTSNeeded != nil {
		go w.onFTSNeeded(workID, path)
	}
}

// isFileAccessible checks if a file can be opened and read
// This helps detect if a file is still being written or replaced
func (w *Watcher) isFileAccessible(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	// Try to read a small amount to verify file is complete
	buf := make([]byte, 4)
	_, err = f.Read(buf)
	return err == nil
}

func (w *Watcher) lookupWorkByPath(absPath string) (int64, error) {
	relPath, err := filepath.Rel(w.basePath, absPath)
	if err != nil {
		return 0, err
	}

	var workID int64
	err = w.db.QueryRow(`SELECT workID FROM Works WHERE path = ?`, relPath).Scan(&workID)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return workID, nil
}

func (w *Watcher) updateFileMtime(workID int64, path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	mtime := info.ModTime().Unix()

	_, err = w.db.Exec(`UPDATE Works SET file_mtime = ? WHERE workID = ?`, mtime, workID)
	return err
}
