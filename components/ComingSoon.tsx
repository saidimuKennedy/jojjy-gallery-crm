import { ReactNode } from "react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm text-ink-600 max-w-xl">{description}</p>
      ) : null}
      <div className="mt-10 rounded-lg border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-ink-800">Coming soon</p>
        <p className="mt-1 text-sm text-ink-500">
          CRUD for this section will land here.
        </p>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-ink-600 max-w-xl">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
