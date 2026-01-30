import { Button, Checkbox, Group, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsExchange,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import {
  CheckWorkPath,
  ExportToSubmissions,
  GetWorkBookAuditStatus,
  GetWorkMarked,
  GetWorkTemplatePath,
  MoveWorkFile,
  OpenDocument,
  PrintWork,
  SetWorkMarked,
  SyncWorkTemplate,
} from '@app';
import { Log, LogErr } from '@/utils';
import { useCallback, useEffect, useState } from 'react';
import { MoveFileModal } from '@trueblocks/ui';

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
    isCompatibilityMode: boolean;
  } | null>(null);
  const [templatePath, setTemplatePath] = useState<string>('');
  const [isMarked, setIsMarked] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    // Get marked status
    GetWorkMarked(workID).then((marked) => {
      setIsMarked(marked);
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

  const handleMarkChange = async (checked: boolean) => {
    try {
      await SetWorkMarked(workID, checked);
      setIsMarked(checked);
    } catch (err) {
      LogErr('Failed to update mark:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await SyncWorkTemplate(workID);
      setIsMarked(true);
      notifications.show({
        title: 'Template Synced',
        message: 'Styles, page setup, and images updated from template',
        color: 'green',
      });
    } catch (err) {
      LogErr('Failed to sync template:', err);
      notifications.show({
        title: 'Sync Failed',
        message: String(err),
        color: 'red',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Build tooltip text explaining what style issues were found
  const buildAuditTooltip = (
    status: {
      unknownStyleNames?: string[];
      directFormattingTypes?: string[];
      isCompatibilityMode?: boolean;
    } | null
  ): string => {
    const parts: string[] = [];
    if (status?.isCompatibilityMode) {
      parts.push('Document is in Compatibility Mode (resave in Word 2013+ format)');
    }
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
      ? auditStatus?.isCompatibilityMode
        ? 'Compatibility Mode'
        : `${auditStatus.unknownStyles} unknown styles, ${auditStatus.directFormatting} direct`
      : '';

  return (
    <>
      <Group gap="xs">
        <Tooltip label="Mark this work for batch operations">
          <Checkbox
            checked={isMarked}
            onChange={(e) => handleMarkChange(e.currentTarget.checked)}
            size="sm"
            color="green"
          />
        </Tooltip>

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

        {templatePath && auditStatusText && (
          <Tooltip label={buildAuditTooltip(auditStatus)} multiline maw={400}>
            <Text size="xs" c="orange" fw={500}>
              {auditStatusText}
            </Text>
          </Tooltip>
        )}

        {fileExists && templatePath && auditStatus?.isInBook && (
          <Tooltip label="Apply template styles, page setup, and scale images">
            <Button
              variant="light"
              color="teal"
              size="xs"
              px="xs"
              onClick={handleSync}
              loading={syncing}
            >
              <IconRefresh size={14} />
            </Button>
          </Tooltip>
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
