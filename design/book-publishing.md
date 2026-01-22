# Book Publishing Feature Specification

> **Document:** book-publishing.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 1.0  
> **Created:** January 21, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Data Model](#3-data-model)
4. [Template System](#4-template-system)
5. [Style Audit System](#5-style-audit-system)
6. [User Interface](#6-user-interface)
7. [Export Pipeline](#7-export-pipeline)
8. [Go Backend Bindings](#8-go-backend-bindings)
9. [File Structure](#9-file-structure)
10. [Dependencies](#10-dependencies)
11. [Implementation Order](#11-implementation-order)
12. [Future Considerations](#12-future-considerations)

---

## 1. Overview

### 1.1 Purpose

Add book publishing capabilities to the Works app, allowing collections to be exported as formatted books for Amazon KDP (Kindle Direct Publishing) and other self-publishing platforms.

### 1.2 Core Workflow

```
Collection (ordered works) → Book Metadata → Export → Publish
```

The workflow is designed to be:

- **Repeatable** — Export can be run multiple times as essays are revised
- **Self-contained** — All functionality remains within the Works app
- **Template-driven** — Single template controls all formatting

### 1.3 Key Concepts

| Concept        | Description                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| **Collection** | A group of works, ordered by position. When marked as a book, becomes exportable. |
| **Book**       | Metadata layer on top of a collection (title, author, front/back matter)          |
| **Section**    | A work of type "Section" that divides the book into parts                         |
| **Template**   | A DOCX file defining the styles used throughout the book                          |
| **Export**     | Process of merging all works into a single publishable document                   |

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Export a collection as a single DOCX file suitable for Amazon KDP upload
- Support EPUB and PDF export formats
- Maintain formatting fidelity through a shared template system
- Generate front matter (title page, copyright, dedication, TOC) from metadata
- Generate back matter (acknowledgements, about author) from metadata
- Provide style auditing to identify essays needing cleanup
- Support recto (right-side) page starts for sections and essays
- Include running headers, footers, and page numbers

### 2.2 Non-Goals (For This Version)

- Automatic style cleanup or conversion
- Two-column layouts
- Index generation
- Footnotes/endnotes special handling
- Print-ready PDF with bleeds and crop marks
- Direct upload to publishing platforms
- Cover image embedding in manuscript (cover is separate for KDP)
- ISBN barcode generation

---

## 3. Data Model

### 3.1 Collections Table — New Column

Add `isBook` flag to existing Collections table:

```sql
ALTER TABLE Collections ADD COLUMN isBook INTEGER DEFAULT 0;
```

| Field    | Type    | Default | Description                                 |
| -------- | ------- | ------- | ------------------------------------------- |
| `isBook` | INTEGER | 0       | 1 if collection should be treated as a book |

When `isBook = 1`:

- "Book Settings" tab appears in Collection Detail view
- Book record is created if not exists
- Export functions become available

### 3.2 Works Table — New Column

Add `isTemplateClean` flag for style audit tracking:

```sql
ALTER TABLE Works ADD COLUMN isTemplateClean INTEGER DEFAULT 0;
```

| Field             | Type    | Default | Description                         |
| ----------------- | ------- | ------- | ----------------------------------- |
| `isTemplateClean` | INTEGER | 0       | 1 if work uses only template styles |

### 3.3 New Books Table

```sql
CREATE TABLE Books (
    bookID INTEGER PRIMARY KEY AUTOINCREMENT,
    collID INTEGER NOT NULL UNIQUE,

    -- Core metadata
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT DEFAULT 'Thomas Jay Rush',

    -- Front matter content
    copyright TEXT,
    dedication TEXT,

    -- Back matter content
    acknowledgements TEXT,
    aboutAuthor TEXT,

    -- Publication info
    coverPath TEXT,
    isbn TEXT,
    publishedDate TEXT,

    -- Settings
    templatePath TEXT,
    exportPath TEXT,

    -- Status tracking
    status TEXT DEFAULT 'draft',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (collID) REFERENCES Collections(collID)
);
```

#### Field Definitions

| Field              | Type    | Required | Description                                                   |
| ------------------ | ------- | -------- | ------------------------------------------------------------- |
| `bookID`           | INTEGER | Yes      | Primary key, auto-increment                                   |
| `collID`           | INTEGER | Yes      | Foreign key to Collections (unique — one book per collection) |
| `title`            | TEXT    | Yes      | Book title (may differ from collection name)                  |
| `subtitle`         | TEXT    | No       | Book subtitle                                                 |
| `author`           | TEXT    | No       | Author name, defaults to "Thomas Jay Rush"                    |
| `copyright`        | TEXT    | No       | Full copyright notice text                                    |
| `dedication`       | TEXT    | No       | Full dedication text                                          |
| `acknowledgements` | TEXT    | No       | Full acknowledgements text                                    |
| `aboutAuthor`      | TEXT    | No       | Author biography text                                         |
| `coverPath`        | TEXT    | No       | Path to cover image file                                      |
| `isbn`             | TEXT    | No       | ISBN if assigned                                              |
| `publishedDate`    | TEXT    | No       | Publication date                                              |
| `templatePath`     | TEXT    | No       | Path to DOCX template (NULL = use default)                    |
| `exportPath`       | TEXT    | No       | Last used export folder                                       |
| `status`           | TEXT    | No       | Book status: "draft", "ready", "published"                    |
| `createdAt`        | TEXT    | No       | Creation timestamp                                            |
| `updatedAt`        | TEXT    | No       | Last update timestamp                                         |

### 3.4 TypeScript Interface

```typescript
interface Book {
  bookID: number;
  collID: number;
  title: string;
  subtitle: string;
  author: string;
  copyright: string;
  dedication: string;
  acknowledgements: string;
  aboutAuthor: string;
  coverPath: string;
  isbn: string;
  publishedDate: string;
  templatePath: string;
  exportPath: string;
  status: 'draft' | 'ready' | 'published';
  createdAt: string;
  updatedAt: string;
}
```

### 3.5 Go Struct

```go
type Book struct {
    BookID           int64  `json:"bookID"`
    CollID           int64  `json:"collID"`
    Title            string `json:"title"`
    Subtitle         string `json:"subtitle"`
    Author           string `json:"author"`
    Copyright        string `json:"copyright"`
    Dedication       string `json:"dedication"`
    Acknowledgements string `json:"acknowledgements"`
    AboutAuthor      string `json:"aboutAuthor"`
    CoverPath        string `json:"coverPath"`
    ISBN             string `json:"isbn"`
    PublishedDate    string `json:"publishedDate"`
    TemplatePath     string `json:"templatePath"`
    ExportPath       string `json:"exportPath"`
    Status           string `json:"status"`
    CreatedAt        string `json:"createdAt"`
    UpdatedAt        string `json:"updatedAt"`
}
```

---

## 4. Template System

### 4.1 Purpose

A single DOCX template controls all formatting for:

- Individual essays (applied during editing)
- Exported book (used as pandoc reference document)

This ensures WYSIWYG editing — essays look the same during editing as they will in the final book.

### 4.2 Storage Location

```
~/.works/templates/
└── book-template.docx    ← User-created, app's source of truth
```

The app stores templates in its data folder. Users who want the template available in Word's template picker can manually copy it to Word's template folder.

### 4.3 Required Styles

The template must define these styles:

#### Core Styles (Required)

| Style Name        | Purpose                                  | Typical Settings                        |
| ----------------- | ---------------------------------------- | --------------------------------------- |
| `Title`           | Book title on title page                 | Large, centered, decorative             |
| `Heading 1`       | Section titles (Part I, Part II, etc.)   | Large, chapter-style, page break before |
| `Heading 2`       | Essay titles                             | Medium, bold                            |
| `Heading 3`       | Subheadings within essays                | Small, bold                             |
| `Normal`          | Default paragraph style                  | Book font, first-line indent            |
| `Body Text`       | Prose paragraphs (alternative to Normal) | Same as Normal                          |
| `First Paragraph` | After headings, no indent                | Same as Normal, no first-line indent    |
| `Block Quote`     | Quoted material                          | Indented, possibly italic               |
| `Caption`         | Image captions                           | Small, centered                         |

#### Poetry & Verse

| Style Name | Purpose                        | Typical Settings                       |
| ---------- | ------------------------------ | -------------------------------------- |
| `Poetry`   | Verse formatting               | No first-line indent, preserved breaks |
| `Epigraph` | Opening quote at chapter start | Italic, right-aligned or indented      |

#### Lists

| Style Name      | Purpose         | Typical Settings                 |
| --------------- | --------------- | -------------------------------- |
| `Bulleted List` | Unordered lists | Hanging indent, bullet character |
| `Numbered List` | Ordered lists   | Hanging indent, auto-numbering   |

#### Technical Content

| Style Name   | Purpose                            | Typical Settings                       |
| ------------ | ---------------------------------- | -------------------------------------- |
| `Code`       | Inline code, addresses, hashes     | Monospace font (Courier, Consolas)     |
| `Code Block` | Multi-line code snippets           | Monospace, background shading, no wrap |
| `Callout`    | Highlighted boxes, notes, warnings | Border or background, distinct font    |

#### Tables

| Style Name     | Purpose              | Typical Settings                 |
| -------------- | -------------------- | -------------------------------- |
| `Table Header` | Table column headers | Bold, possibly shaded background |
| `Table Cell`   | Table body text      | Normal weight, aligned           |

#### Definitions & References

| Style Name        | Purpose            | Typical Settings                          |
| ----------------- | ------------------ | ----------------------------------------- |
| `Definition Term` | Term being defined | Bold, no indent                           |
| `Definition Body` | Definition text    | Indented below term                       |
| `URL`             | Hyperlinks         | Blue, underlined (ebook) or plain (print) |
| `Footnote Text`   | Footnote content   | Smaller font size                         |

#### Character Styles

| Style Name   | Purpose                  | Typical Settings                |
| ------------ | ------------------------ | ------------------------------- |
| `Small Caps` | Acronyms (DAO, NFT, API) | Small caps character formatting |

### 4.4 Style Philosophy

Goal: Define a comprehensive but limited style set. Benefits:

- Covers all content types across different books (essays, poetry, technical)
- Easier to maintain consistency
- Simpler to update formatting later
- Cleaner DOCX files

**Total styles: ~20** (comprehensive enough for any book type)

### 4.5 Template Validation

Before export, the app validates the template:

```go
func (a *App) ValidateTemplate(templatePath string) ([]string, error)
```

Returns list of missing required styles. Export is blocked if validation fails.

### 4.6 Creating the Template

User workflow:

1. Create new DOCX in Word
2. Define required styles with desired formatting
3. Delete unused default styles
4. Save to `~/.works/templates/book-template.docx`
5. Select as template in Book Settings

See Appendix C for detailed template creation instructions.

### 4.7 Template Updates and WYSIWYG

**Key point:** The template controls final export formatting, not the source essays.

| Scenario                             | What Happens                                 |
| ------------------------------------ | -------------------------------------------- |
| Modify template, re-export           | New book uses new formatting ✅              |
| Modify template, don't update essays | Essays look different in Word than in export |
| Apply template to essays             | Essays look the same in Word as in export    |

**During export:** Pandoc maps style names from source essays to template definitions. If the source has "Heading 1" (black) and the template defines "Heading 1" (purple), the export will be purple.

**During editing:** Each essay has its own embedded style definitions. To match the editing experience to the final output, run "Apply Template" on each essay.

**Recommendation:**

- For drafting: Don't worry about style mismatch
- For final polish: Batch "Apply Template" to all essays in collection
- For future template changes: Just re-export (only re-apply to essays if desired)

---

## 5. Style Audit System

### 5.1 Purpose

Help users identify which essays need cleanup before book export. Essays may have:

- Styles not defined in the template
- Direct formatting (manual bold, font changes, etc.)
- Inconsistent style usage

### 5.2 Audit Results

```go
type StyleAuditResult struct {
    WorkID            int64    `json:"workID"`
    Title             string   `json:"title"`
    TemplateStyles    []string `json:"templateStyles"`    // Styles matching template
    UnknownStyles     []string `json:"unknownStyles"`     // Styles not in template
    DirectFormatCount int      `json:"directFormatCount"` // Paragraphs with manual formatting
    IsClean           bool     `json:"isClean"`           // True if only template styles used
}
```

### 5.3 Audit Functions

```go
// Audit a single work
func (a *App) AuditWorkStyles(workID int64, templatePath string) (StyleAuditResult, error)

// Audit all works in a collection
func (a *App) AuditCollectionStyles(collID int64, templatePath string) ([]StyleAuditResult, error)
```

### 5.4 Apply Template Function

```go
func (a *App) ApplyTemplateToWork(workID int64, templatePath string) error
```

Behavior:

- Opens the work's DOCX file
- Imports style definitions from template
- Overwrites matching style definitions in the work
- Does **NOT** delete unknown styles
- Does **NOT** change which style is applied to each paragraph
- Saves the modified DOCX

This is a safe operation that updates formatting of existing styles without changing document structure.

### 5.5 Template Clean Flag

```go
func (a *App) SetWorkTemplateClean(workID int64, isClean bool) error
```

After user manually cleans up an essay, they can mark it as "template clean" to track progress.

### 5.6 Audit Workflow

1. **Run collection audit** — See summary of all essays
2. **Review flagged essays** — Those with unknown styles or heavy direct formatting
3. **Apply template** — Import template style definitions
4. **Manual cleanup** — Open in Word, fix remaining issues
5. **Mark clean** — Set `isTemplateClean = 1`
6. **Re-audit** — Verify cleanup complete

---

## 6. User Interface

### 6.1 Collection Detail View — Modifications

Add checkbox to existing controls area:

```
Collection: You Say You Want A Revolution
Type: [Book ▼]     Items: 107     ☑ Treat as Book
```

**Checkbox behavior:**

When checked:

1. Call `SetCollectionIsBook(collID, true)`
2. Create Books record if none exists (copy collection name to title)
3. Show "Book Settings" tab

When unchecked:

1. Call `SetCollectionIsBook(collID, false)`
2. Keep Books record (preserve data)
3. Hide "Book Settings" tab

### 6.2 Collection Tabs

The Collections page has two main tabs: **List** and **Detail**.

```
[List]  [Detail]
```

Within the Detail view, when `isBook = false`:

```
[Contents]
```

When `isBook = true`:

```
[Contents]  [Book Settings]
```

The "Contents" tab shows the existing collection works list. The "Book Settings" tab (new) shows book metadata and export options.

### 6.3 Book Settings Tab Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  📖 Book Settings                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  METADATA                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  Title:        [So You Say You Want A Revolution              ]    │
│  Subtitle:     [Essays on Ethereum and Decentralization       ]    │
│  Author:       [Thomas Jay Rush                                ]    │
│                                                                     │
│  FRONT MATTER                                                       │
│  ─────────────────────────────────────────────────────────────────  │
│  Copyright:                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ © 2026 Thomas Jay Rush. All rights reserved.               │   │
│  │ Published in the United States.                             │   │
│  │                                                              │   │
│  │ No part of this book may be reproduced without written     │   │
│  │ permission from the author.                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Dedication:                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ For the cypherpunks who came before,                        │   │
│  │ and the builders who carry the torch.                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  BACK MATTER                                                        │
│  ─────────────────────────────────────────────────────────────────  │
│  Acknowledgements:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ I would like to thank the Ethereum community for their     │   │
│  │ tireless work building a more decentralized future...      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  About the Author:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Thomas Jay Rush is a software developer and writer who     │   │
│  │ been exploring blockchain technology since 2016...         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  PUBLICATION                                                        │
│  ─────────────────────────────────────────────────────────────────  │
│  Cover Image:  [Browse...]  revolution-cover.jpg                   │
│  ISBN:         [                                              ]    │
│  Status:       [Draft ▼]                                           │
│                                                                     │
│  TEMPLATE & EXPORT                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│  Template:     [Browse...]  book-template.docx                     │
│  Output:       [Browse...]  ~/Books/Revolution/                    │
│                                                                     │
│  Style Audit:  47/89 essays clean  [Run Audit]  [View Details]     │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  [Export DOCX]  [Export EPUB]  [Export PDF]                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.4 Work Detail View — New Elements

Add template controls to the existing **Flags + Collections** row, within the left-side Stack that contains DocType and checkboxes. This avoids adding vertical space.

**Placement:** Below the existing checkboxes (Revised, ProsePoem, Blog, Printed) in the same Stack:

```
┌─────────────────────────────────────────────────────────────────────┐
│  DocType: [docx]                                                    │
│  ☐ Revised   ☐ ProsePoem   ☐ Blog   ☐ Printed                     │
│                                                                     │
│  Template: ● Clean  ○ Needs Review   [Apply] [Audit]               │
└─────────────────────────────────────────────────────────────────────┘
```

**Elements:**

- **Status indicator:** Small dot (green = clean, yellow = needs review) with label
- **Apply button:** Compact icon button, calls `ApplyTemplateToWork(workID, templatePath)`
- **Audit button:** Compact icon button, calls `AuditWorkStyles(workID, templatePath)`, opens modal

### 6.5 Style Audit Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│  Style Audit: The DAO's First Big Decision                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Template Styles Used:                                              │
│    ✓ Normal (45 paragraphs)                                        │
│    ✓ Heading 2 (1 paragraph)                                       │
│    ✓ Block Quote (3 paragraphs)                                    │
│                                                                     │
│  Unknown Styles:                                                    │
│    ⚠ MyCustomStyle (2 paragraphs)                                  │
│    ⚠ Quote-Old (1 paragraph)                                       │
│                                                                     │
│  Direct Formatting:                                                 │
│    ⚠ 12 paragraphs have manual formatting                          │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  [Open Document]  [Apply Template]  [Mark as Clean]  [Close]       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Open Document button:** Opens the work's DOCX file in the default application (Word) for manual editing.

---

## 7. Export Pipeline

### 7.1 Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Validate template                                               │
│  2. Create temp build directory                                     │
│  3. Generate front matter DOCXs                                     │
│  4. Collect essay/section DOCX paths (ordered by position)          │
│  5. Generate back matter DOCXs                                      │
│  6. Merge all with pandoc                                           │
│  7. Apply page breaks and headers/footers                           │
│  8. Copy to export folder                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Front Matter Generation

Generate temporary DOCX files for front matter. These are created in the book's build directory:

```
~/.works/books/{book-title}/build/
├── half-title.docx
├── title-page.docx
├── copyright.docx
├── dedication.docx
└── toc.docx
```

| File              | Content                   | Source                                       |
| ----------------- | ------------------------- | -------------------------------------------- |
| `half-title.docx` | Book title only, centered | `book.title`                                 |
| `title-page.docx` | Title, subtitle, author   | `book.title`, `book.subtitle`, `book.author` |
| `copyright.docx`  | Copyright notice          | `book.copyright`                             |
| `dedication.docx` | Dedication text           | `book.dedication`                            |
| `toc.docx`        | Table of contents         | Auto-generated from work titles              |

These files are regenerated on each export and can be deleted after export completes.

### 7.3 Table of Contents

Auto-generated from collection works:

```
Contents

Part I: The DAO Awakening .......................... 5
    The DAO's First Big Decision ................... 7
    Smart Contracts are Immutable .................. 12
    What the F is a Finney ......................... 18
    ...

Part II: Building QuickBlocks ...................... 45
    Accounting for the Revolution .................. 47
    The Real Flippening ............................ 52
    ...
```

**Rules:**

- Works with `Type = "Section"` appear as top-level entries (Parts)
- All other works appear indented under the preceding Section
- Page numbers are placeholders (Word/pandoc can update)

### 7.4 Main Content

Collect paths to all work DOCX files in position order:

```go
works := a.GetCollectionWorks(book.CollID)  // Ordered by position
for _, work := range works {
    path := a.GetWorkFilePath(work.WorkID)
    if path == "" || !fileExists(path) {
        return error("Missing file for work: " + work.Title)
    }
    workFiles = append(workFiles, path)
}
```

**Missing files:** If any work in the collection does not have a DOCX file, export aborts with an error listing the missing work(s). All essays must exist before export.

### 7.5 Back Matter Generation

Generate temporary DOCX files:

| File                    | Content          | Source                  |
| ----------------------- | ---------------- | ----------------------- |
| `acknowledgements.docx` | Acknowledgements | `book.acknowledgements` |
| `about-author.docx`     | Author bio       | `book.aboutAuthor`      |

### 7.6 Pandoc Merge Command

```bash
pandoc --reference-doc=book-template.docx \
       half-title.docx \
       title-page.docx \
       copyright.docx \
       dedication.docx \
       toc.docx \
       essay1.docx \
       essay2.docx \
       ... \
       acknowledgements.docx \
       about-author.docx \
       -o output.docx
```

### 7.7 Page Breaks

| Element                    | Page Break Type                         |
| -------------------------- | --------------------------------------- |
| Section (Type = "Section") | Odd page (recto) — starts on right side |
| Essay (all other types)    | Odd page (recto) — starts on right side |
| Front matter elements      | As appropriate per element              |
| Back matter elements       | Odd page (recto) — starts on right side |
| Appendices                 | Odd page (recto) — starts on right side |

**Recto starts:** If the previous content ends on a right page, insert a blank left (verso) page so the next element starts on the right.

Implementation via DOCX section properties:

```xml
<w:sectPr>
  <w:type w:val="oddPage"/>
</w:sectPr>
```

### 7.8 Headers and Footers

#### Standard Pages

| Page Position | Left (Verso) | Right (Recto)       |
| ------------- | ------------ | ------------------- |
| Header Left   | Book Title   | (empty)             |
| Header Right  | (empty)      | Essay/Section Title |
| Header Center | (empty)      | (empty)             |
| Footer Left   | (empty)      | (empty)             |
| Footer Right  | (empty)      | (empty)             |
| Footer Center | Page Number  | Page Number         |

#### Special Pages

| Page Type                              | Header | Footer / Page Number     |
| -------------------------------------- | ------ | ------------------------ |
| Section title page (recto)             | None   | Page number (centered)   |
| Essay title page (recto)               | None   | Page number (centered)   |
| Blank verso (inserted for recto start) | None   | None                     |
| Front matter pages                     | None   | Roman numeral (centered) |

**Rationale:**

- Section and essay opening pages traditionally omit running headers to give visual breathing room
- Blank verso pages inserted for recto alignment should be completely blank (no page number)
- Front matter uses Roman numerals; main content restarts at Arabic 1

#### Page Numbering

- Front matter: Roman numerals (i, ii, iii, iv...)
- Main content: Arabic numerals (1, 2, 3...)
- Restart numbering at first Section

### 7.9 Export Formats

| Format | Extension | Tool                 | Notes                  |
| ------ | --------- | -------------------- | ---------------------- |
| DOCX   | `.docx`   | pandoc               | Primary format for KDP |
| EPUB   | `.epub`   | pandoc               | For ebook distribution |
| PDF    | `.pdf`    | pandoc + wkhtmltopdf | For print preview      |

### 7.10 Export Result

```go
type BookExportResult struct {
    BookID   int64  `json:"bookID"`
    Format   string `json:"format"`
    Path     string `json:"path"`
    Success  bool   `json:"success"`
    Error    string `json:"error,omitempty"`
    Duration int64  `json:"duration"`  // milliseconds
}
```

---

## 8. Go Backend Bindings

### 8.1 Book CRUD

```go
// Create a new book for a collection
func (a *App) CreateBook(collID int64) (Book, error)

// Get book by ID
func (a *App) GetBook(bookID int64) (Book, error)

// Get book by collection ID (returns nil if no book exists)
func (a *App) GetBookByCollection(collID int64) (*Book, error)

// Update book metadata
func (a *App) UpdateBook(book Book) error

// Delete book (does not delete collection or works)
func (a *App) DeleteBook(bookID int64) error
```

### 8.2 Collection IsBook Toggle

```go
// Set collection's isBook flag
func (a *App) SetCollectionIsBook(collID int64, isBook bool) error
```

When `isBook` is set to `true` and no Book record exists, automatically creates one.

### 8.3 Template Management

```go
// Get default template path
func (a *App) GetDefaultTemplatePath() string

// Validate template has required styles
// Returns list of missing styles (empty = valid)
func (a *App) ValidateTemplate(templatePath string) ([]string, error)

// Open file dialog to select template, update book record
func (a *App) SelectBookTemplate(bookID int64) (string, error)
```

### 8.4 Style Audit

```go
// Audit styles in a single work
func (a *App) AuditWorkStyles(workID int64, templatePath string) (StyleAuditResult, error)

// Audit styles in all works in a collection
func (a *App) AuditCollectionStyles(collID int64, templatePath string) ([]StyleAuditResult, error)

// Apply template style definitions to a work
func (a *App) ApplyTemplateToWork(workID int64, templatePath string) error

// Mark work as template-clean
func (a *App) SetWorkTemplateClean(workID int64, isClean bool) error
```

### 8.5 File Selection Dialogs

```go
// Open folder dialog for export location
func (a *App) SelectBookExportFolder(bookID int64) (string, error)

// Open file dialog for cover image
func (a *App) SelectBookCover(bookID int64) (string, error)
```

### 8.6 Export

```go
// Export book to specified format
// format: "docx" | "epub" | "pdf"
func (a *App) ExportBook(bookID int64, format string) (BookExportResult, error)
```

---

## 9. File Structure

### 9.1 App Data Directory

```
~/.works/
├── works.db                    # SQLite database
├── templates/
│   └── book-template.docx      # User's book template
├── books/
│   └── {book-title}/           # Per-book folder (created on first export)
│       ├── build/              # Temporary build files
│       │   ├── half-title.docx
│       │   ├── title-page.docx
│       │   ├── copyright.docx
│       │   ├── dedication.docx
│       │   ├── toc.docx
│       │   ├── acknowledgements.docx
│       │   └── about-author.docx
│       └── exports/            # Generated book files
│           ├── book-title.docx
│           ├── book-title.epub
│           └── book-title.pdf
└── backups/
    └── ...
```

### 9.2 User-Selected Export Location

When user selects a custom export folder, files are written there instead of `~/.works/books/{title}/exports/`.

---

## 10. Dependencies

### 10.1 Required

| Dependency | Purpose                          | Installation          | Version |
| ---------- | -------------------------------- | --------------------- | ------- |
| pandoc     | DOCX merge and format conversion | `brew install pandoc` | 3.4+    |

### 10.2 Optional

| Dependency  | Purpose        | Installation               | Notes                 |
| ----------- | -------------- | -------------------------- | --------------------- |
| wkhtmltopdf | PDF generation | `brew install wkhtmltopdf` | For print-quality PDF |

### 10.3 Pandoc Verification

On app startup or first export attempt, verify pandoc is available:

```go
func (a *App) CheckPandocInstalled() (bool, string, error) {
    // Returns: installed, version, error
}
```

If not installed, show user-friendly message with installation instructions.

---

## 11. Implementation Order

### Phase 1: Data Model

1. Create migration for `Collections.isBook`
2. Create migration for `Works.isTemplateClean`
3. Create migration for `Books` table
4. Update Go structs and TypeScript interfaces
5. Implement Book CRUD functions

### Phase 2: Basic UI

6. Add "Treat as Book" checkbox to Collection Detail
7. Implement `SetCollectionIsBook` toggle logic
8. Add "Book Settings" tab (hidden when `isBook = false`)
9. Implement Book metadata form (all fields)
10. Wire up save/update

### Phase 3: Template System

11. Implement `GetDefaultTemplatePath`
12. Implement template file selection dialog
13. Implement `ValidateTemplate` (parse DOCX styles)
14. Add template validation UI feedback

### Phase 4: Export (DOCX First)

15. Implement front matter DOCX generation
16. Implement TOC generation
17. Implement back matter DOCX generation
18. Implement pandoc merge command
19. Implement `ExportBook` for DOCX format
20. Add export button and progress UI

### Phase 5: Style Audit

21. Implement `AuditWorkStyles` (parse DOCX styles)
22. Implement `AuditCollectionStyles`
23. Add audit results modal
24. Add style audit summary to Book Settings
25. Implement `ApplyTemplateToWork`
26. Add template status to Work Detail view

### Phase 6: Additional Formats

27. Implement EPUB export
28. Implement PDF export
29. Add format selection UI

### Phase 7: Polish

30. Page breaks (recto starts)
31. Headers/footers
32. Page numbering (roman/arabic)
33. Error handling and user feedback
34. Documentation

---

## 12. Future Considerations

### 12.1 Potential Enhancements

- **Batch template apply** — Apply template to all works in collection at once
- **Style mapping** — Define how unknown styles should map to template styles
- **Preview** — In-app preview of generated book
- **Chapter numbering** — Auto-number essays within sections
- **Multiple templates** — Different templates for different book types
- **Export presets** — Save format-specific settings (e.g., KDP print, KDP ebook)

### 12.2 Alternative Export Methods

If pandoc proves insufficient:

- **Direct DOCX XML manipulation** — More control, more complex
- **LibreOffice headless** — Full Word compatibility, requires LibreOffice installed
- **docx library (Go)** — Various options with different trade-offs

### 12.3 Integration Possibilities

- **Amazon KDP API** — Direct upload (if API becomes available)
- **Draft2Digital** — Multi-platform distribution
- **ISBN registration** — Automated ISBN assignment

---

## Appendix A: Sample Book Export Log

```
[INFO] Starting book export: So You Say You Want A Revolution
[INFO] Format: docx
[INFO] Template: /Users/jrush/.works/templates/book-template.docx
[INFO] Validating template...
[INFO] Template valid: 8 styles found
[INFO] Creating build directory...
[INFO] Generating front matter...
[INFO]   - half-title.docx
[INFO]   - title-page.docx
[INFO]   - copyright.docx
[INFO]   - dedication.docx
[INFO]   - toc.docx (107 entries)
[INFO] Collecting works (107 items)...
[INFO] Generating back matter...
[INFO]   - acknowledgements.docx
[INFO]   - about-author.docx
[INFO] Running pandoc merge (112 files)...
[INFO] Pandoc completed in 4.2s
[INFO] Applying page breaks...
[INFO] Adding headers/footers...
[INFO] Export complete: /Users/jrush/Books/Revolution/revolution.docx
[INFO] Total time: 6.8s
```

---

## Appendix B: Example Front Matter Content

### Half Title

```
So You Say You Want A Revolution
```

### Title Page

```
So You Say You Want A Revolution

Essays on Ethereum and Decentralization, 2016-2026


Thomas Jay Rush
```

### Copyright

```
© 2026 Thomas Jay Rush. All rights reserved.

Published in the United States.

No part of this book may be reproduced, stored in a retrieval system,
or transmitted in any form or by any means without the prior written
permission of the author, except for brief quotations in reviews.

First Edition

ISBN: [if assigned]
```

### Dedication

```
For the cypherpunks who came before,
and the builders who carry the torch.
```

---

## Appendix C: Template Creation Guide

### Step 1: Create New Document

1. Open Microsoft Word
2. Create a new blank document
3. Save as `book-template.docx`

### Step 2: Define Core Styles

For each style below, use Word's Styles pane (⌘+Option+Shift+S on Mac):

1. **Modify "Normal"** (don't create new):
   - Font: Your book font (e.g., Garamond, Palatino, Georgia), 11-12pt
   - Paragraph: First line indent 0.25", line spacing 1.15 or 1.5
   - Justified or left-aligned

2. **Modify "Heading 1"**:
   - Font: Book font, 18-24pt, bold or small caps
   - Paragraph: Space before 36pt, space after 18pt, page break before
   - Keep with next

3. **Modify "Heading 2"**:
   - Font: Book font, 14-16pt, bold
   - Paragraph: Space before 18pt, space after 12pt
   - Keep with next

4. **Create "First Paragraph"** (based on Normal):
   - Same as Normal but NO first line indent

5. **Modify "Block Quote"** (or create "Block Text"):
   - Font: Book font, same size or slightly smaller, italic optional
   - Paragraph: Left and right indent 0.5"

### Step 3: Define Additional Styles

Create these styles as needed:

| Style         | Based On    | Key Changes                            |
| ------------- | ----------- | -------------------------------------- |
| Poetry        | Normal      | No first indent, keep line breaks      |
| Epigraph      | Block Quote | Italic, right-aligned attribution line |
| Code          | Normal      | Monospace font (Courier, Consolas)     |
| Code Block    | Code        | Background shading, no word wrap       |
| Bulleted List | Normal      | Bullet character, hanging indent       |
| Numbered List | Normal      | Auto-numbering, hanging indent         |
| Callout       | Normal      | Border or background, indent           |
| Caption       | Normal      | Centered, smaller font                 |
| Table Header  | Normal      | Bold, centered                         |
| Table Cell    | Normal      | No changes needed                      |

### Step 4: Delete Unused Styles

Word includes many default styles. Delete any you won't use:

1. Open Styles pane
2. Right-click unused style → "Delete"
3. Keep only your defined styles

Note: Some built-in styles (Normal, Heading 1-3) cannot be deleted, only modified.

### Step 5: Set Document Defaults

1. **Page size:** 6" x 9" (common trade paperback) or your target size
2. **Margins:** 0.75" inside, 0.5" outside, 0.75" top/bottom (adjust for binding)
3. **Headers/footers:** Define placeholder headers and footers

### Step 6: Save and Register

1. Save the document
2. Move to `~/.works/templates/book-template.docx`
3. In Works app, select this file as the template

### Tips

- **Test early:** Export a few essays before finalizing template
- **Print test:** Print a few pages to check physical appearance
- **Font licensing:** Ensure fonts are embeddable or available on target devices

---

_End of specification._
