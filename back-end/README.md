# Team Task Manager API (backend)

Express 5 + PostgreSQL REST API for the Team Task Manager assessment:
secure register/login (PassportJS + express-session in PostgreSQL),
team management, and task CRUD with search/filters.

## Stack

- Node.js + Express 5
- PostgreSQL (`pg`), sessions via `connect-pg-simple` (memory fallback in dev)
- PassportJS local strategy, `bcrypt` password hashing
- Validation & sanitization via `joi` middleware on every mutating route

## Setup

```bash
cd back-end
npm install
cp .env.example .env      # then edit database credentials + secret
npm run db:init           # creates team_task_manager database + tables
npm run dev               # http://localhost:5000
```

Health check: `GET http://localhost:5000/health`

## Environment variables

| Variable         | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `PORT`           | API port (default 5000)                             |
| `NODE_ENV`       | `production` enables secure cookies / HTTPS         |
| `DATABASE_URL`   | Postgres connection string (local or GCP Cloud SQL) |
| `SESSION_SECRET` | Cookie-signing secret                               |
| `CLIENT_ORIGIN`  | Frontend URL allowed to send cookies (CORS)         |

## API

All routes except `/health` and `/auth/*` require an authenticated session (HTTP-only cookie `ttm.sid`).

### Auth
| Method | Route            | Description                       |
| ------ | ---------------- | --------------------------------- |
| POST   | `/auth/register` | Register (auto-login)             |
| POST   | `/auth/login`    | Login                             |
| POST   | `/auth/logout`   | Logout, destroys session          |
| GET    | `/auth/me`       | Current user (or `null`)          |

### Teams
| Method | Route                          | Description                                    |
| ------ | ------------------------------ | ---------------------------------------------- |
| GET    | `/teams`                       | Teams I belong to                              |
| POST   | `/teams`                       | Create team (creator joins as admin)           |
| GET    | `/teams/:teamId`               | Team detail + members                          |
| PATCH  | `/teams/:teamId`               | Update name/description (admin only)           |
| DELETE | `/teams/:teamId`               | Delete team (**creator only** - role-based)    |
| POST   | `/teams/:teamId/members`       | Add member by email (admin only)               |
| DELETE | `/teams/:teamId/members/:userId` | Remove member (admin) / leave (self)         |

### Invites (bonus - stubbed email)
| Method | Route                              | Description                            |
| ------ | ---------------------------------- | -------------------------------------- |
| POST   | `/teams/:teamId/invites`           | Create invite (email stub goes to logs)|
| GET    | `/teams/:teamId/invites`           | List invites (admin only)              |
| POST   | `/teams/invites/:token/accept`     | Accept invite when logged in           |

### Tasks
| Method | Route             | Description                                                     |
| ------ | ----------------- | --------------------------------------------------------------- |
| GET    | `/tasks`          | List across my teams. Query: `teamId`, `assigneeId`, `status`, `priority`, `q` (title search), `dueBefore`, `createdAfter` |
| POST   | `/tasks`          | Create + optionally assign (assignee must be a team member)     |
| GET    | `/tasks/due`      | Due-date reminders for me (bonus). Query: `days=1..30`          |
| PATCH  | `/tasks/:taskId`  | Update any field incl. assignee/dueDate                         |
| DELETE | `/tasks/:taskId`  | Delete task                                                     |

## Security notes

- Passwords hashed with bcrypt (never stored or returned in plain text)
- HTTP-only, SameSite cookies; `secure` in production
- All non-auth routes gated by `requireAuth`
- Joi validation strips unknown fields and escapes HTML/media chars (XSS-safe storage)
- Team scoping: task/team data is never readable outside your membership
- Role-based access: only the team creator can delete a team; only admins can add/remove members and send invites
