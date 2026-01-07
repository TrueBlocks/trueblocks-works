import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab } from '@wailsjs/go/main/App';
import { CollectionsList } from './CollectionsList';
import { CollectionDetail } from './CollectionDetail';
import { models } from '@wailsjs/go/models';

const tabs: Tab[] = [
  { value: 'list', label: 'Collections' },
  { value: 'detail', label: 'Details' },
];

export function CollectionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const collectionId = id ? parseInt(id, 10) : undefined;
  const lastCollectionIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (collectionId !== undefined) {
      lastCollectionIdRef.current = collectionId;
    }
  }, [collectionId]);

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
      navigate(`/collections/${coll.collID}`);
    },
    [navigate]
  );

  return (
    <TabView
      pageName="collections"
      tabs={tabs}
      defaultTab="list"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'list' ? (
        <CollectionsList onCollectionClick={handleCollectionClick} />
      ) : collectionId !== undefined ? (
        <CollectionDetail collectionId={collectionId} />
      ) : null}
    </TabView>
  );
}
