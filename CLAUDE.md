# Claude Instructions for trueblocks-works

> **Read this file before every task.** These are non-negotiable constraints.

---

## Shell Environment

- **This is a fish shell.** Never use bash syntax.
- No `&&` chaining. Use `; and` or separate commands.
- No `export VAR=value`. Use `set -x VAR value`.
- No `$(command)`. Use `(command)` for command substitution.
- No `[[` conditionals. Use `test` or `[`.
- Never use heredoc.

```fish
# WRONG
cd frontend && npm install
export GOPATH=$HOME/go

# RIGHT
cd frontend; and npm install
set -x GOPATH $HOME/go
```

---

## Directory Discipline

- **Never cd into a subfolder and stay there.**
- If you must cd (e.g., into `frontend/`), immediately cd back when done.
- Prefer absolute paths or run commands with path arguments instead of cd.

```fish
# WRONG
cd frontend
npm install
npm run build
# (forgot to cd back - now all subsequent commands fail)

# RIGHT
npm --prefix frontend install
npm --prefix frontend run build

# OR
cd frontend; npm install; cd ..
```

---

## Language Constraints

### Go Only
- **Never use Python.** Not for scripts, not for one-liners, not for "quick" tools.
- All backend code, CLI tools, and utilities must be Go.
- Use `go run` for quick scripts if needed.

### TypeScript/React Only (Frontend)
- Frontend is React 18 + TypeScript 5 + Mantine 7.
- No JavaScript files. Always `.ts` or `.tsx`.
- No class components. Functional components only.

---

## Code Style

### Comments
- **Keep comments to a bare minimum.**
- No obvious comments like `// increment counter` or `// return the result`.
- Only comment *why*, never *what*.
- No commented-out code. Delete it.

```go
// WRONG
// This function gets a work by ID
// It takes an ID parameter
// It returns a Work struct
func GetWork(id int) Work {
    // Query the database
    // ...
}

// RIGHT
func GetWork(id int) Work {
    // Uses FTS index for O(1) lookup
    ...
}
```

### Error Handling
- Always handle errors explicitly. No silent failures.
- Use the `Result[T]` pattern from the spec for Wails bindings.
- Log errors but show user-friendly messages in UI.

---

## Wails / Yarn

- Wails project root is the repo root.
- Frontend lives in `frontend/`.
- Go code lives in root and `internal/`.
- **Always use yarn commands** — they alias to the underlying tools.

```fish
# WRONG
wails dev
npm run build
cd frontend && npm test

# RIGHT
yarn start      # aliases to wails dev
yarn build      # aliases to wails build
yarn test       # run tests
yarn lint       # run linter
```

- All build, test, lint, and dev commands go through `yarn`.
- Check `package.json` scripts for available commands.
- Never run `wails` commands directly unless debugging.

---

## SQLite

- Use `modernc.org/sqlite` (pure Go, no CGO).
- All queries use `?` placeholders, never string interpolation.
- Always close rows: `defer rows.Close()`.
- Use transactions for multi-step operations.

---

## File Paths

- All paths are macOS paths. No Windows consideration.
- Use `filepath.Join()`, never string concatenation.
- Home directory: `os.UserHomeDir()`.
- App data: `~/.local/share/trueblocks/<app-name>/` (e.g., `~/.local/share/trueblocks/works/`).

```go
func getAppDataDir(appName string) string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".local", "share", "trueblocks", appName)
}
```

---

## Testing

- **Use yarn for all test commands:**
  - `yarn test` — run all tests
  - `yarn test:go` — Go tests only
  - `yarn test:frontend` — frontend tests only
- Run from repo root, never cd into subdirectories.
- No test files in production code directories.

---

## Git

- Commit early and often.
- Clear commit messages: `feat:`, `fix:`, `refactor:`, `docs:`.
- Never commit `node_modules/`, `build/`, or `.db` files.

---

## Performance Mindset

- This is a **single-user desktop app**, not a web service.
- SQLite returns in microseconds. No debouncing needed.
- No pagination for lists under 10,000 records.
- No caching layers. SQLite is the cache.
- No retry logic for "overloaded" scenarios. Won't happen.

---

## When in Doubt

1. Check the design docs in `design/`.
2. The spec is the source of truth.
3. Ask before deviating from the spec.

---

*Last updated: January 3, 2026*
