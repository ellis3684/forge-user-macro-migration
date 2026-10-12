// Pure data logic for the Space Admins macro, kept free of Forge imports so it
// can be unit-tested with plain Node. `fetchJson(path)` is injected: in the app
// it wraps requestConfluence (runs as the viewing user); in tests it's a stub.

const ADMIN_OPERATION = { key: 'administer', targetType: 'space' };
const MAX_PAGES = 20; // 20 x 250 assignments — a guard, not an expected size

export class ConfluenceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function isSpaceAdminAssignment(assignment) {
  const op = assignment?.operation;
  return op?.key === ADMIN_OPERATION.key && op?.targetType === ADMIN_OPERATION.targetType;
}

// Walks every page of /wiki/api/v2/spaces/{id}/permissions and returns the
// admin principals, de-duplicated and split into users and groups.
export async function loadSpaceAdmins(spaceId, fetchJson) {
  if (!spaceId) throw new ConfluenceError(400, 'This macro only works on a page inside a space.');

  const userIds = new Set();
  const groupIds = new Set();
  let path = `/wiki/api/v2/spaces/${encodeURIComponent(spaceId)}/permissions?limit=250`;

  for (let page = 0; path && page < MAX_PAGES; page += 1) {
    const body = await fetchJson(path);
    for (const assignment of body.results ?? []) {
      if (!isSpaceAdminAssignment(assignment)) continue;
      const { type, id } = assignment.principal ?? {};
      if (type === 'user' && id) userIds.add(id);
      if (type === 'group' && id) groupIds.add(id);
    }
    path = body._links?.next ?? null;
  }

  const groups = await Promise.all(
    [...groupIds].map(async (id) => {
      try {
        const group = await fetchJson(`/wiki/rest/api/group/by-id?id=${encodeURIComponent(id)}`);
        return { id, name: group.name ?? 'Unknown group', resolved: Boolean(group.name) };
      } catch {
        // A group we can't resolve is still an admin group; show it rather than hide it.
        return { id, name: 'Unknown group', resolved: false };
      }
    }),
  );

  // Named groups alphabetically, unresolved ones last.
  groups.sort((a, b) => (b.resolved - a.resolved) || a.name.localeCompare(b.name));
  return { userIds: [...userIds], groups };
}

// Maps an HTTP failure to something a page reader can act on.
export function describeError(error) {
  switch (error?.status) {
    case 400:
      return error.message;
    case 401:
    case 403:
      return "You don't have permission to see this space's permissions. Ask a space admin, or view this page as one.";
    case 404:
      return "This space couldn't be found. It may have been deleted or moved.";
    default:
      return "Couldn't load the space admins right now. Try refreshing the page.";
  }
}
