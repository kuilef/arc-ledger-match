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
