import { useEffect, useState } from 'react';
import { Users, Plus, UserPlus, Trash2, LogOutIcon, Send } from 'lucide-react';
import api from '../api';
import {
  ErrorBanner,
  Modal,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
} from './ui';

function CreateTeamModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { team } = await api('/teams', { method: 'POST', body: { name, description } });
      onCreated(team);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a team" onClose={onClose}>
      <ErrorBanner error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="team-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Team name
          </label>
          <input
            id="team-name"
            className={inputClass}
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Frontend Squad"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="team-desc" className="mb-1.5 block text-sm font-medium text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="team-desc"
            className={inputClass}
            rows={3}
            maxLength={500}
            placeholder="What is this team about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Left sidebar.
 * - all teams I belong to, selectable
 * - create new team
 * - selected-team detail: members, add member (admins), invite stub,
 *   leave (members) / delete (team creator only, per role-based rule)
 */
export default function TeamsPanel({ teams, selectedId, onSelect, onRefresh, user }) {
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null); // { team, members }
  const [email, setEmail] = useState('');
  const [panelError, setPanelError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = teams.find((t) => t.id === selectedId);
  const isAdmin = selected?.myRole === 'admin';
  const isCreator = selected?.createdBy === (user?.id ?? null);

  /** load members of the selected team */
  const openDetail = async (teamId) => {
    if (!teamId) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await api(`/teams/${teamId}`));
    } catch (err) {
      setPanelError(err);
      setDetail(null);
    }
  };

  // (re)load members whenever the selection changes
  useEffect(() => {
    setPanelError(null);
    setNotice(null);
    openDetail(selectedId);
  }, [selectedId]);

  const addMember = async (e) => {
    e.preventDefault();
    setBusy(true);
    setPanelError(null);
    setNotice(null);
    try {
      await api(`/teams/${selectedId}/members`, { method: 'POST', body: { email } });
      setEmail('');
      setNotice(`${email} was added to the team`);
      await openDetail(selectedId);
      onRefresh();
    } catch (err) {
      setPanelError(err);
    } finally {
      setBusy(false);
    }
  };

  /** stubbed email invite - backend logs it and stores a token (bonus) */
  const sendInvite = async () => {
    setBusy(true);
    setPanelError(null);
    setNotice(null);
    try {
      await api(`/teams/${selectedId}/invites`, { method: 'POST', body: { email } });
      setNotice(`Invite logged for ${email} - they can register and be added`);
      setEmail('');
    } catch (err) {
      setPanelError(err);
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId) => {
    setPanelError(null);
    try {
      await api(`/teams/${selectedId}/members/${userId}`, { method: 'DELETE' });
      await openDetail(selectedId);
      onRefresh();
    } catch (err) {
      setPanelError(err);
    }
  };

  const deleteTeam = async () => {
    if (!confirm(`Delete "${selected.name}" and all its tasks? This cannot be undone.`)) return;
    setPanelError(null);
    try {
      await api(`/teams/${selectedId}`, { method: 'DELETE' });
      onSelect(null);
      onRefresh();
    } catch (err) {
      setPanelError(err);
    }
  };

  const leaveTeam = async () => {
    setPanelError(null);
    try {
      await api(`/teams/${selectedId}/members/${user?.id ?? null}`, { method: 'DELETE' });
      onSelect(null);
      onRefresh();
    } catch (err) {
      setPanelError(err);
    }
  };

  return (
    <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Users size={15} /> Teams
        </h2>
        <button
          onClick={() => setCreating(true)}
          title="Create team"
          aria-label="Create team"
          className="rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-50"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* team list */}
      <ul className="nice-scroll max-h-64 space-y-1 overflow-y-auto p-2">
        <li>
          <button
            onClick={() => {
              onSelect(null);
              setDetail(null);
            }}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
              !selectedId ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All teams
          </button>
        </li>
        {teams.map((team) => (
          <li key={team.id}>
            <button
              onClick={() => onSelect(team.id)}
              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                selectedId === team.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className={`block truncate text-sm ${
                  selectedId === team.id ? 'font-medium text-indigo-700' : 'text-slate-700'
                }`}
              >
                {team.name}
              </span>
              <span className="text-xs text-slate-400">
                {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                {team.myRole === 'admin' ? ' · admin' : ''}
              </span>
            </button>
          </li>
        ))}
        {teams.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-400">No teams yet — create one!</li>
        )}
      </ul>

      {/* selected team detail */}
      {selected && (
        <div className="border-t border-slate-100 px-4 py-4">
          <h3 className="truncate text-sm font-semibold text-slate-800">{selected.name}</h3>
          {selected.description && (
            <p className="mt-0.5 text-xs text-slate-500">{selected.description}</p>
          )}

          {panelError && (
            <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
              {panelError.errors?.length ? panelError.errors.join(' · ') : panelError.message}
            </div>
          )}

          {/* members */}
          <div className="mt-3 space-y-1.5">
            {detail === null && <p className="text-xs text-slate-400">Loading members…</p>}
            {(detail?.members ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">
                    {m.name}
                    {m.role === 'admin' && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase text-indigo-500">
                        admin
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">{m.email}</p>
                </div>
                {/* creator cannot be removed; admins remove others, anyone can leave */}
                {m.id !== detail.team.createdBy &&
                  (isAdmin || (m.id ?? null) === (user?.id ?? null)) && (
                    <button
                      onClick={() => removeMember(m.id)}
                      title={(m.id ?? null) === (user?.id ?? null) ? 'Leave team' : 'Remove member'}
                      className="rounded-md p-1 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      {(m.id ?? null) === (user?.id ?? null) ? <LogOutIcon size={13} /> : <Trash2 size={13} />}
                    </button>
                  )}
              </div>
            ))}
            {detail !== null && detail.members.length === 0 && (
              <p className="text-xs text-slate-400">No members.</p>
            )}
          </div>

          {notice && <p className="mt-2 text-xs text-emerald-600">{notice}</p>}

          {/* add member / send invite (admins only, backend enforces) */}
          {isAdmin && (
            <form onSubmit={addMember} className="mt-3">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  required
                  aria-label="Member email"
                  placeholder="member@email.com"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" disabled={busy} title="Add member to team" className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-700 disabled:opacity-50">
                  <UserPlus size={14} />
                </button>
                <button
                  type="button"
                  onClick={sendInvite}
                  disabled={busy}
                  title="Send invite by email (stubbed - no SMTP)"
                  className="rounded-lg border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">+ is invite a user not registered yet</p>
            </form>
          )}

          {/* destructive actions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {isCreator && (
              <button onClick={deleteTeam} className={`${btnDanger} !px-2.5 !py-1.5 !text-xs`}>
                <Trash2 size={13} /> Delete team
              </button>
            )}
            {!isCreator && (
              <button onClick={leaveTeam} className={`${btnSecondary} !px-2.5 !py-1.5 !text-xs`}>
                <LogOutIcon size={13} /> Leave team
              </button>
            )}
          </div>
        </div>
      )}

      {creating && (
        <CreateTeamModal
          onClose={() => setCreating(false)}
          onCreated={(team) => {
            setCreating(false);
            onRefresh();
            onSelect(team.id);
          }}
        />
      )}
    </aside>
  );
}
