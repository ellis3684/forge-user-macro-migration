# Rebuilding a Data Center user macro in Forge: what changes and why

Atlassian Data Center reaches end of life in March 2029. For most teams, the hard part of moving to Cloud isn't the Marketplace apps — those usually have a Cloud version or a suggested replacement. It's the things they built themselves. User macros are a good example: Confluence Cloud doesn't support them, so they don't migrate at all.

I rebuilt one to see what that actually involves. It's a "Space Admins" macro: put it on a page and it lists who administers the space. Small, but it's the kind of macro that low-code converters can't handle, because it needs server-side access to permissions.

## The original

On Data Center, user macros are Velocity templates, and the Velocity context only exposes a handful of objects. A common workaround was to use reflection to pull Java services out of Confluence's Spring container — in this case `spacePermissionManager` — and call them directly. That macro ran with the server's full view of the permission system. Newer Data Center versions restrict this kind of reflection, which is one reason these macros were already fragile before anyone talked about migrating.

## What changes in Forge

**Data access becomes an API call.** There's no container to reach into, and the call lives in a small backend function (a resolver) rather than the page itself — my first version called the API straight from the frontend and got a 403 even as a site admin, which is a known rough edge. The macro calls `GET /wiki/api/v2/spaces/{id}/permissions`, keeps the assignments where the operation is `administer` on the space, and follows `_links.next` until it has every page. Admin groups come back as IDs, so a second call turns each one into a name. Some admins aren't people or groups at all: Cloud returns built-in "access classes" such as all Confluence admins, which the old macro never had to think about. And some "users" are apps: on a fresh site, the Slack-style notification integrations show up as space admins alongside the actual humans. The macro looks up each account's type and lists apps on their own line.

**Permissions become explicit.** A Forge app declares its scopes in the manifest, and the site admin approves them at install. This one needs two, both read-only: one for space data, one for group names. Getting them right took a second try — the obvious-sounding `read:space.permission:confluence` is for the newer role-assignment endpoints, and the permissions endpoint actually wants `read:space:confluence`. The API spec is the source of truth, not the scope names. Writing that list down is a useful exercise in itself — the old macro could touch anything, and nobody had ever had to say what it actually needed.

**It runs as the viewer, not the server.** The app's resolver calls the API with `api.asUser()`, as the person looking at the page. That's the biggest behavioral change, and it's a good one: if a reader can't see the space's permissions in Confluence, they can't see them through the macro either. It also means the "no permission" case is real and has to be designed for. The old macro never had that problem, because it never asked.

**Rendering becomes components.** Instead of hand-built HTML, the macro uses UI Kit. The `User` component renders each admin as a profile card from just an account ID, and it applies each user's own privacy settings, so there's no user lookup to write and no extra scope to request.

**Failure states become part of the job.** The Velocity version had two outcomes: a list, or a stack trace in the page. The Forge version has a loading state, an empty state, a permission message, a not-found message, and a generic retry message. That logic lives in a plain JavaScript module with no Forge imports, so it's covered by unit tests that run without an Atlassian account.

## What this means for a migration

For a single macro, the rebuild is a day or two of work. The real cost is in the questions it forces: what data does this actually need, who should be allowed to see it, and what should happen when they can't. Those answers usually aren't written down anywhere, because on Data Center nobody had to ask.

That's also why these macros are worth inventorying early. A team with 20 custom macros across a few thousand pages has 20 small design decisions waiting for them, and March 2029 is a fixed date.
