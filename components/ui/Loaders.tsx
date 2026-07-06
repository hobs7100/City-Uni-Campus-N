"use client";

/**
 * Modern, pure-CSS loader library (cssloaders.github.io-inspired).
 * Each loader is purpose-built for a specific UI context.
 */

export function RingLoader({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border-[3px] border-indigo-200/60 border-t-indigo-600 dark:border-indigo-900/60 dark:border-t-indigo-400 ${className}`}
      style={{
        width: size,
        height: size,
        animation: "loader-ring-spin 0.7s linear infinite",
      }}
    />
  );
}

export function OrbitLoader({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        width: size,
        height: size,
        animation: "loader-orbit-spin 1.1s linear infinite",
      }}
    >
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-indigo-500" />
      <span
        className="absolute inset-[6px] rounded-full border-2 border-transparent border-b-fuchsia-500"
        style={{ animation: "loader-orbit-spin 0.7s linear infinite reverse" }}
      />
    </span>
  );
}

export function CubeLoader({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block grad-primary ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        animation:
          "loader-cube-flip 1.6s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite",
      }}
    />
  );
}

export function GooeyLoader({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full grad-cyan"
          style={{
            animation: `loader-gooey-bounce 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

export function EllipsisLoader({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400"
          style={{
            animation: `loader-ellipsis-bounce 1.1s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

export function PuffLoader({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full border-2 border-indigo-500"
        style={{ animation: "loader-puff-1 1s ease-in-out infinite" }}
      />
      <span
        className="absolute inset-0 rounded-full border-2 border-cyan-500"
        style={{ animation: "loader-puff-2 1s ease-in-out infinite" }}
      />
    </span>
  );
}

export function LineScaleLoader({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-end gap-1 ${className}`}
      style={{ height: 22 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-1 rounded-full grad-primary"
          style={{
            height: "100%",
            animation: `loader-scale-pulse 1s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Full-page loader — shown while an entire route/page is loading. */
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4">
      <OrbitLoader size={56} />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

/** Inline loader for buttons — small ring that sits beside/instead of a label. */
export function ButtonLoader({ className = "" }: { className?: string }) {
  return <RingLoader size={16} className={className} />;
}

/** Loader for form submission overlays. */
export function FormLoader({ label = "Saving..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <GooeyLoader />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

/** Loader for async data fetching within a card/section. */
export function DataFetchLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <CubeLoader />
      {label && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      )}
    </div>
  );
}

/** Loader for table bodies — spans full width within a <tbody>. */
export function TableLoader({
  colSpan = 1,
  label = "Loading data...",
}: {
  colSpan?: number;
  label?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <LineScaleLoader />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {label}
          </span>
        </div>
      </td>
    </tr>
  );
}

/** Loader for modal bodies while content/data loads. */
export function ModalLoader({ label = "Please wait..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <PuffLoader size={44} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

/** Skeleton shimmer block — for content placeholders. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-lg ${className}`} />;
}
