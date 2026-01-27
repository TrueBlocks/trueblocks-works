import { useState, useCallback, useMemo, ReactNode } from 'react';
import type { EntityContract } from '../types';
import { createEntityList, type EntityListProps, type EntityListReturn } from './createEntityList';
import {
  createEntityDetail,
  type EntityDetailProps,
  type EntityDetailReturn,
} from './createEntityDetail';
import { NavigationProvider } from '../context';

export type PageView = 'list' | 'detail' | 'create';

export interface EntityPageReturn<T> {
  view: PageView;
  showDeleted: boolean;
  selectedId: number | null;

  setView: (view: PageView) => void;
  setShowDeleted: (show: boolean) => void;
  openDetail: (id: number) => void;
  openCreate: () => void;
  closeDetail: () => void;

  useList: (props?: Partial<EntityListProps<T>>) => EntityListReturn<T>;
  useDetail: (props: EntityDetailProps) => EntityDetailReturn<T>;
  PageWrapper: React.FC<{ children: ReactNode }>;
}

export function createEntityPage<T extends { id: number; isDeleted: boolean }>(
  contract: EntityContract<T, number>
): () => EntityPageReturn<T> {
  const useEntityList = createEntityList<T>(contract);
  const useEntityDetail = createEntityDetail<T>(contract);

  return function useEntityPage(): EntityPageReturn<T> {
    const [view, setViewState] = useState<PageView>('list');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);

    const setView = useCallback((newView: PageView) => {
      setViewState(newView);
    }, []);

    const openDetail = useCallback((id: number) => {
      setSelectedId(id);
      setViewState('detail');
    }, []);

    const openCreate = useCallback(() => {
      setSelectedId(null);
      setViewState('create');
    }, []);

    const closeDetail = useCallback(() => {
      setSelectedId(null);
      setViewState('list');
    }, []);

    const useList = useCallback(
      (props?: Partial<EntityListProps<T>>) => {
        return useEntityList({
          showDeleted,
          onDoubleClick: (item) => openDetail(item.id),
          ...props,
        });
      },
      [showDeleted, openDetail, useEntityList]
    );

    const useDetail = useCallback(
      (props: EntityDetailProps) => {
        return useEntityDetail({
          ...props,
          onClose: props.onClose ?? closeDetail,
          onNavigate: (newId) => setSelectedId(newId),
        });
      },
      [closeDetail, useEntityDetail]
    );

    const PageWrapper: React.FC<{ children: ReactNode }> = useMemo(
      () =>
        function EntityPageWrapper({ children }: { children: ReactNode }) {
          return <NavigationProvider>{children}</NavigationProvider>;
        },
      []
    );

    return {
      view,
      showDeleted,
      selectedId,
      setView,
      setShowDeleted,
      openDetail,
      openCreate,
      closeDetail,
      useList,
      useDetail,
      PageWrapper,
    };
  };
}
