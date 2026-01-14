# Works

A desktop application for managing creative writing submissions, built with Wails, Go, React, and TypeScript.

## Overview

Works helps writers track their creative work (poems, stories, essays) and manage submissions to literary journals. It replaces a legacy FileMaker Pro database with a modern, cross-platform desktop app.

## Features

- **Works Management**: Create, edit, and organize creative works with metadata (title, type, year, quality, status)
- **Organizations**: Track literary journals, magazines, and publishers with URLs and Duotrope integration
- **Submissions**: Log and monitor submission history between works and organizations
- **Collections**: Group works into collections (both status-based and manual)
- **Notes**: Attach notes to works and organizations with timestamps
- **File Management**: 
  - Auto-generate file paths based on work metadata
  - PDF preview generation using LibreOffice
  - Open documents in default editor
  - Print documents
  - Export submission packages
- **Search**: Full-text search across works and organizations (⌘K)
  - **Metadata search**: Search titles, notes, and fields
  - **Content search**: Search inside DOCX and Markdown files (requires building index)
- **Backup/Restore**: Automatic backups with manual restore capability (⌘⇧B)
- **Settings**: Configurable folder paths and LibreOffice location
- **First-Run Wizard**: Guided setup for new installations

### Full-Text Content Search

The app can index and search the content of your DOCX and Markdown files:

1. Go to **Settings** → **Search** tab
2. Click **Build Index** to extract text from all documents
3. Use **⌘K** and click the database icon to switch to content search

The index is stored separately in `~/.works/fulltext.db` and can be rebuilt at any time.

## Tech Stack

- **Backend**: Go 1.24+ with SQLite (modernc.org/sqlite - pure Go, no CGO)
- **Frontend**: React 18 + TypeScript 5 + Mantine 8.3
- **Framework**: Wails v2
- **Package Manager**: Yarn

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Open search |
| ⌘⇧B | Open backup/restore |
| ⌘1 | Go to Works |
| ⌘2 | Go to Organizations |
| ⌘3 | Go to Submissions |
| ⌘4 | Go to Collections |

## Development

### Prerequisites

- Go 1.24+
- Node.js 18+
- Yarn
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- LibreOffice (optional, for PDF generation)

### Live Development

```fish
cd /path/to/works
wails dev
```

This runs a Vite dev server with hot reload. The Go backend is available at http://localhost:34115.

### Building

```fish
wails build
```

Creates a redistributable production package in `build/bin/`.

### After Go Changes

Regenerate TypeScript bindings:

```fish
wails generate module
```

## Project Structure

```
works/
├── app_*.go          # Wails bindings (frontend-callable functions)
├── main.go           # App entry point
├── internal/
│   ├── db/           # Database operations
│   ├── models/       # Data models
│   ├── fileops/      # File operations
│   ├── backup/       # Backup management
│   ├── settings/     # Settings persistence
│   └── state/        # App state persistence
├── frontend/
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       └── hooks/       # Custom hooks
├── design/           # Specification documents
└── ai/               # AI agent instructions
```

## Data Storage

All data is stored in `~/.works/`:
- `works.db` - SQLite database (main data)
- `fulltext.db` - SQLite FTS5 database (content search index)
- `config.json` - Settings
- `state.json` - UI state persistence
- `backups/` - Automatic backups
- `previews/` - Generated PDF previews

## License

See [LICENSE](LICENSE) file.
