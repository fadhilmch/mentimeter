# Dependency licences

Summary generated from `client/package-lock.json` and `server/package-lock.json` (package counts including transitive dependencies). It reflects the lockfile field only. Re-check before a release.

| Package set | Licence | Runtime | Dev/optional |
| --- | --- | --- | --- |
| client | Apache-2.0 | 2 | 3 |
| client | BSD-2-Clause | 2 | 0 |
| client | BSD-3-Clause | 1 | 0 |
| client | CC0-1.0 | 1 | 0 |
| client | ISC | 10 | 0 |
| client | MIT | 131 | 45 |
| client | MPL-2.0 | 0 | 12 |
| client | not declared in lockfile | 1 | 0 |
| server | 0BSD | 0 | 1 |
| server | Apache-2.0 | 7 | 11 |
| server | BSD-2-Clause | 3 | 0 |
| server | BSD-3-Clause | 3 | 1 |
| server | BlueOak-1.0.0 | 0 | 1 |
| server | CC0-1.0 | 1 | 0 |
| server | ISC | 5 | 7 |
| server | MIT | 142 | 112 |
| server | MPL-2.0 | 0 | 12 |
| server | not declared in lockfile | 0 | 1 |

Notes:

- Everything declared is permissive (MIT, ISC, BSD, Apache-2.0, 0BSD, CC0, BlueOak) except MPL-2.0, which is `lightningcss` and its platform binaries, used in the development/build toolchain. Distribution obligations should be checked for any packaged release; this table is not a release compliance verdict.
- `xmlhttprequest-ssl` 4.0.0 declares no licence field in the lockfile. Its published npm archive contains an MIT-style `LICENSE` (copyright passive.ly LLC); inspected directly. Preserve the notice when redistributing.
- This is an engineering summary, not legal advice.
