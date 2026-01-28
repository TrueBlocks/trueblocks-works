import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconList, IconFileText } from '@tabler/icons-react';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab, GetOrganizationsWithNotes } from '@app';
import { OrganizationsList } from './OrganizationsList';
import { OrganizationDetail } from './OrganizationDetail';
import { NavigationProvider } from '@trueblocks/scaffold';
import { models } from '@models';

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const organizationId = id ? parseInt(id, 10) : undefined;
  const lastOrgIdRef = useRef<number | undefined>(undefined);
  const [filteredSortedOrgs, setFilteredSortedOrgs] = useState<models.OrganizationWithNotes[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (organizationId !== undefined) {
      lastOrgIdRef.current = organizationId;
    }
  }, [organizationId]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    GetOrganizationsWithNotes().then((orgs) => setFilteredSortedOrgs(orgs || []));
  }, []);

  const handleFilteredDataChange = useCallback((orgs: models.OrganizationWithNotes[]) => {
    setFilteredSortedOrgs(orgs);
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
            filteredOrganizations={filteredSortedOrgs}
          />
        ) : (
          <div>Select an organization to view details</div>
        ),
      },
    ],
    [organizationId, handleOrgClick, handleFilteredDataChange, filteredSortedOrgs]
  );

  return (
    <NavigationProvider>
      <TabView
        pageName="organizations"
        tabs={tabs}
        defaultTab="list"
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </NavigationProvider>
  );
}
