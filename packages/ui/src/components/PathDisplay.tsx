import { Paper, Group, Text, Badge, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { IconFile, IconCopy, IconCheck } from '@tabler/icons-react';

export interface PathDisplayProps {
  path?: string;
  docType?: string;
  nWords?: number;
  noPaper?: boolean;
  pageSize?: string;
}

export function PathDisplay({ path, docType, nWords, noPaper, pageSize }: PathDisplayProps) {
  const content = !path ? (
    <Text c="dimmed" fs="italic">
      No file path set
    </Text>
  ) : (
    <Group justify="space-between">
      <Group gap="sm">
        <IconFile size={18} />
        <Text size="sm" style={{ fontFamily: 'monospace' }}>
          {path}
        </Text>
      </Group>
      <Group gap="xs">
        {docType && (
          <Badge variant="outline" size="sm">
            {docType}
          </Badge>
        )}
        {nWords && nWords > 0 && (
          <Badge variant="light" size="sm">
            {nWords.toLocaleString()} words
          </Badge>
        )}
        {pageSize && (
          <Text size="sm" c="dimmed">
            {pageSize}
          </Text>
        )}
        <CopyButton value={path}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied!' : 'Copy path'}>
              <ActionIcon variant="subtle" size="sm" onClick={copy}>
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </Group>
  );

  if (noPaper) {
    return content;
  }

  return (
    <Paper p="sm" withBorder>
      {content}
    </Paper>
  );
}
