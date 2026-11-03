const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

interface Attempts {
  failures: number;
  windowEndsAt: number;
}

/**
 * Slows password guessing: too many failures for one key blocks it for a while.
 * Held in memory, so it applies per server process and resets on restart.
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, Attempts>();

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.windowEndsAt <= this.now()) {
      this.attempts.delete(key);
      return false;
    }
    return entry.failures >= MAX_FAILURES;
  }

  recordFailure(key: string): void {
    this.prune();
    const entry = this.attempts.get(key);
    if (entry && entry.windowEndsAt > this.now()) {
      entry.failures += 1;
    } else {
      this.attempts.set(key, {
        failures: 1,
        windowEndsAt: this.now() + WINDOW_MS,
      });
    }
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  private prune(): void {
    for (const [key, entry] of this.attempts) {
      if (entry.windowEndsAt <= this.now()) this.attempts.delete(key);
    }
  }
}
