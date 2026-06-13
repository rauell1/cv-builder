import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cv-builder.rauell.systems';

  const baseRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/builder`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  // Tailored portfolio project URLs
  const projects = ['safaricharge', 'greenwave', 'roam-energy'];
  const projectRoutes = projects.map((slug) => ({
    url: `${baseUrl}/projects/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Tailored sustainability and tech blog URLs (Kenya / Africa focus)
  const blogPosts = [
    'kenya-ev-charging-infrastructure-challenges',
    'scaling-electric-mobility-in-nairobi',
    'solar-mini-grids-powering-rural-east-africa',
    'building-sustainable-tech-stacks-green-computing',
    'impact-of-roam-rapid-on-public-transport',
  ];
  const blogRoutes = blogPosts.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...baseRoutes, ...projectRoutes, ...blogRoutes];
}
