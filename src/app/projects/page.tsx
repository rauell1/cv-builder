import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Globe, BatteryCharging, Leaf, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Engineering & Sustainability Projects',
  description: 'Explore green mobility, EV charging networks (Safaricharge), sustainability platforms (Greenwave), and clean energy solutions engineered by Roy Okola Otieno.',
};

const projects = [
  {
    slug: 'safaricharge',
    title: 'Safaricharge',
    description: 'De-centralized EV charging network for electric motorcycles and vehicles across East Africa.',
    icon: BatteryCharging,
    category: 'E-Mobility',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    slug: 'greenwave',
    title: 'Greenwave',
    description: 'Sustainably matching clean-energy assets with micro-grid developers in rural communities.',
    icon: Leaf,
    category: 'Clean Energy',
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    slug: 'roam-energy',
    title: 'Roam Energy',
    description: 'Optimizing fleet analytics and battery performance for electric transit buses and utility bikes.',
    icon: Globe,
    category: 'Fleet Tech',
    accent: 'from-blue-500 to-indigo-600',
  },
];

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 glass-nav border-b border-border">
        <div className="h-0.5 bg-stripe-gradient" aria-hidden="true" />
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Logo size="sm" href="/" />
          <div className="flex gap-4">
            <Link href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">Home</Link>
            <Link href="/builder" className="text-xs text-muted-foreground hover:text-primary transition-colors">CV Builder</Link>
            <Link href="/projects" className="text-xs text-primary font-semibold">Projects</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12">
          <Badge variant="outline" className="px-3 py-1 text-[11px] font-medium border-border text-muted-foreground rounded-full mb-4">
            Portfolio
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-3">
            Engineering & Clean-Energy Projects
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Clean tech systems, electric mobility software, and carbon reduction architectures built for Africa's sustainable transition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const Icon = proj.icon;
            return (
              <Card key={proj.slug} className="border-border rounded-2xl bg-white hover:scale-[1.01] transition-all duration-300 overflow-hidden flex flex-col justify-between group">
                <div>
                  <div className="h-1 w-full bg-gradient-to-r from-primary to-transparent" />
                  <CardContent className="p-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${proj.accent} flex items-center justify-center mb-4 text-white shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge className="mb-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[10px]">{proj.category}</Badge>
                    <h2 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{proj.title}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{proj.description}</p>
                  </CardContent>
                </div>
                <div className="px-6 pb-6 pt-0">
                  <Link href={`/projects/${proj.slug}`} className="text-xs text-primary font-medium flex items-center gap-1 hover:gap-1.5 transition-all">
                    View Project Case Study
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-muted/50 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>Built with Next.js App Router for maximal search discovery</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-[#ea2261] fill-[#ea2261]" /> by Roy Okola Otieno
          </p>
        </div>
      </footer>
    </div>
  );
}
