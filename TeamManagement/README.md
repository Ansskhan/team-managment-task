# Team Task Manager - Frontend

This is the React + Vite frontend for the Team Task Manager application.

## Stack

- React 19
- Vite 8
- React Router DOM 7
- Tailwind CSS 4 (with JIT mode)
- Lucide React for icons
- ESLint for linting

## Prerequisites

- Node.js (>= 18 recommended)
- npm or yarn
- Backend API running at `http://localhost:5000` (see back-end README)

## Installation

```bash
# Install dependencies
npm install

# The frontend uses Vite with Tailwind CSS 4 and React Router.
# No additional configuration is needed beyond what's in vite.config.js
# and the existing Tailwind CSS setup.
```

## Development

```bash
# Start the development server
npm run dev

# The app will be available at http://localhost:5173
# The backend API should be running at http://localhost:5000
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Environment Variables

The frontend reads `VITE_API_URL` from `import.meta.env`. By default it connects to:

```
http://localhost:5000
```

You can override this by setting `VITE_API_URL` in your environment or `.env` file.

## API Integration

The `api.js` wrapper sends session cookies automatically (`credentials: 'include'`), which enables the backend's cookie-based authentication (HTTP-only `ttm.sid` cookie). No manual token management is needed.

Endpoints used:

| Endpoint | Purpose |
|---|---|
| `POST /auth/register` | Register a new user (auto-logs in) |
| `POST /auth/login` | Log in with email/password |
| `POST /auth/logout` | Log out (destroys session) |
| `GET /auth/me` | Get current user |
| `GET /teams` | List teams user belongs to |
| `POST /teams` | Create a new team |
| `GET /teams/:teamId` | Get team detail + members |
| `GET /tasks` | List tasks with filters |
| `POST /tasks` | Create a new task |
| `PATCH /tasks/:taskId` | Update a task |
| `DELETE /tasks/:taskId` | Delete a task |

## Notes

- Tailwind CSS 4 uses `@import "tailwindcss"` in `src/index.css` — no `tailwind.config.js` is required for basic usage.
- The React Compiler is not enabled on this template. To add it, see the [React Compiler docs](https://react.dev/learn/react-compiler/installation).
- ESLint configuration is in `eslint.config.js` — includes react-hooks and react-refresh plugins.