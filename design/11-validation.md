# Validation Specification

> **Document:** 11-validation.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Edge Value Behaviors](#2-edge-value-behaviors)
3. [Field Validation Rules](#3-field-validation-rules)
4. [Value List Constraints](#4-value-list-constraints)
5. [Go Validation Implementation](#5-go-validation-implementation)
6. [React Form Validation](#6-react-form-validation)
7. [Database Constraints](#7-database-constraints)

---

## 1. Overview

### 1.1 Validation Philosophy

1. **Validate early** — Check on input, not just on save
2. **Fail clearly** — Specific error messages, not generic "invalid"
3. **Allow flexibility** — Warn on unusual values, don't always block
4. **Preserve intent** — Don't silently modify user input
5. **Handle edge cases explicitly** — Document what happens for null, empty, unknown

### 1.2 Validation Layers

| Layer | Responsibility | Examples |
|-------|----------------|----------|
| **Backend (Go)** | Primary validation | Required fields, business logic, duplicate prevention, cross-field validation |
| **Database (SQLite)** | Data integrity | Foreign keys, unique constraints, NOT NULL |

**Note:** Frontend validation is minimal - the backend is the authoritative validator. The UI displays errors returned from backend validation.

---

## 2. Edge Value Behaviors

This section explicitly documents how the application handles edge cases.

### 2.1 Null vs Empty String vs Missing

| Context | Null/nil | Empty String "" | Missing Field |
|---------|----------|-----------------|---------------|
| **Text fields** | Treated as "" | Valid, allowed | Use default or "" |
| **Number fields** | Treated as 0 | Parse error | Use default or 0 |
| **Date fields** | No date set | Parse error | No date set |
| **Boolean (yes/empty)** | Treated as false | Treated as false | Treated as false |
| **Required fields** | Error | Error (unless allowed) | Error |

### 2.2 Works Table Edge Values

| Field | Empty/Null Behavior | Default | Validation |
|-------|---------------------|---------|------------|
| `workID` | Auto-generated | Next serial | Must be unique positive integer |
| `Title` | **Error - required** | - | Min 1 char, max 500 chars |
| `Type` | **Error - required** | - | Must be in WorkType list |
| `Year` | Use current year | Current year | 4-digit string, 1900-2100 |
| `Status` | Use "Gestating" | "Gestating" | Must be in StatusList |
| `Quality` | Use "Okay" | "Okay" | Must be in QualityList |
| `DocType` | Use "rtf" | "rtf" | One of: rtf, docx, txt, md |
| `Path` | Empty allowed | "" | If set, should be valid path |
| `nWords` | Use 0 | 0 | Non-negative integer |
| `Draft` | Empty allowed | "" | Freeform text |
| `CourseName` | Empty allowed | "" | Freeform text |
| `isBlog` | Treated as false | false | Boolean |
| `isPrinted` | Treated as false | false | Boolean |
| `isProsePoem` | Treated as false | false | Boolean |
| `isRevised` | Treated as false | false | Boolean |
| `Mark` | Empty allowed | "" | Freeform text (temporary marker) |
| `accessDate` | Null allowed | null | Valid timestamp or null |

### 2.3 Organizations Table Edge Values

| Field | Empty/Null Behavior | Default | Validation |
|-------|---------------------|---------|------------|
| `orgID` | Auto-generated | Next serial | Must be unique positive integer |
| `Name` | **Error - required** | - | Min 1 char, max 200 chars |
| `URL` | Empty allowed | "" | If set, should start with http(s):// |
| `Other URL` | Empty allowed | "" | If set, should start with http(s):// |
| `Status` | Use "Open" | "Open" | "Open" or "Closed" |
| `Type` | Use "Journal" | "Journal" | Must be in JournalType list |
| `My Interest` | Use "Unknown" | "Unknown" | Must be in QualityList |
| `Ranking` | Use 0 | 0 | Non-negative integer |
| `DuotropeNum` | Empty allowed | null | Positive integer or null |
| `nPushFiction` | Use 0 | 0 | Non-negative integer |
| `nPushNonFiction` | Use 0 | 0 | Non-negative integer |
| `nPushPoetry` | Use 0 | 0 | Non-negative integer |

### 2.4 Submissions Table Edge Values

| Field | Empty/Null Behavior | Default | Validation |
|-------|---------------------|---------|------------|
| `submissionID` | Auto-generated | Next serial | Must be unique |
| `workID` | **Error - required** | - | Must exist in Works |
| `orgID` | **Error - required** | - | Must exist in Organizations |
| `SubmissionDate` | Empty allowed | null | Valid date or null |
| `QueryDate` | Empty allowed | null | Valid date or null |
| `ResponseDate` | Empty allowed | null | Valid date or null |
| `ResponseType` | Use "Waiting" | "Waiting" | Must be in ResponseTypes list |
| `Cost` | Use 0.00 | 0.00 | Non-negative decimal |

### 2.5 Unknown Values in Value Lists

When a field value is not in its expected value list:

| Scenario | Behavior |
|----------|----------|
| Display in UI | Show value with warning indicator |
| Sorting | Sort at end (treat as lowest priority) |
| Filtering | Include in "other" category |
| Editing | Allow change to valid value |
| New records | Block save, require valid value |

**Go Implementation:**

```go
// Sort order for unknown values
func StatusOrder(status string) int {
    order := map[string]int{
        "Out": 1, "Focus": 2, "Active": 3, "Working": 4,
        "Resting": 5, "Waiting": 6, "Gestating": 7, "Sound": 8,
        "Published": 9, "Sleeping": 10, "Dying": 11, "Dead": 12, "Done": 13,
    }
    if o, ok := order[status]; ok {
        return o
    }
    return 999 // Unknown values sort last
}
```

### 2.6 Date Edge Cases

| Scenario | Behavior |
|----------|----------|
| Future dates | **Warning** - allowed but flagged |
| Very old dates (< 1900) | **Warning** - allowed but flagged |
| ResponseDate before SubmissionDate | **Error** - not allowed |
| QueryDate before SubmissionDate | **Error** - not allowed |
| Empty date | Displayed as "—" or empty |
| Invalid date format | **Error** - parse failure |

### 2.7 Path Edge Cases

| Scenario | Check Field Value | User Sees |
|----------|-------------------|-----------|
| Path matches generated, file exists | `""` (empty) | Normal row |
| Path differs, file exists at generated path | `""` (empty) | Normal row |
| Path differs, file exists at stored path only | `"name changed"` | Yellow warning |
| No file at either path | `"file missing"` | Red warning |
| Path empty, new work | `""` (empty) | Normal row |
| Path contains invalid characters | `"invalid path"` | Red warning |

---

## 3. Field Validation Rules

### 3.1 Text Field Rules

```go
type TextValidation struct {
    Required  bool
    MinLength int
    MaxLength int
    Pattern   *regexp.Regexp // Optional regex
    Transform func(string) string // Optional transformation
}

var WorkTitleValidation = TextValidation{
    Required:  true,
    MinLength: 1,
    MaxLength: 500,
    Transform: strings.TrimSpace,
}

var URLValidation = TextValidation{
    Required: false,
    Pattern:  regexp.MustCompile(`^https?://`),
}
```

### 3.2 Integer Field Rules

```go
type IntValidation struct {
    Required bool
    Min      int
    Max      int
    Default  int
}

var WordCountValidation = IntValidation{
    Required: false,
    Min:      0,
    Max:      1000000,
    Default:  0,
}

var YearValidation = IntValidation{
    Required: false,
    Min:      1900,
    Max:      2100,
    Default:  time.Now().Year(),
}
```

### 3.3 Value List Field Rules

```go
type ValueListValidation struct {
    Required      bool
    AllowedValues []string
    Default       string
    AllowUnknown  bool // For legacy data with unknown values
}

var StatusValidation = ValueListValidation{
    Required: false,
    AllowedValues: []string{
        "Out", "Focus", "Active", "Working", "Resting", "Waiting",
        "Gestating", "Sound", "Published", "Sleeping", "Dying", "Dead", "Done",
    },
    Default:      "Gestating",
    AllowUnknown: true, // Allow legacy values, just warn
}

### 3.4 Duplicate Prevention

**Critical:** Works must not have duplicate `generatedPath` values to prevent file overwrites.

```go
type DuplicateValidation struct {
    CheckFunc func(work *Work) ([]Work, error) // Returns existing works with same generatedPath
}

var GeneratedPathValidation = DuplicateValidation{
    CheckFunc: func(work *Work) ([]Work, error) {
        genPath := fileops.GeneratePath(work)
        return db.FindWorksByGeneratedPath(genPath, work.WorkID)
    },
}
```

**Implementation:**
- Check before `CreateWork`: Reject if duplicate exists
- Check before `UpdateWork`: Reject if change creates duplicate
- Check before file operations: Ensure no collision
- User-facing error: "A work with this title, type, year, and quality already exists"
```

---

## 4. Value List Constraints

### 4.1 StatusList Constraints

| Value | Can Transition To | Cannot Transition To |
|-------|-------------------|----------------------|
| Gestating | Any | - |
| Working | Any | - |
| Active | Any | - |
| Focus | Any | - |
| Resting | Any | - |
| Waiting | Any | - |
| Out | Any (typically Active on rejection, Published on acceptance) | - |
| Published | Typically stays | Can go to Dead if depublished |
| Sleeping | Any | - |
| Dying | Any | - |
| Dead | Can be revived to any active status | - |
| Done | Typically stays | - |

> Note: The system does not enforce these transitions, but they represent typical workflow.

### 4.2 ResponseType Constraints

| Value | Meaning | Next Steps |
|-------|---------|------------|
| Waiting | No response yet | Can become any other type |
| Accepted | Work was accepted | Work status often → "Published" |
| Rejected | Work was rejected | Can resubmit elsewhere |
| Declined | We withdrew | No further action |
| No Response | Never heard back | After ~6 months |
| Expired | Submission period ended | Can resubmit |
| Other | Miscellaneous | - |

### 4.3 Cross-Field Validation

| Rule | Fields Involved | Error Message |
|------|-----------------|---------------|
| Response requires submission date | ResponseDate, SubmissionDate | "Cannot have response without submission date" |
| Published needs acceptance | Status="Published", ResponseType | Warning if no "Accepted" submission |
| Out requires active submission | Status="Out", Submissions | Warning if no "Waiting" submission |

---

## 5. Go Validation Implementation

### 5.1 Validation Interface

```go
// internal/validation/validation.go
package validation

type ValidationResult struct {
    Valid    bool
    Errors   []FieldError
    Warnings []FieldWarndb *DB, fileOps *fileops.FileOps) validation.ValidationResult {
    result := validation.ValidationResult{Valid: true}
    
    // Required: Title
    if strings.TrimSpace(w.Title) == "" {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
            Field:   "Title",
            Message: "Title is required",
            Code:    "VAL_REQUIRED",
        })
    } else if len(w.Title) > 500 {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
            Field:   "Title",
            Message: "Title must be 500 characters or less",
            Code:    "VAL_TOO_LONG",
        })
    }
    
    // Required: Type
    if w.Type == "" {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
            Field:   "Type",
            Message: "Type is required",
            Code:    "VAL_REQUIRED",
        })
    } else if !isValidWorkType(w.Type) {
        result.Warnings = append(result.Warnings, validation.FieldWarning{
            Field:   "Type",
            Message: fmt.Sprintf("Unknown work type: %s", w.Type),
        })
    }
    
    // Status: default if empty
    if w.Status == "" {
        w.Status = "Gestating"
    } else if !isValidStatus(w.Status) {
        result.Warnings = append(result.Warnings, validation.FieldWarning{
            Field:   "Status",
            Message: fmt.Sprintf("Unknown status: %s", w.Status),
        })
    }
    
    // Quality: default if empty
    if w.Quality == "" {
        w.Quality = "Okay"
    }
    
    // Year: validate range
    if w.Year != "" {
        year, err := strconv.Atoi(w.Year)
        if err != nil {
            result.Valid = false
            result.Errors = append(result.Errors, validation.FieldError{
                Field:   "Year",
                Message: "Year must be a 4-digit number",
                Code:    "VAL_INVALID",
            })
        } else if year < 1900 || year > 2100 {
            result.Warnings = append(result.Warnings, validation.FieldWarning{
                Field:   "Year",
                Message: fmt.Sprintf("Unusual year: %d", year),
            })
        }
    }
    
    // nWords: must be non-negative
    if w.NWords < 0 {
        w.NWords = 0
    }
    
    // CRITICAL: Check for duplicate generatedPath
    genPath := fileOps.GeneratePath(w)
    duplicates, err := db.FindWorksByGeneratedPath(genPath, w.WorkID)
    if err != nil {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
            Field:   "Path",
            Message: "Failed to check for duplicates",
            Code:    "VAL_SYSTEM_ERROR",
        })
    } else if len(duplicates) > 0 {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
            Field:   "Title",
            Message: fmt.Sprintf("A work with this title, type, year, and quality already exists (ID: %d)", duplicates[0].WorkID),
            Code:    "VAL_DUPLICATE",
        })"Okay"
    }
    
    // Year: validate range
    if w.Year != "" {
        year, err := strconv.Atoi(w.Year)
        if err != nil {
            result.Valid = false
            result.Errors = append(result.Errors, validation.FieldError{
                Field:   "Year",
                Message: "Year must be a 4-digit number",
                Code:    "VAL_INVALID",
            })
        } else if year < 1900 || year > 2100 {
            result.Warnings = append(result.Warnings, validation.FieldWarning{
                Field:   "Year",
                Message: fmt.Sprintf("Unusual year: %d", year),
            })
        }
    }
    
    // nWords: must be non-negative
    if w.NWords < 0 {
        w.NWords = 0
    }
    
    return result
}
```

### 5.3 Submission Validation

```go
func (s *Submission) Validate() validation.ValidationResult {
    result := validation.ValidationResult{Valid: true}
    
    // Required: workID
    if s.WorkID <= 0 {
        result.Valid = false
        result.Errors = append(result.Errors, validation.FieldError{
### 5.4 Database Helper Methods

```go
// internal/db/works.go
func7.1 Client-Side Validation (Limited)

**Philosophy:** The backend is the authoritative validator. Frontend only provides basic input constraints and displays backend validation errors.

**Frontend responsibilities:**
- Disable submit button when required fields are empty
- Display error messages returned from backend
- Provide input format hints (placeholders, labels)
- Client-side validation is NOT duplicated from backend

```typescript
// src/components/NewWorkModal.tsx
function NewWorkModal() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    try {
      setError('');
      const result = await CreateNewWork({ title, type, /* ... */ });
      
      if (!result.success) {
        setError(result.error); // Display backend validation error
        return;
      }
      
      // Success - close modal, navigate
    } catch (err) {
      setError('Failed to create work');
    }
  };

  return (
    <Modal>
      {error && <Alert color="red">{error}</Alert>}
      
      <TextInput
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      
      <Select
        label="Type"
        value={type}
        onChange={setType}
        data={workTypes}
        required
      />
      
      <Button
        onClick={handleSubmit}
        disabled={!title || !type}
      >
        Create
      </Button>
    </Modalc/hooks/useValidation.ts
import { useState, useCallback } from 'react';

interface ValidationRule<T> {
  validate: (value: T, allValues: Record<string, any>) => string | null;
}

interface FieldRules {
  [field: string]: ValidationRule<any>[];
}

export function useFormValidation<T extends Record<string, any>>(rules: FieldRules) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: string, value: any, allValues: T) => {
    const fieldRules = rules[field] || [];
    
    for (const rule of fieldRules) {
      const error = rule.validate(value, allValues);
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
        return false;
      }
    }
    
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return true;
  }, [rules]);

  const touchField = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateAll = useCallback((values: T) => {
    let valid = true;
    const newErrors: Record<string, string> = {};
    
    for (const [field, fieldRules] of Object.entries(rules)) {
      for (const rule of fieldRules) {
        const error = rule.validate(values[field], values);
        if (error) {
          newErrors[field] = error;
          valid = false;
          break;
        }
      }
    }
    
    setErrors(newErrors);
    setTouched(Object.fromEntries(Object.keys(rules).map(f => [f, true])));
    return valid;
  }, [rules]);

  return { errors, touched, validateField, touchField, validateAll };
}
```

### 6.2 Common Validation Rules

```typescript
// src/utils/validationRules.ts

export const required = (fieldName: string) => ({
  validate: (value: any) => {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },
});

export const maxLength = (max: number) => ({
  validate: (value: string) => {
    if (value && value.length > max) {
      return `Must be ${max} characters or less`;
    }
    return null;
  },
});

export const inList = (allowed: string[], fieldName: string) => ({
  validate: (value: string) => {
    if (value && !allowed.includes(value)) {
      return `Invalid ${fieldName}`;
    }
    return null;
  },
});

export const validURL = () => ({
  validate: (value: string) => {
    if (value && !value.match(/^https?:\/\//)) {
      return 'Must start with http:// or https://';
    }
   8return null;
  },
});8

export const dateAfter = (otherField: string, otherLabel: string) => ({
  validate: (value: Date | null, allValues: Record<string, any>) => {
    const otherValue = allValues[otherField];
    if (value && otherValue && value < otherValue) {
      return `Must be after ${otherLabel}`;
    }
    return null;
  },
});
```

### 6.3 Usage Example

```typescript
// src/pages/WorkDetailPage.tsx
const workRules = {
  title: [required('Title'), maxLength(500)],
  type: [required('Type'), inList(WORK_TYPES, 'type')],
  year: [required('Year')],
  status: [inList(STATUS_VALUES, 'status')],
  quality: [inList(QUALITY_VALUES, 'quality')],
};

function WorkDetailPage() {
  const [values, setValues] = useState<WorkForm>({...});
  const { errors, touched, validateField, touchField, validateAll } = useFormValidation(workRules);
  
  const handleSave = async () => {
    if (!validateAll(values)) {
      return; // Form has errors
    }
    // Save...
  };
  
  return (
    <TextInput
      label="Title"
      value={values.title}
      onChange={(e) => {
        setValues(v => ({ ...v, title: e.target.value }));
        validateField('title', e.target.value, values);
      }}
      onBlur={() => touchField('title')}
      error={touched.title ? errors.title : undefined}
    />
  );
}
```

---

## 7. Database Constraints

### 7.1 SQLite Constraints

```sql
-- Works table constraints
CREATE TABLE works (
    work_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) > 0),
    type TEXT NOT NULL,
    year TEXT DEFAULT (strftime('%Y', 'now')),
    status TEXT DEFAULT 'Gestating',
    quality TEXT DEFAULT 'Okay',
    8_words INTEGER DEFAULT 0 CHECK(n_words >= 0),
    -- ... other fields
);

-- Submissions table constraints
CREATE TABLE submissions (
    submission_id INTEGER PRIMARY KEY,
    work_id INTEGER NOT NULL,
    org_id INTEGER NOT NULL,
    response_date TEXT,
    submission_date TEXT,
    -- Cross-field constraint: response_date >= submission_date
    CHECK(
        response_date IS NULL 
        OR submission_date IS NULL 
        OR response_date >= submission_date
    ),
    FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);

-- CollectionDetails unique constraint
CREATE TABLE collection_details (
    id INTEGER PRIMARY KEY,
    coll_id INTEGER NOT NULL,
    work_id INTEGER NOT NULL,
    UNIQUE(coll_id, work_id),
    FOREIGN KEY (coll_id) REFERENCES collections(coll_id),
    FOREIGN KEY (work_id) REFERENCES works(work_id) ON DELETE CASCADE
);
```

### 7.2 Constraint Error Handling

See [10-error-handling.md](10-error-handling.md#63-constraint-violation-parsing) for how database constraint errors are parsed and displayed to users.

---

*End of Validation Specification*
