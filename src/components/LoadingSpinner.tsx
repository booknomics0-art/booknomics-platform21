/**
 * Full-page loading spinner used as Suspense fallback.
 * Prevents the blank-screen flash while code-split chunks load.
 */
export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground font-serif">Loading…</p>
    </div>
  </div>
);

/**
 * Inline loading spinner for sections.
 */
export const Spinner = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center justify-center py-8 ${className}`}>
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 rounded-full border-3 border-muted" />
      <div className="absolute inset-0 rounded-full border-3 border-primary border-t-transparent animate-spin" />
    </div>
  </div>
);
