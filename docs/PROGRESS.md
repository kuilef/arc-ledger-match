# Implementation ledger — plan: docs/PLAN.md

2026-10-08: isolated new workspace on amethyst confirmed. Source repo absent.
Autonomous design/implementation/publication already explicitly approved.
Using brainstorming, writing-plans, executing-plans and TDD. No review prompts.
Task 1: red 25/29 failed on stub behavior; domain green 14/14 after CSV object
shape correction. Task 2: combined unit suite green 29/29.
Ruling: use only system Transfer principal, annotate ERC20 mirror where unique.
This avoids double counting; ERC20-only/mismatched movement remains unsupported.
Ruling: imported observations cannot claim RPC provenance or use reserved arc:
identities. Importer must use stable IDs and exclude externally duplicated rows.
Otherwise duplicates without any shared identity cannot be detected locally.
User clarification: explicit splits supported with summed principal budget.
Initial pinned dev packages had 9 high audit findings; replacing with current
compatible registry versions before release. Runtime dependencies: zero.
Normal shell setup refresh unavailable; reviewed escalations function locally.
Parent source thread not found by messaging tool; delivery happens at task end.

Task 3: installed Chrome UI smoke 3/3 passed. An added regression reproduced
stale evidence (unavailable reread left invoice paid); fixed by replacing the
selected hash group and invalidating removed/over-budget explicit allocations.
Latest deps clean install audit: 0 vulnerabilities. Initial stale lock peer
conflict resolved by recreating only this project's disposable dependencies.
Ruling: remove stale selected evidence on null/unsupported reread; record warning.
An RPC-wide failure before chain verification retains the prior timestamped
snapshot. No silent claim that a failed request reconfirmed an old transfer.
Windows Node 20 does not expand tests/*.test.mjs; test script now lists both
unit suites explicitly. Existing npm min-release-age and NO_COLOR warnings
are environmental; system/user settings were not changed.
Mainnet 2026-10-08T21:13:51.189Z: primary and dRPC chain reads succeeded;
three public receipts sampled, two supported system transfers, null zero hash
reported, raw timestamp/provider evidence saved. No transactions sent.
Using human-writing-editor for practical docs and requesting-code-review for
one independent fresh reviewer before publication.

Final review: two Important findings fixed (cached block height and global
raw-log identity), both regressions RED→GREEN; complete suite 31/31.
Real local browser UI in temporary installed Chrome profile: Circle and dRPC
each returned 2 supported transfers for one public hash, zero request failures.
Existing user Chrome profile fetch failed; left its configuration untouched.
Synthetic UI screenshot saved. Own temporary server stopped by recorded PID
and node command identity only. Final UI rerun underway after core fixes.
Using verification-before-completion and finishing-a-development-branch;
the requested integration is explicitly authorized publication of a new repo.
No new merge/push/deployment permission question is needed.

Parent follow-up: four minimal corrections implemented after reproducing the
candidate overflow, stale demo Clear/import/RPC cases and cross-origin redirect.
Global candidate links capped at 5,000 with atomic state replacement; stale demo
generation discarded; RPC redirects rejected. JSON preserves exact allocations;
spreadsheet CSV retains formula protection and is documented as a review export.
Full local checks passed: lint/typecheck/build, 35/35 units, 8/8 Chrome UI tests,
zero audit vulnerabilities. Maximum-size unit inputs stop at link 5,001; no
gigabyte report/UI stress or additional live chain calls were performed.
