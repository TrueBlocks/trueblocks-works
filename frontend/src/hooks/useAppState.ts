import { useState, useEffect, useCallback } from 'react';
import { GetAppState, SetLastWorkID, SetLastOrgID, SetLastCollectionID, SetLastRoute } from '@app';
import { state } from '@models';

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
    updateLastRoute,
  };
}
