import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI CV Builder and ATS Resume Optimizer",
  description:
    "Tailor your CV to a job description, improve ATS keyword alignment, and generate a polished CV and cover letter for free.",
  alternates: { canonical: "/builder" },
  openGraph: {
    title: "Free AI CV Builder and ATS Resume Optimizer",
    description:
      "Tailor your CV to a job description and generate a polished CV and cover letter.",
    url: "/builder",
  },
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
