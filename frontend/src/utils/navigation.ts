import { GetTab, GetAppState } from '@app';
import { state } from '@models';

type EntityPageName = 'works' | 'collections' | 'organizations' | 'submissions';

const ENTITY_ID_MAP: Record<EntityPageName, keyof state.AppState> = {
  works: 'lastWorkID',
  collections: 'lastCollectionID',
  organizations: 'lastOrgID',
  submissions: 'lastSubmissionID',
};

export async function getEntityPageURL(pageName: EntityPageName): Promise<string> {
  const savedTab = await GetTab(pageName);

  if (savedTab === 'list' || !savedTab) {
    return `/${pageName}`;
  }

  const appState = await GetAppState();
  const idField = ENTITY_ID_MAP[pageName];
  const lastId = appState[idField] as number | undefined;

  if (lastId && lastId > 0) {
    return `/${pageName}/${lastId}`;
  }

  return `/${pageName}`;
}

export async function toggleEntityPageTab(pageName: EntityPageName): Promise<string> {
  const currentTab = await GetTab(pageName);

  if (currentTab === 'detail') {
    return `/${pageName}`;
  }

  const appState = await GetAppState();
  const idField = ENTITY_ID_MAP[pageName];
  const lastId = appState[idField] as number | undefined;

  if (lastId && lastId > 0) {
    return `/${pageName}/${lastId}`;
  }

  return `/${pageName}`;
}
