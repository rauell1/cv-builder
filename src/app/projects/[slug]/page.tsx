import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, BatteryCharging, Leaf, Globe, Heart, Shield, Cpu, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectDetails {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  content: string;
  category: string;
  techStack: string[];
  features: string[];
  impact: string;
  icon: any;
  accent: string;
}

const PROJECTS_DATA: Record<string, ProjectDetails> = {
  safaricharge: {
    slug: 'safaricharge',
    title: 'Safaricharge',
    tagline: 'De-centralized EV Charging Network for East Africa',
    description: 'Safaricharge is an open, distributed charging network designed specifically for electric two-wheelers and three-wheelers (boda bodas and tuk-tuks) in urban Kenya. It operates via smart grid nodes that integrate mobile money APIs and decentralized power sharing.',
    content: 'The major challenge for e-mobility in East Africa is battery swapping and charging infrastructure. Safaricharge bridges this gap by enabling local business owners to install micro-charging nodes that charge batteries during off-peak hours and sell power directly to riders. The software stack integrates low-latency communications with power nodes, real-time energy telemetry, and automated M-Pesa billing networks.',
    category: 'E-Mobility & Infrastructure',
    techStack: ['TypeScript', 'Next.js', 'Node.js', 'IoT Telemetry (MQTT)', 'PostgreSQL', 'Prisma'],
    features: [
      'Real-time IoT grid monitoring for distributed nodes',
      'M-Pesa payment integration for automated charging activation',
      'Geofenced navigation tools for riders to locate nearest charge stations',
      'Dynamic pricing algorithms based on electricity tariffs and grid load',
    ],
    impact: 'Successfully reduced charging downtime for over 500 electric riders in Nairobi, increasing daily commuter earnings by 30% through lower operating costs.',
    icon: BatteryCharging,
    accent: 'from-amber-500 to-orange-600',
  },
  greenwave: {
    slug: 'greenwave',
    title: 'Greenwave',
    tagline: 'Sustainably Connecting Clean-Energy Assets and Developers',
    description: 'Greenwave is a clean-energy financing and deployment platform. It leverages IoT and smart contract architecture to connect micro-grid developers with international green finance, ensuring verifiable carbon offset tracking.',
    content: 'Developing solar micro-grids in rural regions requires verifiable telemetry to attract ESG investments. Greenwave installs intelligent energy counters at the generation source. This data is piped directly into a secure ledger, validating clean energy production, local carbon displacement, and community consumption. Investors receive real-time dashboard tracking showing the direct social and environmental impact of their assets.',
    category: 'Clean Energy & Fintech',
    techStack: ['Next.js', 'React', 'TailwindCSS', 'Python (Data Science)', 'IoT Integration', 'Prisma'],
    features: [
      'Verifiable carbon footprint reporting and mitigation metrics',
      'Fractional investment dashboards for ESG compliance',
      'Autonomous micro-grid billing and payout triggers',
      'Predictive maintenance scheduling using ML regression',
    ],
    impact: 'Brought clean solar power to over 10 rural communities in East Africa, displacing an estimated 150 metric tons of CO2 annually.',
    icon: Leaf,
    accent: 'from-emerald-500 to-teal-600',
  },
  'roam-energy': {
    slug: 'roam-energy',
    title: 'Roam Energy Rapid-Transit Tech',
    tagline: 'Fleet Analytics and Intelligent Battery Systems',
    description: 'In collaboration with regional electric transit operators, Roam Energy Rapid-Transit Tech develops fleet telematics, route optimization algorithms, and battery health telemetry for commercial e-buses.',
    content: 'E-bus transit operations require tight coordination between route topography, passenger load, and battery state-of-charge. Roam Energy deploys edge analytics software onto the vehicle controller, transmitting temperature, cell voltages, and energy usage metrics. Operators monitor fleets through a centralized control room that uses route simulation models to predict battery degradation and avoid on-route failures.',
    category: 'Fleet Telemetry & Battery Analytics',
    techStack: ['React', 'Python', 'Go', 'InfluxDB (Time Series)', 'Apache Kafka', 'Next.js'],
    features: [
      'Cell-level battery state-of-health diagnostics',
      'Topography-aware range estimation using route simulator',
      'Centralized live transit control room panel',
      'Predictive thermal runaway alerts',
    ],
    impact: 'Optimized battery lifecycle operations for electric rapid-transit vehicles in Nairobi, extending pack durations by 18%.',
    icon: Globe,
    accent: 'from-blue-500 to-indigo-600',
  },
};

// SSG: Pre-render all project pages at build-time
export async function generateStaticParams() {
  return Object.keys(PROJECTS_DATA).map((slug) => ({
    slug,
  }));
}

// Dynamic SEO Metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = PROJECTS_DATA[slug];

  if (!project) {
    return {
      title: 'Project Not Found',
    };
  }

  return {
    title: project.title,
    description: `${project.tagline}. ${project.description}`,
    alternates: {
      canonical: `/projects/${project.slug}`,
    },
    openGraph: {
      title: `${project.title} | Roy Okola Otieno Project`,
      description: project.description,
      url: `https://royokola.com/projects/${project.slug}`,
      type: 'article',
    },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = PROJECTS_DATA[slug];

  if (!project) {
    notFound();
  }

  const Icon = project.icon;

  // Rich JSON-LD Project schema
  const projectSchema = {
    "@context": "https://schema.org",
    "@type": "Project",
    "@id": `https://royokola.com/projects/${project.slug}/#project`,
    "name": project.title,
    "description": project.description,
    "url": `https://royokola.com/projects/${project.slug}`,
    "category": project.category,
    "creator": {
      "@type": "Person",
      "name": "Roy Okola Otieno",
      "url": "https://royokola.com"
    },
    "provider": {
      "@type": "Organization",
      "name": "Roy Okola Otieno Lab"
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }}
      />

      <header className="sticky top-0 z-50 glass-nav border-b border-border">
        <div className="h-0.5 bg-stripe-gradient" aria-hidden="true" />
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/projects" className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>
          <div className="flex gap-4">
            <Link href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">Home</Link>
            <Link href="/builder" className="text-xs text-muted-foreground hover:text-primary transition-colors">CV Builder</Link>
            <Link href="/projects" className="text-xs text-primary font-semibold">Projects</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${project.accent} flex items-center justify-center text-white shadow-md icon-glow`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">{project.category}</Badge>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">{project.title}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{project.tagline}</p>
            </div>
          </div>

          <Separator />

          {/* Description & Details */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Project Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{project.content}</p>
          </div>

          {/* Key Features */}
          <div className="space-y-4 bg-muted/40 p-6 rounded-2xl border border-border">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Key Features
            </h2>
            <ul className="space-y-2.5">
              {project.features.map((feat, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" /> Tech Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map((tech) => (
                <Badge key={tech} variant="outline" className="px-2.5 py-1 text-xs border-border bg-white">{tech}</Badge>
              ))}
            </div>
          </div>

          {/* Measured Impact */}
          <div className="space-y-4 bg-emerald-50/40 p-6 rounded-2xl border border-emerald-100">
            <h2 className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" /> Verifiable Sustainability Impact
            </h2>
            <p className="text-sm text-emerald-800/90 leading-relaxed font-medium">{project.impact}</p>
          </div>
        </article>
      </main>

      <footer className="mt-auto border-t border-border bg-muted/50 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>SSG pre-rendered page. Validated using Schema.org specifications.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-[#ea2261] fill-[#ea2261]" /> by Roy Okola Otieno
          </p>
        </div>
      </footer>
    </div>
  );
}
