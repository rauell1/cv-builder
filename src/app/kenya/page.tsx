import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Free AI CV Builder in Kenya",
  description:
    "Build a professional, ATS-friendly CV for free in Kenya. Tailor your CV to a job description, generate a cover letter, and export a polished PDF with AI.",
  keywords: [
    "Free AI CV Builder Kenya",
    "CV Builder Kenya",
    "AI CV Builder Nairobi",
    "Free CV Maker Kenya",
    "ATS CV Kenya",
    "Resume Builder Kenya",
  ],
  alternates: { canonical: "/kenya" },
  openGraph: {
    title: "Free AI CV Builder in Kenya",
    description:
      "Create an ATS-friendly CV for Kenyan and international jobs, generate a cover letter, and export a professional PDF for free.",
    url: "/kenya",
    locale: "en_KE",
  },
};

const faqs = [
  {
    question: "Is this AI CV builder free to use in Kenya?",
    answer:
      "Yes. You can build and tailor a CV, generate a cover letter, and export your documents without paying or creating an account.",
  },
  {
    question: "Can I use it for jobs outside Kenya?",
    answer:
      "Yes. The builder works with any job description, so you can tailor your CV for roles in Kenya, East Africa, elsewhere in Africa, or international markets.",
  },
  {
    question: "Does it create an ATS-friendly CV?",
    answer:
      "The builder analyzes the job description, helps align relevant keywords, and offers a clean ATS-friendly format. No tool can guarantee an ATS result, so review every generated CV before applying.",
  },
];

export default function KenyaPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold text-primary">
            Built in Nairobi, available across Kenya
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Free AI CV Builder in Kenya
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Create a professional, ATS-friendly CV for Kenyan or international
            opportunities. Tailor it to a job description, generate a matching
            cover letter, and export a polished PDF for free.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/builder">
                Build Your CV Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">Explore All Features</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6" aria-labelledby="kenya-features">
        <div className="mx-auto max-w-5xl">
          <h2 id="kenya-features" className="text-center text-3xl font-semibold">
            One CV builder for local and global opportunities
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Tailored to the vacancy",
                text: "Paste the role you want and align your real experience with the skills and keywords the employer requests.",
              },
              {
                icon: CheckCircle2,
                title: "ATS-friendly output",
                text: "Choose a clean format designed for readability, then review and export your finished CV as a PDF.",
              },
              {
                icon: Globe2,
                title: "Kenya to the world",
                text: "Use the same workflow for opportunities in Nairobi, across Kenya and East Africa, or with international employers.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title}>
                <CardContent className="p-6">
                  <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6" aria-labelledby="kenya-faq">
        <div className="mx-auto max-w-3xl">
          <h2 id="kenya-faq" className="text-3xl font-semibold">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
