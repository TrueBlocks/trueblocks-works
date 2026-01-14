# Platform Notes (macOS)

> **Document:** 16-platform-differences.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0 — Simplified for macOS-only

---

## 1. Overview

This is a **macOS-only** desktop application. No Windows or Linux support is planned.

---

## 2. Keyboard Shortcuts

All shortcuts use `⌘` (Command) as the primary modifier.

| Action | Shortcut | Description |
|--------|----------|-------------|
| Navigate to Collections | `⌘1` | Go to Collections page |
| Navigate to Works | `⌘2` | Go to Works page |
| Navigate to Submissions | `⌘3` | Go to Submissions page |
| Navigate to Organizations | `⌘4` | Go to Organizations page |
| Global Search | `⌘K` | Open search |
| Save | `⌘S` | Save current record |
| New | `⌘N` | Create new record |
| Undo | `⌘Z` | Undo last action |
| Redo | `⌘⇧Z` | Redo |
| Close Window | `⌘W` | Close app |
| Preferences | `⌘,` | Open settings |
| Backup | `⌘⇧B` | Manual backup |

### React Implementation

```typescript
import { useHotkeys } from '@mantine/hooks';

export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate();

  useHotkeys([
    ['mod+1', () => navigate('/')],
    ['mod+2', () => navigate('/works')],
    ['mod+3', () => navigate('/submissions')],
    ['mod+4', () => navigate('/organizations')],
    ['mod+k', () => openSearch()],
    ['mod+n', () => createNew()],
    ['mod+s', () => save()],
    ['mod+shift+z', () => redo()],
  ]);
}
```

---

## 3. File Paths

### Path Conventions

- Separator: `/`
- Home directory: `~` expands to `/Users/{username}`
- Invalid filename characters: `:` and `/`

```go
import (
    "os"
    "path/filepath"
    "strings"
)

func getHomeDir() string {
    home, _ := os.UserHomeDir()
    return home // e.g., "/Users/jrush"
}

func sanitizeFilename(name string) string {
    // Replace invalid characters
    name = strings.ReplaceAll(name, ":", "~")
    name = strings.ReplaceAll(name, "/", "~")
    return name
}
```

---

## 4. Application Locations

### App Data Directory

```
~/Library/Application Support/Submissions/
├── submissions.db           # SQLite database
├── config.json              # User preferences
├── backups/                 # Automatic backups
└── cache/                   # PDF previews
```

```go
func getAppDataDir() string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, "Library", "Application Support", "Submissions")
}
```

### Default Documents Location

```go
func getDefaultBasePath() string {
    home, _ := os.UserHomeDir()
    
    // Check common locations
    candidates := []string{
        filepath.Join(home, "Writing"),
        filepath.Join(home, "Documents", "Writing"),
    }
    
    for _, path := range candidates {
        if dirExists(path) {
            return path
        }
    }
    
    return filepath.Join(home, "Documents", "Writing")
}
```

---

## 5. External Tools

### LibreOffice

Path: `/Applications/LibreOffice.app/Contents/MacOS/soffice`

```go
func getLibreOfficePath() string {
    path := "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if fileExists(path) {
        return path
    }
    return ""
}

func isLibreOfficeInstalled() bool {
    return getLibreOfficePath() != ""
}
```

### Opening Files & URLs

```go
import "os/exec"

func openDocument(path string) error {
    return exec.Command("open", path).Start()
}

func openURL(url string) error {
    return exec.Command("open", url).Start()
}

func revealInFinder(path string) error {
    return exec.Command("open", "-R", path).Start()
}

func openFolder(path string) error {
    return exec.Command("open", path).Start()
}
```

---

## 6. macOS-Specific UI

### System Font

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

code, pre {
  font-family: 'SF Mono', Menlo, monospace;
}
```

### Window Controls

Wails provides native window chrome with standard macOS traffic lights (🔴🟡🟢) in the top-left.

### Menu Bar

The app has a native macOS menu bar with:
- **App Menu**: About, Preferences (⌘,), Quit (⌘Q)
- **File Menu**: New, Save, Backup
- **Edit Menu**: Undo, Redo, Cut, Copy, Paste

---

## 7. Build & Distribution

### Build Command

```bash
wails build -platform darwin/arm64   # Apple Silicon
wails build -platform darwin/amd64   # Intel Mac
wails build -platform darwin/universal # Universal binary
```

### Code Signing

For distribution outside the App Store:

1. Sign with Developer ID
2. Notarize with Apple
3. Staple notarization ticket

```bash
# Sign
codesign --deep --force --verify --verbose \
    --sign "Developer ID Application: Your Name" \
    ./build/bin/Submissions.app

# Notarize
xcrun notarytool submit ./build/bin/Submissions.app.zip \
    --apple-id "your@email.com" \
    --password "@keychain:AC_PASSWORD" \
    --team-id "TEAMID"

# Staple
xcrun stapler staple ./build/bin/Submissions.app
```

---

*End of Platform Notes*
