import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconWorld, IconBook } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { BrowserOpenURL } from '@wailsjs/runtime/runtime';
import {
  GetOrganizationsWithNotes,
  GetOrgsFilterOptions,
  SetLastOrgID,
  GetAppState,
  DeleteOrganization,
  UndeleteOrganization,
  GetOrganizationDeleteConfirmation,
  DeleteOrganizationPermanent,
} from '@app';
import { models, db } from '@models';
import { OrgStatusBadge, DataTable, Column, TypeBadge, ConfirmDeleteModal } from '@/components';
import { Log, LogErr } from '@/utils';
import { notifications } from '@mantine/notifications';
import { useNavigation } from '@trueblocks/scaffold';

const getOrgValue = (org: models.OrganizationWithNotes, column: string): unknown => {
  if (column === 'nPushcarts') {
    return org.nPushFiction + org.nPushNonfiction + org.nPushPoetry;
  }
  return (org as unknown as Record<string, unknown>)[column];
};

interface OrganizationsListProps {
  onOrgClick: (org: models.OrganizationWithNotes) => void;
}

export function OrganizationsList({ onOrgClick }: OrganizationsListProps) {
  const location = useLocation();
  const { currentId, setCurrentId, setItems } = useNavigation();
  const [orgs, setOrgs] = useState<models.OrganizationWithNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{
    statuses: string[];
    types: string[];
    timings: string[];
  }>({ statuses: [], types: [], timings: [] });
  const hasInitialized = useRef(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<db.DeleteConfirmation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingOrgID, setDeletingOrgID] = useState<number | null>(null);

  const loadOrgs = useCallback(() => {
    setLoading(true);
    GetOrganizationsWithNotes()
      .then((data) => setOrgs(data || []))
      .catch((err) => LogErr('Failed to load organizations:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetOrganizationsWithNotes(), GetOrgsFilterOptions()])
      .then(([data, options]) => {
        Log('Organizations loaded:', data?.length || 0);
        setOrgs(data || []);
        setFilterOptions({
          statuses: options.statuses || [],
          types: options.types || [],
          timings: options.timings || [],
        });

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastOrgID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => {
        LogErr('Failed to load organizations:', err);
      })
      .finally(() => setLoading(false));
  }, [location.state]);

  // Reload when showDeleted changes
  useEffect(() => {
    function handleShowDeletedChanged() {
      loadOrgs();
    }
    window.addEventListener('showDeletedChanged', handleShowDeletedChanged);
    return () => window.removeEventListener('showDeletedChanged', handleShowDeletedChanged);
  }, [loadOrgs]);

  // Reload on Cmd+R
  useEffect(() => {
    function handleReload() {
      loadOrgs();
    }
    window.addEventListener('reloadCurrentView', handleReload);
    return () => window.removeEventListener('reloadCurrentView', handleReload);
  }, [loadOrgs]);

  const searchFn = useCallback((org: models.OrganizationWithNotes, search: string) => {
    return org.name.toLowerCase().includes(search.toLowerCase());
  }, []);

  const handleSelectedChange = useCallback(
    (org: models.OrganizationWithNotes) => {
      setCurrentId(org.orgID);
      SetLastOrgID(org.orgID).catch((err) => {
        LogErr('Failed to set lastOrgID:', err);
      });
    },
    [setCurrentId]
  );

  const handleDelete = useCallback(async (org: models.OrganizationWithNotes) => {
    try {
      await DeleteOrganization(org.orgID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to delete organization:', err);
      notifications.show({
        message: 'Delete failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handleUndelete = useCallback(async (org: models.OrganizationWithNotes) => {
    try {
      await UndeleteOrganization(org.orgID);
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to restore organization:', err);
      notifications.show({
        message: 'Restore failed',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, []);

  const handlePermanentDeleteClick = useCallback(async (org: models.OrganizationWithNotes) => {
    try {
      const conf = await GetOrganizationDeleteConfirmation(org.orgID);
      setDeleteConfirmation(conf);
      setDeletingOrgID(org.orgID);
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
    if (!deletingOrgID) return;
    setDeleteLoading(true);
    try {
      await DeleteOrganizationPermanent(deletingOrgID);
      setDeleteModalOpen(false);
      setDeletingOrgID(null);
      notifications.show({
        message: 'Organization permanently deleted',
        color: 'green',
        autoClose: 3000,
      });
      window.dispatchEvent(new CustomEvent('showDeletedChanged'));
    } catch (err) {
      LogErr('Failed to permanently delete organization:', err);
      notifications.show({
        message: 'Permanent delete failed',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingOrgID]);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastOrgID;
  }, []);

  const columns: Column<models.OrganizationWithNotes>[] = useMemo(
    () => [
      { key: 'orgID', label: 'ID', width: '5%', render: (o) => o.orgID },
      { key: 'name', label: 'Name', width: '25%', render: (o) => o.name, scrollOnSelect: true },
      {
        key: 'type',
        label: 'Type',
        width: '10%',
        render: (o) => <TypeBadge value={o.type} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (o) => <OrgStatusBadge status={o.status} />,
        filterOptions: filterOptions.statuses,
      },
      {
        key: 'timing',
        label: 'Timing',
        width: '10%',
        render: (o) => <TypeBadge value={o.timing} />,
        filterOptions: filterOptions.timings,
      },
      {
        key: 'nSubmissions',
        label: 'Subs',
        width: '7%',
        render: (o) => o.nSubmissions || '-',
        filterRange: true,
      },
      {
        key: 'nAccepted',
        label: 'Accepted',
        width: '7%',
        render: (o) => o.nAccepted || '-',
        filterRange: true,
      },
      {
        key: 'nPushcarts',
        label: 'Pushcarts',
        width: '8%',
        render: (o) => o.nPushFiction + o.nPushNonfiction + o.nPushPoetry || '-',
        filterRange: true,
      },
      {
        key: 'notes',
        label: 'Notes',
        width: '20%',
        scrollOnSelect: true,
        render: (o) => (
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {o.notes || '-'}
          </span>
        ),
      },
    ],
    [filterOptions]
  );

  const renderExtraCells = useCallback(
    (org: models.OrganizationWithNotes) => (
      <>
        <Tooltip label="Open website">
          <ActionIcon
            size="sm"
            variant="subtle"
            disabled={!org.url}
            onClick={(e) => {
              e.stopPropagation();
              if (org.url) BrowserOpenURL(org.url);
            }}
          >
            <IconWorld size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Open Duotrope">
          <ActionIcon
            size="sm"
            variant="subtle"
            disabled={!org.duotropeNum}
            onClick={(e) => {
              e.stopPropagation();
              if (org.duotropeNum) {
                BrowserOpenURL(`https://duotrope.com/listing/${org.duotropeNum}`);
              }
            }}
          >
            <IconBook size={16} />
          </ActionIcon>
        </Tooltip>
      </>
    ),
    []
  );

  return (
    <>
      <DataTable<models.OrganizationWithNotes>
        tableName="organizations"
        title="Organizations"
        data={orgs}
        columns={columns}
        loading={loading}
        getRowKey={(o) => o.orgID}
        onRowClick={onOrgClick}
        onSelectedChange={handleSelectedChange}
        getLastSelectedID={getLastSelectedID}
        onFilteredSortedChange={(filteredOrgs) => {
          const items = filteredOrgs.map((o) => ({ id: o.orgID }));
          const navCurrentId = currentId ?? filteredOrgs[0]?.orgID ?? 0;
          setItems('organization', items, navCurrentId);
        }}
        searchFn={searchFn}
        valueGetter={getOrgValue}
        onDelete={handleDelete}
        onUndelete={handleUndelete}
        onPermanentDelete={handlePermanentDeleteClick}
        renderExtraCells={renderExtraCells}
      />
      <ConfirmDeleteModal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingOrgID(null);
        }}
        onConfirm={handlePermanentDelete}
        confirmation={deleteConfirmation}
        loading={deleteLoading}
      />
    </>
  );
}
