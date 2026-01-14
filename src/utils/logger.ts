/**
 * Simple logging utilities for import progress
 */

export class Logger {
  private startTime: number;
  private lastProgressTime: number;

  constructor() {
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();
  }

  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  success(message: string): void {
    console.log(`✓ ${message}`);
  }

  error(message: string): void {
    console.error(`✗ ${message}`);
  }

  warn(message: string): void {
    console.warn(`⚠ ${message}`);
  }

  progress(phase: string, current: number, total: number): void {
    const now = Date.now();

    // Only log progress every 1 second to avoid spam
    if (now - this.lastProgressTime < 1000 && current < total) {
      return;
    }

    this.lastProgressTime = now;

    const percent = ((current / total) * 100).toFixed(1);
    const elapsed = this.getElapsedTime();

    process.stdout.write(
      `\r${phase}: ${current.toLocaleString()}/${total.toLocaleString()} (${percent}%) [${elapsed}]`
    );

    // Newline when complete
    if (current >= total) {
      process.stdout.write("\n");
    }
  }

  startPhase(phaseName: string): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${phaseName}`);
    console.log(`${"=".repeat(60)}`);
    this.startTime = Date.now();
  }

  endPhase(recordCount?: number): void {
    const elapsed = this.getElapsedTime();

    if (recordCount !== undefined) {
      this.success(`Processed ${recordCount.toLocaleString()} records in ${elapsed}`);
    } else {
      this.success(`Completed in ${elapsed}`);
    }
  }

  getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  reset(): void {
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();
  }
}

export const logger = new Logger();
