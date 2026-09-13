/**
 * Press-and-hold timer, for the one action that destroys something.
 *
 * Kept free of the DOM and of requestAnimationFrame so the rules can be
 * tested: that letting go stops it dead rather than animating on to
 * somewhere it never reached, that auto-repeat is not holding, and that it
 * only completes once the full duration has genuinely elapsed.
 */
export class Hold {
  private startedAt: number | null = null;
  private finished = false;

  constructor(
    private readonly durationMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (durationMs <= 0) throw new Error('Hold: duration must be positive');
  }

  /** Begins holding. Ignored if already holding, or already complete. */
  start(): void {
    if (this.startedAt !== null || this.finished) return;
    this.startedAt = this.now();
  }

  /** Lets go. The fill drops back to nothing unless it had completed. */
  release(): void {
    if (this.finished) return;
    this.startedAt = null;
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  get done(): boolean {
    return this.finished;
  }

  /** How far along, 0 to 1. */
  fraction(): number {
    if (this.finished) return 1;
    if (this.startedAt === null) return 0;
    const elapsed = this.now() - this.startedAt;
    return Math.min(1, Math.max(0, elapsed / this.durationMs));
  }

  /** Whole seconds still to go, for the countdown on the label. */
  secondsLeft(): number {
    if (this.finished) return 0;
    if (this.startedAt === null) return Math.ceil(this.durationMs / 1000);
    const left = this.durationMs - (this.now() - this.startedAt);
    return Math.max(0, Math.ceil(left / 1000));
  }

  /**
   * Advances the timer. Returns true on the single tick where the hold
   * completes, so the caller can fire its action exactly once.
   */
  tick(): boolean {
    if (this.finished || this.startedAt === null) return false;
    if (this.now() - this.startedAt < this.durationMs) return false;
    this.finished = true;
    this.startedAt = null;
    return true;
  }

  reset(): void {
    this.startedAt = null;
    this.finished = false;
  }
}
