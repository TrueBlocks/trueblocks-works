import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconList, IconFileText } from '@tabler/icons-react';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab, GetCollections } from '@app';
import { NavigationProvider } from '@trueblocks/scaffold';
import { CollectionsList } from './CollectionsList';
import { CollectionDetail } from './CollectionDetail';
import { models } from '@models';

export function CollectionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const collectionId = id ? parseInt(id, 10) : undefined;
  const [filteredSortedCollections, setFilteredSortedCollections] = useState<
    models.CollectionView[]
  >([]);
  const lastCollectionIdRef = useRef<number | undefined>(undefined);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (collectionId !== undefined) {
      lastCollectionIdRef.current = collectionId;
    }
  }, [collectionId]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    GetCollections().then((colls) => setFilteredSortedCollections(colls || []));
  }, []);

  const handleFilteredDataChange = useCallback((colls: models.CollectionView[]) => {
    setFilteredSortedCollections(colls);
  }, []);

  const activeTab = collectionId !== undefined ? 'detail' : 'list';

  useEffect(() => {
    SetTab('collections', activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab === 'list') {
        navigate('/collections');
      } else {
        const targetId = lastCollectionIdRef.current;
        if (targetId !== undefined) {
          navigate(`/collections/${targetId}`);
        } else {
          GetAppState().then((state) => {
            const lastId = state.lastCollectionID;
            if (lastId) {
              navigate(`/collections/${lastId}`);
            }
          });
        }
      }
    },
    [navigate]
  );

  const handleCollectionClick = useCallback(
    (coll: models.CollectionView) => {
      navigate(`/collections/${coll.collID}`, {
        state: { fromList: true },
      });
    },
    [navigate]
  );

  const tabs: Tab[] = useMemo(
    () => [
      {
        value: 'list',
        label: 'List',
        icon: <IconList size={16} />,
        content: (
          <CollectionsList
            onCollectionClick={handleCollectionClick}
            onFilteredDataChange={handleFilteredDataChange}
          />
        ),
      },
      {
        value: 'detail',
        label: 'Detail',
        icon: <IconFileText size={16} />,
        content: collectionId ? (
          <CollectionDetail
            collectionId={collectionId}
            filteredCollections={filteredSortedCollections}
          />
        ) : (
          <div>Select a collection to view details</div>
        ),
      },
    ],
    [collectionId, handleCollectionClick, handleFilteredDataChange, filteredSortedCollections]
  );

  return (
    <NavigationProvider
      onNavigate={(entityType, id) => {
        if (entityType === 'collection') {
          navigate(`/collections/${id}`);
        } else if (entityType === 'work') {
          navigate(`/works/${id}`);
        }
      }}
    >
      <TabView
        pageName="collections"
        tabs={tabs}
        defaultTab="list"
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </NavigationProvider>
  );
}
