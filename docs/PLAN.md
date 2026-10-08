# Arc Ledger Match Implementation Plan

> **For agentic workers:** use superpowers:executing-plans to implement this plan.

**Goal:** a local evidence-based allocation tool for existing USDC invoices.
**Architecture:** pure typed domain, conservative Arc receipt decoder and bounded
RPC client, browser UI and dependency-free local server.
**Tech stack:** TypeScript, browser DOM, bigint, node:test, ESLint, Playwright.
**Spec:** [DESIGN.md](DESIGN.md).

## Global constraints

- New isolated repository, no changes to other projects or system settings.
- Chain 5042; system18 and ERC20 6; fee = gasUsed × effectiveGasPrice.
- No float money, no signatures/keys/payments/backend/trackers.
- No heuristic paid state. Split budgets never exceed payment principal.
- Strict bounds and untrusted import provenance.

## Review focus

Conflicting evidence identities; failed/null/wrong-chain receipts; repeat imports;
CSV injection and markup; missing timestamps when a window exists. Tests pin
these to domain/import/RPC modules. Browser smoke pins atomic import errors.

## Tasks

1. Domain and import/export: tests for exact decimals, CSV escaping, validation,
   partial/multiple/overpay, splits, budget reuse and candidate ambiguity;
   watch tests fail, implement src/domain.ts and src/formats.ts, run suite.
2. Arc receipts/RPC: tests for duplicate mirrors/logs, exact18/6, unsupported,
   fail/null/wrongchain/timeout/rate limit; implement src/arc.ts, src/rpc.ts,
   record public read-only smoke evidence with provider and timestamp.
3. Browser: test demo allocations, import errors, split and report exports;
   implement src/app.ts, index.html and styles.css; run actual browser smoke.
4. Docs/publication: README, Russian manual/grant draft, MIT, CI. Inspect source,
   secrets/PII/dependency licenses, validate, publish new repo, await terminal CI.
