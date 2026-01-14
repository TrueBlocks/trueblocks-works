import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconList, IconFileText } from '@tabler/icons-react';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab, GetOrganizationsWithNotes } from '@app';
import { OrganizationsList } from './OrganizationsList';
import { OrganizationDetail } from './OrganizationDetail';
import { models } from '@models';

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const organizationId = id ? parseInt(id, 10) : undefined;
  const [filteredSortedOrganizations, setFilteredSortedOrganizations] = useState<
    models.OrganizationWithNotes[]
  >([]);
  const lastOrgIdRef = useRef<number | undefined>(undefined);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (organizationId !== undefined) {
      lastOrgIdRef.current = organizationId;
    }
  }, [organizationId]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    GetOrganizationsWithNotes().then((orgs) => setFilteredSortedOrganizations(orgs || []));
  }, []);

  const handleFilteredDataChange = useCallback((orgs: models.OrganizationWithNotes[]) => {
    setFilteredSortedOrganizations(orgs);
  }, []);

  const activeTab = organizationId !== undefined ? 'detail' : 'list';

  useEffect(() => {
    SetTab('organizations', activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab === 'list') {
        navigate('/organizations');
      } else {
        const targetId = lastOrgIdRef.current;
        if (targetId !== undefined) {
          navigate(`/organizations/${targetId}`);
        } else {
          GetAppState().then((state) => {
            const lastId = state.lastOrgID;
            if (lastId) {
              navigate(`/organizations/${lastId}`);
            }
          });
        }
      }
    },
    [navigate]
  );

  const handleOrgClick = useCallback(
    (org: models.OrganizationWithNotes) => {
      navigate(`/organizations/${org.orgID}`);
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
          <OrganizationsList
            onOrgClick={handleOrgClick}
            onFilteredDataChange={handleFilteredDataChange}
          />
        ),
      },
      {
        value: 'detail',
        label: 'Detail',
        icon: <IconFileText size={16} />,
        content: organizationId ? (
          <OrganizationDetail
            organizationId={organizationId}
            filteredOrganizations={filteredSortedOrganizations}
          />
        ) : (
          <div>Select an organization to view details</div>
        ),
      },
    ],
    [organizationId, handleOrgClick, handleFilteredDataChange, filteredSortedOrganizations]
  );

  return (
    <TabView
      pageName="organizations"
      tabs={tabs}
      defaultTab="list"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
}
