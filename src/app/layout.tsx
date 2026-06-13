import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/next';

const appSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const appMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://royokola.com"),
  title: {
    default: "Roy Okola Otieno | Software Architect & Clean-Energy Developer",
    template: "%s | Roy Okola Otieno",
  },
  description: "Personal portfolio of Roy Okola Otieno, featuring e-mobility, EV charging networks (Safaricharge), sustainability platforms (Greenwave), and AI-powered engineering tools (AI CV Builder).",
  keywords: [
    "Roy Okola Otieno",
    "Software Architect Kenya",
    "Safaricharge",
    "Greenwave",
    "Roam Energy",
    "AI CV Builder",
    "E-mobility Africa",
    "Electric Vehicle Charging Kenya",
    "Clean Tech Software Engineer",
    "ATS Resume Optimizer"
  ],
  authors: [{ name: "Roy Okola Otieno" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Roy Okola Otieno | Software Architect & Clean-Energy Developer",
    description: "Discover clean-energy platforms, e-mobility systems like Safaricharge, and engineering productivity tools.",
    url: "https://royokola.com",
    siteName: "Roy Okola Otieno Portfolio & Lab",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roy Okola Otieno | Software Architect & Clean-Energy Developer",
    description: "Software engineering meets electric mobility and clean-energy infrastructure in East Africa.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://royokola.com/#organization",
    "name": "Roy Okola Otieno Portfolio & Lab",
    "url": "https://royokola.com",
    "logo": "https://royokola.com/logo.png",
    "sameAs": [
      "https://github.com/rauell1",
      "https://x.com"
    ]
  };

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://royokola.com/#person",
    "name": "Roy Okola Otieno",
    "url": "https://royokola.com",
    "image": "https://royokola.com/avatar.jpg",
    "jobTitle": "Senior Software Architect & Clean-Energy Tech Lead",
    "description": "Architecting electric vehicle charging software (Safaricharge), clean-energy systems (Greenwave), and AI-driven platforms.",
    "sameAs": [
      "https://github.com/rauell1",
      "https://x.com"
    ],
    "knowsAbout": [
      "Software Engineering",
      "Clean Mobility",
      "Electric Vehicles",
      "AI Systems",
      "Next.js & Cloud Architecture"
    ]
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </head>
      <body
        className={`${appSans.variable} ${appMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

