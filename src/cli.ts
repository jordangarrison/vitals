#!/usr/bin/env bun

import { importHealthData } from "./importers";
import { closeDatabase } from "./db/client";

const args = process.argv.slice(2);

async function main() {
  const command = args[0];

  if (command === "import") {
    await runImport();
  } else {
    showHelp();
    process.exit(1);
  }
}

async function runImport() {
  // Parse command line arguments
  let username = "jordan"; // Default username
  let skipAppleHealth = false;
  let skipMacroFactor = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--user" || arg === "-u") {
      username = args[++i];
    } else if (arg === "--skip-apple-health") {
      skipAppleHealth = true;
    } else if (arg === "--skip-macrofactor") {
      skipMacroFactor = true;
    } else if (arg === "--help" || arg === "-h") {
      showImportHelp();
      process.exit(0);
    }
  }

  if (!username) {
    console.error("Error: Username is required");
    console.error("Usage: bun run import --user <username>");
    process.exit(1);
  }

  try {
    const result = await importHealthData({
      username,
      skipAppleHealth,
      skipMacroFactor,
    });

    closeDatabase();

    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Fatal error: ${error}`);
    closeDatabase();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Vitals CLI - Personal Health Data Explorer

Usage:
  bun run import [options]

Commands:
  import              Import health data from Apple Health and MacroFactor

Options:
  --help, -h          Show help
`);
}

function showImportHelp() {
  console.log(`
Import health data from Apple Health and MacroFactor

Usage:
  bun run import [options]

Options:
  --user, -u <username>        Username to import data for (default: jordan)
  --skip-apple-health          Skip Apple Health import
  --skip-macrofactor           Skip MacroFactor import
  --help, -h                   Show this help message

Examples:
  # Import all data for user 'jordan'
  bun run import --user jordan

  # Import only Apple Health data
  bun run import --user jordan --skip-macrofactor

  # Import only MacroFactor data
  bun run import --user jordan --skip-apple-health

Data Structure:
  health-data/
  └── {username}/
      ├── apple-health/
      │   └── export.xml
      └── macrofactor/
          └── MacroFactor-*.xlsx
`);
}

main().catch((error) => {
  console.error(`Unhandled error: ${error}`);
  closeDatabase();
  process.exit(1);
});
