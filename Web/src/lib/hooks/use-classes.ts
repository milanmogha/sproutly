'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { classesApi } from '@/lib/api/endpoints';
import { entityId } from '@/lib/api/types';

/**
 * The classes the signed-in user can see, plus which one is selected.
 *
 * `GET /classes` is scoped by the backend — a teacher gets their own classes,
 * an admin the whole school — so the same hook serves both portals. The
 * selection is remembered per browser so a teacher lands on the class they
 * were last working with.
 */
const STORAGE_KEY = 'sproutly.selectedClass';

export function useClasses() {
  const [selectedId, setSelectedId] = useState('');

  const query = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
  });

  const classes = query.data ?? [];

  useEffect(() => {
    if (!classes.length) return;
    setSelectedId((current) => {
      if (current && classes.some((c) => entityId(c) === current)) return current;
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        /* storage blocked */
      }
      if (stored && classes.some((c) => entityId(c) === stored)) return stored;
      return entityId(classes[0]);
    });
  }, [classes]);

  function select(id: string) {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* the choice just won't survive a reload */
    }
  }

  return {
    classes,
    selectedId,
    selected: classes.find((c) => entityId(c) === selectedId) ?? classes[0] ?? null,
    select,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
