import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { LogErr } from '@/utils';
import { GetCollections, SetLastCollectionID, GetAppState } from '@wailsjs/go/main/App';
import { models } from '@wailsjs/go/models';
import { DataTable, Column, TypeBadge } from '@/components';

interface CollectionsListProps {
  onCollectionClick: (coll: models.CollectionView) => void;
  onFilteredDataChange: (colls: models.CollectionView[]) => void;
}

export function CollectionsList({ onCollectionClick, onFilteredDataChange }: CollectionsListProps) {
  const location = useLocation();
  const [collections, setCollections] = useState<models.CollectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    GetCollections()
      .then((colls) => {
        const data = colls || [];
        setCollections(data);
        const types = [...new Set(data.map((c) => c.type).filter(Boolean))] as string[];
        setAvailableTypes(types);

        const state = location.state as { selectID?: number } | null;
        if (state?.selectID) {
          SetLastCollectionID(state.selectID);
          window.history.replaceState({}, document.title);
        }
      })
      .catch((err) => LogErr('Failed to load collections:', err))
      .finally(() => setLoading(false));
  }, [location.state]);

  const searchFn = useCallback((coll: models.CollectionView, search: string) => {
    return coll.collectionName.toLowerCase().includes(search.toLowerCase());
  }, []);

  const handleSelectedChange = useCallback((coll: models.CollectionView) => {
    SetLastCollectionID(coll.collID).catch((err) => {
      LogErr('Failed to set lastCollectionID:', err);
    });
  }, []);

  const getLastSelectedID = useCallback(async () => {
    const state = await GetAppState();
    return state.lastCollectionID;
  }, []);

  const columns: Column<models.CollectionView>[] = useMemo(
    () => [
      { key: 'collID', label: 'ID', width: '8%', render: (c) => c.collID },
      { key: 'collectionName', label: 'Name', width: '45%', render: (c) => c.collectionName },
      {
        key: 'type',
        label: 'Type',
        width: '15%',
        render: (c) => <TypeBadge value={c.type} />,
        filterOptions: availableTypes,
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
    [availableTypes]
  );

  return (
    <DataTable<models.CollectionView>
      tableName="collections"
      title="Collections"
      data={collections}
      columns={columns}
      loading={loading}
      getRowKey={(c) => c.collID}
      onRowClick={onCollectionClick}
      onSelectedChange={handleSelectedChange}
      getLastSelectedID={getLastSelectedID}
      onFilteredSortedChange={onFilteredDataChange}
      searchFn={searchFn}
    />
  );
}
