# Vitals

Personal health data explorer for Apple Health and MacroFactor data. Built with Bun, Elysia, htmx, and SQLite.

## Features

- Import and visualize 4.6M+ health records from Apple Health exports
- Import and analyze MacroFactor nutrition data (calories, macros, 52 micronutrients)
- Browse 100+ health metric types with interactive charts
- View workout history with GPS route visualization (Leaflet.js maps)
- Explore ECG recordings with waveform display
- Browse FHIR clinical records from health providers
- Sleep tracking and activity ring summaries
- Imperial unit display (lbs, miles) by default
- Multi-user support with URL-based routing

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.x or later
- (Optional) [Nix](https://nixos.org/) for reproducible development environment

### Installation

```bash
# Clone the repository
git clone https://github.com/jordangarrison/vitals.git
cd vitals

# Install dependencies
bun install

# Initialize the database
bun run db:init
```

### Data Structure

Place your health data exports in the following structure:

```
health-data/
└── {username}/
    ├── apple-health/
    │   ├── export.xml           # Apple Health export (required)
    │   ├── clinical-records/    # FHIR JSON files (optional)
    │   ├── electrocardiograms/  # ECG CSV files (optional)
    │   └── workout-routes/      # GPX files (optional)
    └── macrofactor/
        └── MacroFactor-*.xlsx   # MacroFactor export (optional)
```

### Import Your Data

```bash
# Import all data for a user
bun run import --user myuser

# Import only Apple Health data
bun run import --user myuser --skip-macrofactor

# Import only MacroFactor data
bun run import --user myuser --skip-apple-health

# Skip specific data types
bun run import --user myuser --skip-ecg --skip-workout-routes
```

### Start the Server

```bash
# Development mode (auto-reload)
bun run dev

# Production mode
bun run start
```

Open http://localhost:3000 in your browser.

## Available Routes

| Route | Description |
|-------|-------------|
| `/` | User selection / redirect |
| `/:username` | Dashboard with summary cards and charts |
| `/:username/metrics` | Browse all metric types |
| `/:username/metrics/:type` | Metric detail with chart |
| `/:username/workouts` | Workout log with pagination |
| `/:username/workouts/:id/route` | Workout GPS route map |
| `/:username/nutrition` | Nutrition overview |
| `/:username/nutrition/:date` | Daily nutrition breakdown |
| `/:username/sleep` | Sleep duration trends |
| `/:username/clinical` | FHIR clinical records browser |
| `/:username/clinical/:id` | Clinical record detail |
| `/:username/ecg` | ECG recordings list |
| `/:username/ecg/:id` | ECG waveform display |
| `/:username/routes` | All workout routes |

## CLI Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start server with auto-reload |
| `bun run start` | Start server in production mode |
| `bun run import` | Import health data |
| `bun run db:init` | Initialize database schema |
| `bun run db:reset` | Reset database (delete and recreate) |
| `bun test` | Run tests |

### Import Options

```bash
bun run import [options]

Options:
  --user, -u <username>    Username to import data for (required)
  --skip-apple-health      Skip Apple Health XML import
  --skip-macrofactor       Skip MacroFactor Excel import
  --skip-clinical-records  Skip FHIR clinical records import
  --skip-ecg               Skip ECG recordings import
  --skip-workout-routes    Skip GPX workout routes import
  --help, -h               Show help
```

## Data Sources

### Apple Health Export

Export your data from the Apple Health app:
1. Open Health app on iPhone
2. Tap your profile picture
3. Tap "Export All Health Data"
4. Unzip the export

The export includes:
- `export.xml` - Main health data (4.6M+ records over 8+ years)
- `clinical-records/` - FHIR JSON files from health providers (788 files)
- `electrocardiograms/` - ECG CSV files from Apple Watch (32 files)
- `workout-routes/` - GPX files with GPS coordinates (470 files)

### MacroFactor Export

Export your data from MacroFactor app settings. The Excel file contains:
- Calories & Macros (daily totals)
- Micronutrients (52 vitamins/minerals)
- Scale Weight entries
- Weight Trend calculations
- TDEE (expenditure) estimates
- Body measurements

## Database Schema

Data is stored in SQLite at `data/vitals.db`:

| Table | Description | Records |
|-------|-------------|---------|
| `users` | User accounts | - |
| `user_profile` | Health profile (DOB, blood type) | - |
| `health_metrics` | Time-series health data | 4.6M+ |
| `nutrition` | Daily nutrition with 52 micronutrients | 146 days |
| `body_metrics` | Weight and body measurements | 228 |
| `workouts` | Workout sessions | 994 |
| `workout_routes` | GPS route file references | 470 |
| `sleep_sessions` | Sleep tracking data | 24,572 |
| `activity_summaries` | Daily Apple Watch rings | 2,602 |
| `ecg_recordings` | ECG metadata + waveforms | 32 |
| `clinical_records` | FHIR clinical data | 788 |
| `import_history` | Import tracking | - |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime with built-in SQLite
- **Framework**: [Elysia](https://elysiajs.com/) - TypeScript web framework
- **Database**: SQLite (via Bun's native driver)
- **Frontend**: htmx, Chart.js, Leaflet.js
- **Parsers**: SAX (XML streaming), ExcelJS (XLSX)

## Development

### Using Nix (Recommended)

```bash
# Enter development shell
nix develop

# Or use direnv
direnv allow
```

### Without Nix

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

### Project Structure

```
vitals/
├── src/
│   ├── index.ts           # Web server entry point
│   ├── cli.ts             # CLI commands
│   ├── db/                # Database schema and queries
│   ├── importers/         # Data parsers
│   │   ├── apple-health/  # Apple Health XML parser
│   │   ├── macrofactor/   # MacroFactor Excel parser
│   │   ├── clinical-records/ # FHIR JSON parser
│   │   ├── ecg/           # ECG CSV parser
│   │   └── workout-routes/# GPX parser
│   ├── server/            # Elysia routes and views
│   │   ├── routes/        # Route handlers
│   │   └── views/         # HTML templates
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── public/                # Static assets
├── data/                  # SQLite database (created on init)
└── health-data/           # Place your exports here
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/utils/date-utils.test.ts

# Watch mode
bun test --watch
```

## Performance Notes

- Apple Health XML is parsed with SAX streaming to handle 2GB+ files
- Health metrics are batch inserted 10,000 records at a time
- ECG waveforms are decimated (every 4th point) for storage efficiency
- Workout routes store file references, parsed on-demand
- Comprehensive indexes on all tables for fast queries
- Import time: ~6 minutes for full dataset

## Multi-User Support

Vitals supports tracking health data for multiple users (e.g., family members):

1. Organize data by username in `health-data/{username}/`
2. Import each user's data: `bun run import --user {username}`
3. Access via URL: `http://localhost:3000/{username}`

Each user's data is isolated in the database with a unique `user_id`.

## License

MIT
