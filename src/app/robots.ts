import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://cv-builder.rauell.systems';
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/builder',
          '/privacy',
          '/cookies',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/.git/',
          '/node_modules/',
          '/src/',
          '/*.json$',
          '/*.ts$',
          '/*.tsx$',
        ],
        crawlDelay: 1,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
