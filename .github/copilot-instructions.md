# AI Agent Instructions — trueblocks-works

> **Read this file before every task.** These are non-negotiable constraints.

---

## 1. Project Overview

**trueblocks-works** is a Wails desktop application for managing creative writing submissions:

- **Go backend** with SQLite database
- **React/TypeScript frontend** with Mantine UI
- Migrating from FileMaker Pro — see `design/` folder for specs

| Layer           | Technology                                            |
| --------------- | ----------------------------------------------------- |
| Framework       | Wails v2                                              |
| Backend         | Go 1.21+                                              |
| Database        | SQLite 3 (via `modernc.org/sqlite` — pure Go, no CGO) |
| Frontend        | React 18 + TypeScript 5                               |
| UI Library      | Mantine 7                                             |
| Icons           | Tabler Icons                                          |
| Package Manager | Yarn                                                  |

---

## 2. Shell Environment

- **fish shell ONLY** — Never use bash syntax.
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

## 3. Package Management (ZERO TOLERANCE)

- **YARN ONLY** — Never use `npm` or `npx`
- All commands run from repo root: `yarn start`, `yarn build`, `yarn test`, `yarn lint`

---

## 4. Critical Workflow

- **NEVER run `yarn start` or `wails dev`** — These commands block and cause issues. If absolutely necessary, ask the user first and always run with `&` (background).
- **DO NOT RUN YARN COMMANDS** unless explicitly requested by the user
- **EXCEPTION**: Validation commands (`yarn lint --fix; and yarn test`) acceptable after major changes
- **ALWAYS use `--fix`** when running lint commands — never run lint without it
- **Read file contents first** before editing — files change between requests
- **After backend changes**: Run `wails generate module` to update TypeScript bindings
- **File deletion**: Use `rm -f` for files, `rm -R` for folders, ask confirmation first
- **Context updates**: When user renames/refactors, immediately update mental model

---

## 4a. Shorthand Commands

When the user types ONLY these words (no other text), execute the corresponding command:

| User types         | Execute                                                                               | Notes                                                    |
| ------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `lint`             | `cd <repo-root>; and yarn lint --fix; and yarn type-check`                            | Run from repo root                                       |
| `run`              | `cd <repo-root>; and yarn start &`                                                    | Background process, then wait for user                   |
| `push`             | `git add -A; and git commit -m "<message>"; and git push`                             | Short, meaningful commit message based on recent changes |
| `plan`             | Exit design mode, read `ai/Invoker.md` and `ai/Rules.md`, follow instructions therein | Obey checkpoints                                         |
| `discuss <topics>` | Enter design mode focused on discussing `<topics>`                                    | Topics are the text after "discuss"                      |
| `cmds`             | List available tools from `github-pull-request_copilot-coding-agent`                  | Shows coding agent capabilities                          |

**CRITICAL**: The `push` command is the ONLY exception to the "never git commit" rule. Only execute git commands when user types `push` alone on a line. Never run git add/commit/push otherwise.

After `run`, do NOT take any further action — wait for the user to tell you what to do next.

---

## 5. Directory Discipline

- **Never cd into a subfolder and stay there.**
- If you must cd, immediately cd back when done.
- Prefer absolute paths or path arguments instead of cd.

```fish
# WRONG
cd frontend
npm install
npm run build
# (forgot to cd back)

# RIGHT
npm --prefix frontend install
npm --prefix frontend run build

# OR
cd frontend; npm install; cd ..
```

---

## 6. Step-by-Step Mode

When user says "go into step-by-step mode":

🚫 **Never Run:**

- `yarn lint`
- `yarn test`
- `yarn start`

🛑 **Stop Between Steps:**

- Never run amok or jump ahead
- Stop after each step for review and approval
- Wait for "go ahead" before proceeding

📋 **Planning Process:**

- Show what you want to do WITHOUT modifying code first
- Explain WHY you want to make each change
- Wait for approval before making any code changes

🔒 **PERSISTENCE RULE:**

- **ONCE IN STEP-BY-STEP MODE, STAY THERE INDEFINITELY**
- Do NOT exit unless explicitly told "exit step-by-step mode"
- Every action must be approved individually

---

## 7. Design Mode

When user says "go into design mode":

🎨 **MODE IDENTIFIER (REQUIRED):**
Every response MUST start with:

```
🎨 DESIGN MODE | [Can: discuss/analyze] [Cannot: implement/modify code]
```

📋 **Rules:**

- NO full codebase scans upfront
- Discussion-focused for architectural analysis
- Read files just-in-time before discussing specifics
- NO code modifications, builds, tests, or implementations

🚫 **FORBIDDEN PHRASES:**

- "I'll implement...", "Let me create...", "I'll modify...", "I'll add..."

If caught: "I cannot implement code changes while in design mode."

🔒 **NO MODIFICATION RULE:**

- Stay in design mode indefinitely until explicit exit
- Even if user asks to implement: respond "I cannot implement while in design mode"

---

## 8. Mode Switching Rules (CRITICAL)

- **MUTUALLY EXCLUSIVE**: Never be in both design mode and step-by-step mode
- **NO SELF-INITIATED MODE EXITS**: Never exit any mode on your own
- **Only two ways to exit:**
  1. Explicit command: "exit [mode-name] mode"
  2. Command to enter other mode: "go into [other-mode] mode"
- **Mode persistence**: Once in a mode, stay there across all requests

---

## 9. Code Quality Principles

- **No over-engineering**: Simple, boring code that works
- **STOP and THINK**: "What's the simplest solution?"
- **No `any` in TypeScript** — always use specific types
- **No comments in production code** — only for TODO items
- **No commented-out code** — delete it
- Only comment _why_, never _what_
- **Verify with examples**: Before submitting any UI or data change, mentally walk through 3 realistic data examples and verify the output is correct. If you can't convince yourself it works, it doesn't.

---

## 10. Collaboration Protocol

- **Ask early, ask often**: When complexity creeps in, stop and discuss
- **Own mistakes**: Don't blame "someone" — broken code is your responsibility
- **Stop conditions**: Test failures, lint errors, unclear requirements — stop and report

---

## 11. Language Constraints

### Go Backend

- **Never use Python** — not for scripts, not for one-liners, not for "quick" tools
- All backend code, CLI tools, and utilities must be Go
- Use `go run` for quick scripts if needed

### TypeScript/React Frontend

- React 18 + TypeScript 5 + Mantine 7
- No JavaScript files — always `.ts` or `.tsx`
- No class components — functional components only
- No React imports (implicitly available)
- **NEVER use `console.log` or `console.error`** — use Wails logging from `@utils`:
  - `Log()` for info messages
  - `LogErr()` for errors
  - `LogDbg()` for debug
  - `LogWarn()` for warnings

### Go Backend

- Use Wails `runtime.Log*` functions, never `fmt.Println` for user-facing logs

---

## 12. Testing

- Use **Vitest** for all tests, never Jest
- Do not run tests during implementation — user will run and report
- Check existing mocks before creating new ones

---

## 13. VS Code Problems Reset

When VS Code shows stale errors:

```
Cmd+Shift+P → "TypeScript: Restart TS Server"
Cmd+Shift+P → "Developer: Reload Window"
```

---

## 14. Git & GitHub

### Git Operations

- **NEVER run `git add`, `git commit`, or `git push`** unless explicitly told to do so
- **NO exceptions** — even if changes are complete, wait for explicit instruction
- When explicitly told to commit, use clear messages: `feat:`, `fix:`, `refactor:`, `docs:`
- Never commit `node_modules/`, `build/`, or `.db` files

### GitHub Operations

- **ALWAYS use `gh` CLI** for GitHub operations (issues, PRs, releases, etc.)
- Issue management: `gh issue create`, `gh issue close`, `gh issue edit`, `gh issue list`
- Pull requests: `gh pr create`, `gh pr merge`, `gh pr view`, `gh pr list`
- If `gh` CLI cannot accomplish a task, use alternative mechanisms as needed

---

## 15. Project Structure

```
works/
├── main.go                   # Entry point
├── app.go                    # Wails app struct
├── app_*.go                  # Wails bindings by domain
├── internal/
│   ├── db/                   # Database layer
│   └── fileops/              # File operations
├── frontend/
│   └── src/                  # React application
├── design/                   # Specification documents
├── imports/                  # CSV data from FileMaker
└── ai/
    ├── Invoker.md            # Mode switching protocol
    ├── Rules.md              # ToDoList.md creation rules
    └── ToDoList.md           # Current task list (when active)
```

---

## 16. Wails / Yarn Commands

```fish
yarn start      # wails dev (development with hot reload)
yarn build      # wails build (production binary)
yarn test       # run all tests
yarn lint --fix # run linter with auto-fix (ALWAYS use --fix)
yarn test:go    # Go tests only
yarn test:frontend  # frontend tests only
```

- All commands go through `yarn` — check `package.json` for available scripts
- Never run `wails` commands directly unless debugging
- After Go struct changes: `wails generate module`

---

## 17. SQLite Rules

- Use `modernc.org/sqlite` (pure Go, no CGO)
- All queries use `?` placeholders, never string interpolation
- Always close rows: `defer rows.Close()`
- Use transactions for multi-step operations

```go
// WRONG
query := fmt.Sprintf("SELECT * FROM works WHERE id = %d", id)

// RIGHT
query := "SELECT * FROM works WHERE id = ?"
row := db.QueryRow(query, id)
```

---

## 17a. SQLite Migration Safety (CRITICAL)

> **Warning**: Migrations can cause **permanent data loss**. Follow these rules exactly.

### What Went Wrong (January 2026 Incident)

A migration to drop columns from the Works table caused data loss:

1. Migration dropped the Works table
2. Migration failed BEFORE renaming Works_new → Works
3. Result: 1749 records lost, recovered from backup

**Root causes:**

- Migration was NOT wrapped in a transaction
- Views (WorksView, SubmissionsView) depended on Works table
- SQLite's integrity check failed after DROP TABLE but before RENAME

### SQLite Column Drop Pattern

SQLite doesn't support `ALTER TABLE DROP COLUMN` (well). The safe pattern is:

1. Drop ALL views that reference the table
2. Create new table with desired schema
3. Copy data from old table to new table
4. Drop old table
5. Rename new table to original name
6. Recreate ALL views

### Mandatory Migration Rules

1. **ALWAYS wrap migrations in transactions**

   ```go
   func migrateXxx(tx *sql.Tx) error {
       // All operations use tx.Exec(), not db.conn.Exec()
   }
   ```

2. **ALWAYS disable foreign keys inside transactions**

   ```go
   tx.Exec(`PRAGMA foreign_keys = OFF`)
   // ... migration work ...
   // foreign_keys automatically re-enabled after transaction
   ```

3. **ALWAYS use idempotent statements**

   ```go
   tx.Exec(`DROP VIEW IF EXISTS ViewName`)
   tx.Exec(`DROP TABLE IF EXISTS TableName_new`)
   ```

4. **ALWAYS find ALL dependent views BEFORE writing migration**

   ```fish
   sqlite3 ~/.works/works.db "SELECT name, sql FROM sqlite_master WHERE type='view'"
   ```

   Then grep for the table name in each view's SQL.

5. **ALWAYS verify data counts before and after**

   ```fish
   # Before migration
   sqlite3 ~/.works/works.db "SELECT COUNT(*) FROM TableName"

   # After migration
   sqlite3 ~/.works/works.db "SELECT COUNT(*) FROM TableName"
   ```

6. **NEVER run `yarn start` to test a destructive migration**
   - First, copy the database: `cp ~/.works/works.db ~/.works/works_test.db`
   - Test against the copy
   - Only run against production after confirming success

### Migration Template (Table Recreation)

```go
func migrateDropColumns(tx *sql.Tx) error {
    // 1. Drop ALL dependent views (find these FIRST!)
    _, _ = tx.Exec(`DROP VIEW IF EXISTS TableView`)
    _, _ = tx.Exec(`DROP VIEW IF EXISTS OtherDependentView`)

    // 2. Clean up any failed previous attempt
    _, _ = tx.Exec(`DROP TABLE IF EXISTS Table_new`)

    // 3. Create new table with desired schema
    _, err := tx.Exec(`CREATE TABLE Table_new (...)`)
    if err != nil {
        return fmt.Errorf("create Table_new: %w", err)
    }

    // 4. Copy data
    _, err = tx.Exec(`INSERT INTO Table_new (...) SELECT ... FROM Table`)
    if err != nil {
        return fmt.Errorf("copy data: %w", err)
    }

    // 5. Drop old table
    _, err = tx.Exec(`DROP TABLE Table`)
    if err != nil {
        return fmt.Errorf("drop old table: %w", err)
    }

    // 6. Rename new table
    _, err = tx.Exec(`ALTER TABLE Table_new RENAME TO Table`)
    if err != nil {
        return fmt.Errorf("rename table: %w", err)
    }

    // 7. Recreate ALL views
    _, err = tx.Exec(`CREATE VIEW TableView AS ...`)
    if err != nil {
        return fmt.Errorf("recreate view: %w", err)
    }

    return nil
}
```

### Recovery

If data is lost, restore from backup:

```fish
cp ~/.works/backups/works_YYYY-MM-DD_HH-MM-SS_pre-reimport.db ~/.works/works.db
```

---

## 17b. Direct Database Modifications

- **NEVER run `sqlite3` UPDATE or DELETE** commands without explicit "go ahead"
- SELECT queries are fine for investigation
- Same approval requirement as git commits

---

## 18. File Paths

- All paths are **macOS paths** — no Windows consideration
- Use `filepath.Join()`, never string concatenation
- Home directory: `os.UserHomeDir()`
- App data: `~/.local/share/trueblocks/works/`

```go
func getAppDataDir() string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".local", "share", "trueblocks", "works")
}
```

---

## 19. Error Handling

- Always handle errors explicitly — no silent failures
- Use `Result[T]` pattern for Wails bindings (see spec)
- Log errors but show user-friendly messages in UI

---

## 20. Performance Mindset

This is a **single-user desktop app**, not a web service:

- SQLite returns in microseconds — no debouncing needed
- No pagination for lists under 10,000 records
- No caching layers — SQLite is the cache
- No retry logic for "overloaded" scenarios — won't happen

---

## 21. Design Documents

The specification is the source of truth. Key documents:

| Document                       | Purpose              |
| ------------------------------ | -------------------- |
| `design/specification.md`      | Master overview      |
| `design/01-data-model.md`      | Database schema      |
| `design/03-business-logic.md`  | Wails bindings       |
| `design/08-migration-guide.md` | Implementation steps |

When in doubt:

1. Check the design docs in `design/`
2. The spec is the source of truth
3. Ask before deviating from the spec

---

## 22. Runtime Paths

| Path | Purpose |
| --- | --- |
| `~/.works/config.json` | App configuration (base folder, preview path, etc.) |
| `~/.works/works.db` | SQLite database |
| `~/.works/previews/` | PDF preview cache |
| `~/.works/backups/` | Database backups |

The documents base folder is stored in `config.json` as `baseFolderPath`. Work paths in the database (`Works.path`) are relative to this base folder.

---

## 23. ToDoList Workflow

For structured implementation tasks, see:

- `ai/Invoker.md` — Mode switching (Design → Planning → Execution → Meta)
- `ai/Rules.md` — ToDoList.md table format and checkpoint rules

Modes:

- **Design Mode**: Clarify and document; no code changes
- **Planning Mode**: Create/update `ai/ToDoList.md`
- **Execution Mode**: Implement steps in order with checkpoints
- **Meta Mode**: Improve process docs only

---

_Last updated: January 5, 2026_
