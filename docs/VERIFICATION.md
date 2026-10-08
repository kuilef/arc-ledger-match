# Verification — 2026-10-08

Environment: amethyst, Windows, Node v20.19.3, npm 11.4.2, installed Chrome.
Only the new task workspace was edited. No system setting, wallet, service,
other repository or persistent credential was changed.

| Check | Actual result |
| --- | --- |
| `npm run lint` | Passed, 0 lint errors |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm run build` | Passed, static dist generated |
| `npm test` | **35/35 unit tests passed**, 0 skipped |
| `npm run test:ui` | **8/8 installed-Chrome browser tests passed** |
| `npm audit --json` | **0 vulnerabilities**, 100 dev packages, no runtime packages |
| Fresh independent review | Two Important evidence-coherence findings reproduced and fixed with RED→GREEN tests; see REVIEW.md |
| Public source secret/PII review | No secret patterns/private contact fields found; only synthetic invoices and public mainnet evidence included |
| Dependency licenses | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0. Pinned dev-only packages; inventory in evidence/dependency-licenses.json |

Unit cases cover exact18/6 values, mirrors/duplicates/conflicting log indices,
shared evidence budgets, partial/multiple/overpayment, ambiguous candidates,
explicit splits, imported-reference priority, date windows/missing data,
failed/null/wrong-chain RPC, cached-block mismatch, retry/timeout/network/JSON,
CSV quotes/newlines/formulas, strict malformed/oversized input and forged import
provenance, a global candidate-link budget (including 5,000 rows per collection
with 300-character IDs), lossless JSON allocation re-import, and an actual offline
cross-origin HTTP 307 whose destination receives zero requests.
UI cases cover demo, split budget rejection, atomic malformed import,
markup safety, export download, private-path denial, no external demo requests,
repeat RPC dedup and invalidation when a receipt becomes unavailable, delayed
demo results after Clear/import/RPC, and candidate-budget rejection that preserves
the complete rendered report and earlier RPC observations.

The parent review regressions first failed on the previous source: unbounded
candidate expansion, three stale-demo cases and a redirect reaching its second
local origin. All pass after the minimal fixes. The redirect issue was reproduced
offline; no live provider redirect or privacy incident was observed. CSV formula
protection remains enabled; JSON is the documented lossless re-import format.
The maximum-size unit case stops at link 5,001 and never creates/serializes a
full Cartesian report. No gigabyte browser stress test was run.

## Live public mainnet evidence

`evidence/live-mainnet.json`, **2026-10-08T21:13:51.189Z**:

- Circle and dRPC anonymous chain checks returned `0x13b2` (5042).
- Bounded recent block sample selected three public transaction hashes.
- Production receipt reader observed two supported system Transfer payments;
  an intentionally unknown zero hash returned null and was marked unavailable.
- Raw receipt/block results, fees, request methods, provider and UTC timestamps
  are retained. This is observational mainnet integration evidence only.

`evidence/browser-live.json`: real local UI in an isolated temporary headless
installed-Chrome profile read public hash
`0x691405ed18faaf588878725c5df92a338cad75fdec5b1f38250d9073ae7ad9c4`
through **both Circle and dRPC**, yielding two system transfers each, no warning
or request failure. Repeated reads replaced the same event identities.
`evidence/browser-demo.png` contains only synthetic invoice/payment records.
These live observations predate the corrective commit. Live mainnet probes were
not repeated for that patch; its RPC transport change is covered offline, and
all eight UI checks run against the updated source with mocked RPC fixtures.

The user's existing Chrome profile, controlled through the browser tool, loaded
the UI and demo but live reads showed `RPC: Failed to fetch`. A screenshot tool
attempt timed out. Its settings/extensions/proxy were left unchanged. A fresh
temporary Chrome test profile proved the browser UI can read actual mainnet;
the existing-profile network issue remains a local environment limitation.
The app displays that failure without attributing an invoice or sending data
to another service. Node and fresh-profile successes are recorded separately.

## Build/publication boundary

CI runs validate, audit and Chromium UI tests on pushes with read-only GitHub
permissions and pinned action SHAs. Public mainnet tests are not in CI.
See [exact-commit runs](https://github.com/kuilef/arc-ledger-match/actions);
the delivery response identifies the successful run and commit.

Initial dependency pins had 9 high audit findings; current compatible pins were
installed from a clean project-local lock and audited with zero findings.
No global package/browser install occurred. Existing npm min-release-age and
NO_COLOR warnings were retained; they do not imply source check failures.
Windows Node 20's lack of wildcard expansion was corrected in the test command.

Not performed: public service hosting, grant submission, organizer outreach,
wallet connection, onchain deployment/payment, KYC, commercial audit,
independent finality/quorum proof, mobile real-device/accessibility audit or
exhaustive history indexing. Grant fit and payouts are not confirmed.
Only this project's temporary smoke servers were stopped after tests.
