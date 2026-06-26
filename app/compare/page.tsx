import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";
import { Skeleton } from "@/components/ui";

export default function ComparePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cross-Exchange Comparison</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Compare the same market on Polymarket and Kalshi — probability history, live spread,
          order books, and side-by-side resolution rules.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
        <CompareView />
      </Suspense>
    </div>
  );
}
