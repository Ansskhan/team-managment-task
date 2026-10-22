import { useEffect, useState } from 'react';
import { Users, Circle, CircleDot, CircleCheck, Clock, Trash2 } from 'lucide-react';
import { btnDanger, btnPrimary, btnSecondary, EmptyState, ErrorBanner, inputClass, Modal, selectClass } from './ui';
import api from '../api';

export const STATUS_STYLE = {
  todo: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export const PRIORITY_STYLE = {
  low: 'bg-sky-50 text-sky-700 ring-sky-200',
  medium: 'bg-orange-50 text-orange-700 ring-orange-200',
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function statusIcon(status) {
  if (status === 'done') {
    return <CircleCheck size={16} className="text-emerald-500" />;
  }
  if (status === 'in_progress') {
    return <CircleDot size={16} className="text-amber-500" />;
  }
  return <Circle size={16} className="text-slate-300" />;
}

/** next status in the quick cycle todo -> in_progress -> done -> todo */
const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

/**
 * Right column.
 * - team + assignee + status filters (assigned from Dashboard)
 * - full task cards for the current team ("All teams" = every team)
 */
export default function TaskList({ tasks, loading, error, filters, onRefresh }) {
  const filterRows = [
    {
      id: 'teamId',
      label: 'Team',
      value: filters.teamId,
      onChange: (v) => {
        filters.setTeamId(v);
        filters.setAssigneeId('');
      },
      allLabel: 'All teams',
      options: filters.teams.map((t) => ({ value: t.id, label: t.name })),
    },
    {
      id: 'assigneeId',
      label: 'Assignee',
      value: filters.assigneeId,
      onChange: filters.setAssigneeId,
      allLabel: 'Anyone',
      options: filters.members.map((m) => ({ value: m.id, label: m.name })),
    },
    {
      id: 'status',
      label: 'Status',
      value: filters.status,
      onChange: filters.setStatus,
      allLabel: 'Any status',
      options: [
        { value: 'todo', label: 'To do' },
        { value: 'in_progress', label: 'In progress' },
        { value: 'done', label: 'Done' },
      ],
    },
  ];

  return (
    <section className="min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* filter row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        {filterRows.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <label
              htmlFor={`filter-${row.id}`}
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {row.label}
            </label>
            <select
              id={`filter-${row.id}`}
              value={row.value}
              onChange={(e) => row.onChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">{row.allLabel}</option>
              {row.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="grow" />
        <button onClick={() => onRefresh()} className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {/* list */}
      <div className="nice-scroll max-h-[calc(100vh-230px)] space-y-2.5 overflow-y-auto p-4">
        {error && <ErrorBanner error={error} />}
        {loading && <p className="py-6 text-center text-sm text-slate-400">Loading tasks…</p>}
        {!loading && !error && tasks.length === 0 && (
          <EmptyState icon={Users} title="No tasks here yet">
            {filters.teamId ? 'Create one with the + button.' : 'Select a team and add your first task.'}
          </EmptyState>
        )}
        {!loading &&
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
          ))}
      </div>
    </section>
  );
}

function TaskCard({ task: t, onRefresh }) {
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false); // detail visibility
  const [editing, setEditing] = useState(false);

  // any team member may edit; backend enforces membership
  const patch = async (body) => {
    setError(null);
    try {
      await api(`/tasks/${t.id}`, { method: 'PATCH', body });
      onRefresh();
    } catch (err) {
      setError(err);
    }
  };

  const cycleStatus = () => patch({ status: NEXT_STATUS[t.status] ?? 'todo' });
  const remove = async () => {
    if (!confirm(`Delete the task "${t.title}"?`)) return;
    try {
      await api(`/tasks/${t.id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      setError(err);
    }
  };

  const openModal = () => {
    setEditing(true);
    setOpen(true);
  };

  return (
    <article className="rounded-xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-slate-300">
      <div className="flex items-start gap-2.5">
        <button onClick={cycleStatus} title="Cycle status (todo → in progress → done)" className="mt-0.5 shrink-0">
          {statusIcon(t.status)}
        </button>

        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={`min-w-0 grow truncate text-sm font-semibold text-slate-800 ${t.status === 'done' ? 'text-slate-400 line-through' : ''}`}>
              {t.title}
            </h3>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_STYLE[t.status]}`}>
              {t.status === 'in_progress' ? 'in progress' : t.status}
            </span>
            {t.priority === 'high' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${PRIORITY_STYLE.high}`}>
                high
              </span>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users size={11} /> {t.teamName ?? '—'}
            </span>
            {t.assigneeName ? (
              <span>
                for <span className="font-medium text-slate-600">{t.assigneeName}</span>
              </span>
            ) : (
              <span className="italic text-slate-400">unassigned</span>
            )}
            {t.dueDate && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> {t.dueDate}
              </span>
            )}
          </p>

          <button onClick={() => setOpen(!open)} className="mt-0.5 text-[11px] font-medium text-indigo-600 hover:underline">
            {open ? 'Hide' : 'Show details'}
          </button>

          {open && (
            <div className="mt-1.5 border-t border-slate-100 pt-2">
              {error && <ErrorBanner error={error} />}
              {editing ? (
                <TaskModal
                  task={t}
                  initialTeamId={t.teamId}
                  onClose={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    onRefresh();
                  }}
                />
              ) : (
                <>
                  <p className="text-xs leading-5 text-slate-600">
                    {t.description || <span className="italic text-slate-400">No description</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400">
                    <button onClick={openModal} className={btnSecondary + ' !px-2 !py-1'}>
                      Edit
                    </button>
                    <button onClick={remove} className={btnDanger + ' !px-2 !py-1'}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * create / update a task
 * - team + title always required; description/priority/assignee/dueDate optional
 * - assignee select lists the chosen team's members
 */
export function TaskModal({ task = null, initialTeamId = '', teams = [], onClose, onSaved }) {
  const [teamId, setTeamId] = useState(task?.teamId ?? initialTeamId ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [priority, setPriority] = useState(task?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // need the members of the selected team for the assignee dropdown
  // when creating for a team other than the auto-selected one
  const [loadedTeam, setLoadedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState(null);
  useEffect(() => {
    if (!teamId) {
      setTeamMembers(null);
      setLoadedTeam(null);
      return;
    }
    if (teamId === loadedTeam) return;
    setLoadedTeam(teamId);
    api(`/teams/${teamId}`)
      .then((d) => setTeamMembers(d.members))
      .catch(() => setTeamMembers(null));
  }, [teamId, loadedTeam]);

  const isEdit = Boolean(task);
  const assignedPeople = teamMembers ?? [];

  const submit = async (e) => {
    e.preventDefault();
    if (!teamId) {
      setError({ message: 'Choose a team first' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await api(`/tasks/${task.id}`, {
          method: 'PATCH',
          body: {
            title,
            description,
            status,
            priority,
            assigneeId: assigneeId || null,
            dueDate: dueDate || null,
          },
        });
      } else {
        await api('/tasks', {
          method: 'POST',
          body: {
            teamId,
            title,
            description,
            status,
            priority,
            assigneeId: assigneeId || null,
            dueDate: dueDate || null,
          },
        });
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit task' : 'New task'} onClose={onClose}>
      <ErrorBanner error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className={isEdit ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3'}>
          <div>
            <label htmlFor="t-team" className="mb-1.5 block text-sm font-medium text-slate-700">
              Team
            </label>
            <select
              id="t-team"
              className={selectClass}
              value={teamId}
              disabled={isEdit}
              onChange={(e) => setTeamId(e.target.value)}
              required
            >
              <option value="">Choose a team</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="t-assignee" className="mb-1.5 block text-sm font-medium text-slate-700">
              Assignee
            </label>
            <select
              id="t-assignee"
              className={selectClass}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignedPeople?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="t-title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="t-title"
            className={inputClass}
            required
            minLength={2}
            maxLength={200}
            placeholder="Ship the landing page"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="t-desc" className="mb-1.5 block text-sm font-medium text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="t-desc"
            className={inputClass}
            rows={3}
            placeholder="Details, links, acceptance criteria…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="t-status" className="mb-1.5 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="t-status"
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label htmlFor="t-priority" className="mb-1.5 block text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              id="t-priority"
              className={selectClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label htmlFor="t-due" className="mb-1.5 block text-sm font-medium text-slate-700">
              Due date
            </label>
            <input
              id="t-due"
              type="date"
              className={selectClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Saving…' : isEdit ? 'Save task' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
