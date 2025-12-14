# Convoy

Pack your conversations into valuable cargo - generate and save tasks from Slack conversations.

## Architecture

This project has been restructured into a monorepo using npm workspaces:

```text
convoy/
├── packages/
│   ├── api/         # Express.js backend server
│   └── frontend/    # Vite + React frontend
```

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Install dependencies for all packages:

```bash
npm run install:all
```

### Development

Start both frontend and backend in development mode:

```bash
npm run dev
```

This will start:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

### Production

Build the frontend:

```bash
npm run build
```

Start the API server:

```bash
npm start
```

## Package Scripts

### Root Level Scripts

- `npm run dev` - Run both frontend and backend in development
- `npm run dev:api` - Run only the backend in development
- `npm run dev:frontend` - Run only the frontend in development
- `npm run build` - Build the frontend for production
- `npm run start` - Start the production API server
- `npm run test` - Run tests for all packages
- `npm run lint` - Lint all packages
- `npm run clean` - Clean all build artifacts

### API Package Scripts

Navigate to `packages/api`:

- `npm run dev` - Start API server with nodemon
- `npm run start` - Start API server in production
- `npm run test` - Run API tests
- `npm run lint` - Lint API code

### Frontend Package Scripts

Navigate to `packages/frontend`:

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run frontend tests
- `npm run lint` - Lint frontend code

## Features

- **Slack Integration**: Extract and manage Slack workspace tokens
- **Conversation Sync**: Sync conversations from multiple channels
- **Task generation**: Generate tasks using Ollama models
- **Task saving**: Save individual tasks you want to keep

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
```

## API Endpoints

- `GET /api/stats` - Get database statistics
- `GET /api/tokens` - List tokens
- `POST /api/extract-token` - Extract token from cookie
- `POST /api/renew-token` - Renew existing token
- `GET /api/channels` - Get Slack channels
- `POST /api/sync-conversations` - Sync conversations
- `GET /api/conversations` - Get synced conversations
- `POST /api/tasks/generate` - Generate task list (not saved)
- `GET /api/tasks` - List saved tasks
- `POST /api/tasks` - Save an individual task
- `DELETE /api/tasks/:id` - Delete a saved task
- `GET /api/ollama/models` - Get available Ollama models

## Database

The application uses SQLite for data storage. The database file (`convoy.db`) is created automatically in the `packages/api` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

ISC
