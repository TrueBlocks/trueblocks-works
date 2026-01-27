import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconList, IconFileText } from '@tabler/icons-react';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab } from '@app';
import { SubmissionsList } from './SubmissionsList';
import { SubmissionDetail } from './SubmissionDetail';
import { NavigationProvider } from '@trueblocks/scaffold';
import { models } from '@models';

export function SubmissionsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const submissionId = id ? parseInt(id, 10) : undefined;
  const lastSubmissionIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (submissionId !== undefined) {
      lastSubmissionIdRef.current = submissionId;
    }
  }, [submissionId]);

  const activeTab = submissionId !== undefined ? 'detail' : 'list';

  useEffect(() => {
    SetTab('submissions', activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab === 'list') {
        navigate('/submissions');
      } else {
        const targetId = lastSubmissionIdRef.current;
        if (targetId !== undefined) {
          navigate(`/submissions/${targetId}`);
        } else {
          GetAppState().then((state) => {
            const lastId = state.lastSubmissionID;
            if (lastId) {
              navigate(`/submissions/${lastId}`);
            }
          });
        }
      }
    },
    [navigate]
  );

  const handleSubmissionClick = useCallback(
    (sub: models.SubmissionView) => {
      navigate(`/submissions/${sub.submissionID}`);
    },
    [navigate]
  );

  const tabs: Tab[] = useMemo(
    () => [
      {
        value: 'list',
        label: 'List',
        icon: <IconList size={16} />,
        content: <SubmissionsList onSubmissionClick={handleSubmissionClick} />,
      },
      {
        value: 'detail',
        label: 'Detail',
        icon: <IconFileText size={16} />,
        content: submissionId ? (
          <SubmissionDetail submissionId={submissionId} />
        ) : (
          <div>Select a submission to view details</div>
        ),
      },
    ],
    [submissionId, handleSubmissionClick]
  );

  return (
    <NavigationProvider>
      <TabView
        pageName="submissions"
        tabs={tabs}
        defaultTab="list"
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </NavigationProvider>
  );
}
