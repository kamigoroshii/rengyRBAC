# Team Management RBAC

Full-stack MERN application for managing users, teams, roles, permissions, and per-team role assignments.

## Features

- Create and search users by name/email
- Create teams and manage membership
- Create reusable roles and permissions
- Assign multiple roles to a user within a specific team
- Resolve effective permissions per user/team from the backend
- Olive green frontend dashboard with dynamic permission cards
- Optional JWT-ready backend structure without forcing hardcoded global roles

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- React + Vite

## Setup

1. Create a MongoDB database and set `MONGODB_URI` in `server/.env`.
2. Install dependencies from the repo root.
3. Run the backend and frontend dev servers.

```bash
npm install
npm run dev
```

## Environment

Create `server/.env` from `server/.env.example`.

Set `VITE_API_URL` in `client/.env` if you are not using the default local backend URL.

## API Overview

- `POST /api/users`
- `GET /api/users`
- `POST /api/teams`
- `GET /api/teams`
- `POST /api/permissions`
- `GET /api/permissions`
- `POST /api/roles`
- `GET /api/roles`
- `PUT /api/roles/:roleId/permissions`
- `POST /api/teams/:teamId/members`
- `DELETE /api/teams/:teamId/members/:userId`
- `PUT /api/teams/:teamId/members/:userId/roles`
- `GET /api/teams/:teamId/members`
- `GET /api/teams/:teamId/users/:userId/permissions`
