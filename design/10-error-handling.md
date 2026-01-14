# Error Handling Specification

> **Document:** 10-error-handling.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Error Categories](#2-error-categories)
3. [Go Backend Error Handling](#3-go-backend-error-handling)
4. [React Frontend Error Display](#4-react-frontend-error-display)
5. [File System Errors](#5-file-system-errors)
6. [Database Errors](#6-database-errors)
7. [Validation Errors](#7-validation-errors)
8. [Network Errors](#8-network-errors)
9. [Recovery Strategies](#9-recovery-strategies)
10. [Logging](#10-logging)

---

## 1. Overview

### 1.1 Design Principles

1. **Never lose user data** — Always prefer to save partial data over losing everything
2. **Fail gracefully** — Show helpful error messages, not stack traces
3. **Suggest recovery** — Tell users what they can do to fix the problem
4. **Log everything** — Keep detailed logs for debugging, separate from user messages
5. **Optimistic UI with rollback** — Show success immediately, rollback if operation fails

### 1.2 Error Severity Levels

| Level | Description | User Impact | Example |
|-------|-------------|-------------|---------|
| **Fatal** | App cannot continue | Must restart | Database corruption |
| **Error** | Operation failed | Action not completed | File not found |
| **Warning** | Partial success | Some data affected | 3 of 5 files moved |
| **Info** | Informational | No impact | File already exists |

---

## 2. Error Categories

### 2.1 Error Type Taxonomy

```go
// internal/errors/errors.go
package errors

type ErrorCategory string

const (
    CategoryFile       ErrorCategory = "file"
    CategoryDatabase   ErrorCategory = "database"
    CategoryValidation ErrorCategory = "validation"
    CategoryNetwork    ErrorCategory = "network"
    CategoryState      ErrorCategory = "state"
)

type AppError struct {
    Category    ErrorCategory `json:"category"`
    Code        string        `json:"code"`
    Message     string        `json:"message"`      // User-friendly message
    Detail      string        `json:"detail"`       // Technical detail
    Recoverable bool          `json:"recoverable"`
    Suggestions []string      `json:"suggestions"`  // Recovery suggestions
}

func (e *AppError) Error() string {
    return fmt.Sprintf("[%s] %s: %s", e.Category, e.Code, e.Message)
}
```

### 2.2 Standard Error Codes

| Code | Category | Message | Suggestions |
|------|----------|---------|-------------|
| `FILE_NOT_FOUND` | file | "The file could not be found" | "Check if the file was moved or renamed", "Use 'Relocate File' to update the path" |
| `FILE_PERMISSION` | file | "Permission denied" | "Check file permissions in Finder", "Make sure the file isn't locked" |
| `FILE_IN_USE` | file | "File is open in another application" | "Close the file in Word/Preview and try again" |
| `DB_LOCKED` | database | "Database is busy" | "Wait a moment and try again", "Check if another instance is running" |
| `DB_CONSTRAINT` | database | "This record cannot be saved" | "Check for duplicate values", "Ensure required fields are filled" |
| `DB_NOT_FOUND` | database | "Record not found" | "The record may have been deleted", "Refresh the list" |
| `VAL_REQUIRED` | validation | "This field is required" | "Enter a value for {field}" |
| `VAL_INVALID` | validation | "Invalid value" | "Expected {format}" |
| `VAL_DUPLICATE` | validation | "This value already exists" | "Choose a different {field}" |
| `NET_TIMEOUT` | network | "Connection timed out" | "Check your internet connection", "The website may be down" |
| `NET_UNREACHABLE` | network | "Could not reach server" | "Check your internet connection" |
| `STATE_SYNC` | state | "Changes could not be saved" | "Your changes will be retried", "Check the error log" |

---

## 3. Go Backend Error Handling

### 3.1 Wails Method Pattern

All Wails-bound methods return a consistent result structure:

```go
// internal/result/result.go
package result

type Result[T any] struct {
    Success bool       `json:"success"`
    Data    T          `json:"data,omitempty"`
    Error   *AppError  `json:"error,omitempty"`
}

func Ok[T any](data T) Result[T] {
    return Result[T]{Success: true, Data: data}
}

func Fail[T any](err *AppError) Result[T] {
    return Result[T]{Success: false, Error: err}
}
```

### 3.2 Example: Save Work

```go
// app_works.go
func (a *App) SaveWork(work models.Work) result.Result[models.Work] {
    // Validate
    if err := work.Validate(); err != nil {
        return result.Fail[models.Work](&errors.AppError{
            Category:    errors.CategoryValidation,
            Code:        "VAL_INVALID",
            Message:     "Work could not be saved",
            Detail:      err.Error(),
            Recoverable: true,
            Suggestions: []string{"Check that all required fields are filled"},
        })
    }
    
    // Save to database
    saved, err := a.db.SaveWork(work)
    if err != nil {
        // Check for specific database errors
        if errors.Is(err, sql.ErrNoRows) {
            return result.Fail[models.Work](&errors.AppError{
                Category:    errors.CategoryDatabase,
                Code:        "DB_NOT_FOUND",
                Message:     "Work not found",
                Detail:      fmt.Sprintf("workID=%d", work.WorkID),
                Recoverable: false,
            })
        }
        
        // Generic database error
        a.logger.Error("SaveWork failed", "workID", work.WorkID, "error", err)
        return result.Fail[models.Work](&errors.AppError{
            Category:    errors.CategoryDatabase,
            Code:        "DB_ERROR",
            Message:     "Could not save work",
            Detail:      err.Error(),
            Recoverable: true,
            Suggestions: []string{"Try again", "Check the error log"},
        })
    }
    
    return result.Ok(saved)
}
```

### 3.3 Transaction Wrapper

```go
// internal/db/tx.go
func (db *DB) WithTransaction(fn func(tx *sql.Tx) error) error {
    tx, err := db.conn.Begin()
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    
    defer func() {
        if p := recover(); p != nil {
            tx.Rollback()
            panic(p) // re-throw after rollback
        }
    }()
    
    if err := fn(tx); err != nil {
        if rbErr := tx.Rollback(); rbErr != nil {
            return fmt.Errorf("rollback failed: %v (original: %w)", rbErr, err)
        }
        return err
    }
    
    return tx.Commit()
}
```

---

## 4. React Frontend Error Display

### 4.1 Error Context Provider

```typescript
// src/contexts/ErrorContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

interface AppError {
  category: string;
  code: string;
  message: string;
  detail?: string;
  recoverable: boolean;
  suggestions?: string[];
}

interface ErrorContextType {
  lastError: AppError | null;
  showError: (error: AppError) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [lastError, setLastError] = useState<AppError | null>(null);

  const showError = useCallback((error: AppError) => {
    setLastError(error);
    
    notifications.show({
      title: error.message,
      message: error.suggestions?.join('. ') || error.detail,
      color: 'red',
      icon: <IconX size={16} />,
      autoClose: error.recoverable ? 5000 : false,
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    notifications.show({
      title: 'Warning',
      message,
      color: 'yellow',
      icon: <IconAlertTriangle size={16} />,
      autoClose: 4000,
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    notifications.show({
      title: 'Info',
      message,
      color: 'blue',
      icon: <IconInfoCircle size={16} />,
      autoClose: 3000,
    });
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  return (
    <ErrorContext.Provider value={{ lastError, showError, showWarning, showInfo, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used within ErrorProvider');
  return ctx;
}
```

### 4.2 Wails Call Wrapper

```typescript
// src/utils/api.ts
import { useError } from '../contexts/ErrorContext';

interface Result<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}

export function useApi() {
  const { showError } = useError();

  async function call<T>(fn: () => Promise<Result<T>>): Promise<T | null> {
    try {
      const result = await fn();
      
      if (!result.success && result.error) {
        showError(result.error);
        return null;
      }
      
      return result.data ?? null;
    } catch (e) {
      // Unexpected error (Wails bridge failure, etc.)
      showError({
        category: 'state',
        code: 'UNEXPECTED',
        message: 'An unexpected error occurred',
        detail: String(e),
        recoverable: true,
        suggestions: ['Try again', 'Restart the application'],
      });
      return null;
    }
  }

  return { call };
}
```

### 4.3 Usage Example

```typescript
// src/pages/WorkDetailPage.tsx
function WorkDetailPage() {
  const { call } = useApi();
  const [work, setWork] = useState<Work | null>(null);

  const saveWork = async () => {
    // Optimistic UI update
    const previousWork = work;
    setWork({ ...work!, ...formValues });

    const saved = await call(() => SaveWork(formValues));
    
    if (!saved) {
      // Rollback on failure
      setWork(previousWork);
    }
  };
}
```

### 4.4 Error Boundary

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';
import { Container, Title, Text, Button, Stack } from '@mantine/core';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('React Error Boundary caught:', error, info);
    // Log to backend
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container size="sm" py="xl">
          <Stack align="center" gap="md">
            <Title order={2}>Something went wrong</Title>
            <Text c="dimmed">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button onClick={() => window.location.reload()}>
              Reload Application
            </Button>
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}
```

---

## 5. File System Errors

### 5.1 Common File Errors

| Error | Cause | User Message | Recovery |
|-------|-------|--------------|----------|
| `ENOENT` | File doesn't exist | "File not found at {path}" | Show Relocate dialog |
| `EACCES` | Permission denied | "Cannot access file" | Check Finder permissions |
| `EBUSY` | File locked/in use | "File is open in another app" | Close other app |
| `ENOSPC` | Disk full | "Not enough disk space" | Free up space |
| `EROFS` | Read-only filesystem | "Cannot write to this location" | Choose different folder |

### 5.2 File Relocate Dialog

When a file cannot be found at the expected path:

```go
// app_files.go
func (a *App) RelocateFile(workID int) result.Result[string] {
    // Open native file picker
    path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
        Title: "Locate File",
        Filters: []runtime.FileFilter{
            {DisplayName: "Documents", Pattern: "*.docx;*.rtf;*.txt"},
        },
    })
    
    if err != nil || path == "" {
        return result.Fail[string](&errors.AppError{
            Category:    errors.CategoryFile,
            Code:        "FILE_CANCELLED",
            Message:     "File selection cancelled",
            Recoverable: true,
        })
    }
    
    // Update the work's path
    if err := a.db.UpdateWorkPath(workID, path); err != nil {
        return result.Fail[string](&errors.AppError{
            Category:    errors.CategoryDatabase,
            Code:        "DB_ERROR",
            Message:     "Could not update file path",
            Recoverable: true,
        })
    }
    
    return result.Ok(path)
}
```

### 5.3 Batch File Operation Errors

When moving/copying multiple files, report partial success:

```go
type BatchResult struct {
    Succeeded []string `json:"succeeded"`
    Failed    []struct {
        Path  string    `json:"path"`
        Error *AppError `json:"error"`
    } `json:"failed"`
}

func (a *App) MoveFiles(workIDs []int, destFolder string) result.Result[BatchResult] {
    batch := BatchResult{}
    
    for _, id := range workIDs {
        if err := a.moveWorkFile(id, destFolder); err != nil {
            batch.Failed = append(batch.Failed, struct {
                Path  string    `json:"path"`
                Error *AppError `json:"error"`
            }{
                Path:  a.getWorkPath(id),
                Error: err,
            })
        } else {
            batch.Succeeded = append(batch.Succeeded, a.getWorkPath(id))
        }
    }
    
    return result.Ok(batch)
}
```

---

## 6. Database Errors

### 6.1 SQLite-Specific Errors

| SQLite Code | Meaning | Handling |
|-------------|---------|----------|
| `SQLITE_BUSY` | Database locked | Retry with exponential backoff |
| `SQLITE_LOCKED` | Table locked | Retry with backoff |
| `SQLITE_CONSTRAINT` | Constraint violation | Parse which constraint, show specific message |
| `SQLITE_CORRUPT` | Database corruption | **Fatal** — backup and recover |
| `SQLITE_FULL` | Disk full | Free disk space |

### 6.2 Retry Logic

```go
// internal/db/retry.go
func (db *DB) WithRetry(fn func() error) error {
    maxRetries := 3
    baseDelay := 100 * time.Millisecond
    
    var lastErr error
    for i := 0; i < maxRetries; i++ {
        err := fn()
        if err == nil {
            return nil
        }
        
        // Check if retryable
        if !isRetryable(err) {
            return err
        }
        
        lastErr = err
        delay := baseDelay * time.Duration(1<<i) // Exponential backoff
        time.Sleep(delay)
    }
    
    return fmt.Errorf("after %d retries: %w", maxRetries, lastErr)
}

func isRetryable(err error) bool {
    var sqliteErr *sqlite.Error
    if errors.As(err, &sqliteErr) {
        switch sqliteErr.Code() {
        case sqlite.SQLITE_BUSY, sqlite.SQLITE_LOCKED:
            return true
        }
    }
    return false
}
```

### 6.3 Constraint Violation Parsing

```go
func parseConstraintError(err error) *AppError {
    msg := err.Error()
    
    if strings.Contains(msg, "UNIQUE constraint failed") {
        // Extract field name: "UNIQUE constraint failed: works.title"
        parts := strings.Split(msg, ".")
        field := "value"
        if len(parts) > 1 {
            field = parts[len(parts)-1]
        }
        
        return &AppError{
            Category:    CategoryValidation,
            Code:        "VAL_DUPLICATE",
            Message:     fmt.Sprintf("A record with this %s already exists", field),
            Recoverable: true,
            Suggestions: []string{fmt.Sprintf("Choose a different %s", field)},
        }
    }
    
    if strings.Contains(msg, "NOT NULL constraint failed") {
        // Extract field name
        parts := strings.Split(msg, ".")
        field := "field"
        if len(parts) > 1 {
            field = parts[len(parts)-1]
        }
        
        return &AppError{
            Category:    CategoryValidation,
            Code:        "VAL_REQUIRED",
            Message:     fmt.Sprintf("%s is required", strings.Title(field)),
            Recoverable: true,
            Suggestions: []string{fmt.Sprintf("Enter a value for %s", field)},
        }
    }
    
    // Generic constraint error
    return &AppError{
        Category:    CategoryDatabase,
        Code:        "DB_CONSTRAINT",
        Message:     "Could not save record",
        Detail:      msg,
        Recoverable: true,
    }
}
```

---

## 7. Validation Errors

### 7.1 Field Validation Rules

See [11-validation.md](11-validation.md) for complete validation rules.

### 7.2 Validation Error Display

```typescript
// src/components/ValidatedInput.tsx
interface ValidatedInputProps extends TextInputProps {
  error?: string;
  touched?: boolean;
}

export function ValidatedInput({ error, touched, ...props }: ValidatedInputProps) {
  return (
    <TextInput
      {...props}
      error={touched && error ? error : undefined}
      styles={(theme) => ({
        input: {
          borderColor: touched && error ? theme.colors.red[6] : undefined,
        },
      })}
    />
  );
}
```

### 7.3 Form-Level Validation

```typescript
// src/hooks/useFormValidation.ts
export function useFormValidation<T extends Record<string, any>>(
  values: T,
  rules: ValidationRules<T>
) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = values[field];
      
      if (rule.required && !value) {
        newErrors[field] = `${rule.label || field} is required`;
      } else if (rule.pattern && !rule.pattern.test(String(value))) {
        newErrors[field] = rule.message || `Invalid ${field}`;
      } else if (rule.custom) {
        const error = rule.custom(value, values);
        if (error) newErrors[field] = error;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, rules]);

  const touch = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const touchAll = useCallback(() => {
    const allTouched: Record<string, boolean> = {};
    for (const field of Object.keys(rules)) {
      allTouched[field] = true;
    }
    setTouched(allTouched);
  }, [rules]);

  return { errors, touched, validate, touch, touchAll };
}
```

---

## 8. Network Errors

### 8.1 URL Preview/Browser Errors

When loading organization URLs for preview:

```go
func (a *App) CheckURL(url string) result.Result[bool] {
    client := &http.Client{
        Timeout: 5 * time.Second,
    }
    
    resp, err := client.Head(url)
    if err != nil {
        if os.IsTimeout(err) {
            return result.Fail[bool](&errors.AppError{
                Category:    errors.CategoryNetwork,
                Code:        "NET_TIMEOUT",
                Message:     "Website is not responding",
                Recoverable: true,
                Suggestions: []string{"Try again later", "Check your internet connection"},
            })
        }
        
        return result.Fail[bool](&errors.AppError{
            Category:    errors.CategoryNetwork,
            Code:        "NET_UNREACHABLE",
            Message:     "Could not reach website",
            Detail:      err.Error(),
            Recoverable: true,
        })
    }
    defer resp.Body.Close()
    
    if resp.StatusCode >= 400 {
        return result.Fail[bool](&errors.AppError{
            Category:    errors.CategoryNetwork,
            Code:        "NET_HTTP_ERROR",
            Message:     fmt.Sprintf("Website returned error: %d", resp.StatusCode),
            Recoverable: true,
        })
    }
    
    return result.Ok(true)
}
```

---

## 9. Recovery Strategies

### 9.1 Undo/Redo Stack

```go
// internal/state/undo.go
type UndoAction struct {
    Type        string      `json:"type"`
    Description string      `json:"description"`
    Undo        func() error `json:"-"`
    Redo        func() error `json:"-"`
    Timestamp   time.Time   `json:"timestamp"`
}

type UndoStack struct {
    actions []UndoAction
    index   int
    maxSize int
}

func (s *UndoStack) Push(action UndoAction) {
    // Truncate any redo history
    s.actions = s.actions[:s.index]
    s.actions = append(s.actions, action)
    s.index++
    
    // Limit stack size
    if len(s.actions) > s.maxSize {
        s.actions = s.actions[1:]
        s.index--
    }
}

func (s *UndoStack) Undo() error {
    if s.index <= 0 {
        return fmt.Errorf("nothing to undo")
    }
    s.index--
    return s.actions[s.index].Undo()
}

func (s *UndoStack) Redo() error {
    if s.index >= len(s.actions) {
        return fmt.Errorf("nothing to redo")
    }
    err := s.actions[s.index].Redo()
    s.index++
    return err
}
```

### 9.2 Auto-Save and Recovery

```go
// Periodic auto-save of unsaved changes
func (a *App) startAutoSave() {
    ticker := time.NewTicker(30 * time.Second)
    go func() {
        for range ticker.C {
            if a.state.HasUnsavedChanges {
                if err := a.saveState(); err != nil {
                    a.logger.Warn("auto-save failed", "error", err)
                }
            }
        }
    }()
}

// On startup, check for recovery file
func (a *App) checkRecovery() {
    recoveryPath := filepath.Join(a.configDir, "recovery.json")
    if _, err := os.Stat(recoveryPath); err == nil {
        // Recovery file exists - offer to restore
        a.state.HasRecoveryData = true
    }
}
```

---

## 10. Logging

### 10.1 Log Configuration

```go
// internal/logging/logging.go
import (
    "log/slog"
    "os"
    "path/filepath"
)

func SetupLogging(configDir string) *slog.Logger {
    logPath := filepath.Join(configDir, "submissions.log")
    
    file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        // Fall back to stderr
        return slog.New(slog.NewJSONHandler(os.Stderr, nil))
    }
    
    return slog.New(slog.NewJSONHandler(file, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    }))
}
```

### 10.2 Log Location

```
~/Library/Logs/Submissions/submissions.log
```

### 10.3 Log Rotation

```go
// Rotate logs when they exceed 10MB
const MaxLogSize = 10 * 1024 * 1024

func rotateLogIfNeeded(logPath string) error {
    info, err := os.Stat(logPath)
    if err != nil {
        return nil // File doesn't exist yet
    }
    
    if info.Size() < MaxLogSize {
        return nil // Not big enough to rotate
    }
    
    // Rename current log
    backupPath := logPath + "." + time.Now().Format("2006-01-02")
    return os.Rename(logPath, backupPath)
}
```

### 10.4 Activity Logging

All significant user actions are logged (no UI view, just file logging for debugging):

```go
// internal/logging/activity.go

type ActivityType string

const (
    ActivityStatusChange     ActivityType = "status_change"
    ActivityWorkCreated      ActivityType = "work_created"
    ActivityWorkDeleted      ActivityType = "work_deleted"
    ActivitySubmissionCreate ActivityType = "submission_created"
    ActivitySubmissionUpdate ActivityType = "submission_updated"
    ActivityFileMove         ActivityType = "file_moved"
    ActivityBackupCreated    ActivityType = "backup_created"
    ActivityImport           ActivityType = "import"
)

type ActivityEntry struct {
    Timestamp time.Time    `json:"timestamp"`
    Type      ActivityType `json:"type"`
    EntityID  int          `json:"entityId,omitempty"`
    Details   string       `json:"details"`
}

func (l *Logger) LogActivity(activity ActivityEntry) {
    l.logger.Info("activity",
        slog.String("type", string(activity.Type)),
        slog.Int("entityId", activity.EntityID),
        slog.String("details", activity.Details),
    )
}

// Usage example:
// logger.LogActivity(ActivityEntry{
//     Type:     ActivityStatusChange,
//     EntityID: workID,
//     Details:  fmt.Sprintf("Status changed from %s to %s", oldStatus, newStatus),
// })
```

---

*End of Error Handling Specification*
