import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Grid,
  TextInput,
  Select,
  Button,
  Table,
  Divider,
  Badge,
  ActionIcon,
  Paper,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconFileText,
  IconFolderOpen,
  IconExternalLink,
  IconCopy,
  IconPlus,
} from '@tabler/icons-react';
import { StatusBadge, QualityBadge, ResponseBadge } from '../components';
import { works, getSubmissionsForWork, getOrgById } from '../data';
import { Status, Quality, WorkType } from '../types';

const statusOptions: Status[] = ['Focus', 'Active', 'Working', 'Resting', 'Waiting', 'Gestating', 'Sleeping', 'Dying', 'Dead', 'Out'];
const qualityOptions: Quality[] = ['Best', 'Better', 'Good', 'Okay', 'Bad', 'Unknown'];
const typeOptions: WorkType[] = ['Poem', 'Story', 'Essay', 'Song', 'Essay Idea', 'Story Idea', 'Poem Idea'];

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const work = works.find((w) => w.workID === Number(id));
  const submissions = work ? getSubmissionsForWork(work.workID) : [];

  if (!work) {
    return (
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/works')}
        >
          Back to Works
        </Button>
        <Text>Work not found</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/works')}
          >
            Back
          </Button>
          <Title order={2}>{work.title}</Title>
          <StatusBadge status={work.status} size="lg" />
          <QualityBadge quality={work.quality} size="lg" />
        </Group>
        <Group>
          <Button
            variant="light"
            leftSection={<IconDeviceFloppy size={16} />}
          >
            Save
          </Button>
        </Group>
      </Group>

      <Grid gutter="lg">
        {/* Left column - Edit form */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Work Details</Title>
            
            <Stack gap="md">
              <TextInput
                label="Title"
                value={work.title}
                readOnly
              />
              
              <Group grow>
                <Select
                  label="Type"
                  data={typeOptions}
                  value={work.type}
                />
                <TextInput
                  label="Year"
                  value={String(work.year)}
                  readOnly
                />
              </Group>

              <Group grow>
                <Select
                  label="Status"
                  data={statusOptions}
                  value={work.status}
                />
                <Select
                  label="Quality"
                  data={qualityOptions}
                  value={work.quality}
                />
              </Group>

              <TextInput
                label="Word Count"
                value={work.nWords}
                readOnly
              />

              <Divider my="sm" label="File Information" labelPosition="left" />

              <TextInput
                label="Path"
                value={work.path}
                readOnly
                rightSection={
                  <ActionIcon variant="subtle" size="sm">
                    <IconCopy size={14} />
                  </ActionIcon>
                }
              />

              <Group>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconFileText size={16} />}
                >
                  Open File
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconFolderOpen size={16} />}
                >
                  Reveal in Finder
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Export
                </Button>
              </Group>

              <Divider my="sm" label="Flags" labelPosition="left" />

              <Group>
                {work.isPrinted && <Badge variant="filled" color="blue">Printed</Badge>}
                {work.isBlog && <Badge variant="filled" color="cyan">Blog</Badge>}
                {work.isRevised && <Badge variant="filled" color="green">Revised</Badge>}
                {work.isProsePoem && <Badge variant="filled" color="purple">Prose Poem</Badge>}
                {!work.isPrinted && !work.isBlog && !work.isRevised && !work.isProsePoem && (
                  <Text size="sm" c="dimmed">No flags set</Text>
                )}
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Right column - Preview & Submissions */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          {/* PDF Preview placeholder */}
          <Card withBorder p="lg" mb="lg">
            <Title order={4} mb="md">Preview</Title>
            <Paper
              withBorder
              p="xl"
              style={{
                backgroundColor: '#f8f9fa',
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Stack align="center" gap="xs">
                <IconFileText size={48} color="#adb5bd" />
                <Text c="dimmed" size="sm">
                  PDF preview would appear here
                </Text>
                <Text c="dimmed" size="xs">
                  {work.docType.toUpperCase()} file
                </Text>
              </Stack>
            </Paper>
          </Card>

          {/* Submissions */}
          <Card withBorder p="lg">
            <Group justify="space-between" mb="md">
              <Title order={4}>Submissions</Title>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
              >
                Add
              </Button>
            </Group>

            {submissions.length === 0 ? (
              <Text c="dimmed" size="sm">
                No submissions yet
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organization</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Response</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {submissions.map((sub) => {
                    const org = getOrgById(sub.orgID);
                    return (
                      <Table.Tr key={sub.submissionID}>
                        <Table.Td>{org?.name || `Org #${sub.orgID}`}</Table.Td>
                        <Table.Td>{sub.submissionDate}</Table.Td>
                        <Table.Td>
                          <ResponseBadge response={sub.responseType} size="xs" />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default WorkDetailPage;
