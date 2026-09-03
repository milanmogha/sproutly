import { api } from './client';

/**
 * Downloads an authenticated file (receipts, reports) and saves it.
 *
 * These endpoints need the bearer token, so a plain `<a href>` won't do — the
 * bytes are fetched through the same axios instance, then handed to the
 * browser as a blob URL that is revoked once the click has been dispatched.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a tick to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  }
}
