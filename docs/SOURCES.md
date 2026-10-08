# Sources and prior art

Read-only review: 2026-10-08. All implementation is original; no prior-art
repository source was copied or linked as a dependency.

| Source | What was checked |
| --- | --- |
| [Arc USDC system events](https://docs.arc.io/arc/references/usdc-system-events) | Current mainnet Transfer emitters, 18/6 decimals, mirror streams and historical testnet boundary |
| [Arc RPC](https://docs.arc.io/arc/references/rpc-endpoints) | Chain 5042, anonymous/open-CORS primary, provider endpoints, transient lag/rate-limit behavior |
| [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) | Mainnet network identity and native USDC decimal model |
| [Arc House Microgrants](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq) | Competitive awards, deadline, public repo/profile/live mainnet requirement and limits |
| [DoraHacks program](https://dorahacks.io/hackathon/arc-microgrants/detail) | Same rules confirmed in browser; failed web-fetch recorded |
| [Zhekinmaksim/arc-invoice](https://github.com/Zhekinmaksim/arc-invoice) | README describes invoice creation, payment links, client/owner roles, Supabase authentication and accounting export. No license was evident in the root read; no code reused. |
| [hitmol/Arc-Crosschain-Checkout](https://github.com/hitmol/Arc-Crosschain-Checkout) | README describes SettleLink checkout, deterministic invoice vaults, CCTP routing, registry/backend/indexer and testnet evidence. Root MIT license was visible. No code reused. |

Arc Ledger Match works on arbitrary existing invoice records and explicit
allocation evidence. It creates no checkout, invoice vault or hosted account.
This comparison is based on each project's public README; it is not a claim
that their implementations were independently tested or audited.

Dependencies are pinned from the official npm registry. They are development
tools only; browsers load local original JavaScript/CSS with no runtime package.
Current-version engines were checked against installed Node 20.19.3. Audit and
license review are recorded in VERIFICATION.md. GitHub Actions use pinned SHAs.
