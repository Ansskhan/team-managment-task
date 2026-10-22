import Joi from 'joi';

// ---------------------------------------------------------------
// auth
// ---------------------------------------------------------------
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .required()
    .messages({ 'any.required': 'Email is required' }),
  password: Joi.string().min(8).max(100).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required()
    .messages({ 'any.required': 'Email is required' }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// ---------------------------------------------------------------
// teams
// ---------------------------------------------------------------
const teamFields = {
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().allow('').max(500),
};

export const createTeamSchema = Joi.object({
  name: teamFields.name.required().messages({
    'any.required': 'Team name is required',
  }),
  description: teamFields.description,
});

export const updateTeamSchema = Joi.object({
  name: teamFields.name,
  description: teamFields.description,
}).min(1); // at least one field to update

export const addMemberSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
});

export const teamIdSchema = Joi.object({
  teamId: Joi.string().uuid().required(),
});

export const teamMemberSchema = Joi.object({
  teamId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().required(),
});

// ---------------------------------------------------------------
// invites
// ---------------------------------------------------------------
export const createInviteSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
});

export const inviteTokenSchema = Joi.object({
  token: Joi.string().uuid().required(),
});

// ---------------------------------------------------------------
// tasks
// ---------------------------------------------------------------
const taskFields = {
  title: Joi.string().trim().min(2).max(255),
  description: Joi.string().trim().allow('').max(2000),
  status: Joi.string().valid('todo', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  assigneeId: Joi.string().uuid().allow(null),
  teamId: Joi.string().uuid(),
  dueDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
      'string.pattern.base': 'dueDate must be in YYYY-MM-DD format',
    }),
};

export const createTaskSchema = Joi.object({
  teamId: taskFields.teamId.required().messages({
    'any.required': 'teamId is required',
  }),
  title: taskFields.title.required().messages({
    'any.required': 'Title is required',
  }),
  description: taskFields.description,
  status: taskFields.status.default('todo'),
  priority: taskFields.priority.default('medium'),
  assigneeId: taskFields.assigneeId,
  dueDate: taskFields.dueDate,
});

export const updateTaskSchema = Joi.object(taskFields).min(1);

export const taskIdSchema = Joi.object({
  taskId: Joi.string().uuid().required(),
});

export const taskQuerySchema = Joi.object({
  teamId: Joi.string().uuid(),
  assigneeId: Joi.string().uuid(),
  status: Joi.string().valid('todo', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  q: Joi.string().trim().max(100),
  dueBefore: taskFields.dueDate,
  createdAfter: taskFields.dueDate,
});

export const dueRemindersSchema = Joi.object({
  days: Joi.number().integer().min(1).max(30).default(7),
});
