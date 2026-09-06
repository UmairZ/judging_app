import { useAuth } from '../auth/AuthContext';
import { SidebarFooter } from './vendor/sidebar';

/** Signed-in user + Sign out — shared between OrgSidebar and CompShell so the
 * control is never lost while a user is inside a competition's sections. */
export function AccountFooter() {
  const { user, signOut } = useAuth();

  return (
    <SidebarFooter>
      <div className="flex items-center justify-between gap-3 px-2 py-1.5">
        <span className="min-w-0">
          <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
            {user?.displayName ?? user?.email ?? 'Account'}
          </span>
          <span className="block truncate text-xs/5 text-zinc-500 dark:text-zinc-400">{user?.email}</span>
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="shrink-0 text-xs/5 font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
        >
          Sign out
        </button>
      </div>
    </SidebarFooter>
  );
}
