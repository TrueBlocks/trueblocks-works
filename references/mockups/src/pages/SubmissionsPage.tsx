import { useState } from 'react';
import {
  Text,
  Group,
  TextInput,
  Select,
  Stack,
  Box,
  Paper,
  Button,
  Tooltip,
  ActionIcon,
  Table,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlus,
  IconTrash,
  IconExternalLink,
  IconSend,
  IconLayoutList,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { submissions, getWorkById, getOrgById } from '../data';
import { StatusBadge, QualityBadge, ResponseBadge } from '../components';
import { ResponseType } from '../types';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const responseOptions: ResponseType[] = ['Pending', 'Accepted', 'Declined', 'Withdrawn', 'Email', 'No Response'];
const submissionTypeOptions = ['Online', 'Email', 'Postal', 'Contest'];

export function SubmissionsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form');
  const submission = submissions[currentIndex];
  const work = getWorkById(submission.workID);
  const org = getOrgById(submission.orgID);

  // Keyboard shortcuts for record navigation and actions
  useKeyboardShortcuts({
    currentIndex,
    totalRecords: submissions.length,
    viewMode,
    onNavigate: setCurrentIndex,
    onToggleView: () => setViewMode(v => v === 'form' ? 'table' : 'form'),
    onNewRecord: () => console.log('New submission'),
    onSaveRecord: () => console.log('Save submission'),
    onFind: () => console.log('Find submissions'),
    onCancel: () => console.log('Cancel'),
  });

  // Table view mode
  if (viewMode === 'table') {
    return (
      <Box p="md">
        <Group justify="space-between" mb="md">
          <Text fw={500}>Submissions ({submissions.length} records)</Text>
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
                <Table.Th>Work</Table.Th>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Submitted</Table.Th>
                <Table.Th>Response</Table.Th>
                <Table.Th>Type</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {submissions.map((s, idx) => {
                const w = getWorkById(s.workID);
                const o = getOrgById(s.orgID);
                return (
                  <Table.Tr 
                    key={s.submissionID} 
                    style={{ cursor: 'pointer', backgroundColor: idx === currentIndex ? '#e7f5ff' : undefined }}
                    onClick={() => { setCurrentIndex(idx); setViewMode('form'); }}
                  >
                    <Table.Td>{s.submissionID}</Table.Td>
                    <Table.Td>{w?.title || s.workID}</Table.Td>
                    <Table.Td>{o?.name || s.orgID}</Table.Td>
                    <Table.Td>{s.submissionDate || ''}</Table.Td>
                    <Table.Td><ResponseBadge response={s.responseType} size="xs" /></Table.Td>
                    <Table.Td>{s.submissionType || ''}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      </Box>
    );
  }

  // Form view mode (default)

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* Main Form Area - Left side */}
      <Box style={{ flex: '0 0 50%', padding: 16, overflow: 'auto' }}>
        {/* Header Section */}
        <Paper withBorder p="sm" mb="md">
          <Text size="xs" fw={500} mb={8}>Submission Details</Text>
          
          {/* Submission ID and dates */}
          <Group gap="sm" mb="sm" align="flex-end">
            <TextInput
              label="ID"
              value={submission.submissionID}
              readOnly
              w={50}
              size="xs"
            />
            <DateInput
              label="Submitted"
              value={submission.submissionDate ? new Date(submission.submissionDate) : null}
              w={120}
              size="xs"
            />
            <DateInput
              label="Query Date"
              value={submission.queryDate ? new Date(submission.queryDate) : null}
              w={120}
              size="xs"
              placeholder="Optional"
            />
            <DateInput
              label="Response Date"
              value={submission.responseDate ? new Date(submission.responseDate) : null}
              w={120}
              size="xs"
            />
          </Group>

          {/* Type and Response */}
          <Group gap="sm" mb="sm" align="flex-end">
            <Select
              label="Submission Type"
              data={submissionTypeOptions}
              value={submission.submissionType || 'Online'}
              w={120}
              size="xs"
            />
            <Select
              label="Response"
              data={responseOptions}
              value={submission.responseType}
              w={120}
              size="xs"
            />
            <TextInput
              label="Draft"
              value={submission.draft || ''}
              w={60}
              size="xs"
            />
          </Group>
        </Paper>

        {/* Work Section */}
        <Paper withBorder p="sm" mb="md">
          <Text size="xs" fw={500} mb={8}>Work Information</Text>
          <Group gap="sm" mb="sm" align="flex-end">
            <TextInput
              label="Work ID"
              value={submission.workID}
              readOnly
              w={60}
              size="xs"
            />
            <TextInput
              label="Title"
              value={work?.title || ''}
              style={{ flex: 1 }}
              size="xs"
              readOnly
            />
            <TextInput
              label="Type"
              value={work?.type || ''}
              w={80}
              size="xs"
              readOnly
            />
          </Group>
          <Group gap="sm" align="flex-end">
            {work && <StatusBadge status={work.status} size="sm" />}
            {work && <QualityBadge quality={work.quality} size="sm" />}
          </Group>
        </Paper>

        {/* Organization Section */}
        <Paper withBorder p="sm" mb="md">
          <Text size="xs" fw={500} mb={8}>Organization Information</Text>
          <Group gap="sm" mb="sm" align="flex-end">
            <TextInput
              label="Org ID"
              value={submission.orgID}
              readOnly
              w={60}
              size="xs"
            />
            <TextInput
              label="Journal Name"
              value={org?.name || ''}
              style={{ flex: 1 }}
              size="xs"
              readOnly
            />
            <TextInput
              label="Status"
              value={org?.status || ''}
              w={80}
              size="xs"
              readOnly
            />
          </Group>
          <Group gap="sm" align="flex-end">
            {org && <QualityBadge quality={org.myInterest} size="sm" />}
            {org?.url && (
              <Button 
                size="xs" 
                variant="light" 
                leftSection={<IconExternalLink size={12} />}
                component="a"
                href={org.url}
                target="_blank"
              >
                Visit Site
              </Button>
            )}
          </Group>
        </Paper>

        {/* Response Status Display */}
        <Paper withBorder p="sm">
          <Text size="xs" fw={500} mb={8}>Response Status</Text>
          <Group>
            <ResponseBadge response={submission.responseType} size="lg" />
            {submission.responseDate && (
              <Text size="sm">
                on {submission.responseDate}
              </Text>
            )}
          </Group>
        </Paper>
      </Box>

      {/* Right Panel - Web Viewers (50%) */}
      <Box style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #dee2e6' }}>
        {/* Button Bar */}
        <Group gap="xs" p="xs" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Tooltip label="New Submission (⌘N)"><Button size="xs" variant="light"><IconPlus size={14} /></Button></Tooltip>
          <Tooltip label="Delete"><Button size="xs" variant="light" color="red"><IconTrash size={14} /></Button></Tooltip>
          <Tooltip label="Resend"><Button size="xs" variant="light"><IconSend size={14} /></Button></Tooltip>
          <Tooltip label="Open Org Website"><Button size="xs" variant="light"><IconExternalLink size={14} /></Button></Tooltip>
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
          <Text size="xs">{currentIndex + 1} of {submissions.length}</Text>
          <Tooltip label="Next Record (↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(Math.min(submissions.length - 1, currentIndex + 1))} disabled={currentIndex === submissions.length - 1}>
              ▶
            </Button>
          </Tooltip>
          <Tooltip label="Last Record (⌘⇧↓)">
            <Button size="xs" variant="subtle" onClick={() => setCurrentIndex(submissions.length - 1)} disabled={currentIndex === submissions.length - 1}>
              ⏭
            </Button>
          </Tooltip>
        </Group>

        {/* PDF Preview (Web Viewer 1) */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #dee2e6' }}>
          <Text size="xs" fw={500} p="xs" style={{ borderBottom: '1px solid #eee' }}>
            Work Preview
          </Text>
          <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
            <Paper
              withBorder
              p="xl"
              style={{
                width: '90%',
                height: '90%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}
            >
              <Stack align="center" gap="xs">
                <Text c="dimmed" size="sm">
                  PDF Preview: {work?.workID || submission.workID}.pdf
                </Text>
                <Text size="xs" c="dimmed">
                  {work?.title || 'Unknown Work'}
                </Text>
              </Stack>
            </Paper>
          </Box>
        </Box>

        {/* Organization Website (Web Viewer 2) */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Text size="xs" fw={500} p="xs" style={{ borderBottom: '1px solid #eee' }}>
            Organization Website
          </Text>
          <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
            <Paper
              withBorder
              p="xl"
              style={{
                width: '90%',
                height: '90%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
              }}
            >
              <Stack align="center" gap="xs">
                <Text c="dimmed" size="sm">
                  {org?.name || 'Unknown Organization'}
                </Text>
                <Text size="xs" c="blue" style={{ wordBreak: 'break-all' }}>
                  {org?.url || 'No URL available'}
                </Text>
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default SubmissionsPage;
