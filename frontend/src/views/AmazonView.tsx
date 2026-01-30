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
  Accordion,
  Box,
  Progress,
  UnstyledButton,
  Button,
  ThemeIcon,
  TextInput,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useLocalStorage } from '@mantine/hooks';
import {
  IconExternalLink,
  IconCheck,
  IconCircleDashed,
  IconBook,
  IconFileTypePdf,
  IconPhoto,
  IconWorld,
  IconClipboardList,
  IconChecks,
  IconX,
  IconAlertTriangle,
  IconCircleCheck,
  IconRefresh,
} from '@tabler/icons-react';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import { GetBookByCollection, GetPublicationReadiness, UpdateBook } from '@app';
import { models, app } from '@models';
import { LogErr } from '@/utils';
import { notifications } from '@mantine/notifications';

interface AmazonViewProps {
  collectionId: number;
  collectionName: string;
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
  const [saving, setSaving] = useState(false);
  const [openSteps, setOpenSteps] = useLocalStorage<string[]>({
    key: `kdp-checklist-open-${collectionId}`,
    defaultValue: [],
  });

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

  const saveBook = useCallback(async (updatedBook: models.Book) => {
    setSaving(true);
    try {
      await UpdateBook(updatedBook);
      setBook(updatedBook);
    } catch (err) {
      LogErr('Failed to save book:', err);
      notifications.show({
        title: 'Save Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleStep = useCallback(
    (step: 'uploaded' | 'previewed' | 'proofOrdered' | 'published') => {
      if (!book) return;
      const updatedBook = { ...book };
      switch (step) {
        case 'uploaded':
          updatedBook.kdpUploaded = !book.kdpUploaded;
          break;
        case 'previewed':
          updatedBook.kdpPreviewed = !book.kdpPreviewed;
          break;
        case 'proofOrdered':
          updatedBook.kdpProofOrdered = !book.kdpProofOrdered;
          break;
        case 'published':
          if (!book.kdpPublished) {
            updatedBook.kdpPublished = true;
            if (!book.lastPublished) {
              updatedBook.lastPublished = new Date().toISOString().split('T')[0];
            }
          } else {
            updatedBook.kdpPublished = false;
          }
          break;
      }
      saveBook(updatedBook);
    },
    [book, saveBook]
  );

  const clearAllSteps = useCallback(() => {
    if (!book) return;
    const updatedBook = {
      ...book,
      kdpUploaded: false,
      kdpPreviewed: false,
      kdpProofOrdered: false,
      kdpPublished: false,
    };
    saveBook(updatedBook);
  }, [book, saveBook]);

  const handleAmazonUrlChange = useCallback(
    (value: string) => {
      if (!book) return;
      const updatedBook = { ...book, amazonUrl: value || undefined };
      saveBook(updatedBook);
    },
    [book, saveBook]
  );

  const handleLastPublishedChange = useCallback(
    (value: string | null) => {
      if (!book) return;
      const updatedBook = {
        ...book,
        lastPublished: value || undefined,
      };
      saveBook(updatedBook);
    },
    [book, saveBook]
  );

  const toggleAccordion = useCallback(
    (stepId: string) => {
      setOpenSteps((prev) =>
        prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
      );
    },
    [setOpenSteps]
  );

  const completedSteps = book
    ? [book.kdpUploaded, book.kdpPreviewed, book.kdpProofOrdered, book.kdpPublished].filter(Boolean)
        .length
    : 0;
  const totalSteps = 4;
  const progressPercent = (completedSteps / totalSteps) * 100;

  const getStepIcon = (completed: boolean) => {
    return completed ? (
      <IconCircleCheck size={20} color="var(--mantine-color-green-6)" />
    ) : (
      <IconCircleDashed size={20} color="var(--mantine-color-gray-4)" />
    );
  };

  if (loading) {
    return (
      <Flex justify="center" py="xl">
        <Loader />
      </Flex>
    );
  }

  const publishingSteps = [
    {
      id: 'upload',
      title: 'Upload to KDP',
      description: 'Upload manuscript and cover files',
      completed: book?.kdpUploaded || false,
      toggle: () => toggleStep('uploaded'),
    },
    {
      id: 'preview',
      title: 'Review Preview',
      description: 'Check KDP previewer for formatting issues',
      completed: book?.kdpPreviewed || false,
      toggle: () => toggleStep('previewed'),
    },
    {
      id: 'proof',
      title: 'Proof Copy',
      description: 'Order and review physical proof copy',
      completed: book?.kdpProofOrdered || false,
      toggle: () => toggleStep('proofOrdered'),
    },
    {
      id: 'publish',
      title: 'Publish',
      description: 'Submit for review and publishing',
      completed: book?.kdpPublished || false,
      toggle: () => toggleStep('published'),
    },
  ];

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

        <Group gap="md">
          <TextInput
            label="Amazon Product URL"
            placeholder="https://amazon.com/dp/..."
            value={book?.amazonUrl || ''}
            onChange={(e) => handleAmazonUrlChange(e.currentTarget.value)}
            style={{ flex: 1 }}
            rightSection={
              book?.amazonUrl ? (
                <ActionIcon variant="subtle" onClick={() => BrowserOpenURL(book.amazonUrl || '')}>
                  <IconExternalLink size={16} />
                </ActionIcon>
              ) : null
            }
          />
        </Group>
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
          <Group align="flex-start" grow>
            <ValidationSection title="Content" result={readiness.content} />
            <ValidationSection title="Matter" result={readiness.matter} />
            <ValidationSection title="Cover" result={readiness.cover} />
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Click &quot;Validate All&quot; to check publication readiness
          </Text>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600}>
            Publishing Checklist
          </Text>
          <Tooltip label="Clear all steps">
            <ActionIcon variant="subtle" color="gray" onClick={clearAllSteps} loading={saving}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group align="flex-start" grow>
          {publishingSteps.map((step) => (
            <Accordion
              key={step.id}
              variant="separated"
              value={openSteps.includes(step.id) ? step.id : null}
              onChange={() => toggleAccordion(step.id)}
            >
              <Accordion.Item value={step.id}>
                <Accordion.Control
                  icon={
                    <UnstyledButton
                      onClick={(e) => {
                        e.stopPropagation();
                        step.toggle();
                      }}
                    >
                      {getStepIcon(step.completed)}
                    </UnstyledButton>
                  }
                >
                  <Group justify="space-between" pr="md">
                    <Text size="sm" fw={500}>
                      {step.title}
                    </Text>
                    <Badge color={step.completed ? 'green' : 'gray'} variant="light" size="sm">
                      {step.completed ? 'Done' : 'Not Started'}
                    </Badge>
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

                    {step.id === 'proof' && (
                      <Box>
                        <List size="sm" spacing="xs">
                          <List.Item icon={<IconCheck size={16} />}>
                            Order proof copy from KDP
                          </List.Item>
                          <List.Item icon={<IconCheck size={16} />}>
                            Review physical print quality
                          </List.Item>
                          <List.Item icon={<IconCheck size={16} />}>
                            Check cover alignment and colors
                          </List.Item>
                          <List.Item icon={<IconCheck size={16} />}>
                            Approve for publication
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
                        <DateInput
                          label="Publication Date"
                          placeholder="Select date"
                          value={book?.lastPublished || null}
                          onChange={handleLastPublishedChange}
                          valueFormat="YYYY-MM-DD"
                          clearable
                          mt="sm"
                          style={{ maxWidth: 200 }}
                        />
                      </Box>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          ))}
        </Group>
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
    </Stack>
  );
}
