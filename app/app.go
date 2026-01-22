package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-works/v2/internal/backup"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/fileops"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/fts"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/migrate"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/server"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/settings"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/state"
	"github.com/TrueBlocks/trueblocks-works/v2/internal/watcher"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	db            *db.DB
	fileOps       *fileops.FileOps
	state         *state.Manager
	backup        *backup.Manager
	settings      *settings.Manager
	fileServer    *server.FileServer
	importSession *ImportSession
	watcher       *watcher.Watcher
}

func NewApp() *App {
	return &App{}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	a.settings = settings.NewManager()
	s := a.settings.Get()

	a.fileOps = fileops.New(fileops.Config{
		BaseFolderPath:       s.BaseFolderPath,
		PDFPreviewPath:       s.PDFPreviewPath,
		SubmissionExportPath: s.SubmissionExportPath,
		TemplateFolderPath:   s.TemplateFolderPath,
	})
	a.state = state.NewManager()

	a.fileServer = server.New(s.PDFPreviewPath)
	_, _ = a.fileServer.Start()

	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".works", "works.db")

	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)

	// Create templates directory
	templatesDir := filepath.Join(homeDir, ".works", "templates")
	_ = os.MkdirAll(templatesDir, 0755)

	a.backup = backup.NewManager(dbPath)
	_, _ = a.backup.AutoBackup()

	database, err := db.New(dbPath)
	if err != nil {
		panic(err)
	}
	a.db = database

	initialized, err := a.db.IsInitialized()
	if err != nil {
		panic(err)
	}
	if !initialized {
		schemaPath := filepath.Join("internal", "migrations", "sql", "001_initial_schema.sql")
		if err := a.db.InitSchemaFromFile(schemaPath); err != nil {
			panic(err)
		}

		importsDir := filepath.Join("imports")
		if _, err := os.Stat(importsDir); err == nil {
			importer := migrate.NewImporter(a.db, importsDir)
			if err := importer.ImportAll(); err != nil {
				panic(err)
			}
		}
	}

	if err := a.db.RunMigrations(); err != nil {
		panic(err)
	}

	fmt.Println(">>> Starting file watcher setup")
	fmt.Printf(">>> BaseFolderPath: %s\n", s.BaseFolderPath)
	runtime.EventsEmit(ctx, "startup:status", map[string]string{"message": "Starting file watcher..."})
	a.watcher = watcher.New(s.BaseFolderPath, a.db.Conn())
	a.watcher.SetLogFunc(func(msg string) {
		fmt.Println(msg)
		runtime.LogInfo(a.ctx, msg)
	})
	a.watcher.SetPDFHandler(a.handlePDFRegeneration)
	a.watcher.SetFTSHandler(a.handleFTSExtraction)
	if err := a.watcher.Start(); err != nil {
		fmt.Printf(">>> Watcher start error: %v\n", err)
		runtime.LogWarning(ctx, "Failed to start file watcher: "+err.Error())
	} else {
		fmt.Println(">>> Watcher started successfully")
	}

	a.processStaleFiles()
}

func (a *App) SaveWindowGeometry(x, y, width, height int) {
	a.state.SetWindowGeometry(x, y, width, height)
}

func (a *App) GetFileServerPort() int {
	if a.fileServer == nil {
		return 0
	}
	return a.fileServer.Port()
}

func (a *App) Shutdown(_ context.Context) {
	if a.watcher != nil {
		a.watcher.Stop()
	}
	// Checkpoint and close FTS database
	if ftsDB != nil && ftsDB.Exists() {
		if conn := ftsDB.Conn(); conn != nil {
			_, _ = conn.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		}
		ftsDB.Close()
	}
	// Checkpoint and close main database
	if a.db != nil {
		_, _ = a.db.Conn().Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		a.db.Close()
	}
}

func (a *App) handlePDFRegeneration(workID int64, filePath string) {
	work, err := a.db.GetWork(workID)
	if err != nil || work == nil {
		return
	}

	if a.fileOps.NeedsRegeneration(filePath, workID) {
		_, err := a.fileOps.GeneratePDF(filePath, workID)
		if err != nil {
			runtime.EventsEmit(a.ctx, "watcher:error", fmt.Sprintf("PDF generation failed: %v", err))
		} else {
			runtime.EventsEmit(a.ctx, "preview:updated", workID)
		}
	}
}

func (a *App) handleFTSExtraction(workID int64, _ string) {
	ftsDB := a.getFTSDB()
	if !ftsDB.Exists() {
		return
	}

	builder := fts.NewIndexBuilder(ftsDB, a.db.Conn(), a.settings.Get().BaseFolderPath)
	_, _ = builder.UpdateSingleWork(workID)
}

func (a *App) processStaleFiles() {
	ftsDB := a.getFTSDB()
	builder := fts.NewIndexBuilder(ftsDB, a.db.Conn(), a.settings.Get().BaseFolderPath)
	staleness, err := builder.CheckStaleness()
	if err != nil {
		return
	}

	for _, workID := range staleness.StaleWorkIDs {
		work, err := a.db.GetWork(int64(workID))
		if err != nil || work == nil || work.Path == nil {
			continue
		}
		fullPath := a.fileOps.GetFilename(*work.Path)
		go a.handlePDFRegeneration(int64(workID), fullPath)
		go a.handleFTSExtraction(int64(workID), fullPath)
	}
}
