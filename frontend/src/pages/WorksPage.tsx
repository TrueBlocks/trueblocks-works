import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ViewSort } from '@/hooks';
import { useNavigate } from 'react-router';

export function WorksPage() {
  const [works, setWorks] = useState<models.Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSort, setInitialSort] = useState<ViewSort | undefined>(undefined);
  const [showYears, setShowYears] = useState<Set<string>>(new Set());
  const [showTypes, setShowTypes] = useState<Set<string>>(new Set());
  const [showStatuses, setShowStatuses] = useState<Set<string>>(new Set());
  const [showQualities, setShowQualities] = useState<Set<string>>(new Set());
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const navigate = useNavigate();

  const loadWorks = useCallback(() => {
    setLoading(true);
    GetWorks()
      .then((data) => setWorks(data || []))
      .catch((err) => LogErr('Failed to load works:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
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

        // Set filters: intersect persisted with available (defaults to all if no valid persisted)
        setShowYears(intersectFilter(appState?.worksYearFilter, filterOptions.years || []));
        setShowTypes(intersectFilter(appState?.worksTypeFilter, filterOptions.types || []));
        setShowStatuses(intersectFilter(appState?.worksStatusFilter, filterOptions.statuses || []));
        setShowQualities(
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
  }, []);

  const handleCreated = (work: models.Work) => {
    loadWorks();
    navigate(`/works/${work.workID}`);
  };

  const toggleYear = useCallback((year: string) => {
    setShowYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      SetWorksYearFilter(Array.from(next));
      return next;
    });
  }, []);

  const toggleType = useCallback((type: string) => {
    setShowTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      SetWorksTypeFilter(Array.from(next));
      return next;
    });
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setShowStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      SetWorksStatusFilter(Array.from(next));
      return next;
    });
  }, []);

  const toggleQuality = useCallback((quality: string) => {
    setShowQualities((prev) => {
      const next = new Set(prev);
      if (next.has(quality)) {
        next.delete(quality);
      } else {
        next.add(quality);
      }
      SetWorksQualityFilter(Array.from(next));
      return next;
    });
  }, []);

  const selectAllYears = useCallback(() => {
    setShowYears(new Set(availableYears));
    SetWorksYearFilter(availableYears);
  }, [availableYears]);

  const selectNoneYears = useCallback(() => {
    setShowYears(new Set());
    SetWorksYearFilter([]);
  }, []);

  const selectOnlyYear = useCallback((year: string) => {
    setShowYears(new Set([year]));
    SetWorksYearFilter([year]);
  }, []);

  const selectAllTypes = useCallback(() => {
    setShowTypes(new Set(availableTypes));
    SetWorksTypeFilter(availableTypes);
  }, [availableTypes]);

  const selectNoneTypes = useCallback(() => {
    setShowTypes(new Set());
    SetWorksTypeFilter([]);
  }, []);

  const selectOnlyType = useCallback((type: string) => {
    setShowTypes(new Set([type]));
    SetWorksTypeFilter([type]);
  }, []);

  const selectAllStatuses = useCallback(() => {
    setShowStatuses(new Set(availableStatuses));
    SetWorksStatusFilter(availableStatuses);
  }, [availableStatuses]);

  const selectNoneStatuses = useCallback(() => {
    setShowStatuses(new Set());
    SetWorksStatusFilter([]);
  }, []);

  const selectOnlyStatus = useCallback((status: string) => {
    setShowStatuses(new Set([status]));
    SetWorksStatusFilter([status]);
  }, []);

  const selectAllQualities = useCallback(() => {
    setShowQualities(new Set(availableQualities));
    SetWorksQualityFilter(availableQualities);
  }, [availableQualities]);

  const selectNoneQualities = useCallback(() => {
    setShowQualities(new Set());
    SetWorksQualityFilter([]);
  }, []);

  const selectOnlyQuality = useCallback((quality: string) => {
    setShowQualities(new Set([quality]));
    SetWorksQualityFilter([quality]);
  }, []);

  const filterFn = useCallback(
    (work: models.Work, search: string) => {
      const matchesSearch = work.title.toLowerCase().includes(search.toLowerCase());
      return (
        matchesSearch &&
        matchesFilter(showYears, work.year) &&
        matchesFilter(showTypes, work.type) &&
        matchesFilter(showStatuses, work.status) &&
        matchesFilter(showQualities, work.quality)
      );
    },
    [showYears, showTypes, showStatuses, showQualities]
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
            selected={showYears}
            onChange={toggleYear}
            onSelectAll={selectAllYears}
            onSelectNone={selectNoneYears}
            onSelectOnly={selectOnlyYear}
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
            selected={showTypes}
            onChange={toggleType}
            onSelectAll={selectAllTypes}
            onSelectNone={selectNoneTypes}
            onSelectOnly={selectOnlyType}
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
            selected={showStatuses}
            onChange={toggleStatus}
            onSelectAll={selectAllStatuses}
            onSelectNone={selectNoneStatuses}
            onSelectOnly={selectOnlyStatus}
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
            selected={showQualities}
            onChange={toggleQuality}
            onSelectAll={selectAllQualities}
            onSelectNone={selectNoneQualities}
            onSelectOnly={selectOnlyQuality}
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
      showYears,
      toggleYear,
      selectAllYears,
      selectNoneYears,
      selectOnlyYear,
      showTypes,
      toggleType,
      selectAllTypes,
      selectNoneTypes,
      selectOnlyType,
      showStatuses,
      toggleStatus,
      selectAllStatuses,
      selectNoneStatuses,
      selectOnlyStatus,
      showQualities,
      toggleQuality,
      selectAllQualities,
      selectNoneQualities,
      selectOnlyQuality,
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
