import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-zinc-50 to-white">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-zinc-200 mb-4">404</div>
        <h1 className="text-2xl font-semibold text-zinc-800 mb-3">
          Page not found
        </h1>
        <p className="text-zinc-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-medium rounded-md bg-slate-800 text-white hover:bg-slate-700 shadow-lg transition-all duration-200"
        >
          Back to CV Builder
        </Link>
      </div>
    </div>
  );
}
