import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LogErr, matchesFilter } from '@/utils';
import { GetCollections, GetAppState, SetCollectionsFilter } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { DataTable, Column, ColumnFilterPopover, TypeBadge } from '@/components';
import { ViewSort, useColumnFilter } from '@/hooks';
import { useNavigate } from 'react-router';

export function CollectionsPage() {
  const [collections, setCollections] = useState<models.CollectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialSearch, setInitialSearch] = useState('');
  const [initialSort, setInitialSort] = useState<ViewSort | undefined>(undefined);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const navigate = useNavigate();

  const typeFilter = useColumnFilter(availableTypes);
  const hasInitialized = useRef(false);

  const defaultSort: ViewSort = useMemo(
    () => ({
      primary: { column: 'collectionName', direction: 'asc' },
      secondary: { column: '', direction: '' },
    }),
    []
  );

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    Promise.all([GetCollections(), GetAppState()])
      .then(([colls, appState]) => {
        const data = colls || [];
        setCollections(data);

        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);

        if (appState?.collectionsFilter) {
          setInitialSearch(appState.collectionsFilter);
        }

        if (appState?.viewSorts?.collections) {
          const vs = appState.viewSorts.collections;
          if (vs.primary?.column) {
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
          } else {
            setInitialSort(defaultSort);
          }
        } else {
          setInitialSort(defaultSort);
        }

        typeFilter.initialize(new Set(types));
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, [typeFilter, defaultSort]);

  const filterFn = useCallback(
    (coll: models.CollectionView, search: string) => {
      const matchesSearch = coll.collectionName.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && matchesFilter(typeFilter.selected, coll.type);
    },
    [typeFilter.selected]
  );

  const columns: Column<models.CollectionView>[] = useMemo(
    () => [
      { key: 'collID', label: 'ID', width: '8%', render: (c) => c.collID },
      { key: 'collectionName', label: 'Name', width: '45%', render: (c) => c.collectionName },
      {
        key: 'type',
        label: 'Type',
        width: '15%',
        render: (c) => <TypeBadge value={c.type} />,
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
        key: 'nItems',
        label: 'Works',
        width: '12%',
        render: (c) => c.nItems,
      },
      {
        key: 'modifiedAt',
        label: 'Last Modified',
        width: '20%',
        render: (c) => (c.modifiedAt ? new Date(c.modifiedAt + 'Z').toLocaleDateString() : '-'),
      },
    ],
    [availableTypes, typeFilter]
  );

  return (
    <DataTable<models.CollectionView>
      title="Collections"
      data={collections}
      columns={columns}
      loading={loading}
      getRowKey={(c) => c.collID}
      onRowClick={(c) => navigate(`/collections/${c.collID}`)}
      filterFn={filterFn}
      initialSearch={initialSearch}
      onSearchChange={SetCollectionsFilter}
      viewName="collections"
      initialSort={initialSort}
    />
  );
}
