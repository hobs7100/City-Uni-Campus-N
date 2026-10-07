import { ButtonLoader } from "../../components/ui/Loaders";
import type { ExamSlipKind } from "../../lib/exam-slip-types";

type ExamSlipAction = "print" | "pdf";

interface ExamSlipsPanelProps {
  threshold: number;
  busy: { kind: ExamSlipKind; action: ExamSlipAction } | null;
  onGenerate: (kind: ExamSlipKind, action: ExamSlipAction) => void;
}

const panels: {
  kind: ExamSlipKind;
  title: string;
  description: string;
  specialCriteria: string;
}[] = [
  {
    kind: "rollno",
    title: "Mid Term Roll Number Slip",
    description:
      "Your mid-term slip includes the theory and practical date sheet, with course attendance annotations.",
    specialCriteria:
      "Requires the current semester's Mid Exam Date Sheet to be published. Courses below 75% attendance are marked Not Allowed for Mid Exam on the slip.",
  },
  {
    kind: "clearance",
    title: "Final Term Clearance Slip",
    description:
      "Your clearance slip lists all current-semester enrolled courses, including practical courses.",
    specialCriteria:
      "Does not require a Mid Exam Date Sheet and does not apply teacher-attendance course block labels.",
  },
];

function ActionIcon({ action }: { action: ExamSlipAction }) {
  return action === "print" ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
      <path d="M6 6V3.5h8V6M6 14H4a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 4 7h12a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 16 14h-2M6 11h8v5.5H6V11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 9.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
      <path d="M10 2.75v9m0 0 3.5-3.5M10 11.75l-3.5-3.5M3.5 13.25v2A1.75 1.75 0 0 0 5.25 17h9.5a1.75 1.75 0 0 0 1.75-1.75v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExamSlipsPanel({
  threshold,
  busy,
  onGenerate,
}: ExamSlipsPanelProps) {
  const isBusy = busy !== null;
  const thresholdLabel = Number.isFinite(threshold) ? `${threshold}%` : "the required threshold";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Exam Slips</h2>
      </div>

      <section
        aria-labelledby="exam-slip-eligibility-heading"
        className="card-3d p-5"
      >
        <h3
          id="exam-slip-eligibility-heading"
          className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Shared eligibility requirements
        </h3>
        <ul className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          <li>
            Enrollment must be Active or Permanent Leave, and an uploaded profile photo is required.
          </li>
          <li>
            Overall daily attendance must meet the {thresholdLabel} threshold. Attendance is
             confirmed by the Coordinator, Assistant, or Admin. Active/permanent-leave students
             within the first 15 evaluable days of their current attendance window are exempt
             from the attendance threshold; an Admin override is also supported.
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {panels.map((panel) => {
          const currentAction = busy?.kind === panel.kind ? busy.action : null;
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
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {panel.description}
                </p>
              </div>
              <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {panel.specialCriteria}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onGenerate(panel.kind, "print")}
                  disabled={isBusy}
                  aria-label={`Generate and print ${panel.title}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                >
                  {currentAction === "print" ? <ButtonLoader className="border-indigo-200/60 border-t-white" /> : <ActionIcon action="print" />}
                  <span>{currentAction === "print" ? "Preparing print…" : "Generate / Print"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onGenerate(panel.kind, "pdf")}
                  disabled={isBusy}
                  aria-label={`Download PDF ${panel.title}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20 dark:focus-visible:ring-offset-slate-900"
                >
                  {currentAction === "pdf" ? <ButtonLoader /> : <ActionIcon action="pdf" />}
                  <span>{currentAction === "pdf" ? "Preparing PDF…" : "Download PDF"}</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Generate / Print opens the browser print dialog, where you can choose a printer or save
        as PDF. Download PDF creates a PDF file directly.
      </p>
    </div>
  );
}
