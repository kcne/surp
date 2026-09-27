/**
 * Whether departures are kept in step with the timetable: the sync inside
 * every schedule edit, and the nightly job.
 *
 * Off until `departures:sync` has run as a dry run and then with `--apply`
 * (#27). Left on from the deploy, the first timetable edit after it would write
 * the tenant's whole first window inside that request, credited to whoever
 * made the edit, and the dry run would never have seen it.
 *
 * Read from the environment rather than `ConfigService`, because scripts and
 * invariant repairs open schedule edits outside Nest. `env.validation.ts`
 * validates the same variable at boot.
 */
export function departureSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEPARTURES_SYNC_ENABLED?.trim().toLowerCase() === 'true';
}
