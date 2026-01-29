import { useState, useCallback } from 'react';
import {
  Grid,
  TextInput,
  Stack,
  Text,
  Paper,
  Button,
  Group,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SelectBookTemplate, ValidateTemplate, GetTitlePageStyles } from '@app';
import { models, app } from '@models';
import { LogErr } from '@/utils';
import { generateTitlePageHTML } from '@/utils/titlePageHTML';
import { PagePreview } from '@trueblocks/ui';
import {
  IconFileText,
  IconCheck,
  IconAlertCircle,
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
} from '@tabler/icons-react';

const OFFSET_STEP = 4;

interface OffsetControlProps {
  field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY';
  value: number | undefined;
  onOffsetChange: (
    field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY',
    delta: number
  ) => void;
  onOffsetReset: (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY') => void;
}

function OffsetControl({ field, value, onOffsetChange, onOffsetReset }: OffsetControlProps) {
  return (
    <Group gap={2}>
      <Text size="xs" c="dimmed" w={32} ta="right">
        {value ?? 0}
      </Text>
      <ActionIcon size="xs" variant="subtle" onClick={() => onOffsetChange(field, -OFFSET_STEP)}>
        <IconChevronUp size={12} />
      </ActionIcon>
      <ActionIcon size="xs" variant="subtle" onClick={() => onOffsetChange(field, OFFSET_STEP)}>
        <IconChevronDown size={12} />
      </ActionIcon>
      <Tooltip label="Reset offset">
        <ActionIcon
          size="xs"
          variant="subtle"
          onClick={() => onOffsetReset(field)}
          disabled={(value ?? 0) === 0}
        >
          <IconRefresh size={12} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface TitlePagePanelProps {
  book: models.Book;
  collectionName: string;
  collectionId: number;
  templateStyles: app.TitlePageStyleInfo | null;
  onBookChange: (book: models.Book) => void;
  onTemplateStylesChange: (styles: app.TitlePageStyleInfo | null) => void;
}

export function TitlePagePanel({
  book,
  collectionName,
  templateStyles,
  onBookChange,
  onTemplateStylesChange,
}: TitlePagePanelProps) {
  const [templateValidation, setTemplateValidation] = useState<app.TemplateValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof models.Book, value: string) => {
      const updated = { ...book, [field]: value };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleOffsetChange = useCallback(
    (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY', delta: number) => {
      const current = book[field] ?? 0;
      const updated = { ...book, [field]: current + delta };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleOffsetReset = useCallback(
    (field: 'titleOffsetY' | 'subtitleOffsetY' | 'authorOffsetY') => {
      const updated = { ...book, [field]: 0 };
      onBookChange(updated);
    },
    [book, onBookChange]
  );

  const handleSelectTemplate = useCallback(async () => {
    try {
      const path = await SelectBookTemplate();
      if (!path) return;

      setValidating(true);
      const [validation, styles] = await Promise.all([
        ValidateTemplate(path),
        GetTitlePageStyles(path),
      ]);
      setTemplateValidation(validation);
      onTemplateStylesChange(styles);
      setValidating(false);

      if (!validation.isValid) {
        notifications.show({
          title: 'Invalid Template',
          message:
            validation.requiredMissing?.length > 0
              ? `Missing required styles: ${validation.requiredMissing.join(', ')}`
              : validation.errors?.join(', ') || 'Template file is invalid',
          color: 'red',
          autoClose: 8000,
        });
        return;
      }

      const updated = { ...book, templatePath: path };
      onBookChange(updated);
    } catch (err) {
      LogErr('Failed to select template:', err);
      setValidating(false);
    }
  }, [book, onBookChange, onTemplateStylesChange]);

  return (
    <Grid gutter="md">
      <Grid.Col span={6}>
        <Stack gap="sm">
          <Paper p="sm" withBorder>
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Title Page
              </Text>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Title"
                  value={book.title || ''}
                  onChange={(e) => handleFieldChange('title', e.currentTarget.value)}
                  placeholder={collectionName}
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="titleOffsetY"
                  value={book.titleOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Subtitle"
                  value={book.subtitle || ''}
                  onChange={(e) => handleFieldChange('subtitle', e.currentTarget.value)}
                  placeholder="Optional"
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="subtitleOffsetY"
                  value={book.subtitleOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
              <Group gap="xs" align="flex-end">
                <TextInput
                  size="xs"
                  label="Author"
                  value={book.author || ''}
                  onChange={(e) => handleFieldChange('author', e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <OffsetControl
                  field="authorOffsetY"
                  value={book.authorOffsetY}
                  onOffsetChange={handleOffsetChange}
                  onOffsetReset={handleOffsetReset}
                />
              </Group>
            </Stack>
          </Paper>
          <Paper p="sm" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  Template
                </Text>
                {templateValidation && (
                  <Badge
                    size="xs"
                    color={templateValidation.isValid ? 'green' : 'yellow'}
                    leftSection={
                      templateValidation.isValid ? (
                        <IconCheck size={10} />
                      ) : (
                        <IconAlertCircle size={10} />
                      )
                    }
                  >
                    {templateValidation.isValid ? 'Valid' : 'Warning'}
                  </Badge>
                )}
              </Group>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFileText size={12} />}
                onClick={handleSelectTemplate}
                loading={validating}
              >
                {book.templatePath ? 'Change Template' : 'Select Template'}
              </Button>
              {book.templatePath && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {book.templatePath.split('/').pop()}
                </Text>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6}>
        <PagePreview
          html={generateTitlePageHTML({
            book,
            collectionName,
            templateStyles,
          })}
          canvasWidthMM={152.4}
          canvasHeightMM={228.6}
        />
      </Grid.Col>
    </Grid>
  );
}
