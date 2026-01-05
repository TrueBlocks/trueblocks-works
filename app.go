package main

import (
	"context"
	"os"
	"path/filepath"

	"works/internal/backup"
	"works/internal/db"
	"works/internal/fileops"
	"works/internal/migrate"
	"works/internal/server"
	"works/internal/settings"
	"works/internal/state"
)

type App struct {
	ctx        context.Context
	db         *db.DB
	fileOps    *fileops.FileOps
	state      *state.Manager
	backup     *backup.Manager
	settings   *settings.Manager
	fileServer *server.FileServer
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
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

func (a *App) shutdown(_ context.Context) {
	if a.db != nil {
		// Checkpoint WAL to main database file before closing
		_, _ = a.db.Conn().Exec("PRAGMA wal_checkpoint(TRUNCATE)")
		a.db.Close()
	}
}
