# Security and trust boundaries

Only synthetic invoice/payment examples and public chain observations belong
in this repository. Keep real invoice exports outside it. The app holds records
in memory, renders untrusted text through textContent, validates known fields,
bounds imports/receipts and neutralizes spreadsheet formulas in CSV exports.
No telemetry, remote fonts, CDN scripts, wallets, signing, keys or transfer
methods exist. RPC endpoints are allowlisted anonymous HTTPS providers, with
credentials omitted and referrer suppressed. Only selected hashes and the block
identifiers needed for receipts leave the browser.

RPC results are observations from a provider, not cryptographic proofs. No
confirmation depth/reorg monitor, light client, independent quorum or invoice
reference decoder exists. Current mainnet system events are authoritative
within the supported receipt model. Explicit-user and imported-reference
allocations are commercial assertions. Imported-unverified rows cannot prove a
payment occurred. A renamed duplicate without common identity cannot be detected.

The loopback server serves a narrow static allowlist from dist, with CSP and
no-store headers. Browser memory and downloaded reports may contain sensitive
user metadata; the user controls their storage and sharing. Hosting dist publicly
requires a deliberate user deployment, corresponding CSP, and a review with
only synthetic data. No public deployment is part of this release.

Dependencies have no runtime role, are pinned in package-lock.json and installed
without lifecycle scripts in CI. npm audit is a point-in-time check; it cannot
guarantee future safety. No external financial or security audit is claimed.
