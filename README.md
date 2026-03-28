# Vizianagram Mangoes - Accounting Sheet

A full-stack mango trade accounting application for managing daily ledger entries, calculation settings, and generating PDF/Excel reports.

## Tech Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Frontend   | React 19, Vite 7, Tailwind CSS 4, shadcn/ui     |
| Backend    | Express 5, Node.js, TypeScript                  |
| Database   | PostgreSQL 16, Drizzle ORM                      |
| Monorepo   | pnpm workspaces                                 |

## Project Structure

```
vizanagram-mangoes/
├── artifacts/
│   ├── api-server/        # Express 5 API server (port 3000)
│   └── shop-app/          # React + Vite frontend (port 5173)
├── lib/
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-spec/          # OpenAPI spec + Orval codegen
│   ├── api-zod/           # Generated Zod schemas
│   └── db/                # Drizzle ORM schema + DB connection
├── scripts/               # Utility scripts
├── .env.example           # Environment variable template
├── pnpm-workspace.yaml    # Workspace config
└── tsconfig.base.json     # Shared TypeScript config
```

## Features

- **Ledger Dashboard** - Create, edit, delete daily entries with marks, quantities (3 rate tiers), truck numbers, payment status
- **Calculation Settings** - Configure station rate, commission %, truck fare, PT rate, custom fields
- **PDF / Excel Export** - Download ledger data as PDF or spreadsheet
- **Dark / Light Mode** - Toggle between themes
- **Login Page** - Simple local-storage-based authentication

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10
- **Docker** (for PostgreSQL) OR a running PostgreSQL 16 instance

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd vizanagram-mangoes
```

### 2. Set up environment variables

Copy the example file and edit if needed:

```bash
cp .env.example .env
```

Default `.env` contents:

```
DATABASE_URL=postgresql://vizuser:vizpass@localhost:5432/vizanagram
PORT=3000
```

### 3. Start PostgreSQL with Docker

```bash
docker run -d --name vizanagram-pg \
  -e POSTGRES_USER=vizuser \
  -e POSTGRES_PASSWORD=vizpass \
  -e POSTGRES_DB=vizanagram \
  -p 5432:5432 \
  postgres:16-alpine
```

### 4. Install dependencies

```bash
pnpm install
```

### 5. Start the API server (Terminal 1)

```bash
cd artifacts/api-server
npx tsx src/index.ts
```

The API server starts on **http://localhost:3000**. It auto-creates the database tables on first run.

### 6. Start the frontend dev server (Terminal 2)

```bash
cd artifacts/shop-app
npx vite --config vite.config.ts --host 0.0.0.0
```

The frontend starts on **http://localhost:5173** and proxies `/api` requests to the backend.

### 7. Open in browser

Go to **http://localhost:5173**

## API Endpoints

| Method | Endpoint                       | Description              |
| ------ | ------------------------------ | ------------------------ |
| GET    | `/api/health`                  | Health check             |
| GET    | `/api/ledger/entries`          | List all ledger entries  |
| POST   | `/api/ledger/entries`          | Create a ledger entry    |
| PUT    | `/api/ledger/entries/:id`      | Update a ledger entry    |
| DELETE | `/api/ledger/entries/:id`      | Delete a ledger entry    |
| POST   | `/api/ledger/entries/bulk-delete` | Bulk delete entries   |
| GET    | `/api/ledger/settings`         | Get calculation settings |
| PUT    | `/api/ledger/settings`         | Update calc settings     |

## Build for Production

```bash
# Build everything (typecheck + bundle)
pnpm run build

# Or build individually:
pnpm --filter @workspace/shop-app run build    # Frontend → artifacts/shop-app/dist/public/
pnpm --filter @workspace/api-server run build  # Backend  → artifacts/api-server/dist/index.cjs
```

To run the production build:

```bash
DATABASE_URL=postgresql://vizuser:vizpass@localhost:5432/vizanagram node artifacts/api-server/dist/index.cjs
```

This serves both the API and the frontend static files on **http://localhost:3000**.

## Stop & Cleanup

```bash
# Stop the Docker PostgreSQL container
docker stop vizanagram-pg

# Remove the container (data is lost)
docker rm vizanagram-pg
```

## Quick Reference (Windows CMD)

If running on Windows CMD instead of Git Bash, set env vars with `set`:

```cmd
set DATABASE_URL=postgresql://vizuser:vizpass@localhost:5432/vizanagram
set PORT=3000
cd artifacts\api-server
npx tsx src/index.ts
```
