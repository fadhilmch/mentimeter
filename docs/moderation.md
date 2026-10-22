# Response moderation

Applies to open-ended responses and word-cloud words. The presenter controls it from the Moderation panel on the presenter screen.

- **Default:** new responses show at once (`moderationMode: off`). Turning on "Hold new responses until I approve them" sets `approve`: new items are `pending` and invisible to the audience until approved.
- **States:** `visible`, `pending`, `hidden`, `deleted`. Hide is reversible (restore). Delete clears the text and its upvotes. The slot stays so stored positions, which upvotes use as their address, never shift.
- **Server-side filtering:** public state, broadcasts (Socket.IO and Ably), word-cloud totals and sizes, counts and CSV exports use only `visible` items. Nothing is filtered by CSS.
- **Upvotes:** refused (HTTP 400) for pending, hidden and deleted items; never retargeted to another response.
- **Own answers:** a participant's own word is returned to them flagged `pending` while waiting; hidden or deleted words are not returned.
- **Retries:** a resend with the same `clientId` after a delete does not bring the response back.
- **Routes (owner only, Bearer token):** `GET /api/presentations/:id/moderation`, `POST .../moderation/mode`, `POST .../moderation/:slideId/:responseId` with `{action: approve|hide|restore|delete}`. Other owners get 404, audience gets 401.
- **Audit:** `moderationLog` keeps owner, action, time, slide and response id (last 200). Never text.
- **Exports:** include only visible responses. Pending, hidden and deleted are excluded from every count.
- **Compatibility / rollback:** existing responses have no `status` and count as visible; ids are stamped on first moderation read. Rolling back the code leaves the extra fields unused. Pending items would then show as normal responses if the old code reads them, so switch the mode to off and approve or delete held items before rolling back.
- **Not included:** automatic profanity or AI filtering.
