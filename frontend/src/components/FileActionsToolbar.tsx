import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconFileText, IconPrinter, IconDownload, IconArrowsExchange } from '@tabler/icons-react';
import {
  OpenDocument,
  MoveWorkFile,
  ExportToSubmissions,
  PrintWork,
  CheckWorkPath,
} from '@wailsjs/go/main/App';
import { Log, LogErr } from '@/utils';
import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    CheckWorkPath(workID).then((result) => {
      setPathStatus(result.status);
      setFileExists(result.fileExists);
      setCurrentPath(result.storedPath);
      setGeneratedPath(result.generatedPath);
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

        <Tooltip label="Open document">
          <ActionIcon variant="subtle" onClick={handleOpen} disabled={!fileExists}>
            <IconFileText size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Export to submissions folder">
          <ActionIcon variant="subtle" onClick={handleExport} disabled={!fileExists}>
            <IconDownload size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Print">
          <ActionIcon variant="subtle" onClick={handlePrint} disabled={!fileExists}>
            <IconPrinter size={18} />
          </ActionIcon>
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
