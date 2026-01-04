import { useState, useEffect, useCallback } from 'react';
import {
  GetAppState,
  SetLastWorkID,
  SetLastOrgID,
  SetLastCollectionID,
  SetWorksFilter,
  SetOrgsFilter,
  SetLastRoute,
} from '@wailsjs/go/main/App';
import { state } from '@wailsjs/go/models';

export function useAppState() {
  const [appState, setAppState] = useState<state.AppState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetAppState().then((s) => {
      setAppState(s);
      setLoading(false);
    });
  }, []);

  const updateLastWorkID = useCallback((id: number) => {
    SetLastWorkID(id);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, lastWorkID: id }) : prev));
  }, []);

  const updateLastOrgID = useCallback((id: number) => {
    SetLastOrgID(id);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, lastOrgID: id }) : prev));
  }, []);

  const updateLastCollectionID = useCallback((id: number) => {
    SetLastCollectionID(id);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, lastCollectionID: id }) : prev));
  }, []);

  const updateWorksFilter = useCallback((filter: string) => {
    SetWorksFilter(filter);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, worksFilter: filter }) : prev));
  }, []);

  const updateOrgsFilter = useCallback((filter: string) => {
    SetOrgsFilter(filter);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, orgsFilter: filter }) : prev));
  }, []);

  const updateLastRoute = useCallback((route: string) => {
    SetLastRoute(route);
    setAppState((prev) => (prev ? new state.AppState({ ...prev, lastRoute: route }) : prev));
  }, []);

  return {
    appState,
    loading,
    updateLastWorkID,
    updateLastOrgID,
    updateLastCollectionID,
    updateWorksFilter,
    updateOrgsFilter,
    updateLastRoute,
  };
}
