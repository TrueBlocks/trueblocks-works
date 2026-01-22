import { Button, Group, Text, Tooltip } from '@mantine/core';
import {
  IconArrowsExchange,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconWand,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  ApplyTemplateToWork,
  CheckWorkPath,
  ExportToSubmissions,
  GetWorkBookAuditStatus,
  GetWorkTemplatePath,
  MoveWorkFile,
  OpenDocument,
  PrintWork,
} from '@app';
import { Log, LogErr } from '@/utils';
import { useCallback, useEffect, useState } from 'react';
import { MoveFileModal } from './MoveFileModal';

interface FileActionsToolbarProps {
  workID: number;
  refreshKey?: number;
  onMoved?: () => void;
}

export function FileActionsToolbar({ workID, refreshKey, onMoved }: FileActionsToolbarProps) {
  const [pathStatus, setPathStatus] = useState<string>('');
  const [fileExists, setFileExists] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [generatedPath, setGeneratedPath] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [auditStatus, setAuditStatus] = useState<{
    isInBook: boolean;
    isClean: boolean;
    unknownStyles: number;
    unknownStyleNames: string[];
    directFormatting: number;
  } | null>(null);
  const [templatePath, setTemplatePath] = useState<string>('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    CheckWorkPath(workID).then((result) => {
      setPathStatus(result.status);
      setFileExists(result.fileExists);
      setCurrentPath(result.storedPath);
      setGeneratedPath(result.generatedPath);
    });
    // Check if this work is in a book collection and get audit status
    GetWorkBookAuditStatus(workID).then((status) => {
      setAuditStatus(status);
    });
    // Get template path for this work
    GetWorkTemplatePath(workID).then((path) => {
      setTemplatePath(path || '');
    });
  }, [workID, refreshKey]);

  const handleOpen = async () => {
    try {
      await OpenDocument(workID);
    } catch (err) {
      LogErr('Failed to open document:', err);
    }
  };

  const handleMove = useCallback(async () => {
    try {
      await MoveWorkFile(workID);
      setPathStatus('');
      setModalOpen(false);
      onMoved?.();
    } catch (err) {
      LogErr('Failed to move file:', err);
    }
  }, [workID, onMoved]);

  // Cmd+M hotkey to move file directly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'm' && pathStatus === 'name changed') {
        e.preventDefault();
        handleMove();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathStatus, handleMove]);

  const handleExport = async () => {
    try {
      const destPath = await ExportToSubmissions(workID);
      Log('Exported to:', destPath);
    } catch (err) {
      LogErr('Failed to export:', err);
    }
  };

  const handlePrint = async () => {
    try {
      await PrintWork(workID);
    } catch (err) {
      LogErr('Failed to print:', err);
    }
  };

  const handleApplyTemplate = async () => {
    if (!templatePath) return;
    setApplying(true);
    try {
      await ApplyTemplateToWork(workID, templatePath);
      notifications.show({
        title: 'Template Applied',
        message: 'Document cleaned - unknown styles removed',
        color: 'green',
        autoClose: 5000,
      });
      // Refresh audit status
      const status = await GetWorkBookAuditStatus(workID);
      setAuditStatus(status);
      onMoved?.();
    } catch (err) {
      LogErr('Failed to apply template:', err);
      notifications.show({
        title: 'Apply Template Failed',
        message: String(err),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setApplying(false);
    }
  };

  // Build audit status text if work is in a book and fails audit
  const auditStatusText =
    auditStatus?.isInBook && !auditStatus?.isClean
      ? `${auditStatus.unknownStyles} unknown styles, ${auditStatus.directFormatting} direct`
      : '';

  return (
    <>
      <Group gap="xs">
        {pathStatus === 'name changed' && (
          <Button
            variant="filled"
            color="orange"
            size="xs"
            leftSection={<IconArrowsExchange size={16} />}
            onClick={() => setModalOpen(true)}
            styles={{ root: { color: 'black' } }}
          >
            Move File
          </Button>
        )}

        {templatePath && auditStatus?.isInBook && (
          <Group gap={4}>
            <Tooltip label="Apply template to clean up styles">
              <Button
                variant="light"
                color="orange"
                size="xs"
                px={6}
                onClick={handleApplyTemplate}
                loading={applying}
                disabled={!fileExists}
              >
                <IconWand size={14} />
              </Button>
            </Tooltip>
            {auditStatusText && (
              <Tooltip
                label={
                  auditStatus?.unknownStyleNames?.length
                    ? `Unknown: ${auditStatus.unknownStyleNames.join(', ')}`
                    : 'Style issues found - click wand to fix'
                }
                multiline
                maw={400}
              >
                <Text size="xs" c="orange" fw={500}>
                  {auditStatusText}
                </Text>
              </Tooltip>
            )}
          </Group>
        )}

        <Tooltip label="Open document">
          <Button
            variant="light"
            color="grape"
            size="xs"
            leftSection={<IconFileText size={14} />}
            onClick={handleOpen}
            disabled={!fileExists}
          >
            Open
          </Button>
        </Tooltip>

        <Tooltip label="Export to submissions folder">
          <Button
            variant="light"
            color="grape"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={handleExport}
            disabled={!fileExists}
          >
            Download
          </Button>
        </Tooltip>

        <Tooltip label="Print">
          <Button
            variant="light"
            color="grape"
            size="xs"
            leftSection={<IconPrinter size={14} />}
            onClick={handlePrint}
            disabled={!fileExists}
          >
            Print
          </Button>
        </Tooltip>
      </Group>

      <MoveFileModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        currentPath={currentPath}
        newPath={generatedPath}
        onMove={handleMove}
      />
    </>
  );
}
