import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Log, LogErr, matchesFilter, intersectFilter } from '@/utils';
import {
  GetWorks,
  GetAppState,
  GetWorksFilterOptions,
  SetWorksFilter,
  SetWorksYearFilter,
  SetWorksTypeFilter,
  SetWorksStatusFilter,
  SetWorksQualityFilter,
} from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import {
  StatusBadge,
  QualityBadge,
  NewWorkModal,
  DataTable,
  Column,
  ColumnFilterPopover,
} from '@/components';
import { ViewSort, useColumnFilter } from '@/hooks';
import { useNavigate } from 'react-router';

export function WorksPage() {
  const [works, setWorks] = useState<models.Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSort, setInitialSort] = useState<ViewSort | undefined>(undefined);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const hasInitialized = useRef(false);
  const navigate = useNavigate();

  const yearFilter = useColumnFilter(availableYears, SetWorksYearFilter);
  const typeFilter = useColumnFilter(availableTypes, SetWorksTypeFilter);
  const statusFilter = useColumnFilter(availableStatuses, SetWorksStatusFilter);
  const qualityFilter = useColumnFilter(availableQualities, SetWorksQualityFilter);

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

    Promise.all([GetWorks(), GetAppState(), GetWorksFilterOptions()])
      .then(([data, appState, filterOptions]) => {
        Log('Works loaded:', data?.length || 0);
        setWorks(data || []);

        // Set available options from backend
        setAvailableYears(filterOptions.years || []);
        setAvailableTypes(filterOptions.types || []);
        setAvailableStatuses(filterOptions.statuses || []);
        setAvailableQualities(filterOptions.qualities || []);

        // Restore persisted search
        if (appState?.worksFilter) {
          setInitialSearch(appState.worksFilter);
        }

        yearFilter.initialize(
          intersectFilter(appState?.worksYearFilter, filterOptions.years || [])
        );
        typeFilter.initialize(
          intersectFilter(appState?.worksTypeFilter, filterOptions.types || [])
        );
        statusFilter.initialize(
          intersectFilter(appState?.worksStatusFilter, filterOptions.statuses || [])
        );
        qualityFilter.initialize(
          intersectFilter(appState?.worksQualityFilter, filterOptions.qualities || [])
        );
        if (appState?.viewSorts?.works) {
          const vs = appState.viewSorts.works;
          setInitialSort({
            primary: {
              column: vs.primary?.column || '',
              direction: (vs.primary?.direction as ViewSort['primary']['direction']) || '',
            },
            secondary: {
              column: vs.secondary?.column || '',
              direction: (vs.secondary?.direction as ViewSort['secondary']['direction']) || '',
            },
          });
        }
      })
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, [yearFilter, typeFilter, statusFilter, qualityFilter]);

  const handleCreated = (work: models.Work) => {
    loadWorks();
    navigate(`/works/${work.workID}`);
  };

  const filterFn = useCallback(
    (work: models.Work, search: string) => {
      const matchesSearch = work.title.toLowerCase().includes(search.toLowerCase());
      return (
        matchesSearch &&
        matchesFilter(yearFilter.selected, work.year) &&
        matchesFilter(typeFilter.selected, work.type) &&
        matchesFilter(statusFilter.selected, work.status) &&
        matchesFilter(qualityFilter.selected, work.quality)
      );
    },
    [yearFilter.selected, typeFilter.selected, statusFilter.selected, qualityFilter.selected]
  );

  const columns: Column<models.Work>[] = useMemo(
    () => [
      { key: 'workID', label: 'ID', width: '5%', render: (w) => w.workID },
      { key: 'title', label: 'Title', width: '35%', render: (w) => w.title },
      {
        key: 'year',
        label: 'Year',
        width: '8%',
        render: (w) => w.year || '-',
        filterElement: (
          <ColumnFilterPopover
            options={availableYears}
            selected={yearFilter.selected}
            onChange={yearFilter.toggle}
            onSelectAll={yearFilter.selectAll}
            onSelectNone={yearFilter.selectNone}
            onSelectOnly={yearFilter.selectOnly}
            label="Year"
          />
        ),
      },
      {
        key: 'type',
        label: 'Type',
        width: '10%',
        render: (w) => w.type,
        filterElement: (
          <ColumnFilterPopover
            options={availableTypes}
            selected={typeFilter.selected}
            onChange={typeFilter.toggle}
            onSelectAll={typeFilter.selectAll}
            onSelectNone={typeFilter.selectNone}
            onSelectOnly={typeFilter.selectOnly}
            label="Type"
          />
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '12%',
        render: (w) => <StatusBadge status={w.status} />,
        filterElement: (
          <ColumnFilterPopover
            options={availableStatuses}
            selected={statusFilter.selected}
            onChange={statusFilter.toggle}
            onSelectAll={statusFilter.selectAll}
            onSelectNone={statusFilter.selectNone}
            onSelectOnly={statusFilter.selectOnly}
            label="Status"
          />
        ),
      },
      {
        key: 'quality',
        label: 'Quality',
        width: '12%',
        render: (w) => <QualityBadge quality={w.quality} />,
        filterElement: (
          <ColumnFilterPopover
            options={availableQualities}
            selected={qualityFilter.selected}
            onChange={qualityFilter.toggle}
            onSelectAll={qualityFilter.selectAll}
            onSelectNone={qualityFilter.selectNone}
            onSelectOnly={qualityFilter.selectOnly}
            label="Quality"
          />
        ),
      },
      {
        key: 'nWords',
        label: 'Words',
        width: '10%',
        render: (w) => w.nWords?.toLocaleString() || '-',
      },
    ],
    [
      availableYears,
      availableTypes,
      availableStatuses,
      availableQualities,
      yearFilter,
      typeFilter,
      statusFilter,
      qualityFilter,
    ]
  );

  return (
    <>
      <DataTable<models.Work>
        title="Works"
        data={works}
        columns={columns}
        loading={loading}
        getRowKey={(w) => w.workID}
        onRowClick={(w) => navigate(`/works/${w.workID}`)}
        filterFn={filterFn}
        initialSearch={initialSearch}
        onSearchChange={SetWorksFilter}
        viewName="works"
        initialSort={initialSort}
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
