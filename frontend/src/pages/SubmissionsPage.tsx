import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TabView, Tab } from '@/components';
import { GetAppState, SetTab } from '@wailsjs/go/main/App';
import { SubmissionsList } from './SubmissionsList';
import { SubmissionDetail } from './SubmissionDetail';
import { models } from '@wailsjs/go/models';

const tabs: Tab[] = [
  { value: 'list', label: 'Submissions' },
  { value: 'detail', label: 'Details' },
];

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

  return (
    <TabView
      pageName="submissions"
      tabs={tabs}
      defaultTab="list"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {activeTab === 'list' ? (
        <SubmissionsList onSubmissionClick={handleSubmissionClick} />
      ) : submissionId !== undefined ? (
        <SubmissionDetail submissionId={submissionId} />
      ) : null}
    </TabView>
  );
}
