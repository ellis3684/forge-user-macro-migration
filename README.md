# Space Admins — a Confluence user macro rebuilt in Forge

A worked example of migrating a **Confluence Data Center user macro** to **Confluence Cloud** as an [Atlassian Forge](https://developer.atlassian.com/platform/forge/) app.

Drop the macro on any page and it lists the administrators of that space — as user cards linking to their profiles — plus any groups or built-in roles (like "Confluence admins") that hold admin rights.

## Why this one can't be auto-migrated

Confluence Cloud doesn't support user macros, so the Cloud Migration Assistant doesn't carry them over. Low-code "user macro" apps on the Marketplace can re-host the simple ones (HTML templates with a few parameters), but they flag anything that needs server-side logic.

This macro is the hard kind. On Data Center it reached into Confluence's Java internals to read space permissions. In Cloud, there are no Java internals to reach — the only way in is the REST API, with explicitly declared scopes, running as a specific user.

## Before → after

| | Data Center (`legacy/space-admins.vm`) | Cloud (`src/frontend/`) |
|---|---|---|
| Language | Velocity template | React (Forge UI Kit) + a Node resolver |
| Data access | `spacePermissionManager`, pulled out of the Spring container with reflection | `GET /wiki/api/v2/spaces/{id}/permissions` |
| Runs as | The server (sees everything) | The person viewing the page |
| Permissions | Implicit — whatever the JVM can touch | Two declared, read-only scopes (below) |
| Rendering | Hand-built HTML | Native components (`User`, `SectionMessage`) |
| Failure modes | Throws a server error into the page | Loading, empty, no-permission and not-found states |
| Tests | None | Unit tests for the data logic (`npm test`) |

## Scopes

| Scope | Why it's needed |
|---|---|
| `read:space:confluence` | Read the space's permission assignments, to find the `administer` entries. This is the scope Atlassian's v2 API spec lists for `GET /spaces/{id}/permissions` — not the similarly named `read:space.permission:confluence`, which covers the newer role-assignment endpoints. |
| `read:confluence-groups` | Turn an admin group's ID into its name. |

Both are read-only. User names and avatars come from the UI Kit `User` component, which respects each person's profile privacy settings and needs no extra scope.

Because calls go through `api.asUser().requestConfluence`, they run **as the viewer**. The first time someone views the macro, Forge asks them to allow access. Someone who can't see a space's permissions in Confluence gets a clear message instead of the list — the macro never shows more than Confluence would.

## How it works

- `src/lib/admins.js` — pure logic: pages through permission assignments (`_links.next`), keeps space-level `administer` entries, de-duplicates users, resolves group names, labels built-in access classes, maps HTTP errors to readable messages. No Forge imports, so it's unit-tested with plain Node.
- `src/index.js` — the resolver: reads the space from the invocation context and runs the logic with an `api.asUser().requestConfluence` fetcher. Failures are logged (visible in `forge logs`) and returned as a readable message plus the HTTP status.
- `src/frontend/index.jsx` — the UI Kit macro: calls the resolver with `invoke` and renders loading, error, empty, and result states.
- `manifest.yml` — one `macro` module (`render: native`) wired to one `function`, two scopes.

The API calls live in the resolver rather than the frontend on purpose: frontend `requestConfluence` calls can be rejected with a 403 for some endpoints, and backend calls give you server-side logs when something goes wrong.

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
