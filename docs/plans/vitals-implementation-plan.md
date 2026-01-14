# Vitals Implementation Plan

## Overview
Build a personal health data explorer using Bun, Hono, htmx, and SQLite to import and visualize Apple Health (8+ years, 4.6M+ records) and MacroFactor (16 months) data.

## Architectural Decisions
✓ **Data Deduplication**: Store both sources separately with source tracking
✓ **Micronutrients**: Dedicated columns for all 52 nutrients (fast queries)
✓ **GPS Routes**: Store file references only, parse on-demand
✓ **ECG Data**: Store file references only, parse on-demand

---

## Database Schema

### Core Tables Structure
```sql
-- Time-series health metrics (4.6M+ records from Apple Health + MacroFactor)
health_metrics: id, metric_type, value, unit, source_name, source_version,
                device, start_date, end_date, creation_date, metadata

-- Nutrition tracking (146 days from MacroFactor)
nutrition: id, date, calories, protein_g, carbs_g, fat_g, fiber_g,
          [52 micronutrient columns: calcium_mg, iron_mg, vitamin_d_mcg, ...],
          source_name, metadata

-- Body composition (228 weight entries + 9 body measurements)
body_metrics: id, date, weight_kg, weight_lb, body_fat_percent, bmi,
              [20 body measurement columns: chest_cm, waist_cm, ...],
              source_name

-- Workouts (8,191 from Apple Health)
workouts: id, uuid, activity_type, start_date, end_date, duration_minutes,
          total_distance_km, total_energy_kcal, source_name, has_route, metadata

-- Workout GPS routes (470 GPX files - store references)
workout_routes: id, workout_id, file_path, start_date, end_date

-- Sleep sessions (extracted from Apple Health records)
sleep_sessions: id, start_date, end_date, duration_hours, sleep_type,
                source_name, metadata

-- Activity summaries (2,602 daily Apple Watch rings)
activity_summaries: id, date, active_energy_burned, active_energy_goal,
                    move_time_minutes, exercise_time_minutes, stand_hours

-- ECG recordings (32 files - store references)
ecg_recordings: id, recorded_date, classification, symptoms, average_heart_rate,
                software_version, device, sample_rate_hz, file_path

-- FHIR clinical records (788 files)
clinical_records: id, resource_type, resource_id, recorded_date, display_name,
                  code, value_text, value_quantity, value_unit, file_path, raw_json

-- User profile (extracted from Apple Health <Me> element)
user_profile: id, date_of_birth, biological_sex, blood_type, fitzpatrick_skin_type

-- Import tracking
import_history: id, source_type, source_file, imported_at, records_imported, status
```

**Indexes**: `(metric_type, start_date)`, `(source_name)`, `(date)`, `(resource_type)`, `(recorded_date)`

---

## File Structure

```
vitals/
├── flake.nix                          # Nix dev environment with Bun
├── package.json                       # Dependencies: hono, sax, exceljs
├── src/
│   ├── index.ts                       # Web server entry point
│   ├── cli.ts                         # CLI commands (import)
│   │
│   ├── db/
│   │   ├── schema.ts                  # Schema + migration logic ⭐
│   │   ├── client.ts                  # Database singleton
│   │   └── queries.ts                 # Reusable queries
│   │
│   ├── importers/
│   │   ├── index.ts                   # Import orchestrator ⭐
│   │   ├── apple-health/
│   │   │   ├── index.ts               # Coordinator
│   │   │   ├── xml-parser.ts          # SAX streaming parser ⭐
│   │   │   ├── ecg-parser.ts          # ECG CSV parser
│   │   │   ├── gpx-parser.ts          # GPX route parser
│   │   │   └── fhir-parser.ts         # FHIR JSON parser
│   │   └── macrofactor/
│   │       ├── index.ts               # Coordinator
│   │       └── xlsx-parser.ts         # Excel parser ⭐
│   │
│   ├── server/
│   │   ├── app.ts                     # Hono app setup ⭐
│   │   ├── routes/
│   │   │   ├── index.ts               # Route registration
│   │   │   ├── home.ts                # Dashboard
│   │   │   ├── metrics.ts             # Health metrics browser
│   │   │   ├── workouts.ts            # Workout explorer
│   │   │   ├── nutrition.ts           # Nutrition data
│   │   │   └── api.ts                 # JSON endpoints for htmx
│   │   └── views/
│   │       ├── layout.tsx             # Base HTML layout
│   │       ├── components/            # Reusable UI components
│   │       └── pages/                 # Page templates
│   │
│   ├── utils/
│   │   ├── date-utils.ts              # Date parsing/formatting
│   │   └── unit-converter.ts          # Unit conversions
│   │
│   └── types/
│       ├── health.ts                  # Type definitions
│       └── fhir.ts                    # FHIR resource types
│
├── public/
│   ├── styles/main.css                # Minimal CSS
│   └── js/charts.js                   # Chart.js initialization
│
└── data/
    └── vitals.db                      # SQLite database (created on init)
```

⭐ = Critical files to implement first

---

## Implementation Steps

### Phase 1: Foundation (Start Here)
1. **Create Nix flake** (`flake.nix`)
   - Dev shell with Bun, SQLite
   - Shell hook with helpful commands

2. **Initialize Bun project**
   ```bash
   bun init
   bun add hono sax exceljs chart.js
   bun add -d @types/bun @types/sax typescript
   ```

3. **Database schema** (`src/db/schema.ts`)
   - Create all table definitions
   - Write migration function to initialize database
   - Add `bun run db:init` script

### Phase 2: Import Pipeline (Core Functionality)
4. **Apple Health XML parser** (`src/importers/apple-health/xml-parser.ts`)
   - Use SAX streaming parser (2GB file, 8.1M lines)
   - Parse `<Record>` elements → `health_metrics` table
   - Parse `<Workout>` elements → `workouts` table
   - Parse `<ActivitySummary>` → `activity_summaries` table
   - Parse `<Me>` element → `user_profile` table
   - **Batch insert 10,000 records at a time** (performance)
   - Track progress with console output

5. **MacroFactor XLSX parser** (`src/importers/macrofactor/xlsx-parser.ts`)
   - Parse "Calories & Macros" sheet → `nutrition` table
   - Parse "Micronutrients" sheet → `nutrition` table (52 columns)
   - Parse "Scale Weight" sheet → `body_metrics` table
   - Parse "Weight Trend" sheet → `health_metrics` (metric_type='weight_trend')
   - Parse "Expenditure" sheet → `health_metrics` (metric_type='tdee')
   - Parse "Steps" sheet → `health_metrics` (metric_type='steps', source='MacroFactor')
   - Parse "Body Metrics" sheet → `body_metrics` table

6. **Import orchestrator** (`src/importers/index.ts` + `src/cli.ts`)
   - Detect available data sources
   - Run Apple Health import
   - Run MacroFactor import
   - Update `import_history` table
   - Display summary report (records imported, errors)
   - Create `bun run import` CLI command

### Phase 3: Web Server & UI (Exploration Interface)
7. **Hono server setup** (`src/server/app.ts`)
   - Initialize Hono app
   - Add static file serving (`public/`)
   - Register routes
   - Start server on port 3000

8. **Home dashboard** (`src/server/routes/home.ts` + `src/server/views/pages/home.tsx`)
   - Query recent metrics (today's steps, latest weight, calories)
   - Display activity ring summary (Apple Watch data)
   - Show 3 charts: weight trend, steps (7 days), nutrition (7 days)
   - Use Chart.js for visualizations

9. **Metrics browser** (`src/server/routes/metrics.ts`)
   - List all available metric types (steps, heart_rate, weight, etc.)
   - Show date range coverage per metric
   - Display record count per metric
   - Link to detail view for each metric type

10. **Metric detail view** (`src/server/routes/metrics.ts`)
    - URL: `/metrics/:type` (e.g., `/metrics/steps`)
    - Filter by date range (htmx date picker)
    - Show line chart of values over time
    - Display data table with source comparison
    - Add CSV export button

11. **API endpoints** (`src/server/routes/api.ts`)
    - `GET /api/metrics/:type?start=&end=` - JSON data for charts
    - `GET /api/workouts/recent` - Recent workouts list
    - `GET /api/nutrition/:date` - Daily nutrition breakdown
    - Used by htmx for dynamic content loading

### Phase 4: Advanced Data Types
12. **FHIR clinical records parser** (`src/importers/apple-health/fhir-parser.ts`)
    - Parse 788 JSON files in `clinical-records/` directory
    - Extract: resource_type, resource_id, recorded_date, display_name, code
    - Store file_path reference and raw_json
    - Parallel processing (use Bun's concurrency)

13. **Clinical records browser** (`src/server/routes/clinical.ts`)
    - List by resource type (Observation, DiagnosticReport, etc.)
    - Filter by date and search by code/name
    - Detail view showing full FHIR resource (formatted JSON)

14. **Workout routes** (`src/importers/apple-health/gpx-parser.ts` + `src/server/routes/workouts.ts`)
    - Store GPX file references in `workout_routes` table
    - On workout detail page, parse GPX on-demand
    - Display route on Leaflet.js map
    - Show elevation profile chart

15. **ECG recordings** (`src/importers/apple-health/ecg-parser.ts`)
    - Parse metadata from ECG CSV files
    - Store file references in `ecg_recordings` table
    - On detail view, load CSV and render waveform with Chart.js
    - Display classification, heart rate, symptoms

### Phase 5: Polish & Documentation
16. **Error handling & logging**
    - Add try/catch in all parsers
    - Log errors to console and `import_history.error_log`
    - User-friendly error messages in UI

17. **Performance optimization**
    - Add missing database indexes
    - Optimize Chart.js rendering for large datasets
    - Add pagination to metric tables (1000 records max)

18. **Documentation**
    - README with setup instructions
    - Document data import process
    - Add inline code comments for complex parsing logic

---

## Import Pipeline Details

### Apple Health XML Parsing Strategy
**File**: `src/importers/apple-health/xml-parser.ts`

```typescript
import sax from 'sax';
import { db } from '../db/client';

// Stream parse 2GB XML file
const parser = sax.createStream(true);
let recordBatch = [];
const BATCH_SIZE = 10000;

parser.on('opentag', (node) => {
  if (node.name === 'Record') {
    // Extract attributes: type, value, unit, sourceName, startDate, endDate
    recordBatch.push({
      metric_type: extractMetricType(node.attributes.type),
      value: parseFloat(node.attributes.value),
      unit: node.attributes.unit,
      source_name: node.attributes.sourceName,
      start_date: node.attributes.startDate,
      end_date: node.attributes.endDate,
    });

    if (recordBatch.length >= BATCH_SIZE) {
      insertBatch(recordBatch);
      recordBatch = [];
    }
  }

  if (node.name === 'Workout') {
    // Parse workout with nested WorkoutStatistics
  }
});

fs.createReadStream('./health-data/apple-health/export.xml')
  .pipe(parser);
```

**Key considerations**:
- Use SAX streaming to avoid loading 2GB into memory
- Batch inserts for performance (10,000 records per transaction)
- Handle 101+ metric types with `metric_type` field
- Parse dates in ISO 8601 format
- Extract nested `<WorkoutStatistics>` and `<WorkoutEvent>` as JSON metadata

### MacroFactor XLSX Parsing Strategy
**File**: `src/importers/macrofactor/xlsx-parser.ts`

```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('./health-data/macrofactor/MacroFactor-*.xlsx');

// Parse "Calories & Macros" sheet
const macrosSheet = workbook.getWorksheet('Calories & Macros');
macrosSheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return; // Skip header

  db.run(`INSERT INTO nutrition (date, calories, fat_g, carbs_g, protein_g)
          VALUES (?, ?, ?, ?, ?)`,
    [row.getCell(1).value, row.getCell(2).value, ...]);
});

// Parse "Micronutrients" sheet (52 columns)
const microSheet = workbook.getWorksheet('Micronutrients');
// Map columns to dedicated database fields
```

---

## Web UI Routes

| Route | Purpose | Data Source |
|-------|---------|-------------|
| `/` | Dashboard with summary cards | Recent `health_metrics`, `activity_summaries` |
| `/metrics` | Browse all metric types | `SELECT DISTINCT metric_type FROM health_metrics` |
| `/metrics/steps` | Steps detail with chart | `health_metrics WHERE metric_type='steps'` |
| `/workouts` | Workout log table | `workouts` |
| `/workouts/:id` | Workout detail + map | `workouts`, parse GPX from `workout_routes.file_path` |
| `/nutrition` | Calendar view of meals | `nutrition` |
| `/nutrition/:date` | Daily breakdown | `nutrition WHERE date=?` |
| `/sleep` | Sleep duration trends | `sleep_sessions` |
| `/clinical` | FHIR resource browser | `clinical_records` |
| `/clinical/:id` | Full FHIR resource | `clinical_records WHERE id=?`, display `raw_json` |
| `/api/metrics/:type` | JSON data for charts | `health_metrics` with date range filter |

---

## Data Volume & Performance Estimates

| Data Type | Record Count | Parsing Strategy | Expected Import Time |
|-----------|-------------|------------------|---------------------|
| Health metrics (Apple) | 4.6M+ records | SAX streaming, 10k batch | 3-5 minutes |
| Workouts | 8,191 | SAX parsing | 30 seconds |
| Activity summaries | 2,602 | SAX parsing | 10 seconds |
| Nutrition (MacroFactor) | 146 days | ExcelJS | 5 seconds |
| FHIR clinical records | 788 files | Parallel JSON parsing | 30 seconds |
| GPX routes | 470 files | File references only | 5 seconds |
| ECG recordings | 32 files | Metadata extraction | 5 seconds |
| **Total** | **~4.7M records** | | **~6 minutes** |

**Database size estimate**: ~500 MB (mostly health_metrics table)

---

## Technology Stack

**Runtime & Framework**:
- Bun 1.x (runtime, package manager, built-in SQLite)
- Hono (web framework)
- TypeScript

**Import Libraries**:
- `sax` - Streaming XML parser for Apple Health export.xml
- `exceljs` - Excel parser for MacroFactor XLSX

**Frontend**:
- htmx - Dynamic interactions
- Chart.js - Data visualizations
- Leaflet.js - Map rendering for workout routes
- Minimal CSS (custom styles, no heavy framework)

**Development**:
- Nix flake for reproducible environment
- TypeScript for type safety

---

## Verification & Testing

### After Import Pipeline (Phase 2)
```bash
# Initialize database
bun run db:init

# Run import
bun run import

# Expected output:
# ✓ Imported 4,600,000+ health metrics
# ✓ Imported 8,191 workouts
# ✓ Imported 2,602 activity summaries
# ✓ Imported 146 nutrition days
# ✓ Imported 788 clinical records
# ✓ Total time: ~6 minutes

# Verify data in SQLite
sqlite3 data/vitals.db
> SELECT COUNT(*) FROM health_metrics;  -- Should be 4.6M+
> SELECT COUNT(DISTINCT metric_type) FROM health_metrics;  -- Should be 101+
> SELECT COUNT(*) FROM workouts;  -- Should be 8,191
> SELECT COUNT(*) FROM nutrition;  -- Should be 146
> SELECT MIN(date), MAX(date) FROM nutrition;  -- 2024-08-23 to 2026-01-11
```

### After Web Server (Phase 3)
```bash
# Start dev server
bun run dev

# Open browser: http://localhost:3000
# Verify:
# ✓ Dashboard loads with summary cards
# ✓ Activity rings display
# ✓ Charts render (weight, steps, nutrition)
# ✓ Navigate to /metrics - see list of all metric types
# ✓ Click on "Steps" - see detail view with chart
# ✓ Use date picker - chart updates via htmx
```

### After Advanced Features (Phase 4)
```bash
# Verify clinical records
# Visit: http://localhost:3000/clinical
# ✓ See 788 records grouped by type
# ✓ Filter by date range
# ✓ Click on record - see formatted FHIR JSON

# Verify workout routes
# Visit: http://localhost:3000/workouts
# ✓ Click workout with route
# ✓ Map loads with GPX track
# ✓ Elevation profile displays

# Verify ECG recordings
# ✓ Navigate to ECG section
# ✓ Click on recording
# ✓ Waveform chart renders from CSV
```

### End-to-End Test Scenario
1. Clean slate: `bun run db:reset`
2. Full import: `bun run import` (wait ~6 minutes)
3. Start server: `bun run dev`
4. Browse to dashboard → verify all 3 charts load
5. Navigate to `/metrics/steps` → verify chart shows data from both sources
6. Navigate to `/workouts` → click workout with GPS → verify map renders
7. Navigate to `/nutrition/2024-12-15` → verify macro breakdown displays
8. Navigate to `/clinical` → verify FHIR records listed

---

## Critical Files (Implementation Order)

1. **flake.nix** - Nix development environment
2. **src/db/schema.ts** - Database schema and migrations
3. **src/importers/apple-health/xml-parser.ts** - Apple Health parser (largest dataset)
4. **src/importers/macrofactor/xlsx-parser.ts** - MacroFactor parser
5. **src/cli.ts** - Import orchestrator and CLI commands
6. **src/server/app.ts** - Web server setup
7. **src/server/routes/home.ts** - Dashboard page
8. **src/server/routes/api.ts** - JSON endpoints for charts

---

## Notes

- **No co-author attribution** in git commits (per user preference)
- **No "Generated with Claude Code"** footers (per user preference)
- Keep UI minimal - focus on data exploration, not polished dashboards
- Store file references (GPX, ECG CSV) rather than duplicating data in database
- Use UNIQUE constraints with `ON CONFLICT REPLACE` for deduplication
- All dates stored as ISO 8601 text in SQLite
- Source tracking on all metrics enables future data reconciliation
