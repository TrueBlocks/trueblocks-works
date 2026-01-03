import { useState } from 'react';
import {
  Text,
  Table,
  Group,
  TextInput,
  Select,
  Stack,
  Box,
  Paper,
  Button,
  Checkbox,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconTrash,
  IconExternalLink,
  IconRefresh,
  IconSend,
  IconLayoutList,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { organizations, submissions, getWorkById } from '../data';
import { QualityBadge, ResponseBadge } from '../components';
import { Quality } from '../types';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const interestOptions: Quality[] = ['Best', 'Better', 'Good', 'Okay', 'Poor', 'Bad', 'Worst', 'Unknown'];
const statusOptions = ['Open', 'Closed', 'On Hiatus'];
const typeOptions = ['Magazine', 'Journal', 'Contest', 'Publisher', 'Online', 'Other'];
const timingOptions = ['Any time', 'Reading Periods', 'Contest Only', 'Closed'];

// Journal Notes mock data
const journalNotes = [
  { id: 1, date: '2024-01-15', type: 'Response', note: 'Very quick response - 2 weeks' },
  { id: 2, date: '2023-11-20', type: 'Research', note: 'Editor prefers literary fiction' },
  { id: 3, date: '2023-08-10', type: 'Visit', note: 'Checked submission guidelines - updated' },
];

export function OrganizationsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form');
  const org = organizations[currentIndex];
  
  // Get submissions for this organization
  const orgSubmissions = submissions.filter(s => s.orgID === org.orgID);

  // Keyboard shortcuts for record navigation and actions
  useKeyboardShortcuts({
    currentIndex,
    totalRecords: organizations.length,
    viewMode,
    onNavigate: setCurrentIndex,
    onToggleView: () => setViewMode(v => v === 'form' ? 'table' : 'form'),
    onNewRecord: () => console.log('New organization'),
    onSaveRecord: () => console.log('Save organization'),
    onFind: () => console.log('Find organizations'),
    onCancel: () => console.log('Cancel'),
  });

  // Table view mode
  if (viewMode === 'table') {
    return (
      <Box p="md">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Organizations ({organizations.length} records)</Text>
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
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Interest</Table.Th>
                <Table.Th>Ranking</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organizations.map((o, idx) => (
                <Table.Tr 
                  key={o.orgID} 
                  style={{ cursor: 'pointer', backgroundColor: idx === currentIndex ? '#e7f5ff' : undefined }}
                  onClick={() => { setCurrentIndex(idx); setViewMode('form'); }}
                >
                  <Table.Td>{o.orgID}</Table.Td>
                  <Table.Td>{o.name}</Table.Td>
                  <Table.Td>{o.type}</Table.Td>
                  <Table.Td>{o.status}</Table.Td>
                  <Table.Td><QualityBadge quality={o.myInterest} size="xs" /></Table.Td>
                  <Table.Td>{o.ranking || ''}</Table.Td>
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
        {/* Header Row: Name, orgID, Duotrope Num, Ranking */}
        <Group gap="sm" mb="sm" align="flex-end">
          <TextInput
            label="Name"
            value={org.name}
            style={{ flex: 1 }}
            size="xs"
          />
          <TextInput
            label="ID"
            value={org.orgID}
            readOnly
            w={50}
            size="xs"
          />
          <TextInput
            label="Duotrope #"
            value=""
            w={80}
            size="xs"
          />
          <TextInput
            label="Ranking"
            value={org.ranking || ''}
            w={60}
            size="xs"
          />
        </Group>

        {/* Status Row */}
        <Group gap="sm" mb="sm" align="flex-end">
          <Select
            label="Status"
            data={statusOptions}
            value={org.status}
            w={100}
            size="xs"
          />
          <Select
            label="Type"
            data={typeOptions}
            value="Magazine"
            w={100}
            size="xs"
          />
          <Select
            label="Interest"
            data={interestOptions}
            value={org.myInterest}
            w={100}
            size="xs"
          />
          <Select
            label="Timing"
            data={timingOptions}
            value="Any time"
            w={120}
            size="xs"
          />
          <DateInput
            label="Contest Ends"
            placeholder="Pick date"
            w={120}
            size="xs"
          />
        </Group>

        {/* Accepts Row */}
        <Paper withBorder p="xs" mb="sm">
          <Text size="xs" fw={500} mb={4}>Accepts</Text>
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
          <Text size="xs" fw={500} mb={4}>Pushcart Statistics</Text>
          <Group gap="md">
            <TextInput label="Total" value={org.nPushPoetry + org.nPushFiction + org.nPushNonFiction} w={60} size="xs" readOnly />
            <TextInput label="Poetry" value={org.nPushPoetry} w={60} size="xs" readOnly />
            <TextInput label="Fiction" value={org.nPushFiction} w={60} size="xs" readOnly />
            <TextInput label="NF" value={org.nPushNonFiction} w={60} size="xs" readOnly />
          </Group>
        </Paper>

        {/* URL */}
        <Group gap="sm" mb="md">
          <TextInput
            label="URL"
            value={org.url || ''}
            style={{ flex: 1 }}
            size="xs"
          />
          <Tooltip label="Open in browser">
            <Button size="xs" variant="light" mt={20}>
              <IconExternalLink size={14} />
            </Button>
          </Tooltip>
        </Group>

        {/* Submissions Portal (10 rows) */}
        <Text size="xs" fw={500} mb={4}>Submission History</Text>
        <Paper withBorder p="xs" mb="md" style={{ minHeight: 200 }}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}><Text size="xs">ID</Text></Table.Th>
                <Table.Th><Text size="xs">Work Title</Text></Table.Th>
                <Table.Th w={60}><Text size="xs">Type</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Submitted</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Response</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Result</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orgSubmissions.map((sub) => {
                const work = getWorkById(sub.workID);
                return (
                  <Table.Tr key={sub.submissionID}>
                    <Table.Td p={4}><Text size="xs">{sub.workID}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{work?.title || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{work?.type || ''}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.submissionDate}</Text></Table.Td>
                    <Table.Td p={4}><Text size="xs">{sub.responseDate || ''}</Text></Table.Td>
                    <Table.Td p={4}><ResponseBadge response={sub.responseType} size="xs" /></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Journal Notes Portal */}
        <Text size="xs" fw={500} mb={4}>Journal Notes</Text>
        <Paper withBorder p="xs" style={{ minHeight: 150 }}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={80}><Text size="xs">Date</Text></Table.Th>
                <Table.Th w={80}><Text size="xs">Type</Text></Table.Th>
                <Table.Th><Text size="xs">Note</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {journalNotes.map((note) => (
                <Table.Tr key={note.id}>
                  <Table.Td p={4}><Text size="xs">{note.date}</Text></Table.Td>
                  <Table.Td p={4}>
                    <Select
                      data={['Response', 'Research', 'Visit', 'Other']}
                      value={note.type}
                      size="xs"
                      variant="unstyled"
                    />
                  </Table.Td>
                  <Table.Td p={4}><Text size="xs">{note.note}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Box>

      {/* Right Panel - Web Viewer + Buttons (40%) */}
      <Box style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
        {/* Button Bar */}
        <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Tooltip label="New Organization (⌘N)"><Button size="xs" variant="light"><IconPlus size={14} /></Button></Tooltip>
          <Tooltip label="Delete"><Button size="xs" variant="light" color="red"><IconTrash size={14} /></Button></Tooltip>
          <Tooltip label="Refresh Data"><Button size="xs" variant="light"><IconRefresh size={14} /></Button></Tooltip>
          <Tooltip label="Submit Work"><Button size="xs" variant="light"><IconSend size={14} /></Button></Tooltip>
          <Tooltip label="Open Website"><Button size="xs" variant="light"><IconExternalLink size={14} /></Button></Tooltip>
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
          <Text size="xs">{currentIndex + 1} of {organizations.length}</Text>
          <Tooltip label="Next Record (↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(Math.min(organizations.length - 1, currentIndex + 1))} disabled={currentIndex === organizations.length - 1}>
              ▶
            </Button>
          </Tooltip>
          <Tooltip label="Last Record (⌘⇧↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(organizations.length - 1)} disabled={currentIndex === organizations.length - 1}>
              ⏭
            </Button>
          </Tooltip>
        </Group>

        {/* Interest Badge */}
        <Group p="xs" justify="center">
          <QualityBadge quality={org.myInterest} size="lg" />
        </Group>

        {/* Web Viewer - Organization Website */}
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
          <Stack align="center" gap="xs">
            <Paper
              withBorder
              p="xl"
              style={{
                width: '90%',
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}
            >
              <Stack align="center" gap="xs">
                <Text c="dimmed" size="sm" ta="center">
                  Organization Website Preview
                </Text>
                <Text size="xs" c="blue" style={{ wordBreak: 'break-all' }}>
                  {org.url || 'No URL set'}
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default OrganizationsPage;
