import Resolver from '@forge/resolver';
import api, { assumeTrustedRoute } from '@forge/api';
import { ConfluenceError, describeError, loadSpaceAdmins } from './lib/admins';

// Calls the Confluence REST API *as the person viewing the page*, so a viewer
// only ever sees what Confluence already lets them see.
// assumeTrustedRoute: every path is either built in lib/admins.js (with
// encoded ids) or is a `_links.next` cursor returned by Confluence itself.
async function fetchJson(path) {
  const response = await api.asUser().requestConfluence(assumeTrustedRoute(path), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Confluence returned ${response.status} for ${path}: ${body.slice(0, 500)}`);
    throw new ConfluenceError(response.status, `${response.status} on ${path}`);
  }
  return response.json();
}

const resolver = new Resolver();

resolver.define('getSpaceAdmins', async ({ context }) => {
  try {
    const admins = await loadSpaceAdmins(context?.extension?.space?.id, fetchJson);
    return { ok: true, ...admins };
  } catch (error) {
    console.error('getSpaceAdmins failed', error);
    return { ok: false, status: error?.status ?? null, message: describeError(error) };
  }
});

export const handler = resolver.getDefinitions();
