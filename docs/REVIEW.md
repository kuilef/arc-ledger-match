# Independent review and corrections

2026-10-08: a fresh reviewer inspected domain, formats, Arc/RPC, UI, local server,
tests and task constraints without editing source or making network requests.
The reviewer ran the existing 29-unit suite and reproduced two Important issues:

1. Cached block timestamps skipped later receipt height validation. A second
   receipt could claim a different block number for the same cached hash.
   Fixed by caching number alongside timestamp and checking every receipt.
2. Filtering unrelated/non-Transfer logs preceded identity checks. Conflicting
   log indices could hide behind an ignored emitter/event. Fixed by validating
   all raw log identities and receipt coherence before filtering principal.

Both became failing regressions (RED: missing exception; 2 payments vs expected
1), then passed after corrections. Full lint/typecheck/build/unit suite:
31/31. The author's earlier stale-reread browser regression similarly failed
with an invoice still paid after null receipt, and passed after group replacement
and explicit allocation invalidation. No deferred Important/Critical findings.
No second review is claimed. See VERIFICATION.md for final browser results.

## Parent review follow-up

2026-10-08: four additional parent findings addressed in a minimal release:

1. Candidate lists could expand to 25 million IDs. A global 5,000-link budget
   now rejects the whole operation before swapping ledger/RPC state. The safe
   71-by-71 regression failed first; the boundary and 5,000-by-5,000 input cases
   now pass without constructing a giant report. Browser rejection retains
   the previous full report and RPC evidence.
2. Spreadsheet protection changes formula-leading IDs/reasons, so CSV allocation
   round-trip claims were incorrect. Protection remains intact; README, UI and
   Russian manual now designate JSON for lossless re-import and CSV for review.
   A regression preserves `-INV`, `+PAY`, `=reference` through JSON and verifies
   the protected CSV apostrophes are never silently removed.
3. Delayed demo promises could replace Clear/import/RPC results. All three UI
   cases reproduced the failure; a generation guard discards stale responses.
4. Allowlisted fetch URLs still followed redirects. A real offline 307 first
   reached the other local origin; `redirect: 'error'` now keeps its request
   count at zero. No live provider redirect incident is claimed.

Full local checks after the fixes: lint/typecheck/build passed, 35/35 units,
8/8 installed-Chrome UI tests, audit zero. No new independent review is claimed.
