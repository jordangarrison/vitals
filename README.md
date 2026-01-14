# Vitals

Personal health data explorer built with Bun, Hono, htmx, and SQLite.

## Features

- Import and visualize Apple Health data (steps, heart rate, workouts, sleep, etc.)
- Import and analyze MacroFactor nutrition data
- Multi-user support for tracking family member health data
- Interactive web dashboard with charts and metrics
- Clinical records browser (FHIR format)
- Workout route visualization with GPS data
- ECG waveform viewer

## Tech Stack

- **Runtime**: Bun
- **Database**: SQLite (bun:sqlite)
- **Backend**: Hono
- **Frontend**: htmx + Chart.js
- **Dev Environment**: Nix flake

## Setup

### Prerequisites

- Nix with flakes enabled, OR
- Bun installed directly

### Using Nix (Recommended)

```bash
# Enter development environment
nix develop

# Install dependencies
bun install

# Initialize database
bun run db:init
```

### Without Nix

```bash
# Install Bun: https://bun.sh
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Initialize database
bun run db:init
```

## Data Structure

Organize your health data in the following structure:

```
health-data/
├── {username}/
│   ├── apple-health/
│   │   ├── export.xml
│   │   ├── export_cda.xml
│   │   ├── electrocardiograms/*.csv
│   │   ├── clinical-records/*.json
│   │   └── workout-routes/*.gpx
│   └── macrofactor/
│       └── MacroFactor-*.xlsx
```

Where `{username}` matches the username you'll use when importing data.

## Usage

### Import Health Data

```bash
# Import data for a specific user
bun run import -- --user {username}

# Example:
bun run import -- --user jordan
```

The import process will:
1. Detect available data sources in `health-data/{username}/`
2. Parse Apple Health XML (export.xml)
3. Parse MacroFactor XLSX files
4. Import ECG recordings, clinical records, and workout routes
5. Display summary report

### Start Web Server

```bash
# Development mode (with auto-reload)
bun run dev

# Production mode
bun run start
```

Then open http://localhost:3000 in your browser.

### Database Management

```bash
# Initialize fresh database
bun run db:init

# Reset database (delete and reinitialize)
bun run db:reset

# Access database directly
sqlite3 data/vitals.db
```

## Project Structure

```
vitals/
├── src/
│   ├── db/              # Database schema and queries
│   ├── importers/       # Data import parsers
│   │   ├── apple-health/
│   │   └── macrofactor/
│   ├── server/          # Web server and routes
│   │   ├── routes/
│   │   └── views/
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript types
├── public/              # Static assets (CSS, JS)
├── data/                # SQLite database (gitignored)
└── health-data/         # Raw health data (gitignored)
```

## Development

```bash
# Watch mode (auto-reload on changes)
bun run dev

# Run tests
bun test

# Run specific test file
bun test tests/utils/date-utils.test.ts

# Run tests in watch mode
bun test --watch
```

### Test Coverage

The project includes comprehensive tests for:
- Date parsing and formatting utilities
- Unit conversions (weight, distance, energy, etc.)
- Database operations (user management, profiles, metrics)
- Import functionality (integration tests coming soon)

All tests use Bun's built-in test runner and SQLite in-memory databases.

## Multi-User Support

Vitals supports tracking health data for multiple users (e.g., family members):

1. Organize data by username in `health-data/{username}/`
2. Import each user's data separately: `bun run import -- --user {username}`
3. Switch between users in the web UI

Each user's data is isolated in the database with a unique `user_id`.

## Data Sources

### Apple Health

Export your data from the Health app on iOS:
1. Open Health app
2. Tap your profile picture
3. Scroll down and tap "Export All Health Data"
4. Save the export to `health-data/{username}/apple-health/`

### MacroFactor

Export your nutrition data from MacroFactor:
1. Open MacroFactor app
2. Go to Settings > Data Export
3. Export as Excel (.xlsx)
4. Save to `health-data/{username}/macrofactor/`

## License

MIT
