import { ButtonLoader } from "../../components/ui/Loaders";
import type { ExamSlipKind } from "../../lib/exam-slip-types";

interface ExamSlipsPanelProps {
  busy: ExamSlipKind | null;
  onGenerate: (kind: ExamSlipKind) => void;
}

const panels: {
  kind: ExamSlipKind;
  title: string;
}[] = [
  {
    kind: "rollno",
    title: "Mid Term",
  },
  {
    kind: "clearance",
    title: "Clearance",
  },
];

function ActionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
      <path d="M6 6V3.5h8V6M6 14H4a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 4 7h12a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 16 14h-2M6 11h8v5.5H6V11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 9.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function ExamSlipsPanel({
  busy,
  onGenerate,
}: ExamSlipsPanelProps) {
  const isBusy = busy !== null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {panels.map((panel) => {
          const preparing = busy === panel.kind;
          return (
            <section
              key={panel.kind}
              aria-labelledby={`${panel.kind}-slip-heading`}
              className="card-3d flex flex-col p-5"
            >
              <div className="mb-4 border-b border-slate-200/80 pb-4 dark:border-slate-700/80">
                <h3
                  id={`${panel.kind}-slip-heading`}
                  className="text-base font-semibold text-slate-800 dark:text-white"
                >
                  {panel.title}
                </h3>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onGenerate(panel.kind)}
                  disabled={isBusy}
                  aria-label={`Generate and print ${panel.title}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                >
                  {preparing ? <ButtonLoader className="border-indigo-200/60 border-t-white" /> : <ActionIcon />}
                  <span>{preparing ? "Preparing print…" : "Generate / Print"}</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

    </div>
  );
}
