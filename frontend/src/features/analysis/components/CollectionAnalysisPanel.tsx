import { Paper, Text, Stack, Badge, Group, Button, Loader, Table, SimpleGrid } from '@mantine/core';
import { analysis } from '@models';

interface CollectionAnalysisPanelProps {
  collectionResult: analysis.CollectionResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

export function CollectionAnalysisPanel({
  collectionResult,
  loading,
  onAnalyze,
}: CollectionAnalysisPanelProps) {
  if (loading) {
    return (
      <Stack align="center" p="xl">
        <Loader size="lg" />
        <Text>Analyzing collection...</Text>
      </Stack>
    );
  }

  if (!collectionResult) {
    return (
      <Stack align="center" p="xl">
        <Text c="dimmed">No analysis available for this collection.</Text>
        <Button onClick={onAnalyze}>Analyze Collection</Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>Collection Analysis</Text>
        <Group>
          <Text size="xs" c="dimmed">
            {new Date(collectionResult.analyzedAt).toLocaleDateString()}
          </Text>
          <Button size="xs" variant="light" onClick={onAnalyze}>
            Re-analyze
          </Button>
        </Group>
      </Group>

      <Paper p="md" withBorder>
        <Text size="sm">{collectionResult.overallSummary}</Text>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="xs">
          Sequence & Flow
        </Text>
        <Text size="sm" c="dimmed">
          {collectionResult.sequenceSummary}
        </Text>

        {collectionResult.sequenceSuggestions &&
          collectionResult.sequenceSuggestions.length > 0 && (
            <>
              <Text fw={500} mt="md" mb="xs" size="sm">
                Reordering Suggestions
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Work</Table.Th>
                    <Table.Th>Current</Table.Th>
                    <Table.Th>Suggested</Table.Th>
                    <Table.Th>Rationale</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {collectionResult.sequenceSuggestions.map((s, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{s.workTitle}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="outline">
                          {s.currentPos}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="blue">
                          {s.suggestedPos}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{s.rationale}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
      </Paper>

      <SimpleGrid cols={2} spacing="md">
        <Paper p="md" withBorder>
          <Text fw={500} mb="xs">
            Thematic Coherence
          </Text>
          <Text size="sm" c="dimmed">
            {collectionResult.themesSummary}
          </Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text fw={500} mb="xs">
            Pacing
          </Text>
          <Text size="sm" c="dimmed">
            {collectionResult.pacingSummary}
          </Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text fw={500} mb="xs">
            Balance
          </Text>
          <Text size="sm" c="dimmed">
            {collectionResult.balanceSummary}
          </Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text fw={500} mb="xs">
            Gaps & Opportunities
          </Text>
          <Text size="sm" c="dimmed">
            {collectionResult.gapsSummary}
          </Text>
        </Paper>
      </SimpleGrid>

      <Text size="xs" c="dimmed" ta="right">
        Provider: {collectionResult.provider} / {collectionResult.model}
      </Text>
    </Stack>
  );
}
