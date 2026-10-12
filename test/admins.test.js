import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessClassLabel, ConfluenceError, describeError, loadSpaceAdmins } from '../src/lib/admins.js';

const admin = (type, id) => ({ principal: { type, id }, operation: { key: 'administer', targetType: 'space' } });
const other = (type, id, key = 'read') => ({ principal: { type, id }, operation: { key, targetType: 'space' } });

function stub(routes) {
  const calls = [];
  const fetchJson = async (path) => {
    calls.push(path);
    const hit = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
    if (!hit) throw new ConfluenceError(404, `no route for ${path}`);
    const value = hit[1];
    if (value instanceof Error) throw value;
    return typeof value === 'function' ? value(path) : value;
  };
  return { fetchJson, calls };
}

test('keeps only space-level administer assignments and de-duplicates users', async () => {
  const { fetchJson } = stub({
    '/wiki/api/v2/spaces/42/permissions': {
      results: [admin('user', 'u1'), admin('user', 'u1'), other('user', 'u2'), admin('user', 'u3'),
        { principal: { type: 'user', id: 'u4' }, operation: { key: 'administer', targetType: 'page' } }],
      _links: {},
    },
  });
  const result = await loadSpaceAdmins('42', fetchJson);
  assert.deepEqual(result.userIds, ['u1', 'u3']);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.accessClasses, []);
});

test('reports built-in access classes that hold admin', async () => {
  // Shape captured from a real Confluence Cloud site.
  const { fetchJson } = stub({
    '/wiki/api/v2/spaces/42/permissions': {
      results: [admin('user', 'u1'), admin('access-class', 'ALL_PRODUCT_ADMINS'), other('access-class', 'ALL_LICENSED_USERS', 'delete')],
      _links: {},
    },
  });
  const result = await loadSpaceAdmins('42', fetchJson);
  assert.deepEqual(result.userIds, ['u1']);
  assert.deepEqual(result.accessClasses, ['Confluence admins']);
});

test('labels unknown access classes readably', () => {
  assert.equal(accessClassLabel('SOME_NEW_CLASS'), 'Some new class');
});

test('follows _links.next across pages', async () => {
  const { fetchJson, calls } = stub({
    '/wiki/api/v2/spaces/42/permissions?limit=250': { results: [admin('user', 'u1')], _links: { next: '/wiki/api/v2/spaces/42/permissions?cursor=abc' } },
    '/wiki/api/v2/spaces/42/permissions?cursor=abc': { results: [admin('user', 'u2')], _links: {} },
  });
  const result = await loadSpaceAdmins('42', fetchJson);
  assert.deepEqual(result.userIds, ['u1', 'u2']);
  assert.equal(calls.length, 2);
});

test('resolves admin group names, sorted, and survives a failed lookup', async () => {
  const { fetchJson } = stub({
    '/wiki/api/v2/spaces/42/permissions': { results: [admin('group', 'g2'), admin('group', 'g1'), admin('group', 'g3')], _links: {} },
    '/wiki/rest/api/group/by-id?id=g1': { name: 'confluence-admins' },
    '/wiki/rest/api/group/by-id?id=g2': { name: 'apac-leads' },
    '/wiki/rest/api/group/by-id?id=g3': new ConfluenceError(403, 'forbidden'),
  });
  const result = await loadSpaceAdmins('42', fetchJson);
  assert.deepEqual(result.groups.map((g) => g.name), ['apac-leads', 'confluence-admins', 'Unknown group']);
});

test('rejects when there is no space in context', async () => {
  await assert.rejects(loadSpaceAdmins(undefined, async () => ({})), { status: 400 });
});

test('maps HTTP failures to readable messages', () => {
  assert.match(describeError(new ConfluenceError(403, 'x')), /permission/);
  assert.match(describeError(new ConfluenceError(404, 'x')), /couldn't be found/);
  assert.match(describeError(new ConfluenceError(500, 'x')), /Try refreshing/);
  assert.match(describeError(new Error('network')), /Try refreshing/);
});
