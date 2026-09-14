# v0.2.3 — One-wallet deposits

Download **sage-ship-deposit-v0.2.3-WINDOWS-APP.zip**, Extract All, and run
START-WINDOWS.cmd after closing the older launcher.

- Connect the Phantom account holding your ship. The same account now pays SOL
  fees and any account rent by default. A second account is no longer mandatory.
- Review the deposit, approve once in Phantom, then choose **Send this deposit**.
  Signing alone never sends. A signed simulation must pass before Send is enabled.
- Separate fee-account funding remains an optional two-approval workflow.
- Preserves automatic profile lookup, manual ship selection, the included public
  RPC, direct account checks, strict message/signature validation, fee/debit caps,
  preflight and duplicate-submission protection. No new polling or rent-transfer
  instruction, shared secrets, hosting or automatic updates.

Unsigned simulation and a user-approved one-wallet deposit were verified for
one configuration. Personal wallet addresses, transaction receipts, timestamps,
balances and individual test fees are intentionally omitted from public notes.
The original same-wallet failure's underlying cause remains unknown.

All 39 offline tests pass, including both approval modes, altered approvals,
invalid signatures, changed wallets, failed/expired simulations and excessive
fees/debits. This is **one verified ship/account configuration**, not an
independent security audit or a guarantee for every ship. Keep this a pre-release.

The tested transaction source and browser bundle are unchanged. This is a
documentation-only update; personal test records are not included.

The SOURCE-CODE ZIP is for the repository's Code tab. The WINDOWS-APP ZIP is the
ready-to-run release download. Use the Windows asset, not GitHub's generated
source archive, to run the app.
