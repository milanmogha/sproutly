import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sproutly',
    short_name: 'Sproutly',
    description:
      'Preschool management for parents, teachers, admins and super admins.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e9f2e1',
    theme_color: '#2e7d32',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/sproutly-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
