import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconFileText, IconPrinter, IconDownload, IconArrowsExchange } from '@tabler/icons-react';
import {
  OpenDocument,
  MoveWorkFile,
  ExportToSubmissions,
  PrintWork,
  CheckWorkPath,
  UpdateWorkPathToGenerated,
} from '@wailsjs/go/main/App';
import { Log, LogErr } from '@/utils';
import { useState, useEffect } from 'react';
import { MoveFileModal } from './MoveFileModal';

interface FileActionsToolbarProps {
  workID: number;
  onMoved?: () => void;
}

export function FileActionsToolbar({ workID, onMoved }: FileActionsToolbarProps) {
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
  }, [workID]);

  const handleOpen = async () => {
    try {
      await OpenDocument(workID);
    } catch (err) {
      LogErr('Failed to open document:', err);
    }
  };

  const handleMove = async () => {
    try {
      await MoveWorkFile(workID);
      setPathStatus('');
      setModalOpen(false);
      onMoved?.();
    } catch (err) {
      LogErr('Failed to move file:', err);
    }
  };

  const handleUpdatePathOnly = async () => {
    try {
      await UpdateWorkPathToGenerated(workID);
      setPathStatus('');
      setModalOpen(false);
      onMoved?.();
    } catch (err) {
      LogErr('Failed to update path:', err);
    }
  };

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
        <Tooltip label="Open document">
          <ActionIcon variant="subtle" onClick={handleOpen} disabled={!fileExists}>
            <IconFileText size={18} />
          </ActionIcon>
        </Tooltip>

        {pathStatus === 'name changed' && (
          <Tooltip label="Move file to match metadata">
            <ActionIcon variant="light" color="yellow" onClick={() => setModalOpen(true)}>
              <IconArrowsExchange size={18} />
            </ActionIcon>
          </Tooltip>
        )}

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
        onUpdatePathOnly={handleUpdatePathOnly}
      />
    </>
  );
}
