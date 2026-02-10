import { useState } from 'react';
import {
  Paper,
  Text,
  Group,
  Badge,
  Stack,
  Collapse,
  ActionIcon,
  Tooltip,
  Button,
  Loader,
  TextInput,
  Modal,
  SimpleGrid,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconX,
  IconCheck,
  IconFileText,
} from '@tabler/icons-react';
import { analysis } from '@models';
import { OpenDocument } from '@app';

interface ScoreCategoryProps {
  name: string;
  score: number;
  summary: string;
  annotations: analysis.Annotation[];
  onDismiss?: (annotationId: number, reason: string) => void;
  onUndismiss?: (annotationId: number) => void;
}

function ScoreCategory({
  name,
  score,
  summary,
  annotations,
  onDismiss,
  onUndismiss,
}: ScoreCategoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissAnnotationId, setDismissAnnotationId] = useState<number | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  const activeAnnotations = annotations.filter((a) => !a.dismissed);
  const getScoreColor = (s: number) => {
    if (s >= 9) return 'green';
    if (s >= 7) return 'blue';
    if (s >= 5) return 'yellow';
    if (s >= 3) return 'orange';
    return 'red';
  };

  const handleDismissClick = (id: number) => {
    setDismissAnnotationId(id);
    setDismissReason('');
    setDismissModalOpen(true);
  };

  const handleConfirmDismiss = () => {
    if (dismissAnnotationId && onDismiss) {
      onDismiss(dismissAnnotationId, dismissReason);
    }
    setDismissModalOpen(false);
    setDismissAnnotationId(null);
    setDismissReason('');
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Text fw={500}>{name}</Text>
          <Badge color={getScoreColor(score)} size="lg">
            {score}/10
          </Badge>
        </Group>
        <ActionIcon variant="subtle" onClick={() => setExpanded(!expanded)}>
          {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </ActionIcon>
      </Group>

      <Text size="sm" c="dimmed" mt="xs">
        {summary}
      </Text>

      {activeAnnotations.length > 0 && (
        <Text size="xs" c="dimmed" mt="xs">
          {activeAnnotations.length} issue{activeAnnotations.length !== 1 ? 's' : ''} found
        </Text>
      )}

      <Collapse in={expanded}>
        <Stack gap="xs" mt="md">
          {annotations.map((ann) => (
            <Paper key={ann.id} p="sm" withBorder style={{ opacity: ann.dismissed ? 0.5 : 1 }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Badge size="xs" variant="outline">
                    ¶{ann.paragraphNum}
                  </Badge>
                  <Badge size="xs" color="gray">
                    {ann.issueType}
                  </Badge>
                </Group>
                {ann.dismissed ? (
                  <Tooltip label="Restore">
                    <ActionIcon size="xs" variant="subtle" onClick={() => onUndismiss?.(ann.id)}>
                      <IconCheck size={12} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Tooltip label="Dismiss as intentional">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => handleDismissClick(ann.id)}
                    >
                      <IconX size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              <Text size="xs" c="dimmed" mt="xs" style={{ fontStyle: 'italic' }}>
                &ldquo;{ann.textSnippet}&rdquo;
              </Text>
              <Text size="sm" mt="xs">
                {ann.message}
              </Text>
              {ann.dismissed && ann.dismissedReason && (
                <Text size="xs" c="dimmed" mt="xs">
                  Dismissed: {ann.dismissedReason}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      </Collapse>

      <Modal
        opened={dismissModalOpen}
        onClose={() => setDismissModalOpen(false)}
        title="Dismiss Annotation"
        size="sm"
      >
        <Stack>
          <Text size="sm">Mark this annotation as intentional. The score will be adjusted.</Text>
          <TextInput
            label="Reason (optional)"
            placeholder="e.g., Stylistic choice"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDismissModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDismiss}>Dismiss</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

interface WorkAnalysisPanelProps {
  workId: number;
  workResult: analysis.WorkResult | null;
  loading: boolean;
  onAnalyze: () => void;
  onDismiss: (annotationId: number, reason: string) => void;
  onUndismiss: (annotationId: number) => void;
}

export function WorkAnalysisPanel({
  workId,
  workResult,
  loading,
  onAnalyze,
  onDismiss,
  onUndismiss,
}: WorkAnalysisPanelProps) {
  if (loading) {
    return (
      <Stack align="center" p="xl">
        <Loader size="lg" />
        <Text>Analyzing work...</Text>
      </Stack>
    );
  }

  if (!workResult) {
    return (
      <Stack align="center" p="xl">
        <Text c="dimmed">No analysis available for this work.</Text>
        <Button onClick={onAnalyze}>Analyze Work</Button>
      </Stack>
    );
  }

  const getAnnotationsForCategory = (category: string) =>
    workResult.annotations?.filter(
      (a) =>
        a.issueType === category ||
        (category === 'technical' &&
          ['grammar', 'spelling', 'punctuation', 'word_choice'].includes(a.issueType))
    ) || [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Text fw={500}>Analysis Results</Text>
          <Badge variant="outline">{workResult.genreMode}</Badge>
        </Group>
        <Group>
          <Text size="xs" c="dimmed">
            {new Date(workResult.analyzedAt).toLocaleDateString()}
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFileText size={14} />}
            onClick={() => OpenDocument(workId)}
          >
            Open in Word
          </Button>
          <Button size="xs" variant="light" onClick={onAnalyze}>
            Re-analyze
          </Button>
        </Group>
      </Group>

      <Paper p="md" withBorder>
        <Text size="sm">{workResult.overallSummary}</Text>
      </Paper>

      <SimpleGrid cols={2} spacing="md">
        <ScoreCategory
          name="Technical"
          score={workResult.technicalScore}
          summary={workResult.technicalSummary}
          annotations={getAnnotationsForCategory('technical')}
          onDismiss={onDismiss}
          onUndismiss={onUndismiss}
        />

        <ScoreCategory
          name="Style"
          score={workResult.styleScore}
          summary={workResult.styleSummary}
          annotations={getAnnotationsForCategory('style')}
          onDismiss={onDismiss}
          onUndismiss={onUndismiss}
        />

        <ScoreCategory
          name="Structure"
          score={workResult.structureScore}
          summary={workResult.structureSummary}
          annotations={getAnnotationsForCategory('structure')}
          onDismiss={onDismiss}
          onUndismiss={onUndismiss}
        />

        <ScoreCategory
          name="Content"
          score={workResult.contentScore}
          summary={workResult.contentSummary}
          annotations={getAnnotationsForCategory('content')}
          onDismiss={onDismiss}
          onUndismiss={onUndismiss}
        />

        <ScoreCategory
          name="Genre"
          score={workResult.genreScore}
          summary={workResult.genreSummary}
          annotations={getAnnotationsForCategory('genre')}
          onDismiss={onDismiss}
          onUndismiss={onUndismiss}
        />
      </SimpleGrid>

      <Text size="xs" c="dimmed" ta="right">
        Provider: {workResult.provider} / {workResult.model}
      </Text>
    </Stack>
  );
}
