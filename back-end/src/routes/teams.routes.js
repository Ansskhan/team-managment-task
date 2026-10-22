import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamSchema,
  updateTeamSchema,
  addMemberSchema,
  createInviteSchema,
  teamIdSchema,
  teamMemberSchema,
  inviteTokenSchema,
} from '../validators/schemas.js';
import {
  listTeams,
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  createInvite,
  listInvites,
  acceptInvite,
} from '../controllers/teams.controller.js';

const router = Router();

// All /teams routes require a session
router.use(requireAuth);

router.get('/', listTeams);
router.post('/', validate(createTeamSchema), createTeam);

// Invite accept is matched before /:teamId so the token is not mistaken for a team id
router.post('/invites/:token/accept', validate(inviteTokenSchema, 'params'), acceptInvite);

router.get('/:teamId', validate(teamIdSchema, 'params'), getTeam);
router.patch('/:teamId', validate(teamIdSchema, 'params'), validate(updateTeamSchema), updateTeam);
router.delete('/:teamId', validate(teamIdSchema, 'params'), deleteTeam);

// members
router.post('/:teamId/members', validate(teamIdSchema, 'params'), validate(addMemberSchema), addMember);
router.delete(
  '/:teamId/members/:userId',
  validate(teamMemberSchema, 'params'),
  removeMember,
);

// invites (stubbed email)
router.post('/:teamId/invites', validate(teamIdSchema, 'params'), validate(createInviteSchema), createInvite);
router.get('/:teamId/invites', validate(teamIdSchema, 'params'), listInvites);

export default router;
