import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = GeistSans;
const geistMono = GeistMono;

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
