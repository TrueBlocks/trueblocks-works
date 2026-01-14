import { useEffect, useState } from 'react';
import { Box, Text, Stack, Checkbox } from '@mantine/core';
import { GetFileModTimes, CheckWorkPath } from '@app';
import { LogErr } from '@/utils';

interface DebugPopoverProps {
  workId: number;
}

interface FileModTimes {
  docxPath: string;
  docxModTime: string;
  pdfPath: string;
  pdfModTime: string;
  docxIsNewer: boolean;
  docxExists: boolean;
  pdfExists: boolean;
}

interface PathCheckResult {
  generatedPath: string;
  storedPath: string;
  status: string;
  fileExists: boolean;
}

export function DebugPopover({ workId }: DebugPopoverProps) {
  const [modTimes, setModTimes] = useState<FileModTimes | null>(null);
  const [pathCheck, setPathCheck] = useState<PathCheckResult | null>(null);

  useEffect(() => {
    async function loadDebugInfo() {
      try {
        const times = await GetFileModTimes(workId);
        setModTimes(times);
        const paths = await CheckWorkPath(workId);
        setPathCheck(paths);
      } catch (err) {
        LogErr('Failed to get debug info:', err);
      }
    }

    loadDebugInfo();
  }, [workId]);

  if (!modTimes || !pathCheck) {
    return null;
  }

  const pathsDiffer = pathCheck.generatedPath !== pathCheck.storedPath;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#FFC0CB',
        color: '#000000',
        padding: '12px 16px',
        borderRadius: '8px',
        zIndex: 1000,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        pointerEvents: 'none',
      }}
    >
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Debug Info (Work #{workId})
        </Text>
        <Text size="xs">
          <strong>Generated Path:</strong> {pathCheck.generatedPath || '(none)'}
        </Text>
        <Text size="xs">
          <strong>Stored Path:</strong> {pathCheck.storedPath || '(none)'}
        </Text>
        {pathsDiffer && (
          <Text size="xs" c="red" fw={700}>
            ⚠️ PATHS DIFFER
          </Text>
        )}
        <Text size="xs">
          <strong>Status:</strong> {pathCheck.status || 'ok'}
        </Text>
        {modTimes.docxExists && (
          <Text size="xs">
            <strong>DOCX Modified:</strong> {modTimes.docxModTime}
          </Text>
        )}
        {modTimes.pdfExists && (
          <Text size="xs">
            <strong>PDF Modified:</strong> {modTimes.pdfModTime}
          </Text>
        )}
        {modTimes.docxExists && modTimes.pdfExists && (
          <Checkbox
            checked={modTimes.docxIsNewer}
            readOnly
            label="DOCX is newer than PDF"
            size="xs"
            styles={{
              input: { pointerEvents: 'none' },
              label: { color: '#000000' },
            }}
          />
        )}
        {!modTimes.docxExists && (
          <Text size="xs" c="red">
            DOCX file not found
          </Text>
        )}
        {!modTimes.pdfExists && (
          <Text size="xs" c="red">
            PDF preview not found
          </Text>
        )}
      </Stack>
    </Box>
  );
}
