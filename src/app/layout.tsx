import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsentProvider } from "@/lib/cookie-consent-context";
import { CookieBanner } from "@/components/privacy/cookie-banner";
import { CookiePreferencesModal } from "@/components/privacy/cookie-preferences-modal";
import { PrivacyFooterTrigger } from "@/components/privacy/privacy-footer-trigger";
import { ConsentAnalytics } from "@/components/analytics/consent-analytics";
import { auth } from "@/lib/auth/server";

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
    default: "Free AI CV Builder | Create an ATS-Friendly CV",
    template: "%s | Free AI CV Builder",
  },
  description: "Create a tailored, ATS-friendly CV for free with AI. Match job-description keywords, improve your resume, generate a cover letter, and export a polished PDF.",
  keywords: [
    "Free AI CV Builder",
    "AI CV Builder",
    "Free CV Builder",
    "Free AI Resume Builder",
    "ATS Resume Optimizer",
    "CV Tailoring Tool",
    "Resume Keyword Matcher",
    "AI Cover Letter Generator",
    "CV Builder Kenya",
    "AI CV Builder Kenya",
  ],
  creator: "Roy Okola Otieno",
  publisher: "AI CV Builder",
  category: "career",
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
    title: "Free AI CV Builder | Create an ATS-Friendly CV",
    description: "Create and tailor an ATS-friendly CV with AI, generate a cover letter, and export a polished PDF for free.",
    url: "https://cv-builder.rauell.systems",
    siteName: "AI CV Builder",
    type: "website",
    locale: "en_KE",
    alternateLocale: ["en_US", "en_GB"],
    images: [{ url: "/logo.svg", alt: "AI CV Builder" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI CV Builder | Create an ATS-Friendly CV",
    description: "Tailor an ATS-friendly CV to any job, generate a cover letter, and export a polished PDF for free.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: session } = await auth.getSession();
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  const isAdmin =
    !!session?.user?.email &&
    !!adminEmail &&
    session.user.email.toLowerCase() === adminEmail.toLowerCase();

  const graphJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://cv-builder.rauell.systems/#website",
        "name": "AI CV Builder",
        "url": "https://cv-builder.rauell.systems",
        "description": "A free AI CV and resume builder for creating ATS-friendly, job-tailored CVs and cover letters worldwide.",
        "inLanguage": "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://cv-builder.rauell.systems/#application",
        "name": "AI CV Builder",
        "url": "https://cv-builder.rauell.systems",
        "applicationCategory": "BusinessApplication",
        "applicationSubCategory": "CV and resume builder",
        "operatingSystem": "Web",
        "description": "A free AI CV builder that tailors CVs to job descriptions, improves ATS keyword alignment, generates cover letters, and exports PDFs.",
        "areaServed": "Worldwide",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "featureList": [
          "AI CV parsing",
          "ATS keyword matching",
          "Job-specific CV tailoring",
          "AI cover letter generation",
          "Professional PDF export"
        ]
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
        <CookieConsentProvider isAdmin={isAdmin}>
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
