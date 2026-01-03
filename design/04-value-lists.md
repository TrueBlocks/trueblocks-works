# Value Lists Specification

> **Document:** 04-value-lists.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Static Value Lists](#2-static-value-lists)
3. [Dynamic Value Lists](#3-dynamic-value-lists)
4. [Value List Usage](#4-value-list-usage)
5. [Go/Wails Implementation](#5-gowails-implementation)
6. [TypeScript/React Implementation](#6-typescriptreact-implementation)

---

## 1. Overview

The database defines **20 value lists** used for dropdown menus, sorting, and validation. Value lists are either:
- **Static (Custom):** Fixed list of values defined in the database
- **Dynamic (Field):** Values populated from table data

### 1.1 Summary

| Value List | Type | Count | Primary Usage |
|------------|------|-------|---------------|
| StatusList | Static | 16 | Work lifecycle states |
| QualityList | Static | 7 | Work quality ratings |
| WorkType | Static | 31 | Creative work categories |
| Response Types | Static | 7 | Submission response categories |
| NoteTypes | Static | 14 | Note categorization |
| Submission Types | Static | 4 | Submission method |
| AcceptTypes | Static | 8 | What journals accept |
| JournalStatus | Static | 2 | Journal availability |
| GenreTypes | Static | 3 | Genre classification |
| YesNo | Static | 2 | Boolean choices |
| Yes | Static | 1 | Single checkbox value |
| Browser | Static | 1 | UI element identifier |
| JournalsList | Dynamic | ~755 | Organization names |
| JournalList | Dynamic | ~755 | Organization ID + Name |
| WorksList | Dynamic | ~1749 | Work titles |
| WorkList | Dynamic | ~1749 | Work ID + Title |
| DraftsList | Dynamic | varies | Draft field values |
| Timing | Dynamic | varies | Response timing options |
| Collections | Dynamic | ~31 | Collection names |
| ContestList | Dynamic | 0 | MISSING FIELDS |

---

## 2. Static Value Lists

### 2.1 StatusList

**Purpose:** Work lifecycle status - controls workflow and sorting priority.

**Values (in order):**
```
Out
-
Focus
Active
Working
Resting
Waiting
-
Gestating
Sound
Published
-
Sleeping
Dying
Dead
Done
```

**Notes:**
- `-` entries are visual separators in dropdown menus
- Order determines sort priority (Out = 1, Done = 16)
- Each status has a corresponding collection for grouping works

**Semantic Meaning:**

| Status | Description | Collection Type |
|--------|-------------|-----------------|
| Out | Currently submitted to journal | Active |
| Focus | Primary focus pieces | Active |
| Active | Being actively worked on | Active |
| Working | In progress | Active |
| Resting | Taking a break from | Active |
| Waiting | Waiting for feedback/review | Active |
| Gestating | Ideas developing | Process |
| Sound | Complete but not submitting | Other |
| Published | Accepted and published | Other |
| Sleeping | Dormant, may revisit | Dead |
| Dying | Low priority, may abandon | Dead |
| Dead | Abandoned | Dead |
| Done | Completed, no further action | Dead |

**Sort Order Value:**
```go
var StatusOrder = map[string]int{
    "Out":       1,
    "Focus":     2,
    "Active":    3,
    "Working":   4,
    "Resting":   5,
    "Waiting":   6,
    "Gestating": 7,
    "Sound":     8,
    "Published": 9,
    "Sleeping":  10,
    "Dying":     11,
    "Dead":      12,
    "Done":      13,
}
```

### 2.2 QualityList

**Purpose:** Subjective quality rating for works and journal interest level.

**Values (in order):**
```
Best
Better
Good
Okay
Bad
Worst
Unknown
```

**Usage:**
- `Works.Quality` - Rating of the work itself
- `Organizations.My Interest` - How interested the user is in submitting to this journal

**Sort Order Value:**
```go
var QualityOrder = map[string]int{
    "Best":    1,
    "Better":  2,
    "Good":    3,
    "Okay":    4,
    "Bad":     5,
    "Worst":   6,
    "Unknown": 7,
}
```

### 2.3 WorkType

**Purpose:** Categorizes creative works by genre/form.

**Values (in order):**
```
Article
Book
Chapter
Critique
Essay
Flash
Interview
Freewrite
Journal
Micro
Poem
Paper
Lesson
Character
Research
Review
Song
Story
Travel
-
Essay Idea
Poem Idea
Article Idea
Book Idea
Story Idea
Paper Idea
Interview Idea
Flash Idea
Micro Idea
-
Other
```

**Notes:**
- Main types (19) plus "Idea" variants (9) for planning/brainstorming
- `-` entries are visual separators
- Determines folder path in file system (see file management)

**Type Categories:**

| Category | Types |
|----------|-------|
| Primary Creative | Poem, Story, Flash, Micro, Essay, Article |
| Long Form | Book, Chapter |
| Academic | Paper, Research, Critique, Review, Lesson |
| Special Format | Song, Interview, Character, Travel, Journal, Freewrite |
| Planning | *Idea variants |

**Sort Order Value:**
```go
var TypeOrder = map[string]int{
    "Article":    1,
    "Book":       2,
    "Chapter":    3,
    "Critique":   4,
    "Essay":      5,
    "Flash":      6,
    "Interview":  7,
    "Freewrite":  8,
    "Journal":    9,
    "Micro":      10,
    "Poem":       11,
    "Paper":      12,
    "Lesson":     13,
    "Character":  14,
    "Research":   15,
    "Review":     16,
    "Song":       17,
    "Story":      18,
    "Travel":     19,
    // Ideas follow their parent type
    "Essay Idea":     20,
    "Poem Idea":      21,
    "Article Idea":   22,
    "Book Idea":      23,
    "Story Idea":     24,
    "Paper Idea":     25,
    "Interview Idea": 26,
    "Flash Idea":     27,
    "Micro Idea":     28,
    "Other":          99,
}
```

### 2.4 Response Types

**Purpose:** Categorizes responses from journals to submissions.

**Values:**
```
Accepted
Email
Form
No Response
Personal
Personal Note
Waiting
```

**Semantic Meaning:**

| Response | Description | Action |
|----------|-------------|--------|
| Accepted | Work was accepted for publication | Change work status to "Published" |
| Email | Standard rejection email | None |
| Form | Form rejection letter | None |
| No Response | No response within expected time | None |
| Personal | Personalized rejection | Consider for future |
| Personal Note | Rejection with encouraging note | Higher priority for resubmission |
| Waiting | Still waiting for response | None |

### 2.5 NoteTypes

**Purpose:** Categorizes notes attached to works and journals.

**Values:**
```
Acceptance
Note
Problem
Response
Review
Critique
TitleChange
Submission
Contest
Reading
Export
Revised
Posting
Query
```

**Usage by Context:**

| Type | Work Notes | Journal Notes | Description |
|------|:----------:|:-------------:|-------------|
| Acceptance | ✓ | ✓ | Acceptance notification |
| Note | ✓ | ✓ | General note |
| Problem | ✓ | ✓ | Issue or problem |
| Response | ✓ | ✓ | Response received |
| Review | ✓ | | Peer review received |
| Critique | ✓ | | Critique from workshop |
| TitleChange | ✓ | | Title was changed |
| Submission | ✓ | ✓ | Submission record |
| Contest | ✓ | ✓ | Contest entry/result |
| Reading | ✓ | | Public reading |
| Export | ✓ | | File exported |
| Revised | ✓ | | Major revision |
| Posting | ✓ | | Posted online |
| Query | | ✓ | Query sent to journal |

### 2.6 Submission Types

**Purpose:** How submissions are sent to journals.

**Values:**
```
submittable
online
snail mail
email
```

**Notes:**
- `submittable` - Via Submittable platform
- `online` - Journal's own submission system
- `snail mail` - Physical mail
- `email` - Email attachment

### 2.7 AcceptTypes

**Purpose:** What types of work a journal accepts.

**Values:**
```
poetry
short fiction
cnf
flash fiction
craft
reviews
interviews
contests
```

**Notes:**
- Stored in `Organizations.Accepts` field
- Can have multiple values (comma-separated)
- `cnf` = Creative Non-Fiction

### 2.8 JournalStatus

**Purpose:** Operating status of a journal.

**Values:**
```
Open
On Hiatus
```

### 2.9 GenreTypes

**Purpose:** Genre classification.

**Values:**
```
science fiction
horror
literary
```

**Notes:** Currently limited - may need expansion.

### 2.10 YesNo

**Purpose:** Boolean choices for toggle fields.

**Values:**
```
yes
no
```

### 2.11 Yes

**Purpose:** Single-value checkbox (checked = "yes", unchecked = empty).

**Values:**
```
yes
```

**Usage:** For boolean flag fields like `isRevised`, `isBlog`, `isPrinted`, etc.

### 2.12 Browser

**Purpose:** UI element identifier.

**Values:**
```
browser
```

**Usage:** Identifies the web browser layout object.

---

## 3. Dynamic Value Lists

### 3.1 JournalsList

**Purpose:** Dropdown of all journal names.

**Source:**
- Field: `Organizations::Name`
- Sort: Ascending by name

**SQL Equivalent:**
```sql
SELECT DISTINCT name FROM Organizations ORDER BY name;
```

### 3.2 JournalList

**Purpose:** Dropdown showing journal names but returning journal IDs.

**Source:**
- Primary Field: `Organizations::orgID` (stored value)
- Secondary Field: `Organizations::Name` (displayed value)
- Sort: By name

**SQL Equivalent:**
```sql
SELECT orgID, name FROM Organizations ORDER BY name;
```

### 3.3 WorksList

**Purpose:** Dropdown of all work titles.

**Source:**
- Field: `Works::Title`
- Sort: Ascending by title

**SQL Equivalent:**
```sql
SELECT DISTINCT title FROM Works ORDER BY title;
```

### 3.4 WorkList

**Purpose:** Dropdown showing work titles but returning work IDs.

**Source:**
- Primary Field: `Works::workID` (stored value)
- Secondary Field: `Works::Title` (displayed value)
- Sort: By title

**SQL Equivalent:**
```sql
SELECT workID, title FROM Works ORDER BY title;
```

### 3.5 DraftsList

**Purpose:** Available draft identifiers.

**Source:**
- Field: `Submissions::Draft`
- Sort: Ascending

### 3.6 Timing

**Purpose:** Response timing expectations.

**Source:**
- Field: `Organizations::Timing`
- Sort: Ascending

### 3.7 Collections

**Purpose:** All collection names for assignment.

**Source:**
- Field: `CollectionDetails::Collection Name`
- Sort: Ascending by name

**SQL Equivalent:**
```sql
SELECT DISTINCT collection_name FROM CollectionDetails ORDER BY collection_name;
-- Or from Collections table:
SELECT collection_name FROM Collections ORDER BY collection_name;
```

### 3.8 ContestList

**Purpose:** Contest entries (BROKEN - references missing fields).

**Status:** NON-FUNCTIONAL - missing field references.

---

## 4. Value List Usage

### 4.1 Usage by Layout

| Layout | Value Lists Used |
|--------|------------------|
| Collections | StatusList, QualityList, Collections, Yes |
| Works | WorkType, StatusList, QualityList, Response Types, NoteTypes, JournalList, YesNo, Yes |
| Works Light | WorkType, StatusList, QualityList, YesNo |
| Organizations | Submission Types, Timing, Response Types, AcceptTypes, JournalStatus, WorkList, QualityList, NoteTypes, Browser |
| Submissions | Submission Types, Response Types, WorksList, DraftsList, StatusList, JournalList, Browser |
| Works Notes | WorksList, NoteTypes |
| Journal Notes | WorksList, NoteTypes |
| Checking | WorkType |

### 4.2 Usage by Field

| Table.Field | Value List | Validation |
|-------------|------------|------------|
| Works.Type | WorkType | Member of list |
| Works.Status | StatusList | Member of list |
| Works.Quality | QualityList | Member of list |
| Works.ShowOnReading | YesNo | Member of list |
| Organizations.My Interest | QualityList | Member of list |
| Organizations.Submit | Submission Types | Member of list |
| Organizations.Accepts | AcceptTypes | Multiple allowed |
| Organizations.Status | JournalStatus | Member of list |
| Organizations.Timing | Timing | Dynamic |
| Submissions.Response Type | Response Types | Member of list |
| Submissions.Draft | DraftsList | Dynamic |
| Work Notes.Type | NoteTypes | Member of list |
| Journal Notes.Type | NoteTypes | Member of list |

---

## 5. Go Implementation

### 5.1 Type Definitions

```go
package models

// StatusValue represents a work's lifecycle status
type StatusValue string

const (
    StatusOut       StatusValue = "Out"
    StatusFocus     StatusValue = "Focus"
    StatusActive    StatusValue = "Active"
    StatusWorking   StatusValue = "Working"
    StatusResting   StatusValue = "Resting"
    StatusWaiting   StatusValue = "Waiting"
    StatusGestating StatusValue = "Gestating"
    StatusSound     StatusValue = "Sound"
    StatusPublished StatusValue = "Published"
    StatusSleeping  StatusValue = "Sleeping"
    StatusDying     StatusValue = "Dying"
    StatusDead      StatusValue = "Dead"
    StatusDone      StatusValue = "Done"
)

// AllStatuses returns all valid statuses in display order
func AllStatuses() []StatusValue {
    return []StatusValue{
        StatusOut, StatusFocus, StatusActive, StatusWorking,
        StatusResting, StatusWaiting, StatusGestating, StatusSound,
        StatusPublished, StatusSleeping, StatusDying, StatusDead, StatusDone,
    }
}

// ActiveStatuses returns statuses considered "active"
func ActiveStatuses() []StatusValue {
    return []StatusValue{
        StatusOut, StatusFocus, StatusActive, StatusWorking,
        StatusResting, StatusWaiting,
    }
}

// Order returns the sort order for this status
func (s StatusValue) Order() int {
    order := map[StatusValue]int{
        StatusOut: 1, StatusFocus: 2, StatusActive: 3, StatusWorking: 4,
        StatusResting: 5, StatusWaiting: 6, StatusGestating: 7, StatusSound: 8,
        StatusPublished: 9, StatusSleeping: 10, StatusDying: 11, 
        StatusDead: 12, StatusDone: 13,
    }
    if v, ok := order[s]; ok {
        return v
    }
    return 99
}

// IsActive returns true if this is an active status
func (s StatusValue) IsActive() bool {
    return s.Order() <= 6
}
```

### 5.2 Quality Values

```go
// QualityValue represents a subjective quality rating
type QualityValue string

const (
    QualityBest    QualityValue = "Best"
    QualityBetter  QualityValue = "Better"
    QualityGood    QualityValue = "Good"
    QualityOkay    QualityValue = "Okay"
    QualityBad     QualityValue = "Bad"
    QualityWorst   QualityValue = "Worst"
    QualityUnknown QualityValue = "Unknown"
)

func AllQualities() []QualityValue {
    return []QualityValue{
        QualityBest, QualityBetter, QualityGood, QualityOkay,
        QualityBad, QualityWorst, QualityUnknown,
    }
}

func (q QualityValue) Order() int {
    order := map[QualityValue]int{
        QualityBest: 1, QualityBetter: 2, QualityGood: 3, QualityOkay: 4,
        QualityBad: 5, QualityWorst: 6, QualityUnknown: 7,
    }
    if v, ok := order[q]; ok {
        return v
    }
    return 99
}
```

### 5.3 Work Type Values

```go
// WorkType represents the type/genre of a creative work
type WorkType string

const (
    TypeArticle    WorkType = "Article"
    TypeBook       WorkType = "Book"
    TypeChapter    WorkType = "Chapter"
    TypeCritique   WorkType = "Critique"
    TypeEssay      WorkType = "Essay"
    TypeFlash      WorkType = "Flash"
    TypeInterview  WorkType = "Interview"
    TypeFreewrite  WorkType = "Freewrite"
    TypeJournal    WorkType = "Journal"
    TypeMicro      WorkType = "Micro"
    TypePoem       WorkType = "Poem"
    TypePaper      WorkType = "Paper"
    TypeLesson     WorkType = "Lesson"
    TypeCharacter  WorkType = "Character"
    TypeResearch   WorkType = "Research"
    TypeReview     WorkType = "Review"
    TypeSong       WorkType = "Song"
    TypeStory      WorkType = "Story"
    TypeTravel     WorkType = "Travel"
    TypeOther      WorkType = "Other"
)

// Idea variants
const (
    TypeEssayIdea     WorkType = "Essay Idea"
    TypePoemIdea      WorkType = "Poem Idea"
    TypeArticleIdea   WorkType = "Article Idea"
    TypeBookIdea      WorkType = "Book Idea"
    TypeStoryIdea     WorkType = "Story Idea"
    TypePaperIdea     WorkType = "Paper Idea"
    TypeInterviewIdea WorkType = "Interview Idea"
    TypeFlashIdea     WorkType = "Flash Idea"
    TypeMicroIdea     WorkType = "Micro Idea"
)

func AllWorkTypes() []WorkType {
    return []WorkType{
        TypeArticle, TypeBook, TypeChapter, TypeCritique, TypeEssay,
        TypeFlash, TypeInterview, TypeFreewrite, TypeJournal, TypeMicro,
        TypePoem, TypePaper, TypeLesson, TypeCharacter, TypeResearch,
        TypeReview, TypeSong, TypeStory, TypeTravel,
        TypeEssayIdea, TypePoemIdea, TypeArticleIdea, TypeBookIdea,
        TypeStoryIdea, TypePaperIdea, TypeInterviewIdea, TypeFlashIdea,
        TypeMicroIdea, TypeOther,
    }
}

func PrimaryTypes() []WorkType {
    return []WorkType{
        TypeArticle, TypeBook, TypeChapter, TypeCritique, TypeEssay,
        TypeFlash, TypeInterview, TypeFreewrite, TypeJournal, TypeMicro,
        TypePoem, TypePaper, TypeLesson, TypeCharacter, TypeResearch,
        TypeReview, TypeSong, TypeStory, TypeTravel, TypeOther,
    }
}

func (t WorkType) IsIdea() bool {
    return strings.HasSuffix(string(t), " Idea")
}

func (t WorkType) Order() int {
    order := map[WorkType]int{
        TypeArticle: 1, TypeBook: 2, TypeChapter: 3, TypeCritique: 4,
        TypeEssay: 5, TypeFlash: 6, TypeInterview: 7, TypeFreewrite: 8,
        TypeJournal: 9, TypeMicro: 10, TypePoem: 11, TypePaper: 12,
        TypeLesson: 13, TypeCharacter: 14, TypeResearch: 15, TypeReview: 16,
        TypeSong: 17, TypeStory: 18, TypeTravel: 19,
        TypeEssayIdea: 20, TypePoemIdea: 21, TypeArticleIdea: 22,
        TypeBookIdea: 23, TypeStoryIdea: 24, TypePaperIdea: 25,
        TypeInterviewIdea: 26, TypeFlashIdea: 27, TypeMicroIdea: 28,
        TypeOther: 99,
    }
    if v, ok := order[t]; ok {
        return v
    }
    return 99
}
```

### 5.4 Response Type Values

```go
// ResponseType represents a journal's response to a submission
type ResponseType string

const (
    ResponseAccepted     ResponseType = "Accepted"
    ResponseEmail        ResponseType = "Email"
    ResponseForm         ResponseType = "Form"
    ResponseNoResponse   ResponseType = "No Response"
    ResponsePersonal     ResponseType = "Personal"
    ResponsePersonalNote ResponseType = "Personal Note"
    ResponseWaiting      ResponseType = "Waiting"
)

func AllResponseTypes() []ResponseType {
    return []ResponseType{
        ResponseAccepted, ResponseEmail, ResponseForm, ResponseNoResponse,
        ResponsePersonal, ResponsePersonalNote, ResponseWaiting,
    }
}

func (r ResponseType) IsRejection() bool {
    return r != ResponseAccepted && r != ResponseWaiting
}
```

### 5.5 Note Type Values

```go
// NoteType categorizes notes
type NoteType string

const (
    NoteAcceptance  NoteType = "Acceptance"
    NoteGeneral     NoteType = "Note"
    NoteProblem     NoteType = "Problem"
    NoteResponse    NoteType = "Response"
    NoteReview      NoteType = "Review"
    NoteCritique    NoteType = "Critique"
    NoteTitleChange NoteType = "TitleChange"
    NoteSubmission  NoteType = "Submission"
    NoteContest     NoteType = "Contest"
    NoteReading     NoteType = "Reading"
    NoteExport      NoteType = "Export"
    NoteRevised     NoteType = "Revised"
    NotePosting     NoteType = "Posting"
    NoteQuery       NoteType = "Query"
)

func AllNoteTypes() []NoteType {
    return []NoteType{
        NoteAcceptance, NoteGeneral, NoteProblem, NoteResponse,
        NoteReview, NoteCritique, NoteTitleChange, NoteSubmission,
        NoteContest, NoteReading, NoteExport, NoteRevised,
        NotePosting, NoteQuery,
    }
}
```

### 5.6 Validation Functions

```go
package validation

import "errors"

var ErrInvalidValue = errors.New("invalid value for field")

func ValidateStatus(status string) error {
    for _, s := range models.AllStatuses() {
        if string(s) == status {
            return nil
        }
    }
    return fmt.Errorf("%w: status '%s'", ErrInvalidValue, status)
}

func ValidateQuality(quality string) error {
    for _, q := range models.AllQualities() {
        if string(q) == quality {
            return nil
        }
    }
    return fmt.Errorf("%w: quality '%s'", ErrInvalidValue, quality)
}

func ValidateWorkType(workType string) error {
    for _, t := range models.AllWorkTypes() {
        if string(t) == workType {
            return nil
        }
    }
    return fmt.Errorf("%w: work type '%s'", ErrInvalidValue, workType)
}
```

### 5.7 Dynamic Value List Queries

```go
package repository

// GetJournalList returns all journals for dropdown
func (r *Repository) GetJournalList() ([]IdNamePair, error) {
    rows, err := r.db.Query(`
        SELECT orgID, name FROM Organizations ORDER BY name`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var result []IdNamePair
    for rows.Next() {
        var pair IdNamePair
        if err := rows.Scan(&pair.ID, &pair.Name); err != nil {
            return nil, err
        }
        result = append(result, pair)
    }
    return result, nil
}

// GetWorkList returns all works for dropdown
func (r *Repository) GetWorkList() ([]IdNamePair, error) {
    rows, err := r.db.Query(`
        SELECT workID, title FROM Works ORDER BY title`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var result []IdNamePair
    for rows.Next() {
        var pair IdNamePair
        if err := rows.Scan(&pair.ID, &pair.Name); err != nil {
            return nil, err
        }
        result = append(result, pair)
    }
    return result, nil
}

// GetCollectionList returns all collection names
func (r *Repository) GetCollectionList() ([]string, error) {
    rows, err := r.db.Query(`
        SELECT DISTINCT collection_name FROM Collections ORDER BY collection_name`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var result []string
    for rows.Next() {
        var name string
        if err := rows.Scan(&name); err != nil {
            return nil, err
        }
        result = append(result, name)
    }
    return result, nil
}

type IdNamePair struct {
    ID   int
    Name string
}
```

---

## 6. TypeScript/React Implementation

### 6.1 Type Definitions

```typescript
// src/types/enums.ts

export const STATUS_VALUES = [
  'Out', 'Focus', 'Active', 'Working', 'Resting', 'Waiting',
  'Gestating', 'Sound', 'Published',
  'Sleeping', 'Dying', 'Dead', 'Done'
] as const;

export type Status = typeof STATUS_VALUES[number];

export const QUALITY_VALUES = [
  'Best', 'Better', 'Good', 'Okay', 'Poor', 'Bad', 'Worst', 'Unknown'
] as const;

export type Quality = typeof QUALITY_VALUES[number];

export const WORK_TYPE_VALUES = [
  'Article', 'Book', 'Chapter', 'Critique', 'Essay', 'Flash', 'Interview',
  'Freewrite', 'Journal', 'Micro', 'Poem', 'Paper', 'Lesson', 'Character',
  'Research', 'Review', 'Song', 'Story', 'Travel',
  'Essay Idea', 'Poem Idea', 'Article Idea', 'Book Idea', 'Story Idea',
  'Paper Idea', 'Interview Idea', 'Flash Idea', 'Micro Idea', 'Other'
] as const;

export type WorkType = typeof WORK_TYPE_VALUES[number];

export const RESPONSE_TYPE_VALUES = [
  'Waiting', 'Accepted', 'Form', 'Personal', 'Withdrawn', 'Lost', 'Expired'
] as const;

export type ResponseType = typeof RESPONSE_TYPE_VALUES[number];
```

### 6.2 React Select Components

```tsx
// src/components/ui/StatusSelect.tsx
import { STATUS_VALUES, Status } from '@/types/enums';

interface StatusSelectProps {
  value: Status;
  onChange: (value: Status) => void;
  disabled?: boolean;
}

export function StatusSelect({ value, onChange, disabled }: StatusSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      disabled={disabled}
      className="px-3 py-2 border rounded-md bg-white"
    >
      {STATUS_VALUES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
```

```tsx
// src/components/ui/QualitySelect.tsx
import { QUALITY_VALUES, Quality } from '@/types/enums';

interface QualitySelectProps {
  value: Quality;
  onChange: (value: Quality) => void;
  disabled?: boolean;
}

export function QualitySelect({ value, onChange, disabled }: QualitySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Quality)}
      disabled={disabled}
      className="px-3 py-2 border rounded-md bg-white"
    >
      {QUALITY_VALUES.map((quality) => (
        <option key={quality} value={quality}>
          {quality}
        </option>
      ))}
    </select>
  );
}
```

### 6.3 Dynamic Value List Hooks

```typescript
// src/hooks/useValueLists.ts
import { useState, useEffect } from 'react';
import { GetJournalList, GetWorkList, GetCollectionList } from '../../wailsjs/go/main/App';

interface IdNamePair {
  id: number;
  name: string;
}

export function useJournalList() {
  const [journals, setJournals] = useState<IdNamePair[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    GetJournalList().then((data) => {
      setJournals(data);
      setLoading(false);
    });
  }, []);
  
  return { journals, loading };
}

export function useWorkList() {
  const [works, setWorks] = useState<IdNamePair[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    GetWorkList().then((data) => {
      setWorks(data);
      setLoading(false);
    });
  }, []);
  
  return { works, loading };
}

export function useCollectionList() {
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    GetCollectionList().then((data) => {
      setCollections(data);
      setLoading(false);
    });
  }, []);
  
  return { collections, loading };
}
```

### 6.4 Styling Constants

```typescript
// src/types/styles.ts
import { Status, Quality } from './enums';

export const STATUS_COLORS: Record<Status, string> = {
  'Out': 'bg-red-100 text-red-800',
  'Focus': 'bg-yellow-100 text-yellow-800',
  'Active': 'bg-green-100 text-green-800',
  'Working': 'bg-blue-100 text-blue-800',
  'Resting': 'bg-purple-100 text-purple-800',
  'Waiting': 'bg-orange-100 text-orange-800',
  'Gestating': 'bg-pink-100 text-pink-800',
  'Sound': 'bg-teal-100 text-teal-800',
  'Published': 'bg-emerald-100 text-emerald-800',
  'Sleeping': 'bg-gray-100 text-gray-800',
  'Dying': 'bg-gray-200 text-gray-600',
  'Dead': 'bg-gray-300 text-gray-500',
  'Done': 'bg-slate-100 text-slate-800',
};

export const QUALITY_COLORS: Record<Quality, string> = {
  'Best': 'bg-green-100 text-green-800',
  'Better': 'bg-lime-100 text-lime-800',
  'Good': 'bg-blue-100 text-blue-800',
  'Okay': 'bg-gray-100 text-gray-800',
  'Poor': 'bg-yellow-100 text-yellow-800',
  'Bad': 'bg-orange-100 text-orange-800',
  'Worst': 'bg-red-100 text-red-800',
  'Unknown': 'bg-slate-100 text-slate-800',
};
```

---

*End of Value Lists Specification*
