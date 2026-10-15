export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
