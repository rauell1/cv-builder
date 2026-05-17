import { MetadataRoute } from 'next';

/**
 * Dynamic sitemap — auto-discovers all public app routes.
 * Vercel deploys this at /sitemap.xml
 * This file is intentionally kept simple so it never breaks the build.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cv.rauell.systems';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/builder`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/templates`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  return staticRoutes;
}
