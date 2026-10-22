-- Team Task Manager schema (PostgreSQL)

-- ---------------------------------------------------------------
-- users: registered application users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100)   NOT NULL,
  email         VARCHAR(255)   NOT NULL UNIQUE,
  password_hash TEXT           NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- teams: a team with its creator
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_by  UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- team_members: membership join table with role per team
-- role: 'admin' = team creator (and optional co-admins), 'member' = invited member
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ---------------------------------------------------------------
-- tasks: work items belonging to a team, optionally assigned
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID         NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    VARCHAR(10)  NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id UUID         REFERENCES users (id) ON DELETE SET NULL,
  due_date    DATE,
  created_by  UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- invites: stubbed "invite by email" records (bonus feature).
-- No SMTP integration; emails are logged and the accept flow uses the token.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID         NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  token      UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status     VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  invited_by UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- performance indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_team_id     ON tasks (team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_invites_email     ON invites (email);

-- ---------------------------------------------------------------
-- session store table is created automatically by connect-pg-simple
-- ---------------------------------------------------------------
