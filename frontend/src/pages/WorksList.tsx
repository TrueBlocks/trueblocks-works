import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Log, LogErr } from '@/utils';
import { GetWorks, GetWorksFilterOptions, SetLastWorkID, GetAppState } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  StatusBadge,
  QualityBadge,
  TypeBadge,
  NewWorkModal,
  DataTable,
  Column,
} from '@/components';

interface WorksListProps {
  onWorkClick: (work: models.WorkView) => void;
  onFilteredDataChange: (works: models.WorkView[]) => void;
}

export function WorksList({ onWorkClick, onFilteredDataChange }: WorksListProps) {
  const location = useLocation();
  const [works, setWorks] = useState<models.WorkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    years: string[];
    types: string[];
    statuses: string[];
    qualities: string[];
  }>({ years: [], types: [], statuses: [], qualities: [] });
  const hasInitialized = useRef(false);

  const loadWorks = useCallback(() => {
    setLoading(true);
    GetWorks()
      .then((data) => setWorks(data || []))
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetWorks(), GetWorksFilterOptions()])
      .then(([data, options]) => {
        Log('Works loaded:', data?.length || 0);
        setWorks(data || []);
        setFilterOptions({
          years: options.years || [],
          types: options.types || [],
          statuses: options.statuses || [],
          qualities: options.qualities || [],
        });

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastWorkID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, [location.state]);

  const handleCreated = (work: models.Work) => {
    loadWorks();
    onWorkClick({ ...work, collectionList: '', nWords: 0 } as models.WorkView);
  };

  const handleSelectedChange = useCallback((work: models.WorkView) => {
    SetLastWorkID(work.workID).catch((err) => {
      LogErr('Failed to set lastWorkID:', err);
    });
  }, []);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastWorkID;
  }, []);

  const searchFn = useCallback((work: models.WorkView, search: string) => {
    return work.title.toLowerCase().includes(search.toLowerCase());
  }, []);

  const columns: Column<models.WorkView>[] = useMemo(
    () => [
      { key: 'workID', label: 'ID', width: '5%', render: (w) => w.workID },
      { key: 'title', label: 'Title', width: '35%', render: (w) => w.title },
      {
        key: 'year',
        label: 'Year',
        width: '8%',
        render: (w) => w.year || '-',
        filterOptions: filterOptions.years,
      },
      {
        key: 'type',
        label: 'Type',
        width: '10%',
        render: (w) => <TypeBadge value={w.type} />,
        filterOptions: filterOptions.types,
      },
      {
        key: 'status',
        label: 'Status',
        width: '12%',
        render: (w) => <StatusBadge status={w.status} />,
        filterOptions: filterOptions.statuses,
      },
      {
        key: 'quality',
        label: 'Quality',
        width: '12%',
        render: (w) => <QualityBadge quality={w.quality} />,
        filterOptions: filterOptions.qualities,
      },
      {
        key: 'nWords',
        label: 'Words',
        width: '8%',
        render: (w) => w.nWords?.toLocaleString() || '-',
      },
      {
        key: 'collectionList',
        label: 'Collections',
        width: '15%',
        render: (w) => {
          const list = w.collectionList || '';
          return list.length > 30 ? list.substring(0, 30) + '…' : list || '-';
        },
      },
    ],
    [filterOptions]
  );

  return (
    <>
      <DataTable<models.WorkView>
        tableName="works"
        title="Works"
        data={works}
        columns={columns}
        loading={loading}
        getRowKey={(w) => w.workID}
        onRowClick={onWorkClick}
        onSelectedChange={handleSelectedChange}
        onFilteredSortedChange={onFilteredDataChange}
        getLastSelectedID={getLastSelectedID}
        searchFn={searchFn}
        headerActions={
          <ActionIcon variant="light" size="lg" onClick={() => setNewModalOpen(true)}>
            <IconPlus size={18} />
          </ActionIcon>
        }
      />

      <NewWorkModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
