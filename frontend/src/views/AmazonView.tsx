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
  Button,
  ThemeIcon,
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
  IconChecks,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { GetBookByCollection, GetPublicationReadiness } from '@app';
import { models, app } from '@models';
import { LogErr } from '@/utils';
import { notifications } from '@mantine/notifications';

interface AmazonViewProps {
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

function ValidationSection({ title, result }: { title: string; result: app.ValidationResult }) {
  const icon = result.passed ? (
    <ThemeIcon color="green" size="sm" radius="xl">
      <IconCheck size={12} />
    </ThemeIcon>
  ) : result.errors.length > 0 ? (
    <ThemeIcon color="red" size="sm" radius="xl">
      <IconX size={12} />
    </ThemeIcon>
  ) : (
    <ThemeIcon color="yellow" size="sm" radius="xl">
      <IconAlertTriangle size={12} />
    </ThemeIcon>
  );

  return (
    <Paper p="sm" withBorder>
      <Group
        justify="space-between"
        mb={result.errors.length > 0 || result.warnings.length > 0 ? 'xs' : 0}
      >
        <Group gap="xs">
          {icon}
          <Text size="sm" fw={500}>
            {title}
          </Text>
        </Group>
        <Badge
          size="xs"
          color={result.passed ? 'green' : result.errors.length > 0 ? 'red' : 'yellow'}
        >
          {result.passed
            ? 'Passed'
            : result.errors.length > 0
              ? `${result.errors.length} errors`
              : `${result.warnings.length} warnings`}
        </Badge>
      </Group>
      {result.errors.length > 0 && (
        <List size="xs" spacing={2} ml="md">
          {result.errors.map((err, i) => (
            <List.Item key={i} c="red">
              {err}
            </List.Item>
          ))}
        </List>
      )}
      {result.warnings.length > 0 && (
        <List size="xs" spacing={2} ml="md">
          {result.warnings.map((warn, i) => (
            <List.Item key={i} c="yellow.7">
              {warn}
            </List.Item>
          ))}
        </List>
      )}
    </Paper>
  );
}

export function AmazonView({ collectionId, collectionName: _collectionName }: AmazonViewProps) {
  void _collectionName;
  const [book, setBook] = useState<models.Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [readiness, setReadiness] = useState<app.PublicationReadiness | null>(null);

  const publishingSteps: PublishingStep[] = [
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
  ];

  const loadBook = useCallback(async () => {
    try {
      const result = await GetBookByCollection(collectionId);
      setBook(result);
    } catch (err) {
      LogErr('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const runValidation = useCallback(async () => {
    setValidating(true);
    try {
      const result = await GetPublicationReadiness(collectionId);
      setReadiness(result);
    } catch (err) {
      LogErr('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  }, [collectionId]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const handleValidateAll = useCallback(async () => {
    setValidating(true);
    try {
      const result = await GetPublicationReadiness(collectionId);
      setReadiness(result);
      const allPassed = result.content.passed && result.matter.passed && result.cover.passed;
      notifications.show({
        title: allPassed ? 'All Validations Passed' : 'Validation Issues Found',
        message: allPassed
          ? 'Your book is ready for publication'
          : 'Review the checklist below for details',
        color: allPassed ? 'green' : 'yellow',
        autoClose: 5000,
      });
    } catch (err) {
      LogErr('Validation failed:', err);
      notifications.show({
        title: 'Validation Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setValidating(false);
    }
  }, [collectionId]);

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
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600}>
            Publication Readiness
          </Text>
          <Button
            size="xs"
            leftSection={<IconChecks size={14} />}
            onClick={handleValidateAll}
            loading={validating}
          >
            Validate All
          </Button>
        </Group>

        {readiness ? (
          <Stack gap="sm">
            <ValidationSection title="Content" result={readiness.content} />
            <ValidationSection title="Matter" result={readiness.matter} />
            <ValidationSection title="Cover" result={readiness.cover} />
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Click &quot;Validate All&quot; to check publication readiness
          </Text>
        )}
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
