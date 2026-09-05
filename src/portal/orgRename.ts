import { writeDoc } from '../data/db';

/**
 * Rename an organization. Writes to both the org doc and the user's org mirror.
 * @param write - function to write docs (defaults to writeDoc); tests pass a recording stub
 * @param uid - user ID
 * @param orgId - organization ID
 * @param name - new name (will be trimmed; rejects if empty or whitespace-only)
 * @throws if name is empty or whitespace-only
 */
export async function renameOrg(
  write: typeof writeDoc = writeDoc,
  uid: string,
  orgId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Organization name cannot be empty');
  }

  // Write to both paths: the org doc and the user's org mirror
  await write(`orgs/${orgId}`, { name: trimmed });
  await write(`users/${uid}/orgs/${orgId}`, { name: trimmed });
}
