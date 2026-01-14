import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconList, IconFileText } from '@tabler/icons-react';
import { GetAppState, SetTab, GetWorks } from '@app';
import { TabView, Tab } from '@/components';
import { WorksList } from './WorksList';
import { WorkDetail } from './WorkDetail';
import { models } from '@models';

export function WorksPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workId = id ? parseInt(id, 10) : null;
  const [filteredSortedWorks, setFilteredSortedWorks] = useState<models.WorkView[]>([]);
  const hasInitialized = useRef(false);

  const handleWorkClick = useCallback(
    (work: models.WorkView) => {
      navigate(`/works/${work.workID}`);
    },
    [navigate]
  );

  const handleTabChange = useCallback(
    async (tab: string) => {
      if (tab === 'list') {
        navigate('/works');
      } else if (tab === 'detail') {
        const state = await GetAppState();
        const lastId = state.lastWorkID || 1;
        navigate(`/works/${lastId}`);
      }
    },
    [navigate]
  );

  const activeTab = workId ? 'detail' : 'list';

  useEffect(() => {
    SetTab('works', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    GetWorks().then((works) => setFilteredSortedWorks(works || []));
  }, []);

  const handleFilteredDataChange = useCallback((works: models.WorkView[]) => {
    setFilteredSortedWorks(works);
  }, []);

  const tabs: Tab[] = useMemo(
    () => [
      {
        value: 'list',
        label: 'List',
        icon: <IconList size={16} />,
        content: (
          <WorksList
            onWorkClick={handleWorkClick}
            onFilteredDataChange={handleFilteredDataChange}
          />
        ),
      },
      {
        value: 'detail',
        label: 'Detail',
        icon: <IconFileText size={16} />,
        content: workId ? (
          <WorkDetail workId={workId} filteredWorks={filteredSortedWorks} />
        ) : (
          <div>Select a work to view details</div>
        ),
      },
    ],
    [workId, handleWorkClick, handleFilteredDataChange, filteredSortedWorks]
  );

  return (
    <TabView pageName="works" tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
  );
}
