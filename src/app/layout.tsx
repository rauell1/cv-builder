import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/next';
import { CookieConsentProvider } from "@/lib/cookie-consent-context";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { CookiePreferencesModal } from "@/components/privacy/cookie-preferences-modal";
import { PrivacyFooterTrigger } from "@/components/privacy/privacy-footer-trigger";

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
  metadataBase: new URL("https://cv-builder.rauell.systems"),
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
  verification: {
    google: "YopMsxRCWbWYZU_ANAhcwd6ggCeArux5CR37WuXqXXA",
    other: {
      "msvalidate.01": "66CE208CF02793B41D19362E121494C6",
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Roy Okola Otieno | Software Architect & Clean-Energy Developer",
    description: "Discover clean-energy platforms, e-mobility systems like Safaricharge, and engineering productivity tools.",
    url: "https://cv-builder.rauell.systems",
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
    "@id": "https://cv-builder.rauell.systems/#organization",
    "name": "Roy Okola Otieno Portfolio & Lab",
    "url": "https://cv-builder.rauell.systems",
    "logo": "https://cv-builder.rauell.systems/logo.svg",
    "sameAs": [
      "https://github.com/rauell1",
      "https://x.com"
    ]
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": "https://cv-builder.rauell.systems/#app",
    "name": "AI CV Builder",
    "url": "https://cv-builder.rauell.systems/builder",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Upload a CV and a job description; AI restructures your experience, matches keywords, and generates a tailored PDF CV plus cover letter. No account required.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "AI CV parsing with OCR",
      "Job description keyword matching",
      "5 professional CV formats",
      "Cover letter generation",
      "ATS score insights"
    ],
    "publisher": { "@id": "https://cv-builder.rauell.systems/#organization" }
  };

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://cv-builder.rauell.systems/#person",
    "name": "Roy Okola Otieno",
    "url": "https://cv-builder.rauell.systems",
    "image": "https://cv-builder.rauell.systems/avatar.jpg",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
        />
      </head>
      <body
        className={`${appSans.variable} ${appMono.variable} antialiased bg-background text-foreground`}
      >
        <CookieConsentProvider>
          {children}
          <CookieBanner />
          <CookiePreferencesModal />
          <PrivacyFooterTrigger />
          <Toaster />
          <Analytics />
        </CookieConsentProvider>
      </body>
    </html>
  );
}


