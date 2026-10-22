import { useCallback, useEffect, useState } from 'react';
import { Plus, Bell } from 'lucide-react';
import api from '../api';
import TeamsPanel from '../components/TeamsPanel';
import TaskList, { TaskModal } from '../components/TaskList';
import { ErrorBanner, btnPrimary } from '../components/ui';

export default function Dashboard({ user }) {
  // data
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]); // assignee filter options
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(null);
  const [pageError, setPageError] = useState(null);
  const [dueCount, setDueCount] = useState(0);

  // task filters
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');

  // modals
  const [creatingTask, setCreatingTask] = useState(false);

  /** teams the user belongs to */
  const loadTeams = useCallback(async () => {
    try {
      const { teams: list } = await api('/teams');
      setTeams(list);
    } catch (err) {
      setPageError(err);
    }
  }, []);

  /** tasks, respecting the current filters */
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);
      if (assigneeId) params.set('assigneeId', assigneeId);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (q) params.set('q', q);
      const qs = params.toString();
      const { tasks: list } = await api(`/tasks${qs ? `?${qs}` : ''}`);
      setTasks(list);
    } catch (err) {
      setTasksError(err);
    } finally {
      setTasksLoading(false);
    }
  }, [teamId, assigneeId, status, priority, q]);

  /** members of the selected team -> assignee filter options */
  const loadMembers = useCallback(async () => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    try {
      const { members: list } = await api(`/teams/${teamId}`);
      setMembers(list);
    } catch {
      setMembers([]);
    }
  }, [teamId]);

  /** reminders badge (bonus): tasks due within 7 days */
  const loadDue = useCallback(async () => {
    try {
      const { count } = await api('/tasks/due?days=7');
      setDueCount(count);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadTeams();
    loadDue();
  }, [loadTeams, loadDue]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // debounce search typing
  useEffect(() => {
    const t = setTimeout(loadTasks, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadTasks, q]);

  const refreshAll = useCallback(() => {
    loadTeams();
    loadTasks();
    loadMembers();
    loadDue();
  }, [loadTeams, loadTasks, loadMembers, loadDue]);

  const selectedTeam = teams.find((t) => t.id === teamId) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      {/* header */}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="grow text-xl font-bold text-slate-800">
          {selectedTeam ? (
            <>
              <span className="text-indigo-600">{selectedTeam.name}</span>
              <span className="text-slate-400"> — tasks</span>
            </>
          ) : (
            'All my tasks'
          )}
        </h1>
        <span
          title="Assigned tasks due within 7 days"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            dueCount > 0
              ? 'bg-amber-50 text-amber-700 ring-amber-200'
              : 'bg-slate-50 text-slate-500 ring-slate-200'
          }`}
        >
          <Bell size={12} /> {dueCount} due this week
        </span>
        <button onClick={() => setCreatingTask(true)} className={btnPrimary}>
          <Plus size={15} /> New task
        </button>
      </header>

      {pageError && <ErrorBanner error={pageError} />}

      {/* main split: teams sidebar + task list */}
      <div className="grid min-h-0 grow grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <TeamsPanel
          teams={teams}
          selectedId={teamId}
          onSelect={(id) => {
            setTeamId(id ?? '');
            setAssigneeId('');
          }}
          onRefresh={refreshAll}
          user={user}
        />
        <div className="flex min-w-0 flex-col gap-2">
          {/* search box row */}
          <div className="flex gap-2">
            <input
              type="search"
              aria-label="Search task titles"
              placeholder="Search tasks by title…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="Priority filter"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Any priority</option>
              <option value="low">Low </option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <TaskList
            tasks={tasks}
            loading={tasksLoading}
            error={tasksError}
            filters={{ teamId, setTeamId, assigneeId, setAssigneeId, status, setStatus, teams, members }}
            onRefresh={refreshAll}
            user={user}
          />
        </div>
      </div>

      {creatingTask && (
        <TaskModal
          teams={teams}
          members={members}
          initialTeamId={teamId}
          onClose={() => setCreatingTask(false)}
          onSaved={() => {
            setCreatingTask(false);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
