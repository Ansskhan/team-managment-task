import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdSchema,
  taskQuerySchema,
  dueRemindersSchema,
} from '../validators/schemas.js';
import {
  createTask,
  listTasks,
  listDueTasks,
  updateTask,
  deleteTask,
} from '../controllers/tasks.controller.js';

const router = Router();

// All /tasks routes require a session
router.use(requireAuth);

// Reminder endpoint ("due date reminders" bonus) - matched before /:taskId
router.get('/due', validate(dueRemindersSchema, 'query'), listDueTasks);

router.get('/', validate(taskQuerySchema, 'query'), listTasks);
router.post('/', validate(createTaskSchema), createTask);

router.patch('/:taskId', validate(taskIdSchema, 'params'), validate(updateTaskSchema), updateTask);
router.delete('/:taskId', validate(taskIdSchema, 'params'), deleteTask);

export default router;
