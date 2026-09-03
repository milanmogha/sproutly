'use client';

import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { galleryApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import { fileUrl } from '@/lib/api/config';
import { entityId, galleryItemPath, listOf, type GalleryItem } from '@/lib/api/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

/** Photos from the classroom. Staff with `canManage` can upload and delete. */
export function GalleryScreen({ canManage = false }: { canManage?: boolean }) {
  const [preview, setPreview] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState<GalleryItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const galleryQuery = useQuery({
    queryKey: ['gallery'],
    queryFn: () => galleryApi.list(),
  });
  // `/gallery` paginates; listOf accepts either shape.
  const photos = listOf(galleryQuery.data);

  const upload = useMutation({
    mutationFn: (file: File) => galleryApi.upload(file),
    onSuccess: () => {
      toast.success('Photo uploaded.');
      void queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not upload that photo.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => galleryApi.remove(id),
    onSuccess: () => {
      toast.success('Photo removed.');
      void queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove that photo.')),
  });

  const srcOf = (item: GalleryItem) => fileUrl(galleryItemPath(item));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gallery"
        subtitle="Moments from the classroom"
        actions={
          canManage && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  // Reset so picking the same file twice still fires.
                  e.target.value = '';
                }}
              />
              <Button
                icon={<Upload className="size-4" />}
                onClick={() => fileRef.current?.click()}
                loading={upload.isPending}
              >
                Upload photo
              </Button>
            </>
          )
        }
      />

      {galleryQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : galleryQuery.error ? (
        <ErrorState
          message={errorMessage(galleryQuery.error)}
          onRetry={() => galleryQuery.refetch()}
        />
      ) : !photos.length ? (
        <EmptyState
          icon={<Images className="size-6" />}
          title="No photos yet"
          message="Pictures shared by the school will appear here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((item) => {
            const src = srcOf(item);
            return (
              <div key={entityId(item)} className="group relative">
                <button
                  type="button"
                  onClick={() => setPreview(item)}
                  className="block w-full overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]"
                >
                  <span className="relative block aspect-square">
                    {src ? (
                      <Image
                        src={src}
                        alt={item.title ?? 'Gallery photo'}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-[var(--color-text-muted)]">
                        <Images className="size-8" />
                      </span>
                    )}
                  </span>
                  {item.title && (
                    <span className="block truncate px-2.5 py-2 text-left text-xs font-bold">
                      {item.title}
                    </span>
                  )}
                </button>
                {canManage && (
                  <IconButton
                    label="Delete photo"
                    onClick={() => setDeleting(item)}
                    className="absolute top-2 right-2 bg-white/90 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox. Deliberately plain — click anywhere or press Escape closes. */}
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.title ?? 'Photo'}
        >
          <IconButton
            label="Close"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 text-white hover:bg-white/15 hover:text-white"
          >
            <X className="size-6" />
          </IconButton>
          <div className="max-h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {srcOf(preview) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={srcOf(preview)!}
                alt={preview.title ?? 'Gallery photo'}
                className="mx-auto max-h-[75dvh] w-auto rounded-[var(--radius-card)] object-contain"
              />
            )}
            <Card className="mt-3">
              <p className="font-display font-bold">{preview.title ?? 'Untitled'}</p>
              {preview.notes && (
                <p className="text-sm text-[var(--color-text-muted)]">{preview.notes}</p>
              )}
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {formatDate(preview.createdAt)}
              </p>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(entityId(deleting))}
        title="Delete this photo?"
        message="It will be removed from the gallery for everyone."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
      />
    </div>
  );
}
