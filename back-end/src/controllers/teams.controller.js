import { query } from '../config/connection.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendInviteEmail } from '../utils/inviteEmail.js';

// ---------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------

const getMembership = async (teamId, userId) => {
  const [membership] = await query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId],
  );
  return membership ?? null;
};

const isTeamAdmin = (membership) => membership?.role === 'admin';

// ---------------------------------------------------------------
// GET /teams - teams the user belongs to
// ---------------------------------------------------------------
export const listTeams = asyncHandler(async (req, res) => {
  const teams = await query(
    `SELECT t.id, t.name, t.description, t.created_by AS "createdBy",
            t.created_at AS "createdAt", tm.role AS "myRole",
            (SELECT COUNT(*)::int FROM team_members m2 WHERE m2.team_id = t.id) AS "memberCount"
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY t.created_at DESC`,
    [req.user.id],
  );
  res.json({ teams });
});

// ---------------------------------------------------------------
// POST /teams - create team, creator joins as admin
// ---------------------------------------------------------------
export const createTeam = asyncHandler(async (req, res) => {
  const { name, description = '' } = req.body;

  const [team] = await query(
    'INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING id, name, description, created_by AS "createdBy", created_at AS "createdAt"',
    [name, description, req.user.id],
  );

  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'admin')",
    [team.id, req.user.id],
  );

  res.status(201).json({ team });
});

// ---------------------------------------------------------------
// GET /teams/:teamId - team detail with members
// ---------------------------------------------------------------
export const getTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }

  const [team] = await query(
    `SELECT t.id, t.name, t.description, t.created_by AS "createdBy",
            t.created_at AS "createdAt", u.name AS "creatorName"
       FROM teams t JOIN users u ON u.id = t.created_by
      WHERE t.id = $1`,
    [teamId],
  );
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const members = await query(
    `SELECT u.id, u.name, u.email, tm.role, tm.joined_at AS "joinedAt"
       FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at`,
    [teamId],
  );

  return res.json({ team, members });
});

// ---------------------------------------------------------------
// PATCH /teams/:teamId - admins only
// ---------------------------------------------------------------
export const updateTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;
  const { name, description } = req.body;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }
  if (!isTeamAdmin(membership)) {
    return res.status(403).json({ message: 'Only team admins can update the team' });
  }

  const [team] = await query(
    `UPDATE teams
        SET name = COALESCE($2, name),
            description = COALESCE($3, description)
      WHERE id = $1
      RETURNING id, name, description, created_by AS "createdBy", created_at AS "createdAt"`,
    [teamId, name ?? null, description ?? null],
  );
  if (!team) return res.status(404).json({ message: 'Team not found' });

  return res.json({ team });
});

// ---------------------------------------------------------------
// DELETE /teams/:teamId - creator only (role-based bonus)
// ---------------------------------------------------------------
export const deleteTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }

  const [team] = await query(
    'SELECT created_by FROM teams WHERE id = $1',
    [teamId],
  );
  if (!team) return res.status(404).json({ message: 'Team not found' });

  if (team.created_by !== req.user.id) {
    return res.status(403).json({ message: 'Only the team creator can delete this team' });
  }

  await query('DELETE FROM teams WHERE id = $1', [teamId]);
  return res.json({ message: 'Team deleted' });
});

// ---------------------------------------------------------------
// POST /teams/:teamId/members - admins add members by email
// ---------------------------------------------------------------
export const addMember = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;
  const { email } = req.body;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }
  if (!isTeamAdmin(membership)) {
    return res.status(403).json({ message: 'Only team admins can add members' });
  }

  const [targetUser] = await query(
    'SELECT id, name, email FROM users WHERE email = $1',
    [email],
  );
  if (!targetUser) {
    return res.status(404).json({
      message: 'No user found with that email - they must register first',
    });
  }

  const already = await getMembership(teamId, targetUser.id);
  if (already) {
    return res.status(409).json({ message: 'User is already a team member' });
  }

  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')",
    [teamId, targetUser.id],
  );
  // Any pending invite for this email is now fulfilled
  await query(
    "UPDATE invites SET status = 'accepted' WHERE team_id = $1 AND email = $2 AND status = 'pending'",
    [teamId, email],
  );

  return res.status(201).json({
    member: { ...targetUser, role: 'member' },
  });
});

// ---------------------------------------------------------------
// DELETE /teams/:teamId/members/:userId
// admins can remove anyone but the creator; members can only leave
// ---------------------------------------------------------------
export const removeMember = asyncHandler(async (req, res) => {
  const { teamId, userId } = req.validatedParams;

  const [team] = await query(
    'SELECT created_by FROM teams WHERE id = $1',
    [teamId],
  );
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const targetMembership = await getMembership(teamId, userId);
  if (!targetMembership) {
    return res.status(404).json({ message: 'User is not a member of this team' });
  }
  if (team.created_by === userId) {
    return res.status(403).json({ message: 'The team creator cannot be removed' });
  }

  const myMembership = await getMembership(teamId, req.user.id);
  const selfRemoval = userId === req.user.id;
  if (!selfRemoval && !isTeamAdmin(myMembership)) {
    return res.status(403).json({ message: 'Only team admins can remove other members' });
  }

  await query(
    'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId],
  );

  return res.json({ message: selfRemoval ? 'You left the team' : 'Member removed' });
});

// ---------------------------------------------------------------
// POST /teams/:teamId/invites - admins invite by email (stubbed)
// ---------------------------------------------------------------
export const createInvite = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;
  const { email } = req.body;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }
  if (!isTeamAdmin(membership)) {
    return res.status(403).json({ message: 'Only team admins can send invites' });
  }

  const [team] = await query('SELECT name FROM teams WHERE id = $1', [teamId]);
  if (!team) return res.status(404).json({ message: 'Team not found' });

  const [invite] = await query(
    'INSERT INTO invites (team_id, email, invited_by) VALUES ($1, $2, $3) RETURNING id, email, token, status, created_at AS "createdAt"',
    [teamId, email, req.user.id],
  );

  // Stubbed email - logged, never sent
  sendInviteEmail({
    email,
    teamName: team.name,
    inviterName: req.user.name,
    token: invite.token,
  });

  return res.status(201).json({ invite });
});

// ---------------------------------------------------------------
// GET /teams/:teamId/invites - admins list pending invites
// ---------------------------------------------------------------
export const listInvites = asyncHandler(async (req, res) => {
  const { teamId } = req.validatedParams;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this team' });
  }
  if (!isTeamAdmin(membership)) {
    return res.status(403).json({ message: 'Only team admins can view invites' });
  }

  const invites = await query(
    'SELECT id, email, status, created_at AS "createdAt" FROM invites WHERE team_id = $1 ORDER BY created_at DESC',
    [teamId],
  );
  return res.json({ invites });
});

// ---------------------------------------------------------------
// POST /teams/invites/:token/accept - invited user joins on login
// ---------------------------------------------------------------
export const acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.validatedParams;

  const [invite] = await query('SELECT * FROM invites WHERE token = $1', [token]);
  if (!invite) return res.status(404).json({ message: 'Invite not found' });
  if (invite.email !== req.user.email) {
    return res.status(403).json({ message: 'This invite was sent to a different email address' });
  }
  if (invite.status !== 'pending') {
    return res.status(409).json({ message: 'Invite already used or revoked' });
  }

  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
    [invite.team_id, req.user.id],
  );
  await query("UPDATE invites SET status = 'accepted' WHERE id = $1", [invite.id]);

  const [team] = await query('SELECT id, name FROM teams WHERE id = $1', [
    invite.team_id,
  ]);

  return res.json({ message: `You joined ${team.name}`, team });
});
