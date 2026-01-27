import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Paper,
  Text,
  Loader,
  Flex,
  Badge,
  Group,
  Divider,
  List,
  Alert,
  Accordion,
  Box,
  Progress,
  UnstyledButton,
} from '@mantine/core';
import {
  IconExternalLink,
  IconCheck,
  IconAlertCircle,
  IconCircleDashed,
  IconBook,
  IconFileTypePdf,
  IconPhoto,
  IconWorld,
  IconClipboardList,
  IconFileText,
} from '@tabler/icons-react';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { GetBookByCollection, OpenKDPManuscriptSpecs } from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';

interface AmazonPublishingTabProps {
  collectionId: number;
  collectionName: string;
}

interface PublishingStep {
  id: string;
  title: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed';
  details?: string;
}

export function AmazonPublishingTab({
  collectionId,
  collectionName: _collectionName,
}: AmazonPublishingTabProps) {
  void _collectionName; // Reserved for future use
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishingSteps, setPublishingSteps] = useState<PublishingStep[]>([
    {
      id: 'manuscript',
      title: 'Prepare Manuscript',
      description: 'Export book as PDF and verify formatting',
      status: 'not-started',
    },
    {
      id: 'cover',
      title: 'Prepare Cover',
      description: 'Create front and back cover with proper dimensions',
      status: 'not-started',
    },
    {
      id: 'metadata',
      title: 'Book Metadata',
      description: 'Title, subtitle, author, description, keywords',
      status: 'not-started',
    },
    {
      id: 'upload',
      title: 'Upload to KDP',
      description: 'Upload manuscript and cover files',
      status: 'not-started',
    },
    {
      id: 'preview',
      title: 'Review Preview',
      description: 'Check KDP previewer for formatting issues',
      status: 'not-started',
    },
    {
      id: 'publish',
      title: 'Publish',
      description: 'Submit for review and publishing',
      status: 'not-started',
    },
  ]);

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);

      if (result) {
        setPublishingSteps((prev) =>
          prev.map((step) => {
            if (step.id === 'manuscript' && result.exportPath) {
              return { ...step, status: 'completed' as const };
            }
            if (step.id === 'cover' && result.coverPath) {
              return { ...step, status: 'completed' as const };
            }
            if (step.id === 'metadata' && result.title && result.author) {
              return { ...step, status: 'completed' as const };
            }
            return step;
          })
        );
      }
    } catch (err) {
      LogErr('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const completedSteps = publishingSteps.filter((s) => s.status === 'completed').length;
  const totalSteps = publishingSteps.length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  const getStatusIcon = (status: PublishingStep['status']) => {
    switch (status) {
      case 'completed':
        return <IconCheck size={18} color="var(--mantine-color-green-6)" />;
      case 'in-progress':
        return <IconCircleDashed size={18} color="var(--mantine-color-blue-6)" />;
      default:
        return <IconCircleDashed size={18} color="var(--mantine-color-gray-4)" />;
    }
  };

  const getStatusBadge = (status: PublishingStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge color="green" variant="light" size="sm">
            Done
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge color="blue" variant="light" size="sm">
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge color="gray" variant="light" size="sm">
            Not Started
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Flex justify="center" py="xl">
        <Loader />
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <IconBook size={24} />
            <Text size="lg" fw={600}>
              Amazon KDP Publishing
            </Text>
          </Group>
          <Badge color="blue" variant="light" size="lg">
            {completedSteps}/{totalSteps} Steps Complete
          </Badge>
        </Group>

        <Progress value={progressPercent} size="lg" radius="xl" mb="md" />

        <Alert icon={<IconAlertCircle size={18} />} color="blue" mb="md">
          <Text size="sm">
            Amazon KDP does not provide a public API. Use this checklist to track your manual
            publishing process.
          </Text>
        </Alert>
      </Paper>

      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="md">
          Publishing Checklist
        </Text>

        <Accordion variant="separated">
          {publishingSteps.map((step) => (
            <Accordion.Item key={step.id} value={step.id}>
              <Accordion.Control icon={getStatusIcon(step.status)}>
                <Group justify="space-between" pr="md">
                  <Text size="sm" fw={500}>
                    {step.title}
                  </Text>
                  {getStatusBadge(step.status)}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">
                    {step.description}
                  </Text>

                  {step.id === 'manuscript' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item icon={<IconFileTypePdf size={16} />}>
                          Export book as PDF from the Book Settings tab
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Verify all essays are styled correctly
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Check page breaks and section starts
                        </List.Item>
                      </List>
                      <UnstyledButton
                        onClick={() => {
                          OpenKDPManuscriptSpecs().catch((err) =>
                            LogErr('Failed to open KDP specs:', err)
                          );
                        }}
                        style={{ color: 'var(--mantine-color-blue-6)', marginTop: 8 }}
                      >
                        <Group gap={4}>
                          <IconFileText size={14} />
                          KDP Manuscript Specifications
                        </Group>
                      </UnstyledButton>
                      {book?.exportPath && (
                        <Alert color="green" mt="sm" icon={<IconCheck size={16} />}>
                          <Text size="sm">Manuscript exported to: {book.exportPath}</Text>
                        </Alert>
                      )}
                    </Box>
                  )}

                  {step.id === 'cover' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item icon={<IconPhoto size={16} />}>
                          Front cover: 2560 x 1600 pixels (1.6:1 ratio)
                        </List.Item>
                        <List.Item icon={<IconPhoto size={16} />}>
                          Back cover: Include barcode area (ISBN)
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Spine width depends on page count
                        </List.Item>
                      </List>
                      <UnstyledButton
                        onClick={() =>
                          BrowserOpenURL('https://kdp.amazon.com/en_US/help/topic/G201953020')
                        }
                        style={{ color: 'var(--mantine-color-blue-6)', marginTop: 8 }}
                      >
                        <Group gap={4}>
                          KDP Cover Guidelines <IconExternalLink size={14} />
                        </Group>
                      </UnstyledButton>
                    </Box>
                  )}

                  {step.id === 'metadata' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item>
                          <strong>Title:</strong> {book?.title || 'Not set'}
                        </List.Item>
                        <List.Item>
                          <strong>Subtitle:</strong> {book?.subtitle || 'None'}
                        </List.Item>
                        <List.Item>
                          <strong>Author:</strong> {book?.author || 'Not set'}
                        </List.Item>
                        <List.Item>
                          <strong>ISBN:</strong> {book?.isbn || 'Not set'}
                        </List.Item>
                      </List>
                      <Text size="sm" c="dimmed" mt="sm">
                        Also prepare: book description (4000 chars max), keywords (7 max),
                        categories
                      </Text>
                    </Box>
                  )}

                  {step.id === 'upload' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item icon={<IconWorld size={16} />}>
                          <UnstyledButton
                            onClick={() => BrowserOpenURL('https://kdp.amazon.com')}
                            style={{ color: 'var(--mantine-color-blue-6)' }}
                          >
                            <Group gap={4}>
                              Go to KDP Dashboard <IconExternalLink size={14} />
                            </Group>
                          </UnstyledButton>
                        </List.Item>
                        <List.Item icon={<IconClipboardList size={16} />}>
                          Create new Paperback or eBook
                        </List.Item>
                        <List.Item icon={<IconFileTypePdf size={16} />}>
                          Upload manuscript PDF
                        </List.Item>
                        <List.Item icon={<IconPhoto size={16} />}>Upload cover PDF</List.Item>
                      </List>
                    </Box>
                  )}

                  {step.id === 'preview' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item icon={<IconCheck size={16} />}>
                          Use KDP Previewer to check formatting
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Check front matter displays correctly
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Verify page numbers and headers
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Check for widows/orphans and bad breaks
                        </List.Item>
                      </List>
                    </Box>
                  )}

                  {step.id === 'publish' && (
                    <Box>
                      <List size="sm" spacing="xs">
                        <List.Item icon={<IconCheck size={16} />}>
                          Set pricing and royalties
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Select territories (typically Worldwide)
                        </List.Item>
                        <List.Item icon={<IconCheck size={16} />}>
                          Submit for review (typically 24-72 hours)
                        </List.Item>
                      </List>
                      <Alert color="yellow" mt="sm" icon={<IconAlertCircle size={16} />}>
                        <Text size="sm">
                          Once published, changes require a new version submission
                        </Text>
                      </Alert>
                    </Box>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Paper>

      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="md">
          Useful Resources
        </Text>

        <Divider mb="md" />

        <Stack gap="sm">
          <UnstyledButton
            onClick={() => BrowserOpenURL('https://kdp.amazon.com')}
            style={{ color: 'var(--mantine-color-blue-6)' }}
          >
            <Group gap={4}>
              <IconWorld size={16} />
              KDP Dashboard
              <IconExternalLink size={14} />
            </Group>
          </UnstyledButton>

          <UnstyledButton
            onClick={() => BrowserOpenURL('https://kdp.amazon.com/en_US/help/topic/G201834180')}
            style={{ color: 'var(--mantine-color-blue-6)' }}
          >
            <Group gap={4}>
              <IconFileTypePdf size={16} />
              Print Specifications
              <IconExternalLink size={14} />
            </Group>
          </UnstyledButton>

          <UnstyledButton
            onClick={() => BrowserOpenURL('https://kdp.amazon.com/en_US/help/topic/G201953020')}
            style={{ color: 'var(--mantine-color-blue-6)' }}
          >
            <Group gap={4}>
              <IconPhoto size={16} />
              Cover Guidelines
              <IconExternalLink size={14} />
            </Group>
          </UnstyledButton>

          <UnstyledButton
            onClick={() => BrowserOpenURL('https://kdp.amazon.com/en_US/help/topic/G201834040')}
            style={{ color: 'var(--mantine-color-blue-6)' }}
          >
            <Group gap={4}>
              <IconBook size={16} />
              Manuscript Guidelines
              <IconExternalLink size={14} />
            </Group>
          </UnstyledButton>
        </Stack>
      </Paper>

      {book?.publishedDate && (
        <Paper p="md" withBorder>
          <Group>
            <IconCheck size={20} color="var(--mantine-color-green-6)" />
            <Text size="sm">
              Published on: <strong>{book.publishedDate}</strong>
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
