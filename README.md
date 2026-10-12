# Space Admins — a Confluence user macro rebuilt in Forge

A worked example of migrating a **Confluence Data Center user macro** to **Confluence Cloud** as an [Atlassian Forge](https://developer.atlassian.com/platform/forge/) app.

Drop the macro on any page and it lists the administrators of that space — as user cards linking to their profiles — plus any groups that hold admin rights.

## Why this one can't be auto-migrated

Confluence Cloud doesn't support user macros, so the Cloud Migration Assistant doesn't carry them over. Low-code "user macro" apps on the Marketplace can re-host the simple ones (HTML templates with a few parameters), but they flag anything that needs server-side logic.

This macro is the hard kind. On Data Center it reached into Confluence's Java internals to read space permissions. In Cloud, there are no Java internals to reach — the only way in is the REST API, with explicitly declared scopes, running as a specific user.

## Before → after

| | Data Center (`legacy/space-admins.vm`) | Cloud (`src/frontend/`) |
|---|---|---|
| Language | Velocity template | React (Forge UI Kit) |
| Data access | `spacePermissionManager`, pulled out of the Spring container with reflection | `GET /wiki/api/v2/spaces/{id}/permissions` |
| Runs as | The server (sees everything) | The person viewing the page |
| Permissions | Implicit — whatever the JVM can touch | Two declared, read-only scopes (below) |
| Rendering | Hand-built HTML | Native components (`User`, `SectionMessage`) |
| Failure modes | Throws a server error into the page | Loading, empty, no-permission and not-found states |
| Tests | None | Unit tests for the data logic (`npm test`) |

## Scopes

| Scope | Why it's needed |
|---|---|
| `read:space.permission:confluence` | Read who holds which permission in the space, to find the `administer` assignments. |
| `read:confluence-groups` | Turn an admin group's ID into its name. |

Both are read-only. User names and avatars come from the UI Kit `User` component, which respects each person's profile privacy settings and needs no extra scope.

Because calls go through `requestConfluence`, they run **as the viewer**. Someone who can't see a space's permissions in Confluence gets a clear message instead of the list — the macro never shows more than Confluence would.

## How it works

- `src/frontend/admins.js` — pure logic: pages through permission assignments (`_links.next`), keeps space-level `administer` entries, de-duplicates users, resolves group names, maps HTTP errors to readable messages. No Forge imports, so it's unit-tested with plain Node.
- `src/frontend/index.jsx` — the UI Kit macro: reads the space from the product context, calls the logic with a `requestConfluence`-backed fetcher, renders the result.
- `manifest.yml` — one `macro` module, `render: native`, two scopes.

## Run it

Requires Node 22 or 24 and a Confluence Cloud site where you're an admin (a [free developer site](https://go.atlassian.com/cloud-dev) works).

```bash
npm test                   # unit tests, no Atlassian account needed
./scripts/setup.sh         # register, deploy, and install to your site
```

`setup.sh` reads `FORGE_EMAIL` / `FORGE_API_TOKEN` from a gitignored `.env.forge` if present, otherwise runs `forge login`. Set `FORGE_SITE` to target a site other than the default.

Then edit a page, type `/Space Admins`, insert the macro, and publish.

## Writeup

[docs/writeup.md](docs/writeup.md) — what changes when a user macro moves to Forge, and why.
