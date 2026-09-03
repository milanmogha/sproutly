import { resolve } from 'path';

/**
 * The one place that decides where uploaded files live on disk.
 *
 * `resolve`, never `join`: `STORAGE_LOCAL_PATH` is a relative path in dev
 * (`./uploads`) and an absolute one in production, and `join(cwd, '/abs/path')`
 * glues the two together instead of honouring the absolute path. That is
 * exactly how gallery images broke — multer wrote to the absolute path while
 * the static server served `cwd + /abs/path`, an empty directory it had
 * created itself, so every image 404'd while the files sat safely on disk.
 *
 * `resolve` returns an absolute path unchanged and resolves a relative one
 * against the working directory, which is what both callers actually want.
 */
export function uploadsDir(localPath?: string | null): string {
  return resolve(process.cwd(), localPath?.trim() || './uploads');
}

/** The public URL path for a stored file, e.g. `/uploads/1699-42.png`. */
export const UPLOADS_URL_PREFIX = '/uploads';

export function uploadedFileUrl(filename: string): string {
  return `${UPLOADS_URL_PREFIX}/${filename}`;
}
