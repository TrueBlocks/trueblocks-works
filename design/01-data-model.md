# Data Model Specification

> **Document:** 01-data-model.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Collections Table](#1-collections-table)
2. [CollectionDetails Table](#2-collectiondetails-table)
3. [Works Table](#3-works-table)
4. [Organizations Table](#4-organizations-table)
5. [Submissions Table](#5-submissions-table)
6. [Work Notes Table](#6-work-notes-table)
7. [Journal Notes Table](#7-journal-notes-table)
8. [SQLite Schema](#8-sqlite-schema)
9. [TypeScript Interfaces](#9-typescript-interfaces)
10. [Go Structs](#10-go-structs)

---

## 1. Collections Table

**Purpose:** Define groupings/categories for organizing works. Some collections represent workflow status.

**Record Count:** 31 collections

### 1.1 Field Definitions

| Field             | Type          | Required | Default                  | Description                                                      |
| ----------------- | ------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| `Collection ID`   | Number        | Yes      | Auto-serial (10200, +10) | Primary key                                                      |
| `Collection Name` | Text          | Yes      | -                        | Display name of the collection                                   |
| `isStatus`        | Text          | No       | -                        | "yes" if this collection represents a workflow status            |
| `Type`            | Text          | No       | -                        | Category: "Active", "Process", "Dead", "Book", "Other", "Hidden" |
| `statusList`      | Text (calc)   | No       | -                        | Returns Collection Name if isStatus="yes", else "None"           |
| `nItems`          | Number (calc) | No       | -                        | Count of works in this collection                                |

> **Note:** UI filter flags (gl_showAll, gl_showActive, etc.) have been migrated to AppState.
> See [09-app-state.md](09-app-state.md) for details.

### 1.2 Indexes

- `Collection ID`: Primary key, unique, all values indexed
- `Collection Name`: All values indexed

### 1.3 Sample Data

| Collection ID | Collection Name | isStatus | Type    |
| ------------- | --------------- | -------- | ------- |
| 00090         | Out             | yes      | Process |
| 10010         | Focus           | yes      | Active  |
| 10020         | Active          | yes      | Active  |
| 10030         | Working         | yes      | Active  |
| 10040         | Resting         | yes      | Active  |
| 10050         | Waiting         | yes      | Active  |
| 20010         | Gestating       | yes      | Process |
| 40010         | Spiral          | -        | Book    |
| 60010         | Sleeping        | yes      | Dead    |
| 60020         | Dying           | yes      | Dead    |
| 60030         | Dead            | yes      | Dead    |
| 70010         | Published       | yes      | Process |

---

## 2. CollectionDetails Table

**Purpose:** Join table implementing many-to-many relationship between Collections and Works.

**Record Count:** 2,996 records

### 2.1 Field Definitions

| Field             | Type   | Required | Default | Description                              |
| ----------------- | ------ | -------- | ------- | ---------------------------------------- |
| `collID`          | Number | Yes      | -       | Foreign key to Collections               |
| `WorkID`          | Number | Yes      | -       | Foreign key to Works                     |
| `Collection Name` | Text   | Yes      | -       | Denormalized collection name for display |

### 2.2 Indexes

- `collID`: All values indexed
- `WorkID`: All values indexed
- `Collection Name`: All values indexed

### 2.3 Relationship Behaviors

| Direction                       | Behavior                                 |
| ------------------------------- | ---------------------------------------- |
| Collections → CollectionDetails | Allow creation: No                       |
| CollectionDetails → Works       | Allow creation: Yes, Delete cascade: Yes |

### 2.4 Sort Order (in relationship)

When accessed from Collections:

1. `Collection Name` ascending

When accessed from Works (via CollectionDetails):

1. `Status` (custom order by StatusList)
2. `Quality` (custom order by QualityList)
3. `Type` (custom order by WorkType)
4. `Title` ascending

---

## 3. Works Table

**Purpose:** Store creative writing pieces with metadata and file references.

**Record Count:** 1,749 works

### 3.1 Field Definitions

| Field           | Type          | Required | Default                 | Validation                    | Description                          |
| --------------- | ------------- | -------- | ----------------------- | ----------------------------- | ------------------------------------ |
| `workID`        | Number        | Yes      | Auto-serial (22200, +1) | Unique                        | Primary key                          |
| `Title`         | Text          | Yes      | -                       | -                             | Title of the work                    |
| `Type`          | Text          | Yes      | -                       | Member of WorkType value list | Work type (Poem, Story, Essay, etc.) |
| `Year`          | Text          | No       | Current year            | -                             | Year created                         |
| `Status`        | Text          | No       | "Working"               | -                             | Current workflow status              |
| `Quality`       | Text          | No       | "Okay"                  | -                             | Self-assessment quality rating       |
| `DocType`       | Text          | No       | "docx"                  | -                             | File extension                       |
| `Path`          | Text          | No       | -                       | -                             | Legacy file path                     |
| `generatedPath` | Text (calc)   | No       | -                       | -                             | Computed file path                   |
| `Draft`         | Text          | No       | -                       | -                             | Current draft designation            |
| `nWords`        | Number        | No       | -                       | -                             | Word count                           |
| `CourseName`    | Text          | No       | -                       | -                             | Associated course/workshop           |
| `isBlog`        | Text          | No       | -                       | -                             | "yes" if posted to blog              |
| `isPrinted`     | Text          | No       | -                       | -                             | "yes" if printed                     |
| `isProsePoem`   | Text          | No       | -                       | -                             | "yes" if prose poem                  |
| `isRevised`     | Text          | No       | -                       | -                             | "yes" if recently revised            |
| `Mark`          | Text          | No       | -                       | -                             | Temporary marker                     |
| `accessDate`    | Timestamp     | No       | -                       | -                             | Last accessed timestamp              |
| `Age`           | Number (calc) | No       | -                       | -                             | Days since last access               |
| `Check`         | Text (calc)   | No       | -                       | -                             | File existence validation            |
| `DelCol`        | Text (calc)   | No       | -                       | -                             | Comma-separated collection names     |
| `nSubmissions`  | Number (calc) | No       | -                       | -                             | Count of submissions                 |
| `memo`          | Container     | No       | -                       | -                             | Attached document/image              |
| `hasMemo`       | Text (calc)   | No       | -                       | -                             | "yes" if memo has content            |
| `memoPath`      | Text (calc)   | No       | -                       | -                             | Path from layout object              |

> **Note:** Browser URL globals (g_BrowserURL, g_CurrentPath) have been migrated to AppState.
> See [09-app-state.md](09-app-state.md) for details.

### 3.2 Indexes

- `workID`: Primary key, unique, all values indexed
- `Title`: All values indexed
- `Type`: All values indexed
- `Year`: All values indexed
- `Status`: All values indexed
- `Quality`: All values indexed
- `DocType`: All values indexed

### 3.3 Calculated Field Formulas

#### generatedPath

```
generatePath ( Type ; Year ; Title ; Quality ; Status ) & "." & DocType
```

Uses custom functions to build: `{folder}/{qualityMark}{Type} - {Year} - {Title}.{DocType}`

#### Age

```
Timestamp ( Get ( CurrentDate ) ; Get ( CurrentTime ) ) - accessDate
```

Returns seconds since last access (divide by 86400 for days).

#### DelCol

```
Substitute ( List ( CollectionDetails::Collection Name ) ; "¶" ; ", " )
```

Aggregates all collection names for this work.

#### nSubmissions

```
Count ( Submissions::Title of Work )
```

Counts related submission records.

#### Check

```
If ( not fileExists ( getFilename ( generatedPath ) ) ;
   If ( not fileExists ( getFilename ( Path ) ) ;
      "file missing" ;
      "name changed"
   ) ;
   If ( generatedPath ≠ Path ;
      "paths disagree" ;
      ""
   )
)
```

Validates file existence and path consistency.

### 3.4 Sample Data (CSV Headers)

```csv
"CourseName","DocType","Draft","isBlog","isPrinted","isProsePoem","isRevised","Mark","Path","Quality","Status","Title","Type","nWords","workID","accessDate"
```

---

## 4. Organizations Table

**Purpose:** Store information about literary journals, magazines, and publishers.

**Record Count:** 755 organizations

### 4.1 Field Definitions

| Field              | Type          | Required | Default           | Description                                                 |
| ------------------ | ------------- | -------- | ----------------- | ----------------------------------------------------------- |
| `orgID`            | Number        | Yes      | Auto-serial       | Primary key                                                 |
| `Name`             | Text          | Yes      | -                 | Organization name                                           |
| `Other Name`       | Text          | No       | -                 | Alternate name                                              |
| `URL`              | Text          | No       | -                 | Main website URL                                            |
| `Other URL`        | Text          | No       | -                 | Submission guidelines URL                                   |
| `Status`           | Text          | No       | "Open"            | Organization status                                         |
| `Type`             | Text          | No       | "Journal"         | Organization type                                           |
| `Timing`           | Text          | No       | -                 | Submission timing                                           |
| `Submission Types` | Text          | No       | -                 | Accepted methods (online, email, snail mail)                |
| `Accepts`          | Text          | No       | -                 | Accepted genres (poetry, cnf, short fiction, etc.)          |
| `My Interest`      | Text          | No       | -                 | Personal interest level (Best, Better, Good, Okay, Unknown) |
| `Ranking`          | Number        | No       | -                 | Numerical ranking                                           |
| `Rating`           | Number (calc) | No       | -                 | Computed priority for sorting                               |
| `Mark`             | Text          | No       | -                 | Temporary marker                                            |
| `Doutrope Num`     | Number        | No       | -                 | Duotrope database number                                    |
| `nPushFiction`     | Number        | No       | -                 | Pushcart nominations for fiction                            |
| `nPushNonFiction`  | Number        | No       | -                 | Pushcart nominations for non-fiction                        |
| `nPushPoetry`      | Number        | No       | -                 | Pushcart nominations for poetry                             |
| `nPushcarts`       | Number (calc) | No       | -                 | Total Pushcart nominations                                  |
| `nSubmissions`     | Number (calc) | No       | -                 | Count of submissions to this org                            |
| `Source`           | Text          | No       | -                 | How this org was discovered                                 |
| `Website Menu`     | Text          | No       | -                 | Website menu structure                                      |
| `Contest Ends`     | Date          | No       | -                 | Contest deadline                                            |
| `Contest Fee`      | Text          | No       | -                 | Contest entry fee                                           |
| `Contest Prize`    | Text          | No       | -                 | Contest prize amount                                        |
| `Contest Prize 2`  | Text          | No       | -                 | Secondary prize                                             |
| `Date Added`       | Timestamp     | No       | Auto-creation     | When record was created                                     |
| `Date Modified`    | Timestamp     | No       | Auto-modification | When record was last modified                               |

> **Note:** Browser globals (g_CurrentURL, g_BrowserOn, g_currentWork) have been migrated to AppState.
> See [09-app-state.md](09-app-state.md) for details.

### 4.2 Calculated Field Formulas

#### Rating

```
If ( nPushPoetry > 0 ; 1000 ; 2000 ) + Ranking
```

Priority calculation: journals with Pushcart nominations sort first.

#### nPushcarts

```
nPushFiction + nPushNonFiction + nPushPoetry
```

#### nSubmissions

```
Count ( Works::Title )
```

**Note:** This calculation appears incorrect in the original database. Should count Submissions, not Works.

### 4.3 Sample Data (CSV Headers)

```csv
"Accepts","Contest Fee","Contest Prize","Contest Prize 2","Mark","My Interest","Name","Other Name","Other URL","Source","Status","Submission Types","Timing","Type","URL","Website Menu","Doutrope Num","nPushFiction","nPushNonFiction","nPushPoetry","orgID","Ranking","Contest Ends","Date Added","Date Modified"
```

---

## 5. Submissions Table

**Purpose:** Track when works are submitted to organizations and their responses.

**Record Count:** 246 submissions

### 5.1 Field Definitions

| Field             | Type        | Required | Default                 | Validation | Description                          |
| ----------------- | ----------- | -------- | ----------------------- | ---------- | ------------------------------------ |
| `submissionID`    | Number      | Yes      | Auto-serial (40322, +1) | Unique     | Primary key                          |
| `workID`          | Number      | Yes      | -                       | -          | Foreign key to Works                 |
| `orgID`           | Number      | Yes      | -                       | -          | Foreign key to Organizations         |
| `Title of Work`   | Text (calc) | No       | -                       | -          | Lookup: Works::Title                 |
| `Journal Name`    | Text (calc) | No       | -                       | -          | Lookup: Organizations::Name          |
| `Draft`           | Text        | No       | From last record        | Not empty  | Draft version submitted              |
| `Submission Date` | Date        | No       | Creation date           | -          | Date submitted                       |
| `Submission Type` | Text        | No       | From last record        | -          | How submitted (online, email, paper) |
| `Query Date`      | Date        | No       | -                       | -          | Date of follow-up query              |
| `Response Date`   | Date        | No       | -                       | -          | Date response received               |
| `Response Type`   | Text        | No       | -                       | -          | Type of response received            |
| `decisionPending` | Text (calc) | No       | -                       | -          | "yes" if awaiting response           |
| `Contest Name`    | Text        | No       | -                       | -          | Contest name if applicable           |
| `Cost`            | Number      | No       | -                       | -          | Submission fee paid                  |
| `User ID`         | Text        | No       | -                       | -          | Login credentials                    |
| `Password`        | Text        | No       | -                       | -          | Login credentials                    |
| `Web Address`     | Text        | No       | -                       | -          | Submission URL                       |
| `Mark`            | Text        | No       | -                       | -          | Temporary marker                     |

### 5.2 Calculated Field Formulas

#### Title of Work

```
Works::Title
```

Simple lookup via workID relationship.

#### Journal Name

```
Organizations::Name
```

Simple lookup via orgID relationship.

#### decisionPending

```
If ( Response Type ≠ "" and Response Type ≠ "Waiting" ; "no" ; "yes" )
```

Returns "yes" if still awaiting response.

### 5.3 Relationship Sort Order

When accessed from Works:

1. `Response Date` descending
2. `Submission Date` descending

### 5.4 Sample Data (CSV Headers)

```csv
"Contest Name","Draft","Mark","Password","Response Type","Submission Type","User ID","Web Address","Cost","orgID","submissionID","workID","Query Date","Response Date","Submission Date"
```

---

## 6. Work Notes Table

**Purpose:** Store notes, critiques, and history for individual works.

**Record Count:** 221 notes

### 6.1 Field Definitions

| Field          | Type        | Required | Default | Description            |
| -------------- | ----------- | -------- | ------- | ---------------------- |
| `workID`       | Number      | Yes      | -       | Foreign key to Works   |
| `Type`         | Text        | No       | -       | Note type category     |
| `Note`         | Text        | No       | -       | Note content           |
| `Handle`       | Text (calc) | No       | -       | Lookup: Works::Title   |
| `Modifed Date` | Timestamp   | No       | -       | When note was modified |

### 6.2 Note Types (Value List)

- Acceptance
- Critique
- Export
- Note
- Posting
- Problem
- Query
- Reading
- Rejection
- Response
- Review
- Revised
- Submission
- TitleChange
- Contest

### 6.3 Relationship Behaviors

| Behavior                           | Setting |
| ---------------------------------- | ------- |
| Allow creation via relationship    | Yes     |
| Delete related when parent deleted | Yes     |

---

## 7. Journal Notes Table

**Purpose:** Store notes about organizations/journals.

**Record Count:** 239 notes

### 7.1 Field Definitions

| Field          | Type        | Required | Default | Description                  |
| -------------- | ----------- | -------- | ------- | ---------------------------- |
| `orgID`        | Number      | Yes      | -       | Foreign key to Organizations |
| `Type`         | Text        | No       | -       | Note type category           |
| `Note`         | Text        | No       | -       | Note content                 |
| `Handle`       | Text (calc) | No       | -       | Lookup: Organizations::Name  |
| `Modifed Date` | Timestamp   | No       | -       | When note was modified       |

### 7.2 Relationship Behaviors

| Behavior                           | Setting |
| ---------------------------------- | ------- |
| Allow creation via relationship    | Yes     |
| Delete related when parent deleted | Yes     |

---

## 8. SQLite Schema

### 8.1 Complete DDL

```sql
-- Collections table
CREATE TABLE Collections (
    collID INTEGER PRIMARY KEY,
    collection_name TEXT NOT NULL,
    is_status TEXT,
    type TEXT,
    UNIQUE(collection_name)
);

-- Works table
CREATE TABLE Works (
    workID INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    year TEXT,
    status TEXT DEFAULT 'Working',
    quality TEXT DEFAULT 'Okay',
    quality_at_publish TEXT,  -- Stores original quality when status changes to Published
    doc_type TEXT DEFAULT 'docx',
    path TEXT,
    draft TEXT,
    n_words INTEGER,
    course_name TEXT,
    is_blog TEXT,
    is_printed TEXT,
    is_prose_poem TEXT,
    is_revised TEXT,
    mark TEXT,
    access_date TEXT,  -- ISO 8601 timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CollectionDetails (join table)
CREATE TABLE CollectionDetails (
    id INTEGER PRIMARY KEY,
    collID INTEGER NOT NULL,
    workID INTEGER NOT NULL,
    collection_name TEXT,
    FOREIGN KEY (collID) REFERENCES Collections(collID),
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE,
    UNIQUE(collID, workID)
);

-- Organizations table
CREATE TABLE Organizations (
    orgID INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    other_name TEXT,
    url TEXT,
    other_url TEXT,
    status TEXT DEFAULT 'Open',
    type TEXT DEFAULT 'Journal',
    timing TEXT,
    submission_types TEXT,
    accepts TEXT,
    my_interest TEXT,
    ranking INTEGER,
    source TEXT,
    website_menu TEXT,
    duotrope_num INTEGER,
    n_push_fiction INTEGER DEFAULT 0,
    n_push_nonfiction INTEGER DEFAULT 0,
    n_push_poetry INTEGER DEFAULT 0,
    contest_ends TEXT,
    contest_fee TEXT,
    contest_prize TEXT,
    contest_prize_2 TEXT,
    date_added TEXT DEFAULT CURRENT_TIMESTAMP,
    date_modified TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Submissions table
CREATE TABLE Submissions (
    submissionID INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    orgID INTEGER NOT NULL,
    draft TEXT NOT NULL,
    submission_date TEXT,
    submission_type TEXT,
    query_date TEXT,
    response_date TEXT,
    response_type TEXT,
    contest_name TEXT,
    cost REAL,
    user_id TEXT,
    password TEXT,
    web_address TEXT,
    mark TEXT,
    FOREIGN KEY (workID) REFERENCES Works(workID),
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID)
);

-- Work Notes table
CREATE TABLE WorkNotes (
    id INTEGER PRIMARY KEY,
    workID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    FOREIGN KEY (workID) REFERENCES Works(workID) ON DELETE CASCADE
);

-- Journal Notes table
CREATE TABLE JournalNotes (
    id INTEGER PRIMARY KEY,
    orgID INTEGER NOT NULL,
    type TEXT,
    note TEXT,
    modified_date TEXT,
    FOREIGN KEY (orgID) REFERENCES Organizations(orgID) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_works_status ON Works(status);
CREATE INDEX idx_works_type ON Works(type);
CREATE INDEX idx_works_quality ON Works(quality);
CREATE INDEX idx_works_year ON Works(year);
CREATE INDEX idx_works_title ON Works(title);

CREATE INDEX idx_colldet_collid ON CollectionDetails(collID);
CREATE INDEX idx_colldet_workid ON CollectionDetails(workID);

CREATE INDEX idx_submissions_workid ON Submissions(workID);
CREATE INDEX idx_submissions_orgid ON Submissions(orgID);
CREATE INDEX idx_submissions_response ON Submissions(response_type);

CREATE INDEX idx_worknotes_workid ON WorkNotes(workID);
CREATE INDEX idx_journalnotes_orgid ON JournalNotes(orgID);

CREATE INDEX idx_orgs_name ON Organizations(name);
CREATE INDEX idx_orgs_interest ON Organizations(my_interest);
```

### 8.2 Computed Columns as Views

```sql
-- View for Works with computed fields
CREATE VIEW WorksView AS
SELECT
    w.*,
    -- Computed: Age in days
    CAST((julianday('now') - julianday(w.access_date)) AS INTEGER) AS age_days,
    -- Computed: Number of submissions
    (SELECT COUNT(*) FROM Submissions s WHERE s.workID = w.workID) AS n_submissions,
    -- Computed: Collection list
    (SELECT GROUP_CONCAT(cd.collection_name, ', ')
     FROM CollectionDetails cd
     WHERE cd.workID = w.workID) AS collection_list
FROM Works w;

-- View for Organizations with computed fields
CREATE VIEW OrganizationsView AS
SELECT
    o.*,
    -- Computed: Total Pushcarts
    (o.n_push_fiction + o.n_push_nonfiction + o.n_push_poetry) AS n_pushcarts,
    -- Computed: Rating
    (CASE WHEN o.n_push_poetry > 0 THEN 1000 ELSE 2000 END + COALESCE(o.ranking, 9999)) AS rating,
    -- Computed: Number of submissions
    (SELECT COUNT(*) FROM Submissions s WHERE s.orgID = o.orgID) AS n_submissions
FROM Organizations o;

-- View for Submissions with lookups
CREATE VIEW SubmissionsView AS
SELECT
    s.*,
    w.title AS title_of_work,
    o.name AS journal_name,
    CASE
        WHEN s.response_type IS NOT NULL AND s.response_type != 'Waiting'
        THEN 'no'
        ELSE 'yes'
    END AS decision_pending
FROM Submissions s
JOIN Works w ON s.workID = w.workID
JOIN Organizations o ON s.orgID = o.orgID;

-- View for Collections with item count
CREATE VIEW CollectionsView AS
SELECT
    c.*,
    CASE WHEN c.is_status = 'yes' THEN c.collection_name ELSE 'None' END AS status_list,
    (SELECT COUNT(*) FROM CollectionDetails cd WHERE cd.collID = c.collID) AS n_items
FROM Collections c;
```

---

## 9. TypeScript Interfaces

These interfaces are generated by Wails and used in the React frontend.

### 9.1 Core Entity Interfaces

```typescript
// src/types/models.ts

export interface Work {
  workID: number;
  title: string;
  type: WorkType;
  year: string;
  status: Status;
  quality: Quality;
  docType: string;
  path: string;
  draft: string;
  nWords: number;
  courseName: string;
  isBlog: boolean;
  isPrinted: boolean;
  isProsePoem: boolean;
  isRevised: boolean;
  mark: string;
  accessDate: string;
  createdAt: string;
  modifiedAt: string;
  // Computed fields
  generatedPath?: string;
  check?: string;
  nSubmissions?: number;
  collectionList?: string;
  ageDays?: number;
}

export interface Organization {
  orgID: number;
  name: string;
  otherName: string;
  url: string;
  otherUrl: string;
  status: string;
  type: string;
  timing: string;
  submissionTypes: string;
  accepts: string;
  myInterest: Quality;
  ranking: number;
  source: string;
  websiteMenu: string;
  duotropeNum: number;
  nPushFiction: number;
  nPushNonFiction: number;
  nPushPoetry: number;
  contestEnds: string;
  contestFee: string;
  contestPrize: string;
  contestPrize2: string;
  dateAdded: string;
  dateModified: string;
  // Computed fields
  nPushcarts?: number;
  rating?: number;
  nSubmissions?: number;
}

export interface Submission {
  submissionID: number;
  workID: number;
  orgID: number;
  draft: string;
  submissionDate: string;
  submissionType: string;
  queryDate: string;
  responseDate: string;
  responseType: ResponseType;
  contestName: string;
  cost: number;
  userID: string;
  password: string;
  webAddress: string;
  mark: string;
  // Computed/joined fields
  titleOfWork?: string;
  journalName?: string;
  decisionPending?: boolean;
}

export interface Collection {
  collID: number;
  collectionName: string;
  isStatus: boolean;
  type: CollectionType;
  // Computed fields
  nItems?: number;
}

export interface CollectionDetail {
  id: number;
  collID: number;
  workID: number;
  collectionName: string;
}

export interface WorkNote {
  id: number;
  workID: number;
  type: NoteType;
  note: string;
  modifiedDate: string;
}

export interface JournalNote {
  id: number;
  orgID: number;
  type: NoteType;
  note: string;
  modifiedDate: string;
}
```

### 9.2 Enum Types

```typescript
// src/types/enums.ts

export type Status =
  | 'Out'
  | 'Focus'
  | 'Active'
  | 'Working'
  | 'Resting'
  | 'Waiting'
  | 'Gestating'
  | 'Sound'
  | 'Published'
  | 'Sleeping'
  | 'Dying'
  | 'Dead'
  | 'Done';

export type Quality = 'Best' | 'Better' | 'Good' | 'Okay' | 'Poor' | 'Bad' | 'Worst' | 'Unknown';

export type WorkType =
  | 'Poem'
  | 'Poem Idea'
  | 'Prose Poem'
  | 'Story'
  | 'Story Idea'
  | 'Flash Fiction'
  | 'Flash Fiction Idea'
  | 'Micro'
  | 'Micro Idea'
  | 'Essay'
  | 'Essay Idea'
  | 'Article'
  | 'Article Idea'
  | 'CNF'
  | 'CNF Idea'
  | 'Memoir'
  | 'Memoir Idea'
  | 'Letter'
  | 'Letter Idea'
  | 'Review'
  | 'Review Idea'
  | 'Travel'
  | 'Travel Idea'
  | 'Book'
  | 'Book Idea'
  | 'Research'
  | 'Notes'
  | 'Blog Post'
  | 'Other';

export type ResponseType =
  | 'Waiting'
  | 'Accepted'
  | 'Form'
  | 'Personal'
  | 'Withdrawn'
  | 'Lost'
  | 'Expired';

export type NoteType =
  | 'Critique'
  | 'Revision'
  | 'Workshop'
  | 'Idea'
  | 'Research'
  | 'Feedback'
  | 'Draft'
  | 'Final'
  | 'Rejected'
  | 'Accepted'
  | 'Published'
  | 'Submitted'
  | 'Other'
  | 'General';

export type CollectionType = 'Active' | 'Process' | 'Dead' | 'Book' | 'Other' | 'Hidden';
```

### 9.3 Sort Order Constants

```typescript
// src/types/constants.ts

export const STATUS_ORDER: Record<Status, number> = {
  Out: 1,
  Focus: 2,
  Active: 3,
  Working: 4,
  Resting: 5,
  Waiting: 6,
  Gestating: 7,
  Sound: 8,
  Published: 9,
  Sleeping: 10,
  Dying: 11,
  Dead: 12,
  Done: 13,
};

export const QUALITY_ORDER: Record<Quality, number> = {
  Best: 1,
  Better: 2,
  Good: 3,
  Okay: 4,
  Poor: 5,
  Bad: 6,
  Worst: 7,
  Unknown: 8,
};

export const QUALITY_MARKS: Record<Quality, string> = {
  Best: 'aa',
  Better: 'a',
  Good: 'b',
  Okay: 'c',
  Poor: 'd',
  Bad: 'e',
  Worst: 'f',
  Unknown: 'z',
};
```

---

## 10. Go Structs

These structs are used in the Wails backend and automatically generate TypeScript bindings.

### 10.1 Core Entity Structs

```go
// internal/models/work.go
package models

type Work struct {
    WorkID       int    `json:"workID"`
    Title        string `json:"title"`
    Type         string `json:"type"`
    Year         string `json:"year"`
    Status       string `json:"status"`
    Quality      string `json:"quality"`
    DocType      string `json:"docType"`
    Path         string `json:"path"`
    Draft        string `json:"draft"`
    NWords       int    `json:"nWords"`
    CourseName   string `json:"courseName"`
    IsBlog       bool   `json:"isBlog"`
    IsPrinted    bool   `json:"isPrinted"`
    IsProsePoem  bool   `json:"isProsePoem"`
    IsRevised    bool   `json:"isRevised"`
    Mark         string `json:"mark"`
    AccessDate   string `json:"accessDate"`
    CreatedAt    string `json:"createdAt"`
    ModifiedAt   string `json:"modifiedAt"`
    // Computed fields
    GeneratedPath  string `json:"generatedPath,omitempty"`
    Check          string `json:"check,omitempty"`
    NSubmissions   int    `json:"nSubmissions,omitempty"`
    CollectionList string `json:"collectionList,omitempty"`
    AgeDays        int    `json:"ageDays,omitempty"`
}

type Organization struct {
    OrgID           int    `json:"orgID"`
    Name            string `json:"name"`
    OtherName       string `json:"otherName"`
    URL             string `json:"url"`
    OtherURL        string `json:"otherUrl"`
    Status          string `json:"status"`
    Type            string `json:"type"`
    Timing          string `json:"timing"`
    SubmissionTypes string `json:"submissionTypes"`
    Accepts         string `json:"accepts"`
    MyInterest      string `json:"myInterest"`
    Ranking         int    `json:"ranking"`
    Source          string `json:"source"`
    WebsiteMenu     string `json:"websiteMenu"`
    DuotropeNum     int    `json:"duotropeNum"`
    NPushFiction    int    `json:"nPushFiction"`
    NPushNonFiction int    `json:"nPushNonFiction"`
    NPushPoetry     int    `json:"nPushPoetry"`
    ContestEnds     string `json:"contestEnds"`
    ContestFee      string `json:"contestFee"`
    ContestPrize    string `json:"contestPrize"`
    ContestPrize2   string `json:"contestPrize2"`
    DateAdded       string `json:"dateAdded"`
    DateModified    string `json:"dateModified"`
    // Computed
    NPushcarts   int `json:"nPushcarts,omitempty"`
    Rating       int `json:"rating,omitempty"`
    NSubmissions int `json:"nSubmissions,omitempty"`
}

type Submission struct {
    SubmissionID   int     `json:"submissionID"`
    WorkID         int     `json:"workID"`
    OrgID          int     `json:"orgID"`
    Draft          string  `json:"draft"`
    SubmissionDate string  `json:"submissionDate"`
    SubmissionType string  `json:"submissionType"`
    QueryDate      string  `json:"queryDate"`
    ResponseDate   string  `json:"responseDate"`
    ResponseType   string  `json:"responseType"`
    ContestName    string  `json:"contestName"`
    Cost           float64 `json:"cost"`
    UserID         string  `json:"userID"`
    Password       string  `json:"password"`
    WebAddress     string  `json:"webAddress"`
    Mark           string  `json:"mark"`
    // Joined fields
    TitleOfWork     string `json:"titleOfWork,omitempty"`
    JournalName     string `json:"journalName,omitempty"`
    DecisionPending bool   `json:"decisionPending,omitempty"`
}

type Collection struct {
    CollID         int    `json:"collID"`
    CollectionName string `json:"collectionName"`
    IsStatus       bool   `json:"isStatus"`
    Type           string `json:"type"`
    NItems         int    `json:"nItems,omitempty"`
}

type WorkNote struct {
    ID           int    `json:"id"`
    WorkID       int    `json:"workID"`
    Type         string `json:"type"`
    Note         string `json:"note"`
    ModifiedDate string `json:"modifiedDate"`
}

type JournalNote struct {
    ID           int    `json:"id"`
    OrgID        int    `json:"orgID"`
    Type         string `json:"type"`
    Note         string `json:"note"`
    ModifiedDate string `json:"modifiedDate"`
}
```

---

_End of Data Model Specification_
