# SAGE Local 0.2.3 — one-wallet deposits

**Windows users:** download `sage-ship-deposit-v0.2.3-WINDOWS-APP.zip`, Extract All,
then double-click `START-WINDOWS.cmd`. Do not use GitHub's automatic source ZIP
as the ready-to-run app. Close the previous launcher before starting this copy.

This local browser utility works around blocked inventory searches by letting
you select a ship manually. Solana Tracker's no-key public endpoint is included;
no personal RPC setup or creator-hosted server is required for the tested path.
Public service availability is not guaranteed. This is community software,
not an official Star Atlas/Phantom product and not independently audited.

## Use it

1. Connect the Phantom account holding your ship. The app finds and fills your
   public Player Profile from a small batch of recent activity, when available.
2. Select the ship, quantity and your faction CSS.
3. If multiple profiles are found, choose one. If none is found, choose **Check
   older activity**, or paste a successful SAGE transaction's Solscan link,
   signature, or public Player Profile address as a fallback.
   The app verifies current profile authority; a receipt does not grant authority.
4. Keep the same Phantom account selected. It pays SOL fees and any account rent;
   make sure it has enough SOL. A second account is not required.
5. Choose **Review my deposit**. This only reads chain data and simulates.
6. Check the ship, quantity, destination, wallet and SOL limit. Choose
   **Approve with ship wallet**. Signed simulation must pass before Send appears.
7. Only the final **Send this deposit** button submits. Use **Check confirmation**
   until finalized, then refresh the official game's CSS inventory.

Never paste a seed phrase or private key. Never bypass wallet warnings.
Wallet connection does not sign, send, or query inventory. After connecting,
the app performs one bounded public-history lookup. This uses up to 12 recent
transaction references/receipts and at most 512 distinct account candidates,
batched in groups of at most 100. Older history is read only on another click.
Lookup results stay in tab memory, are reset on wallet/RPC changes, and are
revalidated during deposit preparation. History is not an exhaustive registry:
session-key activity or unavailable receipts can prevent automatic discovery.

Version 0.2.3 defaults to one wallet. An optional separate-fee-account setting
preserves the two-approval workflow; only use accounts you own. No creator wallet
is bundled or used. The earlier failure's underlying cause remains unproven.

## Manual selection limitations

The bundled catalog contains 63 ship **types**, not an inventory or balances.
Current ownership, quantity, mint, program and CSS are always read on-chain.

- Bundled registration hints are available for Armstrong IMP Tip and Ogrika Ruch.
- Other ship registrations can be recovered from an existing matching entry in
  the user's CSS escrow, including a zero-quantity entry.
- If neither exists, Advanced accepts the public **SAGE ship-registration address**.
  This is a different address from the mint. Obtain it from a decoded successful
  deposit of that ship or a knowledgeable moderator. The app rejects a mismatch.
- Advanced accepts a custom ship mint for unlisted ships and an optional explicit
  source token-account address. Otherwise it checks the standard associated token
  account. No balance there does not prove the wallet owns no ships elsewhere.
- If a transaction link cannot identify exactly one currently controlled profile,
  paste the public Player Profile address instead. Wallet, Sage Player Profile,
  and Starbase Player addresses are not interchangeable.
- Retired same-mint CSS escrow registrations stop preparation and must be updated
  in the official game. Ship-registration update links are followed with a bound.
- Only classic SPL, initialized zero-decimal ship mints and standard single-authority
  profiles are supported. No Token-2022 or multisig profiles.

## What changed

0.2.3 removes the mandatory different-wallet check and defaults fees to the ship
wallet. One verified signature plus a successful signed simulation enables the
separate Send button. Optional two-account funding retains both signature checks.
Changing fee mode discards unsubmitted approvals. No rent-prefunding transfer,
new program, extra polling or automatic submission was added.

0.2.2 adds automatic public player-profile lookup after connection, explicit
selection for multiple profiles, and a user-controlled older-history button.
Public-history profile lookup was tested without requiring a pasted profile
address or transaction link.

0.2.1 introduced the manual ship selection below:

The previous version depended on blocked indexed reads. Merely reconnecting
Phantom or changing button labels did not solve that. This version's UI always
selects direct mode and never calls `getProgramAccounts` or
`getTokenAccountsByOwner`, even when a registration is missing.
The old discovery helper remains in source for regression coverage but is not
used by this interface.

The public RPC is preset under optional Connection settings. Review tests
mainnet, the SAGE game account and blockhash access automatically. Every deposit
still undergoes account validation and unsigned/signed simulation.
Public RPC calls start at least 350 ms apart, with no background polling,
automatic retries, or hidden provider switching.

Changing the RPC discards unsubmitted approvals but retains pending-submission
records. Endpoint credentials, if you use a custom endpoint, remain in tab
memory and never enter logs or browser storage. Raw provider errors are redacted.

## Validation status

- All 39 offline transaction, direct-mode, source validation, signature, fee-cap,
  pending-record, startup and error-handling regressions passed.
- Live read-only RPC checks and unsigned deposit simulation passed for a tested
  configuration. Simulations are not live transfers or fee quotes.
- Profile discovery and the transaction-link fallback verified current authority.
- A user-approved one-wallet deposit was reported and independently checked as
  finalized. This is one tested configuration, not an independent security audit
  or a guarantee for every ship, wallet or account state.
- No real wallet private keys were read while building this version. Offline
  tests use generated fixture keys.

Public documentation intentionally excludes personal wallet addresses, transaction
receipts, timestamps, balances and individual test fees. Transaction source and
built browser files are unchanged from the tested v0.2.3 Windows package.

## Safety and operating limits

The network fee cap is 0.0002 SOL. The reviewed total debit includes allocation
and rent, capped at 0.05 SOL. A failed submitted transaction can still incur a fee.
Simulations are estimates, not guarantees against changing chain state.

Owner signatures are checked against the intended instructions. Only tightly
bounded, recognized wallet safety assertions and compute changes are accepted.
If a separate fee wallet is selected, it must preserve the owner's entire message.
All required signatures, signed simulation and preflight are required before an
explicit send. A one-wallet transaction requires one signature, not two.

**If submission is uncertain, do not retry or clear storage.** The signature is
recorded before sending. Another deposit stays blocked until a finalized receipt
is found. Use the explorer/support to resolve missing receipts. Never switch
browser profiles or run duplicate copies to get around that guard.

## Running locally

The included Windows x64 runtime serves only bundled static files on
`http://127.0.0.1:8787`. Keep its launcher window open. Use Chrome or Edge with
Phantom; if the default browser has no Phantom, copy that URL into one that does.
Do not open `dist/index.html` as a file: Phantom requires a supported page origin.

No installation, router changes, Tailscale, port forwarding, telemetry, automatic
updates, runtime CDN dependencies, RPC proxy or remote signer are included.
Internet access to the chosen RPC is still required. Account data is trusted
from that provider rather than verified by a local Solana validator.

## Source and reproducible build

The matching `sage-ship-deposit-v0.2.3-SOURCE-CODE.zip` is for source review and
GitHub's Code tab. Extract it and upload the **contents** of SOURCE-CODE, preserving
the folders. Attach the intact WINDOWS-APP ZIP to a new **v0.2.3 pre-release**.
Do not relabel an older ZIP as this version.

Source: `src/`. UI: `public/`. Built browser files: `dist/`.
The source ZIP deliberately omits `runtime/node.exe`; the Windows ZIP includes it.

```sh
npm ci --ignore-scripts
npm run build
npm test
node scripts/serve.mjs
```

On macOS/Linux, use your own supported Node.js installation. Prebuilt Windows
users do not need npm or Node installation. Dependencies are pinned; no dependency
versions changed for this patch. Source is MIT; bundled dependencies retain their
licenses in THIRD-PARTY-NOTICES.txt.

Run `node scripts/check-release.mjs` (or `runtime/node.exe scripts/check-release.mjs`)
to check distributed file hashes. A manifest supplied with a ZIP proves integrity
relative to that manifest, not authenticity. Verify the ZIP hash independently.

Tested Windows ZIP SHA-256:
`2b9c2c41a8a8bc760f8c7c03d77ff0432dbf3604db08395d9acff54e8a19e198`

## Sources

- [Official Star Atlas item catalog](https://build.staratlas.com/dev-resources/apis-and-data/galaxy-api/items)
- [Solana direct account reads](https://solana.com/docs/rpc/http/getmultipleaccounts)
- [Solana public address history](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- [Public RPC provider](https://freesolanarpc.com/)
- [Phantom connection API](https://docs.phantom.com/solana/establishing-a-connection)
- [Star Atlas SDK](https://github.com/staratlasmeta/star-atlas-programs)

Read SECURITY.md before transacting. Public transaction IDs can identify a wallet
and expose its activity. Share them only with trusted support when you accept that
privacy tradeoff. Redact errors and never share wallet secrets.
