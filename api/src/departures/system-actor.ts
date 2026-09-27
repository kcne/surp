/**
 * The actor for departures nobody in particular wrote: the nightly job and
 * `departures:sync`. It has no user row, so it cannot log in, is not staff, and
 * never shows up in a user list; the audit records it like any other actor.
 * Departures written during a timetable edit are credited to the person editing.
 */
export const SYSTEM_ACTOR_ID = 'system:departures';
