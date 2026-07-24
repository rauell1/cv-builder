import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsentProvider } from "@/lib/cookie-consent-context";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { CookiePreferencesModal } from "@/components/privacy/cookie-preferences-modal";
import { PrivacyFooterTrigger } from "@/components/privacy/privacy-footer-trigger";
import { ConsentAnalytics } from "@/components/analytics/consent-analytics";

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
    default: "AI CV Builder | Free ATS Resume Optimizer",
    template: "%s | AI CV Builder",
  },
  description: "Build a tailored, ATS-friendly CV and cover letter with AI. Match job-description keywords, improve your resume, and export polished PDFs for free.",
  keywords: [
    "AI CV Builder",
    "ATS Resume Optimizer",
    "CV Tailoring Tool",
    "Resume Keyword Matcher",
    "AI Cover Letter Generator",
    "Free Resume Builder",
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
    title: "AI CV Builder | Free ATS Resume Optimizer",
    description: "Tailor your CV to a job description, improve ATS keyword alignment, and generate a polished CV and cover letter for free.",
    url: "https://cv-builder.rauell.systems",
    siteName: "AI CV Builder",
    type: "website",
    locale: "en_US",
    images: [{ url: "/logo.svg", alt: "AI CV Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI CV Builder | Free ATS Resume Optimizer",
    description: "Tailor your CV to a job description and generate a polished CV and cover letter for free.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const graphJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://cv-builder.rauell.systems/#website",
        "name": "AI CV Builder",
        "url": "https://cv-builder.rauell.systems",
        "description": "A free AI tool for tailoring ATS-friendly CVs and cover letters to job descriptions.",
        "inLanguage": "en",
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graphJsonLd) }}
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
          <ConsentAnalytics />
        </CookieConsentProvider>
      </body>
    </html>
  );
}


