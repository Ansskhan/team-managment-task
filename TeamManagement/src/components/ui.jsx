import { X } from 'lucide-react';

export const STATUS_STYLES = {
  todo: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};
export const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const PRIORITY_STYLES = {
  low: 'bg-sky-50 text-sky-700 ring-sky-200',
  medium: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
};
export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

export function Badge({ className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

/** Shared form field classes so every input looks consistent. */
export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50';

export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${btn} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus:ring-indigo-400`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-indigo-300`;
export const btnDanger = `${btn} border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 focus:ring-rose-300`;

/** Light-themed centered modal with backdrop + title bar. */
export function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Red inline error banner for form submissions. */
export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
      {error.errors?.length ? error.errors.join(' · ') : error.message}
    </div>
  );
}

/** Light empty-state placeholder with icon + hint. */
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      {Icon && <Icon size={28} className="text-slate-300" />}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="text-xs text-slate-400">{children}</p>
    </div>
  );
}
