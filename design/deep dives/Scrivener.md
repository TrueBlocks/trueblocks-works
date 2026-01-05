# Integrating Scrivener for Writing with trueblocks-works for Management

## Overview
Scrivener serves as a robust writing and organization tool for drafting individual works, replacing MS Word with its open-ish format for better long-term accessibility. trueblocks-works, a custom desktop app built in Go/React/SQLite, manages your extensive portfolio (1,900+ works, including poems, books, essays) by tracking metadata, submissions, collections, and more. Integration involves using Scrivener for content creation/editing and trueblocks-works for high-level tracking, with exports ensuring 50-year CD-ROM viability via plain RTF/TXT files readable without proprietary software.

Key goals: Avoid format lock-in; enable custom analysis (e.g., phrase counting across works); separate writing from portfolio management.

## Scrivener for Writing: Detailed Features and Format
### Core Features
- **Binder Structure**: Hierarchical organization of texts, folders, subdocuments for chapters/scenes/poems. Supports drag-and-drop reorganization.
- **Research Integration**: Import PDFs, images, webpages as references; store alongside drafts without bloating main text.
- **Writing Tools**: Corkboard for visual synopses/index cards; Outliner for metadata views (e.g., word counts, status); Scrivenings mode to view/edit combined sections; Full-screen composition mode; Annotations, footnotes, comments.
- **Metadata and Search**: Built-in labels, status, keywords; Custom metadata fields for tracking elements like themes, characters, dates – searchable and sortable in Outliner.
- **Versioning**: Snapshots save revisions; Auto-backups on close/open; History tracking per document.
- **Math/Equations**: No native OLE (Windows-only); On Mac, embed as images via LaTeXiT or use LaTeX/Markdown syntax for compiled exports (e.g., to PDF).
- **Platforms**: Mac, Windows, iOS; Sync via Dropbox/external folders (exports plain text/Markdown to avoid conflicts).

### File Format Details
- **.scriv Package**: A folder disguised as a file (right-click "Show Package Contents" on Mac). Contains:
  - **RTF Files**: Main text content (content.rtf per document); Supports basic formatting (bold, italics, lists) but limited math (embed objects/images).
  - **XML Files**: Project structure (.scrivx – UUID-based for sync resilience), metadata (styles.xml, synopsis.txt, notes.rtf, comments).
  - **Other Assets**: Images/PDFs as-is; TXT for synopses.
- **Version Differences**: Pre-v2 used RTFD (Mac-only); v2+ switched to RTF for cross-platform; v3 uses UUID folders for better sync/error recovery (e.g., 77B63EEE-D11D-4CBF-928F-67697202D368/content.rtf).
- **Over MS Word**: Avoids .docx proprietary elements; RTF is open, editable in free tools (Notepad, TextEdit); Better for complex projects without bloat.
- **Long-Term Archiving**: Direct access to internals without Scrivener; Export to RTF/TXT/PDF via File > Export (includes notes, metadata, snapshots; Options: Exclude subdocs, number files, remove annotations). For CD-ROM: Export flattened TXT/RTF folders; Avoid .scriv packages – they're readable but require folder navigation.

## trueblocks-works for Management: Detailed Features and Structure
### Core Features (From Repo Analysis)
- **Purpose**: Desktop app for writers to catalog large bodies of work (poetry, fiction, essays); Track journals, submissions, collections; Future extensions for publishing/marketing/speaking.
- **Management Areas**:
  - **Works**: Metadata tracking (title, type, year, status, word count, file paths); Auto-generates storage paths; Supports 1,900+ items.
  - **Organizations/Journals**: Links to Duotrope/external sites; Track interests/submission guidelines.
  - **Submissions**: History, packages sent, responses; Status updates (pending, accepted, rejected).
  - **Collections**: Group works into books/poetry anthologies; Manual status tracking.
  - **Notes/Search**: Attached notes; Full-text search across metadata.
  - **Backups/Exports**: JSON exports (e.g., Works.json); PDF previews; Backups of DB/files.
- **User Interface**: React-based; Open works in default editor (e.g., Scrivener); Print/export functions.
- **Extensibility**: No APIs, but file-based; Reference external paths; Custom scripts can query SQLite for analysis.

### Data Structure
- **Database**: SQLite (~/.works/works.db) – Tables for works, submissions, collections, etc.
- **Files**: Config/state in JSON; Works stored in ~/.works/works_dir (or custom); Exports like Works.json array of objects with fields: id, title, type (e.g., Poetry, Fiction), year, status, notes.
- **Handling External Editors**: App opens files in system default; No direct integration, but paths in metadata allow linking.

## Integration Strategy: Step-by-Step Workflow
### Setup
1. Install Scrivener; Create .scriv per work/book in a dedicated folder (e.g., ~/ScrivenerProjects).
2. Configure trueblocks-works to reference Scrivener export paths in metadata (e.g., add "scriv_path" custom field).
3. Set Scrivener as default RTF editor.

### Daily Workflow
1. **Drafting**: Create/edit in Scrivener; Use custom metadata for alignment (e.g., tags matching trueblocks-works types).
2. **Export for Management**: File > Sync > External Folder (plain text/Markdown) or Export > Files (RTF/TXT) to ~/.works/works_dir subfolder. Include metadata/notes.
3. **Tracking in trueblocks-works**: Import/update metadata; Log file paths; Track submissions/collections via app UI.
4. **Editing Round-Trip**: Open from trueblocks-works (launches Scrivener); Re-export changes.
5. **Analysis/Custom Scripts**: Export Scrivener to TXT; Use trueblocks-works paths to batch-process (e.g., Python script for phrase counting: glob TXT files, count "three word phrases").
6. **Advanced Linking**: Use Scrivener hyperlinks to trueblocks-works entries; Or integrate via tools like Zotero/Notion for shared metadata. For DB tie-in: Script SQLite queries against exported XML.

### Tools for Deeper Integration
- **Aeon Timeline/Zotero**: Sync timelines/references with Scrivener; Export to trueblocks-works.
- **Evernote/Notion**: Web imports to Scrivener Research; Link pages in trueblocks-works notes.
- **Automation**: Use scripts (e.g., AppleScript on Mac) to batch-export; Monitor folders for sync.

### Long-Term Archiving Protocol
- Export Scrivener projects annually to RTF/TXT folders + metadata CSV.
- Backup trueblocks-works DB/JSON to same CD-ROM.
- Test readability: Open RTFs in free editors; Query JSON with basic tools.
- Avoid clouds for masters; Use external drives.

## Benefits and Risks
### Benefits
- **Productivity**: Scrivener accelerates drafting; trueblocks-works scales management.
- **Accessibility**: Open formats (RTF/XML/JSON) ensure future-proofing; Custom analysis via exports.
- **Flexibility**: Modular – upgrade one without affecting the other.
- **Cost**: Scrivener one-time ($49-59); trueblocks-works custom/free.

### Risks and Mitigations
- **Manual Steps**: Exports add workflow; Mitigate with habits/scripts.
- **Sync Conflicts**: Dropbox for Scrivener can corrupt; Use external folder sync only.
- **Scale Issues**: For 1,900 works, test with subset; Optimize DB indexes.
- **No Direct API**: Limits automation; Add custom hooks in trueblocks-works code.
- **Format Evolution**: Scrivener v3+ changes; Always export flats.