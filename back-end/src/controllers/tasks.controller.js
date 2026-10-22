import { query } from '../config/connection.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const taskSelect = `
  SELECT t.id, t.title, t.description, t.status, t.priority,
         t.due_date::text AS "dueDate", t.team_id AS "teamId",
         t.assignee_id AS "assigneeId", t.created_by AS "createdBy",
         t.created_at AS "createdAt", t.updated_at AS "updatedAt",
         a.name  AS "assigneeName",
         tm.name AS "teamName"
    FROM tasks t
    LEFT JOIN users  a  ON a.id  = t.assignee_id
    LEFT JOIN teams  tm ON tm.id = t.team_id
`;

const getMembership = async (teamId, userId) => {
  const [membership] = await query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId],
  );
  return membership ?? null;
};

// ---------------------------------------------------------------
// POST /tasks - create and (optionally) assign within a team
// ---------------------------------------------------------------
export const createTask = asyncHandler(async (req, res) => {
  const {
    teamId, title, description = '', status, priority,
    assigneeId = null, dueDate = null,
  } = req.body;

  const membership = await getMembership(teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You can only create tasks in teams you belong to' });
  }

  if (assigneeId) {
    const assigneeIsMember = await getMembership(teamId, assigneeId);
    if (!assigneeIsMember) {
      return res.status(422).json({ message: 'Assignee is not a member of this team' });
    }
  }

  const [task] = await query(
    `INSERT INTO tasks (team_id, title, description, status, priority, assignee_id, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, description, status, priority, due_date::text AS "dueDate",
               team_id AS "teamId", assignee_id AS "assigneeId", created_by AS "createdBy",
               created_at AS "createdAt"`,
    [teamId, title, description, status, priority, assigneeId, dueDate, req.user.id],
  );

  return res.status(201).json({ task });
});

// ---------------------------------------------------------------
// GET /tasks?teamId=&assigneeId=&status=&priority=&q=
// Tasks across the user's teams; filters narrow further
// ---------------------------------------------------------------
export const listTasks = asyncHandler(async (req, res) => {
  const { teamId, assigneeId, status, priority, q, dueBefore, createdAfter } =
    req.validatedQuery;

  const conditions = [];
  const values = [];

  // Restrict to teams the user belongs to
  values.push(req.user.id);
  let sql = `${taskSelect}
    JOIN team_members tmf ON tmf.team_id = t.team_id AND tmf.user_id = $${values.length}`;

  if (teamId) {
    values.push(teamId);
    conditions.push(`t.team_id = $${values.length}`);
  }
  if (assigneeId) {
    values.push(assigneeId);
    conditions.push(`t.assignee_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (priority) {
    values.push(priority);
    conditions.push(`t.priority = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`t.title ILIKE $${values.length}`);
  }
  if (dueBefore) {
    values.push(dueBefore);
    conditions.push(`t.due_date <= $${values.length}`);
  }
  if (createdAfter) {
    values.push(createdAfter);
    conditions.push(`t.created_at >= $${values.length}::timestamptz`);
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY t.created_at DESC';

  const tasks = await query(sql, values);
  return res.json({ tasks, count: tasks.length });
});

// ---------------------------------------------------------------
// GET /tasks/due?days=N - due-date reminder list (bonus, login only)
// Tasks assigned to the logged-in user, due within N days, not done
// ---------------------------------------------------------------
export const listDueTasks = asyncHandler(async (req, res) => {
  const { days } = req.validatedQuery;

  const tasks = await query(
    `${taskSelect}
      WHERE t.assignee_id = $1
        AND t.status <> 'done'
        AND t.due_date IS NOT NULL
        AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 || ' days')::interval
      ORDER BY t.due_date ASC`,
    [req.user.id, String(days)],
  );

  return res.json({ days, count: tasks.length, tasks });
});

// ---------------------------------------------------------------
// PATCH /tasks/:taskId - team members can update/assign their tasks
// ---------------------------------------------------------------
export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.validatedParams;
  const { title, description, status, priority, assigneeId, dueDate } = req.body;

  const [task] = await query(
    `${taskSelect} WHERE t.id = $1`,
    [taskId],
  );
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const membership = await getMembership(task.teamId, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this task\'s team' });
  }

  if (assigneeId) {
    const assigneeIsMember = await getMembership(task.teamId, assigneeId);
    if (!assigneeIsMember) {
      return res.status(422).json({ message: 'Assignee is not a member of this team' });
    }
  }

  const updates = [];
  const values = [taskId];
  const addUpdate = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (title !== undefined) addUpdate('title', title);
  if (description !== undefined) addUpdate('description', description);
  if (status !== undefined) addUpdate('status', status);
  if (priority !== undefined) addUpdate('priority', priority);
  if (assigneeId !== undefined) addUpdate('assignee_id', assigneeId);
  if (dueDate !== undefined) addUpdate('due_date', dueDate);
  addUpdate('updated_at', new Date());

  await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $1`, values);

  // return the fresh row, not the snapshot taken before the update
  const [updated] = await query(`${taskSelect} WHERE t.id = $1`, [taskId]);
  return res.json({ task: updated });
});

// ---------------------------------------------------------------
// DELETE /tasks/:taskId - team members can delete their team's tasks
// ---------------------------------------------------------------
export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.validatedParams;

  const [task] = await query(
    'SELECT id, team_id FROM tasks WHERE id = $1',
    [taskId],
  );
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const membership = await getMembership(task.team_id, req.user.id);
  if (!membership) {
    return res.status(403).json({ message: 'You are not a member of this task\'s team' });
  }

  await query('DELETE FROM tasks WHERE id = $1', [taskId]);
  return res.json({ message: 'Task deleted' });
});
