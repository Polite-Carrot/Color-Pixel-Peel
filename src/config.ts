/* Build switches — the things that differ between a test build and a
   shipped one. One file so that turning a test build back into a real one
   is reading this list, not searching the codebase for what was loosened. */

/**
 * Opens every level in the picture list, whatever progress says.
 *
 * On for testing, so any of the five hundred can be reached without
 * playing four hundred first. **Set this to `false` before shipping** —
 * with it on, a new player is handed the Expert run on their first open
 * and the campaign has no shape at all.
 *
 * It only decides whether a tile can be pressed. Progress itself is
 * untouched: the cleared ticks, the counts on each setting's heading, the
 * gold tile and the level the list scrolls to all still come from how far
 * you have actually got, so turning this off is a straight revert rather
 * than a repair. The list says so on screen while it is on, because a
 * switch like this is easy to ship by accident.
 */
export const UNLOCK_ALL_LEVELS = true;
