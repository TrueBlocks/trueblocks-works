# Submissions Database - Design Specification

> **Version:** 2.0  
> **Generated:** January 2, 2026  
> **Source:** FileMaker Pro Database (dbSubmissions.fmp12)  
> **Purpose:** Complete technical specification for migration to a Wails desktop application with React/TypeScript frontend

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Document Index](#3-document-index)
4. [Architecture Decisions](#4-architecture-decisions)
5. [Migration Strategy](#5-migration-strategy)

---

## 1. Executive Summary

### 1.1 Purpose

This specification documents the complete design of the **Submissions Tracking System**, a personal database for managing creative writing works, their organization into collections, tracking submissions to literary journals, and recording responses.

### 1.2 Current System Statistics

| Component | Count | Status |
|-----------|-------|--------|
| **Tables** | 7 | Fully documented |
| **Relationships** | 6 | Verified and mapped |
| **Fields** | 107 | All types catalogued |
| **Layouts** | 17 | Visual specs captured |
| **Scripts** | 46 | Logic fully documented |
| **Custom Functions** | 8 | All convertible |
| **Value Lists** | 20 | Static + dynamic lists |
| **Records** | ~6,000+ | Exported to CSV |

### 1.3 Data Volume

| Table | Records | Description |
|-------|---------|-------------|
| Works | 1,749 | Creative writing pieces (poems, stories, essays, etc.) |
| Organizations | 755 | Literary journals and publishers |
| Submissions | 246 | Submission records tracking where works were sent |
| Collections | 31 | Groupings/categories of works |
| CollectionDetails | 2,996 | Many-to-many links between Collections and Works |
| Work Notes | 221 | Notes, critiques, and revision history for works |
| Journal Notes | 239 | Notes about organizations/journals |

### 1.4 Core Workflows

1. **Work Management**: Create, categorize, and track status of creative works
2. **Collection Organization**: Group works into thematic or status-based collections
3. **Submission Tracking**: Record submissions to journals with dates and responses
4. **Response Handling**: Track acceptances, rejections, and follow-up actions
5. **File Management**: Link database records to physical .docx files on disk

---

## 2. System Overview

### 2.1 Domain Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUBMISSIONS TRACKING SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌──────────────────┐         ┌─────────────┐      │
│  │ Collections │─────────│ CollectionDetails │─────────│    Works    │      │
│  │             │ 1     * │   (join table)    │ *     1 │             │      │
│  │ - collID    │         │ - collID          │         │ - workID    │      │
│  │ - Name      │         │ - workID          │         │ - Title     │      │
│  │ - isStatus  │         │ - Collection Name │         │ - Type      │      │
│  │ - Type      │         └──────────────────┘         │ - Status    │      │
│  └─────────────┘                                       │ - Quality   │      │
│                                                        │ - Year      │      │
│                                                        │ - Path      │      │
│                                                        └──────┬──────┘      │
│                                                               │             │
│                         ┌─────────────────────────────────────┼─────┐       │
│                         │                                     │     │       │
│                         ▼                                     ▼     ▼       │
│                  ┌────────────┐                      ┌─────────────────┐   │
│                  │ Work Notes │                      │   Submissions   │   │
│                  │            │                      │                 │   │
│                  │ - workID   │                      │ - submissionID  │   │
│                  │ - Type     │                      │ - workID        │   │
│                  │ - Note     │                      │ - orgID         │   │
│                  │ - Date     │                      │ - Submit Date   │   │
│                  └────────────┘                      │ - Response Type │   │
│                                                      │ - Response Date │   │
│                                                      └────────┬────────┘   │
│                                                               │             │
│                                                               ▼             │
│                  ┌───────────────┐                   ┌──────────────────┐  │
│                  │ Journal Notes │───────────────────│  Organizations   │  │
│                  │               │ *               1 │                  │  │
│                  │ - orgID       │                   │ - orgID          │  │
│                  │ - Type        │                   │ - Name           │  │
│                  │ - Note        │                   │ - URL            │  │
│                  └───────────────┘                   │ - My Interest    │  │
│                                                      │ - Accepts        │  │
│                                                      └──────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Concepts

#### Works
A "Work" is any piece of creative writing: poem, story, essay, flash fiction, article, etc. Each work has:
- **Identity**: Unique ID, title, type, year created
- **Status**: Current workflow state (Focus, Active, Working, Resting, Published, etc.)
- **Quality**: Self-assessment rating (Best, Better, Good, Okay, Bad, Worst)
- **Physical File**: Path to the .docx file on disk
- **Metadata**: Word count, flags (isBlog, isPrinted, isRevised, isProsePoem)

#### Collections
Collections are groupings of works. Some are **status-based** (marked with `isStatus = "yes"`) and represent workflow stages. Others are thematic or project-based.

**Status Collections** (workflow stages):
- Out → Focus → Active → Working → Resting → Waiting
- Gestating → Published → Done
- Sleeping → Dying → Dead

**Non-Status Collections** (thematic):
- Book projects (Spiral, Doylestown, Storey Cotton)
- Time-based archives (Poetry 2008, Prose 2010)
- Special projects (365 Challenge, Math Essays)

#### Organizations
Literary journals, magazines, and publishers where works can be submitted. Includes:
- Contact information and URLs
- Submission preferences (online, email, snail mail)
- Quality indicators (Pushcart nominations, acceptance rates)
- Personal interest rating

#### Submissions
Records of when a work was sent to an organization. Tracks:
- Which work, which journal, which draft
- Submission date and method
- Response type (Accepted, Form rejection, Personal rejection, etc.)
- Response date

---

## 3. Document Index

This specification is divided into the following detailed documents:

| Document | Description |
|----------|-------------|
| [01-data-model.md](01-data-model.md) | Complete database schema with all fields, types, and validations |
| [02-relationships.md](02-relationships.md) | Entity relationships, foreign keys, and join behaviors |
| [03-business-logic.md](03-business-logic.md) | Scripts, workflows, and automation rules |
| [04-value-lists.md](04-value-lists.md) | All enumerated values and dynamic lookups |
| [05-custom-functions.md](05-custom-functions.md) | Reusable calculation functions |
| [06-layouts.md](06-layouts.md) | UI specifications, field placement, and keyboard shortcuts |
| [07-file-management.md](07-file-management.md) | File path conventions and document handling |
| [08-migration-guide.md](08-migration-guide.md) | Step-by-step migration to Go/SQLite, Wails binding signatures |
| [09-app-state.md](09-app-state.md) | Application state, globals migration, and session persistence |
| [10-error-handling.md](10-error-handling.md) | Error categories, user messaging, retry logic, and undo/redo |
| [11-validation.md](11-validation.md) | Edge value behaviors, field validation rules, and constraints |
| [12-integration-tests.md](12-integration-tests.md) | Critical workflow tests, data integrity tests, and E2E testing |
| [13-search.md](13-search.md) | Full-text search architecture, FTS5, global search UI |
| [14-backup-restore.md](14-backup-restore.md) | Automatic backups, manual backup, restore process, VACUUM |
| [15-schema-migrations.md](15-schema-migrations.md) | Database versioning, migration runner, rollback strategy |
| [16-platform-differences.md](16-platform-differences.md) | macOS-specific notes, keyboard shortcuts, file paths |
| [17-installation-guide.md](17-installation-guide.md) | First-run wizard, LibreOffice detection, data import |

---

## 4. Architecture Decisions

### 4.1 Technology Stack

This application will be built as a native desktop application using:

| Layer | Technology | Rationale |
|-------|------------|----------|
| **Framework** | Wails v2 | Native desktop app with web technologies, single binary |
| **Backend** | Go 1.21+ | Strong typing, excellent file I/O, SQLite support, Wails backend |
| **Frontend** | React 18 | Component-based UI, large ecosystem, excellent TypeScript support |
| **Language** | TypeScript 5 | Type safety, IDE support, catches errors at compile time |
| **Package Manager** | Yarn | Fast, reliable dependency management |
| **Database** | SQLite 3 | Portable, file-based, SQL-compatible, perfect for single-user |
| **UI Library** | Mantine 7 | Full-featured React component library with hooks |
| **Icons** | Tabler Icons | Consistent icon set, integrates with Mantine |
| **State Management** | React Context + Hooks | Simple state for single-user app |
| **Data Format** | JSON | For Wails bindings between Go and React |

### 4.2 Key Design Principles

1. **File-Linked Records**: Works are linked to physical .docx files. The system should verify file existence and handle renames gracefully.

2. **Many-to-Many Collections**: A work can belong to multiple collections simultaneously. The CollectionDetails join table handles this.

3. **Status as Collection Membership**: Workflow status is implemented as collection membership, not a simple field. When status changes, collection membership updates.

4. **Calculated Display Fields**: Several fields (DelCol, Journal Name, Title of Work) are lookups for display. In SQL, these become JOINs.

5. **Path Generation**: File paths are computed from work attributes using a deterministic formula. The `generatePath` function must be preserved exactly.

6. **Automatic PDF Generation**: Unlike the original FileMaker system (which relied on pre-existing PDFs), the new app generates preview PDFs on-demand using LibreOffice headless conversion. See [07-file-management.md](07-file-management.md#6-pdf-preview-system).

7. **Background File Watching**: A goroutine monitors the documents folder for changes to .docx files and automatically regenerates PDF previews when files are modified.

8. **Integrated Work Creation**: Creating a new work automatically creates the document file from a template, generates the initial PDF preview, adds the work to collections, and optionally opens the document in the default editor. See [03-business-logic.md](03-business-logic.md#31-addwork).

### 4.3 Data Integrity Rules

1. **Works.workID** is the primary key, auto-incremented
2. **Works.Type** must be a valid WorkType value (enforced by value list)
3. **Works.Status** defaults to "Working" for new records
4. **Works.Quality** defaults to "Okay" for new records
5. **Submissions** require both workID and orgID foreign keys
6. **CollectionDetails** require both collID and workID
7. **Work Notes** and **Journal Notes** are cascade-deleted with their parent

---

## 5. Migration Strategy

### 5.1 Phase 1: Data Export (Complete)

All tables have been exported to CSV format:
- `design/export/dbSubmissions/*.csv`

### 5.2 Phase 2: Schema Creation

Create SQLite tables matching the specification in [01-data-model.md](01-data-model.md).

### 5.3 Phase 3: Data Import

1. Import Organizations first (no dependencies)
2. Import Collections second (no dependencies)
3. Import Works third (no dependencies on other tables)
4. Import CollectionDetails (requires Collections + Works)
5. Import Submissions (requires Works + Organizations)
6. Import Work Notes (requires Works)
7. Import Journal Notes (requires Organizations)

### 5.4 Phase 4: Wails Application Development

Implement the application using the Wails framework:

1. **Go Backend (Wails bindings)**
   - Custom functions from [05-custom-functions.md](05-custom-functions.md)
   - Business logic from [03-business-logic.md](03-business-logic.md)
   - File operations from [07-file-management.md](07-file-management.md)
   - Wails-exposed methods for React frontend

2. **React Frontend**
   - TypeScript interfaces matching Go structs
   - Components based on [06-layouts.md](06-layouts.md)
   - Conditional formatting via Mantine Badge components
   - Native dialogs via Wails runtime

### 5.5 Phase 5: Testing & Deployment

Build and distribute as native desktop app:
1. `wails dev` for development with hot reload
2. `wails build` for production binary
3. Single executable, no installation required

---

## Appendix A: Source Files

| Source | Location | Description |
|--------|----------|-------------|
| FileMaker Database | `design/databases/dbSubmissions.fmp12` | Original binary database |
| Design Report (HTML) | `design/design_reports/dbSubmissions/` | Full DDR export |
| Exported Data (CSV) | `design/export/dbSubmissions/` | All table data |
| AI Analysis | `design/export/dbSubmissions/ai/` | Previous analysis docs |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **DDR** | Database Design Report - FileMaker's export of database structure |
| **Collection** | A grouping of works, either status-based or thematic |
| **Status Collection** | A collection where `isStatus = "yes"`, representing workflow state |
| **Organization** | A literary journal, magazine, or publisher |
| **Submission** | A record of sending a work to an organization |
| **Work** | A piece of creative writing (poem, story, essay, etc.) |
| **Work Note** | A note attached to a work (critique, revision note, etc.) |
| **Journal Note** | A note attached to an organization |
| **TO** | Table Occurrence - FileMaker term for a table reference in relationships |

---

*End of Main Specification*
