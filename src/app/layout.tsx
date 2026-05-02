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
  title: "AI CV Builder - Intelligent Resume Optimization",
  description: "Transform your CV with AI intelligence. Parse, analyze job descriptions, restructure your resume, and generate professional Europass PDFs powered by advanced AI models.",
  keywords: ["CV Builder", "Resume", "AI", "Europass", "Job Application", "Career", "Tailored CV"],
  authors: [{ name: "AI CV Builder" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "AI CV Builder - Intelligent Resume Optimization",
    description: "Transform your CV with AI intelligence. Generate professional Europass PDFs.",
    url: "https://chat.z.ai",
    siteName: "AI CV Builder",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI CV Builder - Intelligent Resume Optimization",
    description: "Transform your CV with AI intelligence. Generate professional Europass PDFs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
