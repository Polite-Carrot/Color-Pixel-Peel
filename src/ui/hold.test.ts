import { describe, expect, it } from 'vitest';
import { Hold } from './hold';

/** A clock the test drives by hand. */
function fakeClock(): { advance(ms: number): void; now(): number } {
  let t = 1000;
  return { advance: (ms) => void (t += ms), now: () => t };
}

describe('Hold', () => {
  it('starts at nothing', () => {
    const hold = new Hold(6000, fakeClock().now);
    expect(hold.fraction()).toBe(0);
    expect(hold.running).toBe(false);
    expect(hold.done).toBe(false);
    expect(hold.secondsLeft()).toBe(6);
  });

  it('fills as it is held', () => {
    const clock = fakeClock();
    const hold = new Hold(6000, clock.now);
    hold.start();
    clock.advance(3000);
    expect(hold.fraction()).toBeCloseTo(0.5);
    expect(hold.secondsLeft()).toBe(3);
    expect(hold.tick()).toBe(false);
  });

  it('stops dead when released, rather than carrying on', () => {
    const clock = fakeClock();
    const hold = new Hold(6000, clock.now);
    hold.start();
    clock.advance(5900);
    hold.release();
    // Time keeps passing; the bar must not creep to the end anyway.
    clock.advance(10_000);
    expect(hold.fraction()).toBe(0);
    expect(hold.tick()).toBe(false);
    expect(hold.done).toBe(false);
  });

  it('completes exactly once, and only after the full duration', () => {
    const clock = fakeClock();
    const hold = new Hold(6000, clock.now);
    hold.start();

    clock.advance(5999);
    expect(hold.tick()).toBe(false);

    clock.advance(1);
    expect(hold.tick()).toBe(true);
    expect(hold.done).toBe(true);
    expect(hold.fraction()).toBe(1);
    expect(hold.secondsLeft()).toBe(0);

    // The action must not fire twice.
    expect(hold.tick()).toBe(false);
  });

  it('ignores a second start while already holding', () => {
    const clock = fakeClock();
    const hold = new Hold(6000, clock.now);
    hold.start();
    clock.advance(4000);
    hold.start(); // auto-repeat, or a second finger — not a fresh hold
    expect(hold.fraction()).toBeCloseTo(4 / 6);
  });

  it('cannot be restarted or released once complete', () => {
    const clock = fakeClock();
    const hold = new Hold(1000, clock.now);
    hold.start();
    clock.advance(1000);
    hold.tick();

    hold.release();
    expect(hold.done).toBe(true);
    expect(hold.fraction()).toBe(1);
    hold.start();
    expect(hold.running).toBe(false);
  });

  it('can be started again after a reset', () => {
    const clock = fakeClock();
    const hold = new Hold(1000, clock.now);
    hold.start();
    clock.advance(1000);
    hold.tick();

    hold.reset();
    expect(hold.done).toBe(false);
    expect(hold.fraction()).toBe(0);
    hold.start();
    clock.advance(1000);
    expect(hold.tick()).toBe(true);
  });

  it('never reports more than full, however long it is held', () => {
    const clock = fakeClock();
    const hold = new Hold(1000, clock.now);
    hold.start();
    clock.advance(60_000);
    expect(hold.fraction()).toBe(1);
    expect(hold.secondsLeft()).toBe(0);
  });

  it('rejects a non-positive duration', () => {
    expect(() => new Hold(0)).toThrow();
    expect(() => new Hold(-5)).toThrow();
  });
});
