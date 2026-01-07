import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab } from '@wailsjs/go/main/App';
import { OrganizationsList } from './OrganizationsList';
import { OrganizationDetail } from './OrganizationDetail';
import { models } from '@wailsjs/go/models';

const tabs: Tab[] = [
  { value: 'list', label: 'Organizations' },
  { value: 'detail', label: 'Details' },
];

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const organizationId = id ? parseInt(id, 10) : undefined;
  const lastOrgIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (organizationId !== undefined) {
      lastOrgIdRef.current = organizationId;
    }
  }, [organizationId]);

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

  return (
    <TabView
      pageName="organizations"
      tabs={tabs}
      defaultTab="list"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'list' ? (
        <OrganizationsList onOrgClick={handleOrgClick} />
      ) : organizationId !== undefined ? (
        <OrganizationDetail organizationId={organizationId} />
      ) : null}
    </TabView>
  );
}
