'use client';

import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { studentsApi } from '@/lib/api/endpoints';
import { entityId, type Paginated, type Student } from '@/lib/api/types';

/**
 * The child every parent screen is currently showing.
 *
 * `GET /students` is scoped by the backend to the signed-in parent's own
 * children, so this is both the list and the selector. A parent with one child
 * never sees a picker; one with several switches here and every screen follows.
 */
interface ChildContextValue {
  children: Student[];
  selected: Student | null;
  selectedId: string;
  select: (id: string) => void;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

const ChildContext = createContext<ChildContextValue | null>(null);

const STORAGE_KEY = 'sproutly.parent.selectedChild';

export function ChildProvider({ children: tree }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: async () => {
      const result = await studentsApi.list();
      // The endpoint pages for admins and returns a bare array for parents.
      return Array.isArray(result) ? result : (result as Paginated<Student>).data;
    },
  });

  const list = useMemo(() => data ?? [], [data]);

  // Restore the last-viewed child, falling back to the first. A stored id that
  // no longer belongs to this parent is ignored.
  useEffect(() => {
    if (!list.length) return;
    setSelectedId((current) => {
      if (current && list.some((child) => entityId(child) === current)) return current;
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        /* storage blocked */
      }
      if (stored && list.some((child) => entityId(child) === stored)) return stored;
      return entityId(list[0]);
    });
  }, [list]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage blocked — the choice just won't survive a reload */
    }
  }, []);

  const value = useMemo<ChildContextValue>(
    () => ({
      children: list,
      selected: list.find((child) => entityId(child) === selectedId) ?? list[0] ?? null,
      selectedId,
      select,
      loading: isLoading,
      error,
      refetch: () => void refetch(),
    }),
    [list, selectedId, select, isLoading, error, refetch],
  );

  return <ChildContext.Provider value={value}>{tree}</ChildContext.Provider>;
}

export function useChild(): ChildContextValue {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error('useChild must be used inside <ChildProvider>');
  return ctx;
}
