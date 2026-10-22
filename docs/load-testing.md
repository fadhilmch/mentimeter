# Load testing the live voting path (brief 06, first slice)

## Method
`node server/scripts/load-test.js [sizes...]` boots the server with in-memory MongoDB and Socket.IO in one process, connects N websocket clients to one presentation, has every client vote at the same moment, then reads the stored votes. It reports ack latency percentiles, accepted versus stored votes (lost or duplicated answers), error messages, a run where voting is closed 40 ms into the burst, and bytes broadcast per action.

Limits of this method: one machine (2 CPUs), in-memory database, one server process, no network latency, no reconnect storm, Socket.IO only (not Ably). The numbers are a repeatable baseline for comparison. They are not a supported audience size, and no targets are set from them yet.

## Finding
Before the change, 100 simultaneous voters produced 40 errors and 250 produced 213. Each failed voter saw a raw database "No matching document found ... version" message. No accepted vote was lost; the failures were version conflicts that exhausted the 8 retries, because every action reads and rewrites the whole presentation document.

Fix in this PR: actions for one presentation run one after another inside a process (`applyLiveActionByCode`). The version check and retry stay for the case of several processes.

| Audience | Before: errors | Before: p50 / p95 | After: errors | After: p50 / p95 |
| --- | --- | --- | --- | --- |
| 50 | 0 | 595 / 780 ms | 0 | 181 / 305 ms |
| 100 | 40 | 1285 / 1453 ms | 0 | 299 / 527 ms |
| 250 | 213 | 2436 / 2508 ms | 0 | 938 / 1717 ms |

After the change, accepted equals stored in every run, with no duplicates. Closing voting 40 ms into a burst of 250: 6 accepted, 244 refused as closed, 0 errors, no accepted answer lost.

Broadcast cost: each action broadcasts the full public state, about 340 bytes here (one small question). That is about 85 KB sent to the room per action at 250 people, and it grows with the deck and with open-ended responses. Changed-slide or coalesced updates are the next step and are not done.

## Not done in this slice
Reconnect storms, Ably, multiple replicas (this fix assumes one process per presentation for ordering; several replicas fall back to version retries and will show the old failure under heavy bursts), per-session answer records, presence counts and connection banners, and the dashboard payload (covered by #36).
