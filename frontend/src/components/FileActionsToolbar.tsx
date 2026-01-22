import { Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
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
  GetWorkTemplateClean,
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
    directFormattingTypes: string[];
  } | null>(null);
  const [templatePath, setTemplatePath] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [templateAlreadyApplied, setTemplateAlreadyApplied] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

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
    // Check if template has already been applied to this work
    GetWorkTemplateClean(workID).then((isClean) => {
      setTemplateAlreadyApplied(isClean);
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

  const handleApplyTemplateClick = () => {
    if (templateAlreadyApplied) {
      setConfirmModalOpen(true);
    } else {
      handleApplyTemplate();
    }
  };

  const handleApplyTemplate = async () => {
    if (!templatePath) return;
    setConfirmModalOpen(false);
    setApplying(true);
    try {
      await ApplyTemplateToWork(workID, templatePath);
      setTemplateAlreadyApplied(true);
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

  // Build tooltip text explaining what style issues were found
  const buildAuditTooltip = (
    status: {
      unknownStyleNames?: string[];
      directFormattingTypes?: string[];
    } | null
  ): string => {
    const parts: string[] = [];
    if (status?.unknownStyleNames?.length) {
      parts.push(`Unknown styles: ${status.unknownStyleNames.join(', ')}`);
    }
    if (status?.directFormattingTypes?.length) {
      parts.push(`Direct formatting: ${status.directFormattingTypes.join(', ')}`);
    }
    return parts.length > 0 ? parts.join('\n') : 'Style issues found - click wand to fix';
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

        {templatePath && (
          <Group gap={4}>
            <Tooltip label="Apply template to clean up styles">
              <Button
                variant="light"
                color={templateAlreadyApplied ? 'orange' : 'green'}
                size="xs"
                px={6}
                onClick={handleApplyTemplateClick}
                loading={applying}
                disabled={!fileExists}
              >
                <IconWand size={14} />
              </Button>
            </Tooltip>
            {auditStatusText && (
              <Tooltip label={buildAuditTooltip(auditStatus)} multiline maw={400}>
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

      <Modal
        opened={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Re-apply Template?"
        centered
      >
        <Stack>
          <Text size="sm">
            This document has already had the template applied. Re-applying will:
          </Text>
          <Text size="sm" c="red" fw={500}>
            • Remove all images and pictures
          </Text>
          <Text size="sm" c="red" fw={500}>
            • Reset all formatting to template styles
          </Text>
          <Text size="sm" c="dimmed">
            This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleApplyTemplate}>
              Re-apply Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
