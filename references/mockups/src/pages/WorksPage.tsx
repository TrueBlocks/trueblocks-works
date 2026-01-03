import { useState } from 'react';
import {
  Text,
  Table,
  Group,
  TextInput,
  Select,
  Checkbox,
  Stack,
  ActionIcon,
  Tooltip,
  Box,
  Button,
  Paper,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconSend,
  IconFileExport,
  IconPrinter,
  IconExternalLink,
  IconArrowLeft,
  IconFileSymlink,
  IconAlertTriangle,
  IconLayoutList,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { works, getSubmissionsForWork, getOrgById } from '../data';
import { ResponseBadge } from '../components';
import { Status, Quality, WorkType } from '../types';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const statusOptions: Status[] = ['Focus', 'Active', 'Working', 'Resting', 'Waiting', 'Gestating', 'Sleeping', 'Dying', 'Dead', 'Out', 'Done', 'Published', 'Sound'];
const qualityOptions: Quality[] = ['Best', 'Better', 'Good', 'Okay', 'Poor', 'Bad', 'Worst', 'Unknown'];
const typeOptions: WorkType[] = ['Poem', 'Story', 'Essay', 'Song', 'Essay Idea', 'Story Idea', 'Poem Idea'];

// Work Notes mock data
const workNotes = [
  { id: 1, type: 'Revision', modified: '2024-01-15', note: 'Revised ending to be more ambiguous' },
  { id: 2, type: 'Feedback', modified: '2024-01-10', note: 'Workshop feedback: strengthen the middle section' },
  { id: 3, type: 'Idea', modified: '2024-01-05', note: 'Consider adding a third character' },
];

// Collection mock data for the Collections portal
const collections = [
  { id: 1, name: 'Best Stories 2024' },
  { id: 2, name: 'Literary Fiction' },
  { id: 3, name: 'Submission Ready' },
];

export function WorksPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form');
  const work = works[currentIndex];
  const submissions = getSubmissionsForWork(work.workID);

  // Keyboard shortcuts for record navigation and actions
  useKeyboardShortcuts({
    currentIndex,
    totalRecords: works.length,
    viewMode,
    onNavigate: setCurrentIndex,
    onToggleView: () => setViewMode(v => v === 'form' ? 'table' : 'form'),
    onNewRecord: () => console.log('New work'),
    onSaveRecord: () => console.log('Save work'),
    onFind: () => console.log('Find works'),
    onCancel: () => console.log('Cancel'),
  });

  // Simulate path check
  const generatedPath = `/Users/jrush/Sites/Works/${work.workID}.pdf`;
  const pathMismatch = work.path !== generatedPath;

  // Table view mode
  if (viewMode === 'table') {
    return (
      <Box p="md">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Works ({works.length} records)</Text>
          <Tooltip label="Switch to Form View (⌘V)">
            <ActionIcon variant="light" onClick={() => setViewMode('form')}>
              <IconLayoutGrid size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Paper withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Quality</Table.Th>
                <Table.Th>Year</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {works.map((w, idx) => (
                <Table.Tr 
                  key={w.workID} 
                  style={{ cursor: 'pointer', backgroundColor: idx === currentIndex ? '#e7f5ff' : undefined }}
                  onClick={() => { setCurrentIndex(idx); setViewMode('form'); }}
                >
                  <Table.Td>{w.workID}</Table.Td>
                  <Table.Td>{w.title}</Table.Td>
                  <Table.Td>{w.type}</Table.Td>
                  <Table.Td>{w.status}</Table.Td>
                  <Table.Td>{w.quality}</Table.Td>
                  <Table.Td>{w.year}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Box>
    );
  }

  // Form view mode (default)

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Main Form Area - 60% */}
      <Box style={{ flex: '0 0 60%', padding: 16, overflow: 'auto' }}>
        {/* Header Row: workID, Title, Type, Year, nWords */}
        <Group gap="sm" mb="sm" align="flex-end">
          <TextInput
            label="ID"
            value={work.workID}
            readOnly
            w={60}
            size="xs"
          />
          <TextInput
            label="Title"
            value={work.title}
            style={{ flex: 1 }}
            size="xs"
          />
          <Select
            label="Type"
            data={typeOptions}
            value={work.type}
            w={120}
            size="xs"
          />
          <TextInput
            label="Year"
            value={String(work.year)}
            w={60}
            size="xs"
          />
          <TextInput
            label="Words"
            value={work.nWords || '—'}
            w={70}
            size="xs"
          />
        </Group>

        {/* Path Section */}
        <Paper withBorder p="xs" mb="sm">
          <Stack gap={4}>
            <Group gap="xs">
              <Text size="xs" c="dimmed" w={80}>Generated:</Text>
              <Text size="xs" style={{ fontFamily: 'monospace' }}>{generatedPath}</Text>
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed" w={80}>Path:</Text>
              <Text size="xs" style={{ fontFamily: 'monospace' }}>{work.path}</Text>
              <Group gap={4}>
                <Tooltip label="Move file to generated path">
                  <ActionIcon size="xs" variant="subtle">
                    <IconArrowLeft size={12} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="moveFile">
                  <ActionIcon size="xs" variant="subtle">
                    <IconFileSymlink size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            {pathMismatch && (
              <Group gap="xs">
                <Text size="xs" c="dimmed" w={80}>Check:</Text>
                <Text size="xs" c="red" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconAlertTriangle size={12} /> name changed
                </Text>
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Status Row */}
        <Group gap="sm" mb="sm" align="flex-end">
          <Select
            label="Status"
            data={statusOptions}
            value={work.status}
            w={100}
            size="xs"
          />
          <Select
            label="Quality"
            data={qualityOptions}
            value={work.quality}
            w={100}
            size="xs"
          />
          <TextInput
            label="Course Name"
            value=""
            style={{ flex: 1 }}
            size="xs"
          />
        </Group>

        {/* Flags Column (right side) */}
        <Group gap="lg" mb="md">
          <Stack gap={4}>
            <TextInput label="DocType" value={work.docType} w={80} size="xs" />
            <TextInput label="Mark" value="" w={80} size="xs" />
            <Checkbox label="Revised" checked={work.isRevised} size="xs" />
            <Checkbox label="ProsePoem" checked={work.isProsePoem} size="xs" />
            <Checkbox label="Blog" checked={work.isBlog} size="xs" />
            <Checkbox label="Printed" checked={work.isPrinted} size="xs" />
            <TextInput label="Draft" value="" w={80} size="xs" />
          </Stack>

          {/* Collections Portal (right side, 8 rows) */}
          <Box style={{ flex: 1 }}>
            <Text size="xs" fw={500} mb={4}>Collections</Text>
            <Paper withBorder p="xs" style={{ minHeight: 180 }}>
              <Table withRowBorders={false}>
                <Table.Tbody>
                  {collections.map((col) => (
                    <Table.Tr key={col.id}>
                      <Table.Td p={2}>
                        <Text size="xs">{col.name}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Box>
        </Group>

        {/* Work Notes Portal (10 rows) */}
        <Text size="xs" fw={500} mb={4}>Work Notes</Text>
        <Paper withBorder p="xs" mb="md" style={{ minHeight: 200 }}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={80}><Text size="xs">Type</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Modified</Text></Table.Th>
                <Table.Th><Text size="xs">Note</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {workNotes.map((note) => (
                <Table.Tr key={note.id}>
                  <Table.Td p={4}>
                    <Select
                      data={['Revision', 'Feedback', 'Idea', 'Other']}
                      value={note.type}
                      size="xs"
                      variant="unstyled"
                    />
                  </Table.Td>
                  <Table.Td p={4}><Text size="xs">{note.modified}</Text></Table.Td>
                  <Table.Td p={4}><Text size="xs">{note.note}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Submissions Portal (10 rows) */}
        <Text size="xs" fw={500} mb={4}>Submissions</Text>
        <Paper withBorder p="xs" style={{ minHeight: 200 }}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}><Text size="xs">ID</Text></Table.Th>
                <Table.Th><Text size="xs">Journal Name</Text></Table.Th>
                <Table.Th w={50}><Text size="xs">Draft</Text></Table.Th>
                <Table.Th w={60}><Text size="xs">Type</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Submitted</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Query</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Response</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Type</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {submissions.map((sub) => {
                const org = getOrgById(sub.orgID);
                return (
                  <Table.Tr key={sub.submissionID}>
                    <Table.Td p={4}><Text size="xs">{sub.orgID}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{org?.name || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.draft || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.submissionType || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.submissionDate}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.queryDate || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.responseDate || ''}</Text></Table.Td>
                    <Table.Td p={4}><ResponseBadge response={sub.responseType} size="xs" /></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      </Box>

      {/* Right Panel - PDF Preview (40%) */}
      <Box style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
        {/* Button Bar */}
        <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Tooltip label="New Work (⌘N)"><Button size="xs" variant="light"><IconPlus size={14} /></Button></Tooltip>
          <Tooltip label="Delete Work"><Button size="xs" variant="light" color="red"><IconTrash size={14} /></Button></Tooltip>
          <Tooltip label="Submit"><Button size="xs" variant="light"><IconSend size={14} /></Button></Tooltip>
          <Tooltip label="Export"><Button size="xs" variant="light"><IconFileExport size={14} /></Button></Tooltip>
          <Tooltip label="Print"><Button size="xs" variant="light"><IconPrinter size={14} /></Button></Tooltip>
          <Tooltip label="Open Poetry DB"><Button size="xs" variant="light"><IconExternalLink size={14} /></Button></Tooltip>
          <Box style={{ flex: 1 }} />
          <Tooltip label="Table View (⌘V)">
            <ActionIcon variant="light" onClick={() => setViewMode('table')}>
              <IconLayoutList size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Record Navigation */}
        <Group gap="xs" p="xs" justify="center" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Tooltip label="First Record (⌘⇧↑)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0}>
              ⏮
            </Button>
          </Tooltip>
          <Tooltip label="Previous Record (↑)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
              ◀
            </Button>
          </Tooltip>
          <Text size="xs">{currentIndex + 1} of {works.length}</Text>
          <Tooltip label="Next Record (↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(Math.min(works.length - 1, currentIndex + 1))} disabled={currentIndex === works.length - 1}>
              ▶
            </Button>
          </Tooltip>
          <Tooltip label="Last Record (⌘⇧↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(works.length - 1)} disabled={currentIndex === works.length - 1}>
              ⏭
            </Button>
          </Tooltip>
        </Group>

        {/* PDF Preview */}
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
          <Stack align="center" gap="xs">
            <Paper
              withBorder
              p="xl"
              style={{
                width: '90%',
                height: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}
            >
              <Text c="dimmed" size="sm">
                PDF Preview: {work.workID}.pdf
              </Text>
            </Paper>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default WorksPage;
