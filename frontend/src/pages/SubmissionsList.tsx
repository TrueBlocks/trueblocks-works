import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge, ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { Log, LogErr } from '@/utils';
import {
  GetAllSubmissionViews,
  GetSubmissionsFilterOptions,
  SetLastSubmissionID,
  GetAppState,
  DeleteSubmission,
  UndeleteSubmission,
  GetSubmissionDeleteConfirmation,
  DeleteSubmissionPermanent,
} from '@app';
import { models, db } from '@models';
import { ResponseBadge, DataTable, Column, TypeBadge, ConfirmDeleteModal } from '@/components';
import { notifications } from '@mantine/notifications';
import { useNavigation } from '@trueblocks/scaffold';
import dayjs from 'dayjs';

function getStatus(sub: models.SubmissionView): string {
  return !sub.responseDate && !sub.responseType ? 'Active' : 'Closed';
}

const getSubmissionValue = (sub: models.SubmissionView, column: string): unknown => {
  if (column === 'status') {
    return getStatus(sub);
  }
  return (sub as unknown as Record<string, unknown>)[column];
};

interface SubmissionsListProps {
  onSubmissionClick: (sub: models.SubmissionView) => void;
}

export function SubmissionsList({ onSubmissionClick }: SubmissionsListProps) {
  const location = useLocation();
  const { currentId, setCurrentId, setItems } = useNavigation();
  const [submissions, setSubmissions] = useState<models.SubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{
    types: string[];
    responses: string[];
  }>({ types: [], responses: [] });
  const hasInitialized = useRef(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingSubmissionID, setDeletingSubmissionID] = useState<number | null>(null);

  const loadSubmissions = useCallback(() => {
    setLoading(true);
    GetAllSubmissionViews()
      .then((data) => setSubmissions(data || []))
      .catch((err) => LogErr('Failed to load submissions:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetAllSubmissionViews(), GetSubmissionsFilterOptions()])
      .then(([data, filterOpts]) => {
        Log('Submissions loaded:', data?.length || 0);
        setSubmissions(data || []);
        setFilterOptions({
          types: filterOpts.types || [],
          responses: filterOpts.responses || [],
        });

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastSubmissionID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => LogErr('Failed to load submissions:', err))
      .finally(() => setLoading(false));
  }, [location.state]);

  // Reload when showDeleted changes
  useEffect(() => {
    function handleShowDeletedChanged() {
      loadSubmissions();
    }
    window.addEventListener('showDeletedChanged', handleShowDeletedChanged);
    return () => window.removeEventListener('showDeletedChanged', handleShowDeletedChanged);
  }, [loadSubmissions]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadSubmissions();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadSubmissions]);

  const searchFn = useCallback((sub: models.SubmissionView, search: string) => {
    return (
      sub.titleOfWork.toLowerCase().includes(search.toLowerCase()) ||
      sub.journalName.toLowerCase().includes(search.toLowerCase()) ||
      (sub.draft?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (sub.contestName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    );
  }, []);

  const handleSelectedChange = useCallback(
    (sub: models.SubmissionView) => {
      setCurrentId(sub.submissionID);
      SetLastSubmissionID(sub.submissionID).catch((err) => {
        LogErr('Failed to set lastSubmissionID:', err);
      });
    },
    [setCurrentId]
  );

  const handleDelete = useCallback(async (sub: models.SubmissionView) => {
    try {
      await DeleteSubmission(sub.submissionID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to delete submission:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handleUndelete = useCallback(async (sub: models.SubmissionView) => {
    try {
      await UndeleteSubmission(sub.submissionID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to restore submission:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDeleteClick = useCallback(async (sub: models.SubmissionView) => {
    try {
      const conf = await GetSubmissionDeleteConfirmation(sub.submissionID);
      setDeleteConfirmation(conf);
      setDeletingSubmissionID(sub.submissionID);
      setDeleteModalOpen(true);
    } catch (err) {
      LogErr('Failed to get delete confirmation:', err);
      notifications.show({
        message: 'Failed to prepare delete',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDelete = useCallback(async () => {
    if (!deletingSubmissionID) return;
    setDeleteLoading(true);
    try {
      await DeleteSubmissionPermanent(deletingSubmissionID);
      setDeleteModalOpen(false);
      setDeletingSubmissionID(null);
      notifications.show({
        message: 'Submission permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to permanently delete submission:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingSubmissionID]);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastSubmissionID;
  }, []);

  const columns: Column<models.SubmissionView>[] = useMemo(
    () => [
      {
        key: 'titleOfWork',
        label: 'Work',
        width: '20%',
        scrollOnSelect: true,
        render: (s) => s.titleOfWork || '-',
      },
      {
        key: 'journalName',
        label: 'Organization',
        width: '20%',
        scrollOnSelect: true,
        render: (s) => s.journalName || '-',
      },
      {
        key: 'submissionType',
        label: 'Type',
        width: '12%',
        render: (s) => <TypeBadge value={s.submissionType} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'responseType',
        label: 'Response',
        width: '12%',
        render: (s) => <ResponseBadge response={s.responseType} />,
        filterOptions: filterOptions.responses,
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (s) => {
          const status = getStatus(s);
          return status === 'Active' ? (
            <Badge color="green" variant="light">
              Active
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Closed
            </Badge>
          );
        },
        filterOptions: ['Active', 'Closed'],
      },
      {
        key: 'submissionDate',
        label: 'Submitted',
        width: '12%',
        render: (s) => (s.submissionDate ? dayjs(s.submissionDate).format('MMM D, YYYY') : '-'),
      },
    ],
    [filterOptions]
  );

  return (
    <>
      <DataTable<models.SubmissionView>
        tableName="submissions"
        title="Submissions"
        data={submissions}
        columns={columns}
        loading={loading}
        getRowKey={(s) => s.submissionID}
        onRowClick={onSubmissionClick}
        onSelectedChange={handleSelectedChange}
        getLastSelectedID={getLastSelectedID}
        onFilteredSortedChange={(subs) => {
          const items = subs.map((s) => ({ id: s.submissionID }));
          const navCurrentId = currentId ?? subs[0]?.submissionID ?? 0;
          setItems('submission', items, navCurrentId);
        }}
        searchFn={searchFn}
        valueGetter={getSubmissionValue}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
        headerActions={
          <ActionIcon variant="filled" size="lg">
            <IconPlus size={18} />
          </ActionIcon>
        }
      />
      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingSubmissionID(null);
        }}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </>
  );
}
