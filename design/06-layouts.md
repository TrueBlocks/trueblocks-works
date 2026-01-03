# Layouts Specification

> **Document:** 06-layouts.md  
> **Parent:** [specification.md](specification.md)  
> **Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Layout Summary](#2-layout-summary)
3. [Primary Layouts](#3-primary-layouts)
4. [Secondary Layouts](#4-secondary-layouts)
5. [Conditional Formatting](#5-conditional-formatting)
6. [React Component Architecture](#6-react-component-architecture)
7. [Wails Integration](#7-wails-integration)

---

## 1. Overview

The FileMaker database contains **13 layouts** (including 2 separator layouts named "-"). These layouts represent the primary user interface screens.

### 1.1 Layout Hierarchy

```
Primary Entry Points:
├── Collections (main work management view)
├── Works (individual work detail)
├── Organizations (literary journal management)
└── Submissions (submission tracking)

Detail/Secondary Views:
├── Collection Details
├── Works Light (simplified list with preview)
├── Works Notes
├── Journal Notes
├── Preview (PDF preview window)
├── Checking (file validation)
└── Collections Copy

Separators:
├── - (divider 1)
└── - (divider 2)
```

---

## 2. Layout Summary

| Layout | Table | Objects | Purpose | Themes |
|--------|-------|---------|---------|--------|
| Collections | Collections | 24 fields, 6 btn groups, 2 buttons, 1 portal, 1 web viewer | Main work list with collection filtering | 06 |
| Works | Works | 38 fields, 1 btn group, 9 buttons, 3 portals, 1 web viewer | Work detail with notes and submissions | 05 |
| Organizations | Organizations | 41 fields, 1 btn group, 6 buttons, 2 portals, 1 web viewer | Journal/organization management | 04 |
| Submissions | Submissions | 22 fields, 3 btn groups, 1 button, 2 web viewers | Submission tracking | 05 |
| Collection Details | CollectionDetails | 4 fields | Link works to collections | 05 |
| Works Light | Works | 14 fields, 2 buttons | Simplified list with PDF preview | 03 |
| Works Notes | Work Notes | 6 fields | Notes list view | 01 |
| Journal Notes | Journal Notes | 5 fields | Journal notes list view | 01 |
| Preview | Works | 4 fields, 1 web viewer | PDF preview window | 05 |
| Checking | Works | 11 fields | File path validation | 05 |
| Collections Copy | Collections | 23 fields, 6 btn groups, 1 button, 1 portal, 5 graphics, 1 web viewer | Alternative collection view | 06 |

---

## 3. Primary Layouts

### 3.1 Collections Layout

**Purpose:** Main work management interface. Shows works in a selected collection with filtering controls.

**Table:** Collections

#### Field Layout

| Field | Position (pt) | Format | Behavior |
|-------|---------------|--------|----------|
| Collection ID | (50, 15, 75, 94) | Edit Box | Browse + Find |
| Collection Name | (50, 99, 75, 565) | Drop-down List (Collections) | Browse + Find |
| Type | (50, 569, 75, 701) | Edit Box, auto-complete | Browse + Find |
| nItems | (50, 973, 75, 1024) | Edit Box | Browse + Find |

#### Filter Buttons

> **Note:** Filter state is managed via AppState (see [09-app-state.md](09-app-state.md)).
> The frontend uses a single `collectionFilter` enum value rather than individual checkboxes.

| Filter | Position | Label | Action |
|--------|----------|-------|--------|
| all | (18, 1092, 40, 1104) | (all) | Set filter to "all" |
| active | (18, 1142, 40, 1154) | active | Set filter to "active" |
| process | (18, 1219, 40, 1231) | process | Set filter to "process" |
| other | (18, 1302, 40, 1314) | other | Set filter to "other" |
| books | (18, 1372, 40, 1384) | books | Set filter to "books" |
| dead | (18, 1448, 40, 1460) | dead | Set filter to "dead" |

#### Portal: Works

**Source Table:** Works (via CollectionDetails relationship)  
**Position:** (105, 15, 998, 1076)  
**Rows:** 27

**Sort Order:**
1. Status (custom: StatusList)
2. Quality (custom: QualityList)
3. Type (custom: WorkType)
4. Year (descending)
5. CourseName (ascending)
6. Title (ascending)

**Portal Fields:**

| Field | Position | Format | Script Trigger |
|-------|----------|--------|----------------|
| Check | (107, 18, 137, 1056) | Edit Box | OnObjectEnter: enterRow |
| workID | (110, 20, 132, 76) | Edit Box | OnObjectEnter: enterRow |
| Type | (110, 79, 132, 163) | Edit Box | OnObjectEnter: enterRow |
| Year | (110, 166, 132, 217) | Edit Box | OnObjectEnter: enterRow |
| Title | (110, 220, 132, 677) | Edit Box | OnObjectEnter: enterRow |
| Status | (110, 714, 132, 808) | Drop-down (StatusList) | OnObjectEnter/Exit: Status Change |
| Quality | (110, 811, 132, 905) | Drop-down (QualityList) | OnObjectEnter/Exit: Status Change |
| isRevised | (114, 962, 136, 978) | Checkbox (Yes) | OnObjectEnter: enterRow |
| isBlog | (114, 981, 136, 997) | Checkbox (Yes) | OnObjectEnter: enterRow |
| isPrinted | (114, 999, 136, 1015) | Checkbox (Yes) | OnObjectEnter: enterRow |
| hasMemo | (114, 1036, 136, 1052) | Checkbox (Yes) | OnObjectEnter: enterRow |

#### Web Viewer: Browser

**Position:** (50, 1080, 959, 1818)  
**URL Source:** AppState.BrowserURL (see [09-app-state.md](09-app-state.md))

---

### 3.2 Works Layout

**Purpose:** Complete work editing with notes portal, submissions portal, and file management.

**Table:** Works

#### Header Fields

| Field | Position | Format |
|-------|----------|--------|
| workID | (40, 32, 66, 93) | Edit Box |
| Title | (40, 109, 66, 712) | Edit Box |
| Type | (40, 715, 66, 853) | Drop-down (WorkType) |
| Year | (40, 858, 66, 936) | Edit Box |
| nWords | (43, 998, 66, 1067) | Edit Box |

#### Path Section

| Field | Position | Notes |
|-------|----------|-------|
| generatedPath | (74, 32, 97, 936) | Shows expected path |
| Path | (106, 32, 129, 936) | Actual stored path |
| Check | (106, 947, 129, 1064) | File status check |

#### Status Section

| Field | Position | Format |
|-------|----------|--------|
| Status | (137, 33, 159, 127) | Drop-down (StatusList) |
| Quality | (137, 130, 159, 224) | Drop-down (QualityList) |
| CourseName | (138, 571, 161, 930) | Edit Box |
| DocType | (136, 995, 159, 1064) | Edit Box |
| Mark | (167, 995, 190, 1064) | Edit Box |
| isRevised | (199, 995, 222, 1064) | Edit Box |
| isProsePoem | (231, 995, 254, 1064) | Edit Box |
| isBlog | (261, 995, 284, 1064) | Edit Box |
| isPrinted | (291, 995, 314, 1064) | Edit Box |
| Draft | (323, 995, 346, 1064) | Edit Box |

#### Portals

**1. Work Notes Portal**
- Position: (164, 32, 496, 936)
- Rows: 10
- Sort: Modified Date (descending)
- Allow deletion: Yes
- Fields: Type (dropdown), Modified Date, Note

**2. Submissions Portal**
- Position: (630, 20, 892, 1067)
- Rows: 10
- Sort: Submission Date (descending)
- Allow deletion: Yes
- Fields: orgID, Journal Name, Draft, Submission Type, Submission Date, Query Date, Response Date, Response Type

**3. CollectionDetails Portal**
- Position: (369, 948, 587, 1065)
- Rows: 8
- Sort: Collection Name (ascending)
- Allow deletion: Yes
- Fields: Collection Name

#### Buttons

| Button | Position | Action |
|--------|----------|--------|
| New | (5, 902, 30, 966) | AddWork script |
| Delete | (5, 973, 30, 1037) | Delete Work script |
| Submit | (5, 1044, 30, 1108) | AddSubmission script |
| Export | (5, 1115, 30, 1179) | copyFile script |
| Print | (5, 1186, 30, 1250) | printFile script |
| Poetry DB | (5, 1257, 30, 1335) | Open dbPoetry file |
| << | (74, 947, 97, 986) | moveFile script |
| moveFile | (74, 991, 97, 1067) | moveFile script (with param) |

#### Web Viewer

**Position:** (42, 1081, 998, 1818)  
**URL Logic:**
```filemaker
If ( fileExists("/Users/jrush/Sites/Works/" & GetAsText(Works::workID) & ".pdf") ; 
    "http://localhost:/Works/" & Works::workID & ".pdf" ; 
    "http://localhost:/Scans/0000 NoPreview.pdf" 
)
```

---

### 3.3 Organizations Layout

**Purpose:** Literary journal/organization management with submission history.

**Table:** Organizations

**Script Triggers:**
- OnLayoutKeystroke: keyStroke (Browse mode)
- OnRecordLoad: SetURL (Browse mode)

#### Key Fields

| Field | Position | Format | Notes |
|-------|----------|--------|-------|
| Name | (50, ~, ~, ~) | Edit Box | Journal name |
| orgID | (50, ~, ~, ~) | Edit Box | Primary key |
| Doutrope Num | (50, 652, 77, 771) | Edit Box | External reference ID |
| Ranking | (50, 409, 76, 445) | Edit Box | User ranking |
| Status | (varies) | Drop-down | closed/on hiatus/active |
| Type | (varies) | Drop-down (OrgType) | Publication type |
| Timing | (352, 236, 375, 342) | Drop-down (Timing) | Submission timing |
| Contest Ends | (352, 73, 375, 179) | Calendar | Contest deadline |

#### Pushcart Statistics Fields

| Field | Purpose |
|-------|---------|
| nPushcarts | Total Pushcart nominations |
| nPushFiction | Fiction nominations |
| nPushPoetry | Poetry nominations |
| nPushNonFiction | Non-fiction nominations |

---

### 3.4 Submissions Layout

**Purpose:** View all submissions across works/organizations.

**Table:** Submissions

#### Key Fields

- Submission Date
- Response Date
- Response Type
- Query Date
- Draft
- Journal Name (via relationship)
- Work Title (via relationship)

---

## 4. Secondary Layouts

### 4.1 Works Light

**Purpose:** Simplified list view with automatic PDF preview panel.

**Script Triggers:**
- OnLayoutEnter: PreviewWindow("Open")
- OnRecordLoad: PreviewWindow("Find|" & workID)
- OnLayoutExit: PreviewWindow("Close")

### 4.2 Preview

**Purpose:** Floating window for PDF preview.

Contains web viewer displaying PDF from `http://localhost:/Works/{workID}.pdf`

### 4.3 Checking

**Purpose:** File path validation and troubleshooting.

Shows 11 fields related to path verification.

### 4.4 Works Notes / Journal Notes

**Purpose:** List views for browsing notes.

Minimal field layouts (5-6 fields each).

---

## 5. Conditional Formatting

### 5.1 Status Field Colors

The Status field uses 13 conditional formats for visual status indication:

| Status | Background Color | Text Color |
|--------|------------------|------------|
| Focus | Dark blue (0, 35%, 49%) | Light gray |
| Active | Very dark purple (13%, 0%, 39%) | Light gray |
| Working | Dark red-brown (39%, 5%, 18%) | Light gray |
| Out | Red-orange (100%, 46%, 44%) | Dark purple |
| Sound | Light green (76%, 90%, 65%) | Dark purple |
| Gestating | Light blue (60%, 72%, 100%) | Dark purple |
| Resting | Orange-brown (61%, 17%, 0%) | Light gray |
| Waiting | Purple (68%, 0%, 94%) | Light gray |
| Sleeping | Dark purple (40%, 0%, 55%) | Light gray |
| Dying | Yellow-brown (58%, 41%, 0%) | Light gray |
| Dead | Olive (24%, 27%, 2%) | Light gray |
| Done | Dark green (25%, 41%, 12%) | Light gray |
| Published | Dark green (25%, 41%, 12%) | Light gray |

### 5.2 Quality Field Colors

| Quality | Background Color | Text Color |
|---------|------------------|------------|
| Best | Orange-brown (61%, 17%, 0%) | Light gray |
| Better | Orange (99%, 60%, 0%) | Dark purple |
| Good | Dark purple (40%, 0%, 55%) | Light gray |
| Okay | Light purple (81%, 73%, 100%) | Dark purple |
| Poor | Dark blue (0%, 35%, 49%) | Light gray |
| Bad | Very dark purple (13%, 0%, 39%) | Light gray |
| Worst | Dark red-brown (39%, 5%, 18%) | Light gray |

### 5.3 Other Conditional Formats

**Age-Based Highlighting (workID field in Collections):**
- Age 0-300 days: Light green background, bold dark green text
- Age 300-36000 days: Light orange background, orange text

**Check Field (generatedPath mismatch):**
- If Check ≠ "": Red background (100%, 29%, 25%), white text

**moveFile Button:**
- If Check = "name changed": Yellow background
- If Check ≠ "name changed": Gray, strikethrough

**Accepted Submissions:**
- Journal Name: Light green background
- Title/Type/Year: Red-orange text

---

## 6. React Component Architecture (Mantine)

This section describes the React component patterns that match the original FileMaker layouts. All primary views are **single-record detail views** with portals, PDF previews, and web viewers — not list/table browsers.

### 6.1 Layout Pattern Summary

| Page | FileMaker Pattern | React Pattern |
|------|-------------------|---------------|
| Collections | Header + filter checkboxes + portal table + web viewer | 60/40 split: form+table / PDF preview |
| Works | Single-record detail + 3 portals + web viewer | 60/40 split: form+portals / PDF preview |
| Organizations | Single-record detail + 2 portals + web viewer | 60/40 split: form+portals / website preview |
| Submissions | Single-record detail + 2 web viewers | 50/50 split: form / stacked web viewers |

### 6.2 Application Shell

```tsx
// src/App.tsx
import { MantineProvider, AppShell, NavLink, Group, Title } from '@mantine/core';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { IconHome, IconFileText, IconSend, IconBuilding } from '@tabler/icons-react';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: IconHome, label: 'Collections', path: '/' },
    { icon: IconFileText, label: 'Works', path: '/works' },
    { icon: IconSend, label: 'Submissions', path: '/submissions' },
    { icon: IconBuilding, label: 'Organizations', path: '/organizations' },
  ];

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 200, breakpoint: 'sm' }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Submissions Tracker</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<CollectionsPage />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
```

### 6.3 Collections Page

The Collections page shows works within a selected collection. Layout: header row with collection selector, filter checkboxes, portal table, and PDF preview panel.

```tsx
// src/pages/CollectionsPage.tsx - Structure
<Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
  {/* Left Panel - 60% */}
  <Box style={{ flex: '0 0 60%', padding: 16, overflow: 'auto' }}>
    {/* Header Row: Collection ID, Name dropdown, Type, nItems */}
    <Group gap="sm" mb="sm" align="flex-end">
      <TextInput label="ID" value={collection.collID} w={60} size="xs" readOnly />
      <Select label="Collection" data={collectionNames} value={collection.name} style={{ flex: 1 }} size="xs" />
      <TextInput label="Type" value={collection.type} w={80} size="xs" />
      <TextInput label="Items" value={collection.nItems} w={60} size="xs" readOnly />
    </Group>

    {/* Filter Checkboxes Row */}
    <Group gap="md" mb="md">
      <Checkbox label="(all)" size="xs" />
      <Checkbox label="active" size="xs" />
      <Checkbox label="process" size="xs" />
      <Checkbox label="other" size="xs" />
      <Checkbox label="books" size="xs" />
      <Checkbox label="dead" size="xs" />
    </Group>

    {/* Works Portal Table */}
    <Table withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={30}>✓</Table.Th>
          <Table.Th w={50}>ID</Table.Th>
          <Table.Th w={70}>Type</Table.Th>
          <Table.Th w={50}>Year</Table.Th>
          <Table.Th>Title</Table.Th>
          <Table.Th w={80}>Status</Table.Th>
          <Table.Th w={70}>Quality</Table.Th>
          <Table.Th w={20}>R</Table.Th>
          <Table.Th w={20}>B</Table.Th>
          <Table.Th w={20}>P</Table.Th>
          <Table.Th w={20}>S</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {works.map((work) => (
          <Table.Tr key={work.workID} style={{ backgroundColor: statusColors[work.status] }}>
            {/* Portal row fields */}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  </Box>

  {/* Right Panel - PDF Preview (40%) */}
  <Box style={{ flex: '0 0 40%', borderLeft: '1px solid #dee2e6' }}>
    <WebViewer url={`/Works/${selectedWorkID}.pdf`} />
  </Box>
</Box>
```

### 6.4 Works Page (Single-Record Detail)

The Works page is a **single-record detail view** — NOT a list browser. It shows one work at a time with record navigation, 3 portals, and a PDF preview.

**Broken Path Warning:** If a work's document file does not exist at the expected path, show a red warning banner at the top of the page:

```tsx
{!fileExists && (
  <Alert color="red" mb="md" icon={<IconAlertCircle />}>
    File not found: {work.path}
  </Alert>
)}
```

```tsx
// src/pages/WorksPage.tsx - Structure
<Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
  {/* Main Form Area - 60% */}
  <Box style={{ flex: '0 0 60%', padding: 16, overflow: 'auto' }}>
    {/* Header Row: workID, Title, Type, Year, nWords */}
    <Group gap="sm" mb="sm" align="flex-end">
      <TextInput label="ID" value={work.workID} w={60} size="xs" readOnly />
      <TextInput label="Title" value={work.title} style={{ flex: 1 }} size="xs" />
      <Select label="Type" data={typeOptions} value={work.type} w={120} size="xs" />
      <TextInput label="Year" value={work.year} w={60} size="xs" />
      <TextInput label="Words" value={work.nWords} w={70} size="xs" />
    </Group>

    {/* Path Section */}
    <Paper withBorder p="xs" mb="sm">
      <Text size="xs">Generated: {generatedPath}</Text>
      <Text size="xs">Path: {work.path}</Text>
      {pathMismatch && <Text size="xs" c="red">Check: name changed</Text>}
    </Paper>

    {/* Status Row */}
    <Group gap="sm" mb="sm">
      <Select label="Status" data={statusOptions} value={work.status} w={100} size="xs" />
      <Select label="Quality" data={qualityOptions} value={work.quality} w={100} size="xs" />
      <TextInput label="Course Name" value={work.courseName} style={{ flex: 1 }} size="xs" />
    </Group>

    {/* Flags + Collections Portal (side by side) */}
    <Group gap="lg" mb="md">
      <Stack gap={4}>
        <TextInput label="DocType" value={work.docType} w={80} size="xs" />
        <Checkbox label="Revised" checked={work.isRevised} size="xs" />
        <Checkbox label="ProsePoem" checked={work.isProsePoem} size="xs" />
        <Checkbox label="Blog" checked={work.isBlog} size="xs" />
        <Checkbox label="Printed" checked={work.isPrinted} size="xs" />
      </Stack>
      
      {/* CollectionDetails Portal */}
      <Box style={{ flex: 1 }}>
        <Text size="xs" fw={500}>Collections</Text>
        <Paper withBorder p="xs">
          <Table>{/* Collection names */}</Table>
        </Paper>
      </Box>
    </Group>

    {/* Work Notes Portal (10 rows) */}
    <Text size="xs" fw={500} mb={4}>Work Notes</Text>
    <Paper withBorder p="xs" mb="md">
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={80}>Type</Table.Th>
            <Table.Th w={80}>Modified</Table.Th>
            <Table.Th>Note</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{/* Work notes rows */}</Table.Tbody>
      </Table>
    </Paper>

    {/* Submissions Portal (10 rows) */}
    <Text size="xs" fw={500} mb={4}>Submissions</Text>
    <Paper withBorder p="xs">
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={40}>ID</Table.Th>
            <Table.Th>Journal Name</Table.Th>
            <Table.Th w={50}>Draft</Table.Th>
            <Table.Th w={60}>Type</Table.Th>
            <Table.Th w={80}>Submitted</Table.Th>
            <Table.Th w={80}>Query</Table.Th>
            <Table.Th w={80}>Response</Table.Th>
            <Table.Th w={80}>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{/* Submission rows */}</Table.Tbody>
      </Table>
    </Paper>
  </Box>

  {/* Right Panel - PDF Preview (40%) */}
  <Box style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
    {/* Button Bar */}
    <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="light">New</Button>
      <Button size="xs" variant="light" color="red">Delete</Button>
      <Button size="xs" variant="light">Submit</Button>
      <Button size="xs" variant="light">Export</Button>
      <Button size="xs" variant="light">Print</Button>
      <Button size="xs" variant="light">Poetry DB</Button>
    </Group>

    {/* Record Navigation */}
    <Group gap="xs" p="xs" justify="center" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="subtle">&lt;</Button>
      <Text size="xs">{currentIndex + 1} of {works.length}</Text>
      <Button size="xs" variant="subtle">&gt;</Button>
    </Group>

    {/* PDF Preview Web Viewer */}
    <Box style={{ flex: 1 }}>
      <WebViewer url={`/Works/${work.workID}.pdf`} />
    </Box>
  </Box>
</Box>
```

### 6.5 Organizations Page (Single-Record Detail)

The Organizations page is a **single-record detail view** with 2 portals (Submissions history, Journal Notes) and a web viewer for the organization's website.

```tsx
// src/pages/OrganizationsPage.tsx - Structure
<Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
  {/* Main Form Area - 60% */}
  <Box style={{ flex: '0 0 60%', padding: 16, overflow: 'auto' }}>
    {/* Header Row: Name, orgID, Duotrope #, Ranking */}
    <Group gap="sm" mb="sm" align="flex-end">
      <TextInput label="Name" value={org.name} style={{ flex: 1 }} size="xs" />
      <TextInput label="ID" value={org.orgID} w={50} size="xs" readOnly />
      <TextInput label="Duotrope #" value={org.duotropeNum} w={80} size="xs" />
      <TextInput label="Ranking" value={org.ranking} w={60} size="xs" />
    </Group>

    {/* Status Row */}
    <Group gap="sm" mb="sm">
      <Select label="Status" data={['Open', 'Closed', 'On Hiatus']} value={org.status} w={100} size="xs" />
      <Select label="Type" data={orgTypes} value={org.type} w={100} size="xs" />
      <Select label="Interest" data={qualityOptions} value={org.myInterest} w={100} size="xs" />
      <Select label="Timing" data={timingOptions} value={org.timing} w={120} size="xs" />
      <DateInput label="Contest Ends" value={org.contestEnds} w={120} size="xs" />
    </Group>

    {/* Accepts Checkboxes */}
    <Paper withBorder p="xs" mb="sm">
      <Text size="xs" fw={500}>Accepts</Text>
      <Group gap="md">
        <Checkbox label="Fiction" size="xs" />
        <Checkbox label="Poetry" size="xs" />
        <Checkbox label="Non-Fiction" size="xs" />
        <Checkbox label="Flash" size="xs" />
        <Checkbox label="Reprints" size="xs" />
        <Checkbox label="Sim Subs" size="xs" />
      </Group>
    </Paper>

    {/* Pushcart Statistics */}
    <Paper withBorder p="xs" mb="sm">
      <Text size="xs" fw={500}>Pushcart Statistics</Text>
      <Group gap="md">
        <TextInput label="Total" value={org.nPushcarts} w={60} size="xs" readOnly />
        <TextInput label="Poetry" value={org.nPushPoetry} w={60} size="xs" readOnly />
        <TextInput label="Fiction" value={org.nPushFiction} w={60} size="xs" readOnly />
        <TextInput label="NF" value={org.nPushNonFiction} w={60} size="xs" readOnly />
      </Group>
    </Paper>

    {/* Submissions Portal */}
    <Text size="xs" fw={500} mb={4}>Submission History</Text>
    <Paper withBorder p="xs" mb="md">
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={40}>ID</Table.Th>
            <Table.Th>Work Title</Table.Th>
            <Table.Th w={60}>Type</Table.Th>
            <Table.Th w={80}>Submitted</Table.Th>
            <Table.Th w={80}>Response</Table.Th>
            <Table.Th w={80}>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{/* Submission rows */}</Table.Tbody>
      </Table>
    </Paper>

    {/* Journal Notes Portal */}
    <Text size="xs" fw={500} mb={4}>Journal Notes</Text>
    <Paper withBorder p="xs">
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={80}>Date</Table.Th>
            <Table.Th w={80}>Type</Table.Th>
            <Table.Th>Note</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{/* Journal notes rows */}</Table.Tbody>
      </Table>
    </Paper>
  </Box>

  {/* Right Panel - Website Preview (40%) */}
  <Box style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
    {/* Button Bar + Record Navigation */}
    <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="light">New</Button>
      <Button size="xs" variant="light" color="red">Delete</Button>
      <Button size="xs" variant="light">Refresh</Button>
      <Button size="xs" variant="light">Submit</Button>
      <Button size="xs" variant="light">Open Website</Button>
    </Group>
    <Group gap="xs" p="xs" justify="center" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="subtle">&lt;</Button>
      <Text size="xs">{currentIndex + 1} of {organizations.length}</Text>
      <Button size="xs" variant="subtle">&gt;</Button>
    </Group>

    {/* Organization Website Web Viewer */}
    <Box style={{ flex: 1 }}>
      <WebViewer url={org.url} />
    </Box>
  </Box>
</Box>
```

### 6.6 Submissions Page (Single-Record Detail)

The Submissions page is a **single-record detail view** with 2 web viewers (PDF preview and organization website) stacked vertically.

```tsx
// src/pages/SubmissionsPage.tsx - Structure
<Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
  {/* Main Form Area - 50% */}
  <Box style={{ flex: '0 0 50%', padding: 16, overflow: 'auto' }}>
    {/* Submission Details */}
    <Paper withBorder p="sm" mb="md">
      <Text size="xs" fw={500} mb={8}>Submission Details</Text>
      <Group gap="sm" mb="sm">
        <TextInput label="ID" value={submission.submissionID} w={50} size="xs" readOnly />
        <DateInput label="Submitted" value={submission.submissionDate} w={120} size="xs" />
        <DateInput label="Query Date" value={submission.queryDate} w={120} size="xs" />
        <DateInput label="Response Date" value={submission.responseDate} w={120} size="xs" />
      </Group>
      <Group gap="sm">
        <Select label="Submission Type" data={submissionTypes} value={submission.submissionType} w={120} size="xs" />
        <Select label="Response" data={responseTypes} value={submission.responseType} w={120} size="xs" />
        <TextInput label="Draft" value={submission.draft} w={60} size="xs" />
      </Group>
    </Paper>

    {/* Work Information (readonly display) */}
    <Paper withBorder p="sm" mb="md">
      <Text size="xs" fw={500} mb={8}>Work Information</Text>
      <Group gap="sm">
        <TextInput label="Work ID" value={submission.workID} w={60} size="xs" readOnly />
        <TextInput label="Title" value={work.title} style={{ flex: 1 }} size="xs" readOnly />
        <TextInput label="Type" value={work.type} w={80} size="xs" readOnly />
      </Group>
      <Group gap="sm" mt="xs">
        <StatusBadge status={work.status} />
        <QualityBadge quality={work.quality} />
      </Group>
    </Paper>

    {/* Organization Information (readonly display) */}
    <Paper withBorder p="sm" mb="md">
      <Text size="xs" fw={500} mb={8}>Organization Information</Text>
      <Group gap="sm">
        <TextInput label="Org ID" value={submission.orgID} w={60} size="xs" readOnly />
        <TextInput label="Journal Name" value={org.name} style={{ flex: 1 }} size="xs" readOnly />
        <TextInput label="Status" value={org.status} w={80} size="xs" readOnly />
      </Group>
    </Paper>

    {/* Response Status Display */}
    <Paper withBorder p="sm">
      <Text size="xs" fw={500} mb={8}>Response Status</Text>
      <Group>
        <ResponseBadge response={submission.responseType} size="lg" />
        {submission.responseDate && <Text size="sm">on {submission.responseDate}</Text>}
      </Group>
    </Paper>
  </Box>

  {/* Right Panel - Dual Web Viewers (50%) */}
  <Box style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
    {/* Button Bar + Record Navigation */}
    <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="light">New</Button>
      <Button size="xs" variant="light" color="red">Delete</Button>
      <Button size="xs" variant="light">Resend</Button>
      <Button size="xs" variant="light">Open Org Website</Button>
    </Group>
    <Group gap="xs" p="xs" justify="center" style={{ borderBottom: '1px solid #dee2e6' }}>
      <Button size="xs" variant="subtle">&lt;</Button>
      <Text size="xs">{currentIndex + 1} of {submissions.length}</Text>
      <Button size="xs" variant="subtle">&gt;</Button>
    </Group>

    {/* PDF Preview (Web Viewer 1) */}
    <Box style={{ flex: 1, borderBottom: '1px solid #dee2e6' }}>
      <Text size="xs" fw={500} p="xs">Work Preview</Text>
      <WebViewer url={`/Works/${work.workID}.pdf`} />
    </Box>

    {/* Organization Website (Web Viewer 2) */}
    <Box style={{ flex: 1 }}>
      <Text size="xs" fw={500} p="xs">Organization Website</Text>
      <WebViewer url={org.url} />
    </Box>
  </Box>
</Box>
```

### 6.7 Badge Components

```tsx
// src/components/StatusBadge.tsx
import { Badge } from '@mantine/core';
import { Status } from '../types';

const statusColors: Record<Status, { bg: string; color: string }> = {
  Focus: { bg: '#C8E6C9', color: '#1B5E20' },
  Active: { bg: '#A5D6A7', color: '#1B5E20' },
  Working: { bg: '#BBDEFB', color: '#0D47A1' },
  Resting: { bg: '#E1BEE7', color: '#4A148C' },
  Waiting: { bg: '#FFE0B2', color: '#E65100' },
  Gestating: { bg: '#FFF9C4', color: '#F57F17' },
  Sleeping: { bg: '#EEEEEE', color: '#616161' },
  Dying: { bg: '#FFCDD2', color: '#B71C1C' },
  Dead: { bg: '#CFD8DC', color: '#37474F' },
  Out: { bg: '#B3E5FC', color: '#01579B' },
  Done: { bg: '#388E3C', color: '#FFFFFF' },
  Published: { bg: '#388E3C', color: '#FFFFFF' },
  Sound: { bg: '#C5E1A5', color: '#33691E' },
};

export function StatusBadge({ status, size = 'sm' }: { status: Status; size?: string }) {
  const colors = statusColors[status] || { bg: '#E0E0E0', color: '#424242' };
  return (
    <Badge size={size} style={{ backgroundColor: colors.bg, color: colors.color }}>
      {status}
    </Badge>
  );
}
```

```tsx
// src/components/QualityBadge.tsx
import { Badge } from '@mantine/core';
import { Quality } from '../types';

const qualityColors: Record<Quality, { bg: string; color: string }> = {
  Best: { bg: '#1B5E20', color: '#FFFFFF' },
  Better: { bg: '#388E3C', color: '#FFFFFF' },
  Good: { bg: '#66BB6A', color: '#1B5E20' },
  Okay: { bg: '#E0E0E0', color: '#616161' },
  Poor: { bg: '#B0BEC5', color: '#37474F' },
  Bad: { bg: '#FFCDD2', color: '#B71C1C' },
  Worst: { bg: '#EF5350', color: '#FFFFFF' },
  Unknown: { bg: '#F5F5F5', color: '#9E9E9E' },
};

export function QualityBadge({ quality, size = 'sm' }: { quality: Quality; size?: string }) {
  const colors = qualityColors[quality] || { bg: '#E0E0E0', color: '#424242' };
  return (
    <Badge size={size} style={{ backgroundColor: colors.bg, color: colors.color }}>
      {quality}
    </Badge>
  );
}
```

```tsx
// src/components/ResponseBadge.tsx
import { Badge } from '@mantine/core';
import { ResponseType } from '../types';

const responseColors: Record<ResponseType, { bg: string; color: string }> = {
  Pending: { bg: '#FFF9C4', color: '#F57F17' },
  Accepted: { bg: '#C8E6C9', color: '#1B5E20' },
  Declined: { bg: '#FFCDD2', color: '#B71C1C' },
  Withdrawn: { bg: '#E0E0E0', color: '#616161' },
  Email: { bg: '#BBDEFB', color: '#0D47A1' },
  'No Response': { bg: '#F5F5F5', color: '#9E9E9E' },
};

export function ResponseBadge({ response, size = 'sm' }: { response: ResponseType; size?: string }) {
  const colors = responseColors[response] || { bg: '#E0E0E0', color: '#424242' };
  return (
    <Badge size={size} style={{ backgroundColor: colors.bg, color: colors.color }}>
      {response}
    </Badge>
  );
}
```

### 6.8 Row Background Colors (for Tables)

```tsx
// src/types/styles.ts
import { Status, Quality } from './enums';

export const statusRowColors: Record<Status, string> = {
  Focus: '#E8F5E9',
  Active: '#E8F5E9',
  Working: '#E3F2FD',
  Resting: '#F3E5F5',
  Waiting: '#FFF3E0',
  Gestating: '#FFFDE7',
  Sleeping: '#FAFAFA',
  Dying: '#FFEBEE',
  Dead: '#ECEFF1',
  Out: '#E1F5FE',
  Done: '#C8E6C9',
  Published: '#C8E6C9',
  Sound: '#E8F5E9',
};

export const qualityRowColors: Record<Quality, string> = {
  Best: '#E8F5E9',
  Better: '#F1F8E9',
  Good: '#FFFDE7',
  Okay: '#FAFAFA',
  Poor: '#ECEFF1',
  Bad: '#FFEBEE',
  Worst: '#FFCDD2',
  Unknown: '#F5F5F5',
};
```

---

## 7. Wails Integration

### 7.1 Wails App Structure

```go
// app.go
package main

import (
    "context"
    "submissions/internal/db"
    "submissions/internal/fileops"
)

type App struct {
    ctx  context.Context
    db   *db.Database
    file *fileops.FileManager
}

func NewApp() *App {
    return &App{}
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    a.db = db.Open("./submissions.db")
    a.file = fileops.NewFileManager()
}

func (a *App) shutdown(ctx context.Context) {
    a.db.Close()
}
```

### 7.2 Wails Bindings (Collections)

```go
// app_collections.go
package main

import "submissions/internal/models"

type CollectionFilters struct {
    All     bool `json:"all"`
    Active  bool `json:"active"`
    Process bool `json:"process"`
    Other   bool `json:"other"`
    Books   bool `json:"books"`
    Dead    bool `json:"dead"`
}

func (a *App) GetCollections(filters CollectionFilters) ([]models.Collection, error) {
    return a.db.GetCollections(filters)
}

func (a *App) GetWorksByCollection(collID int) ([]models.Work, error) {
    return a.db.GetWorksByCollection(collID)
}
```

### 7.3 Wails Bindings (Works)

```go
// app_works.go
package main

import "submissions/internal/models"

func (a *App) GetWork(workID int) (*models.Work, error) {
    return a.db.GetWork(workID)
}

func (a *App) UpdateWork(work models.Work) error {
    return a.db.UpdateWork(work)
}

func (a *App) CreateWork(work models.Work) (*models.Work, error) {
    return a.db.CreateWork(work)
}

func (a *App) DeleteWork(workID int) error {
    return a.db.DeleteWork(workID)
}

func (a *App) GetWorkNotes(workID int) ([]models.WorkNote, error) {
    return a.db.GetWorkNotes(workID)
}

func (a *App) GetWorkSubmissions(workID int) ([]models.Submission, error) {
    return a.db.GetSubmissionsByWork(workID)
}
```

### 7.4 Wails Bindings (File Operations)

```go
// app_files.go
package main

import (
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) FileExists(path string) bool {
    return a.file.Exists(path)
}

func (a *App) OpenDocument(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.file.Open(work.Path)
}

func (a *App) MoveFile(workID int) (string, error) {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return "", err
    }
    
    newPath, err := a.file.Move(work)
    if err != nil {
        return "", err
    }
    
    work.Path = newPath
    if err := a.db.UpdateWork(*work); err != nil {
        return "", err
    }
    
    return newPath, nil
}

func (a *App) CopyToSubmissions(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.file.CopyToSubmissions(work)
}

func (a *App) PrintFile(workID int) error {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return err
    }
    return a.file.Print(work.Path)
}

func (a *App) GetPDFPreviewURL(workID int) (string, error) {
    work, err := a.db.GetWork(workID)
    if err != nil {
        return "", err
    }
    return a.file.GetPDFURL(work), nil
}
```

### 7.5 Native Dialogs

```go
// app_dialogs.go
package main

import (
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ShowConfirmDialog(title, message string) (bool, error) {
    result, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
        Type:          runtime.QuestionDialog,
        Title:         title,
        Message:       message,
        Buttons:       []string{"Yes", "No"},
        DefaultButton: "No",
    })
    return result == "Yes", err
}

func (a *App) ShowErrorDialog(title, message string) error {
    _, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
        Type:    runtime.ErrorDialog,
        Title:   title,
        Message: message,
    })
    return err
}

func (a *App) ShowInputDialog(title, defaultValue string) (string, error) {
    // Wails doesn't have built-in input dialogs,
    // so this would be handled by a React modal component
    return "", nil
}
```

---

## 8. Keyboard Shortcuts

The application implements comprehensive keyboard navigation to match professional desktop workflows. All shortcuts are implemented at the application level and work regardless of which field has focus.

### 8.1 Global Navigation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| ⌘1 | Go to Collections / Cycle Filter | Navigate to Collections page; if already on Collections, cycle through filters (all → active → process → other → books → dead → all) |
| ⌘2 | Go to Works | Navigate to Works page |
| ⌘3 | Go to Submissions | Navigate to Submissions page |
| ⌘4 | Go to Organizations | Navigate to Organizations page |

### 8.2 Record Navigation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| ↓ or ⌘↓ | Next Record | Move to the next record in the current set |
| ↑ or ⌘↑ | Previous Record | Move to the previous record in the current set |
| ⌘Home or ⌘⇧↑ | First Record | Jump to the first record |
| ⌘End or ⌘⇧↓ | Last Record | Jump to the last record |

### 8.3 View Switching Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| ⌘V | Toggle View | Switch between Form View and Table View |

### 8.4 Action Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| ⌘N | New Record | Create a new record in the current table |
| ⌘S | Save Record | Commit current record changes |
| ⌘F | Find/Filter | Open find mode or filter panel |
| Escape | Cancel | Cancel current edit, close dialog, or exit find mode |

### 8.5 React Implementation

```tsx
// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface RecordNavigationProps {
  currentIndex: number;
  totalRecords: number;
  onNavigate: (index: number) => void;
  viewMode: 'form' | 'table';
  onToggleView?: () => void;
  onNewRecord?: () => void;
  onSaveRecord?: () => void;
  onFind?: () => void;
  onCancel?: () => void;
}

export function useKeyboardShortcuts(props?: RecordNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMeta = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;

    // Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.tagName === 'SELECT' ||
                         target.isContentEditable;

    // Global navigation shortcuts (⌘1-4) - always work
    if (isMeta && event.key >= '1' && event.key <= '4') {
      event.preventDefault();
      const routes = ['/', '/works', '/submissions', '/organizations'];
      const index = parseInt(event.key) - 1;
      navigate(routes[index]);
      return;
    }

    // Skip other shortcuts if in input field (unless Escape)
    if (isInputField && event.key !== 'Escape') {
      return;
    }

    // Record navigation shortcuts
    if (props) {
      const { currentIndex, totalRecords, onNavigate, onToggleView, onNewRecord, onSaveRecord, onFind, onCancel } = props;

      switch (event.key) {
        case 'ArrowDown':
          if (currentIndex < totalRecords - 1) {
            event.preventDefault();
            onNavigate(currentIndex + 1);
          }
          break;

        case 'ArrowUp':
          if (currentIndex > 0) {
            event.preventDefault();
            onNavigate(currentIndex - 1);
          }
          break;

        case 'Home':
          if (isMeta || isShift) {
            event.preventDefault();
            onNavigate(0);
          }
          break;

        case 'End':
          if (isMeta || isShift) {
            event.preventDefault();
            onNavigate(totalRecords - 1);
          }
          break;

        case 'v':
          if (isMeta && onToggleView) {
            event.preventDefault();
            onToggleView();
          }
          break;

        case 'n':
          if (isMeta && onNewRecord) {
            event.preventDefault();
            onNewRecord();
          }
          break;

        case 's':
          if (isMeta && onSaveRecord) {
            event.preventDefault();
            onSaveRecord();
          }
          break;

        case 'f':
          if (isMeta && onFind) {
            event.preventDefault();
            onFind();
          }
          break;

        case 'Escape':
          if (onCancel) {
            event.preventDefault();
            onCancel();
          }
          break;
      }
    }
  }, [navigate, props]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

### 8.6 Usage in Page Components

```tsx
// src/pages/WorksPage.tsx - Example usage
import { useState, useCallback } from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function WorksPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form');
  const totalRecords = works.length;

  useKeyboardShortcuts({
    currentIndex,
    totalRecords,
    viewMode,
    onNavigate: setCurrentIndex,
    onToggleView: () => setViewMode(v => v === 'form' ? 'table' : 'form'),
    onNewRecord: () => console.log('New record'),
    onSaveRecord: () => console.log('Save record'),
    onFind: () => console.log('Find'),
    onCancel: () => console.log('Cancel'),
  });

  // ... rest of component
}
```

### 8.7 Wails Backend Integration

```go
// app_keyboard.go - Future Wails integration
package main

// In Wails, keyboard shortcuts can be registered globally
// using the runtime menu system or handled in the frontend.
// The React implementation above is the recommended approach
// for consistency with web-based UI patterns.

// For truly global shortcuts (even when app is not focused),
// use Wails menu accelerators:
func (a *App) registerMenu() {
    menu := menu.NewMenu()
    
    fileMenu := menu.AddSubmenu("File")
    fileMenu.AddText("New", keys.CmdOrCtrl("n"), a.onNewRecord)
    fileMenu.AddText("Save", keys.CmdOrCtrl("s"), a.onSaveRecord)
    
    viewMenu := menu.AddSubmenu("View")
    viewMenu.AddText("Collections", keys.CmdOrCtrl("1"), a.goToCollections)
    viewMenu.AddText("Works", keys.CmdOrCtrl("2"), a.goToWorks)
    viewMenu.AddText("Submissions", keys.CmdOrCtrl("3"), a.goToSubmissions)
    viewMenu.AddText("Organizations", keys.CmdOrCtrl("4"), a.goToOrganizations)
    viewMenu.AddSeparator()
    viewMenu.AddText("Toggle View", keys.CmdOrCtrl("v"), a.toggleView)
    
    runtime.MenuSetApplicationMenu(a.ctx, menu)
}
```

### 8.8 Keyboard Shortcut Display

Display available shortcuts in the UI footer or help panel:

```tsx
// src/components/KeyboardHints.tsx
import { Group, Text, Kbd } from '@mantine/core';

export function KeyboardHints() {
  return (
    <Group gap="lg" p="xs" bg="gray.1">
      <Group gap={4}>
        <Kbd>⌘</Kbd><Kbd>1-4</Kbd>
        <Text size="xs" c="dimmed">Navigate pages</Text>
      </Group>
      <Group gap={4}>
        <Kbd>↑</Kbd><Kbd>↓</Kbd>
        <Text size="xs" c="dimmed">Records</Text>
      </Group>
      <Group gap={4}>
        <Kbd>⌘</Kbd><Kbd>V</Kbd>
        <Text size="xs" c="dimmed">Toggle view</Text>
      </Group>
      <Group gap={4}>
        <Kbd>⌘</Kbd><Kbd>N</Kbd>
        <Text size="xs" c="dimmed">New</Text>
      </Group>
    </Group>
  );
}
```

---

*End of Layouts Specification*
