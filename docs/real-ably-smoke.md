# Real Ably smoke test (not run)

Nothing in this repository has been tested against a real Ably account. The Ably path is covered only by unit tests with a mocked publisher (`server/tests/ably.test.js`, `serverlessBroadcast.test.js`) and by the reconnect test over Socket.IO. Run this checklist once with a throwaway Ably app and a staging deploy before relying on serverless hosting.

You need: an Ably app with a root key (free tier is fine), a staging deploy with `ABLY_API_KEY` set and `VITE_LIVE_MODE=ably`, MongoDB, and two phones or browser profiles.

1. Open `/api/live/<code>/token`. Expect 200 and a token request, with a subscribe-only capability for that code's channel and no publish.
2. Phone A joins the code. In the Ably dashboard (Stats / Dev console) confirm one connection and one subscribed channel `presentation:<code>`.
3. Phone B votes. Phone A sees the new tally within about a second. Note the delay.
4. The presenter changes slide, closes voting, hides results. Phone A follows each change in order. Open-ended slides: held or hidden responses never appear on A.
5. Airplane-mode phone A for 30 seconds, vote on B ten times, restore A. A shows the current tally (it catches up through the state read, not by replaying missed messages). Note how long it takes.
6. Let phone A sit for the token lifetime and confirm it renews without a visible gap.
7. Burst: run `server/scripts/load-test.js` style traffic against staging and watch Ably's rate limits and message counts for the app. A broadcast per vote costs one Ably message per vote per room; consider `BROADCAST_COALESCE_MS` (socket server only) and measure.
8. Failure case: set a wrong `ABLY_API_KEY` on staging. Votes must still save, and the server log should show `Live publish failed after save`.

Record the date, Ably plan, results and measured delays here. Until then, treat serverless Ably as unverified.
