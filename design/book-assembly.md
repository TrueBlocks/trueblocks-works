# Book Assembly Pipeline

> PDF post-processing for professional book output with running headers, page numbers, and table of contents.

**Status:** Design  
**Created:** January 21, 2026

---

## Overview

The book assembly pipeline takes individual work PDFs (with blank margins) and produces a professionally formatted book with:

- Unified page numbering
- Running headers (book title on verso, essay title on recto)
- Automatic table of contents with correct page numbers
- Recto alignment (essays start on right-hand pages)
- Part/section support with proper TOC hierarchy

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Wails App                               │
│  ExportBookPDF() ─────────────────────────────────────────┐ │
│                                                            │ │
│  ┌──────────────────────────────────────────────────────┐ │ │
│  │              internal/bookbuild                       │ │ │
│  │  (shared library - used by both app and CLI)         │ │ │
│  └──────────────────────────────────────────────────────┘ │ │
│                            ▲                               │ │
└────────────────────────────│───────────────────────────────┘ │
                             │                                  │
                    ┌────────┴────────┐                        │
                    │  cmd/bookbuild  │                        │
                    │   (CLI tool)    │                        │
                    └─────────────────┘                        │
```

Core logic lives in `internal/bookbuild`, callable from both CLI and Wails app.

---

## Terminology

| Term               | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| **Verso**          | Left-hand page (even page numbers)                    |
| **Recto**          | Right-hand page (odd page numbers)                    |
| **Running header** | Text at top of page (book/essay title)                |
| **Drop folio**     | Page number only, no header (used on chapter openers) |
| **Front matter**   | Title, copyright, dedication, TOC                     |
| **Back matter**    | Acknowledgements, about the author                    |
| **Part/Section**   | Grouping of essays (e.g., "Part I: Early Work")       |

---

## Input: JSON Manifest

```json
{
  "title": "Revolution & New Order",
  "author": "Thomas Jay Rush",
  "outputPath": "/Users/jrush/Desktop/Revolution.pdf",

  "typography": {
    "headerFont": "Times New Roman",
    "headerSize": 10,
    "pageNumberFont": "Times New Roman",
    "pageNumberSize": 10
  },

  "frontMatter": [
    { "type": "title", "pdf": "~/.works/book-builds/coll-5/title.pdf" },
    { "type": "copyright", "pdf": "~/.works/book-builds/coll-5/copyright.pdf" },
    { "type": "dedication", "pdf": "~/.works/book-builds/coll-5/dedication.pdf" },
    { "type": "toc", "placeholder": true }
  ],

  "parts": [
    {
      "title": "Part I: Early Work",
      "pdf": "~/.works/book-builds/coll-5/part1.pdf",
      "works": [
        { "id": 123, "title": "The Nature of Being", "pdf": "~/.works/pdf-previews/123.pdf" },
        { "id": 456, "title": "On Revolution", "pdf": "~/.works/pdf-previews/456.pdf" }
      ]
    },
    {
      "title": "Part II: Later Thoughts",
      "pdf": "~/.works/book-builds/coll-5/part2.pdf",
      "works": [
        { "id": 789, "title": "The End of History", "pdf": "~/.works/pdf-previews/789.pdf" }
      ]
    }
  ],

  "backMatter": [
    { "type": "acknowledgements", "pdf": "~/.works/book-builds/coll-5/acknowledgements.pdf" },
    { "type": "about", "pdf": "~/.works/book-builds/coll-5/about.pdf" }
  ]
}
```

For books without parts, use a flat `works` array instead of `parts`.

---

## Processing Pipeline

### Pass 1: Analyze

1. Count pages in each input PDF
2. Compute page offsets
3. Determine where blank pages needed for recto alignment
4. Calculate final page numbers for each essay
5. Track part/section boundaries

### Pass 2: Generate TOC

1. Create TOC PDF with final page numbers
2. Handle two-level hierarchy (Parts → Essays)
3. Insert into front matter position

### Pass 3: Merge

1. Merge all PDFs in order using pdfcpu
2. Insert blank pages for recto alignment
3. Track essay boundaries in merged document

### Pass 4: Overlay

1. Add page numbers (bottom center)
2. Add running headers (where applicable)
3. Write final PDF

---

## Page Numbering

| Section      | Style              | Position      | Notes         |
| ------------ | ------------------ | ------------- | ------------- |
| Front matter | Roman (i, ii, iii) | Bottom center | May be sparse |
| Body         | Arabic (1, 2, 3)   | Bottom center | Continuous    |
| Back matter  | Arabic (1, 2, 3)   | Bottom center | Restarts at 1 |

---

## Running Headers

| Page Type              | Verso (left) | Recto (right) |
| ---------------------- | ------------ | ------------- |
| Front matter (all)     | —            | —             |
| Part/section divider   | —            | —             |
| First page of essay    | —            | —             |
| Subsequent essay pages | Book Title   | Essay Title   |
| Blank pages            | —            | —             |
| Back matter (all)      | —            | —             |

---

## Page Layout Geometry

```
┌────────────────────────────────────────┐
│            (0.5" margin)               │
│  ┌──────────────────────────────────┐  │
│  │  BOOK TITLE          ESSAY TITLE │  │  ← Running header
│  │  ────────────────────────────────│  │    ~0.3" from top
│  │                                  │  │
│  │                                  │  │
│  │         [Essay Content]          │  │
│  │                                  │  │
│  │                                  │  │
│  │                                  │  │
│  │  ────────────────────────────────│  │
│  │               47                 │  │  ← Page number
│  └──────────────────────────────────┘  │    ~0.3" from bottom
│            (0.5" margin)               │
└────────────────────────────────────────┘
```

---

## Table of Contents Format

```
CONTENTS

Part I: Early Work

    The Nature of Being .......................... 1
    On Revolution ................................ 15

Part II: Later Thoughts

    The End of History ........................... 42

Acknowledgements ................................ 67
About the Author ................................ 69
```

### TOC Styling

- "CONTENTS" in all caps, centered
- Part titles flush left, bold or small caps
- Essay titles indented under parts
- Dotted leaders between title and page number
- Back matter entries flush left (no indent)

---

## Recto Alignment

Each essay starts on a recto (odd) page. Logic:

```
For each essay in collection:
  If previous content ended on recto (odd page):
    Insert blank verso page
  Add essay pages
```

Blank pages are truly blank — no header, no page number.

Part/section dividers also start on recto and count as one page.

---

## Default Typography

| Element        | Default Font    | Default Size |
| -------------- | --------------- | ------------ |
| Running header | Times New Roman | 10pt         |
| Page number    | Times New Roman | 10pt         |

Configurable in Book metadata (stored in database) and overridable via CLI flags.

---

## CLI Interface

```fish
# Build from manifest file
bookbuild --manifest book.json

# Generate manifest from collection and build
bookbuild --collection 5 --output ~/Desktop/book.pdf

# Override typography
bookbuild --collection 5 \
  --output ~/Desktop/book.pdf \
  --header-font "Garamond" \
  --header-size 9

# Preview plan without building
bookbuild --collection 5 --dry-run
```

### Flags

| Flag                 | Description              | Default         |
| -------------------- | ------------------------ | --------------- |
| `--manifest`         | Path to JSON manifest    | —               |
| `--collection`       | Collection ID to build   | —               |
| `--output`           | Output PDF path          | Prompted        |
| `--header-font`      | Font for running headers | Times New Roman |
| `--header-size`      | Size for running headers | 10              |
| `--page-number-font` | Font for page numbers    | Times New Roman |
| `--page-number-size` | Size for page numbers    | 10              |
| `--dry-run`          | Show plan, don't build   | false           |

---

## Error Handling

| Condition                     | Behavior                     |
| ----------------------------- | ---------------------------- |
| Missing work PDF              | **Abort** with error message |
| Missing front/back matter PDF | Abort with error             |
| pdfcpu failure                | Abort with error             |
| Invalid manifest              | Abort with error             |

No partial builds — either complete success or complete failure.

---

## Dependencies

- **pdfcpu** — Pure Go PDF library for merging, page manipulation, and overlays
- No external tools required (replaces `pdfunite`)

---

## Integration with Wails App

The Wails app's `ExportBookPDF()` will:

1. Generate front matter PDFs (existing `generateFrontMatterPDF`)
2. Generate back matter PDFs (existing `generateBackMatterPDF`)
3. Generate part divider PDFs if parts exist
4. Build manifest JSON
5. Call `internal/bookbuild.Build(manifest)`
6. Report progress via existing `emitExportProgress`

---

## Future Considerations

- **EPUB generation** with same TOC/structure
- **Clickable TOC** in PDF (PDF bookmarks)
- **Custom front matter templates** (user-provided PDFs)
- **Page size variants** (trade paperback, mass market, etc.)

---

## Implementation Order

1. Create `internal/bookbuild` package with core types
2. Implement page counting and offset calculation
3. Implement blank page insertion for recto alignment
4. Implement PDF merging with pdfcpu
5. Implement page number overlay
6. Implement running header overlay
7. Implement TOC generation
8. Create `cmd/bookbuild` CLI wrapper
9. Integrate into Wails app (replace existing `exportBookPDFConcat`)

---

_Last updated: January 21, 2026_
