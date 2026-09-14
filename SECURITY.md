# Security model and limitations

Do not enter, export, upload, or paste private keys/seed phrases into this tool or DevTools. All private signing stays inside Phantom. The app receives public keys and signed transactions. Unsigned and signed transaction bytes live only in memory; only a submitted transaction signature and its expiry metadata are persisted.

The ship wallet pays fees by default and supplies one signature. A distinct fee account is optional and requires its own second signature. Every selected account must belong to the user. The owner must be a current primary authority of a standard single-authority Player Profile. The funder (which may equal the owner) must be a plain funded SOL account. Only the official configured SAGE mainnet program/game and classic SPL token program are supported; no Token-2022, multisig profiles, custom SAGE deployments, or arbitrary transaction uploads.

The app constructs only a compute limit, idempotent destination ATA creation, and the official addShipEscrow instruction. It validates the returned owner message for unchanged ordered deposit instructions, account privileges, signer set, payer, and blockhash. It permits tightly bounded compute changes and Lighthouse assertion tags 2 through 15 only, against accounts already present. Memory writes/closes and unfamiliar instructions are rejected. This validator does not independently implement every Lighthouse predicate; the on-chain Lighthouse program interprets them. The funding signer must preserve the owner's entire message exactly. All required signatures are verified locally before signed simulation and preflight-enforced submission.

Message equivalence is not an audit of the SAGE or Lighthouse on-chain programs. Program upgrades, compromised wallet/browser/RPC, malicious dependency/build changes, or altered downloaded source remain risks. Account data comes from the selected RPC, not a local trustless validator. Review the code, executable bundle, wallet preview, and destination independently. This utility cannot remove financial risk or guarantee a deposit will finalize.

The fee cap is distinct from account-rent costs. Reviewed total funding debit is checked in both unsigned and signed simulations. These are simulations, not guarantees against subsequent chain changes. Do not transact if the amount or destination is unexpected. Never bypass Phantom security warnings to make this utility work.

The localhost viewer binds only to loopback. It rejects unexpected Host headers, file paths and non-GET/HEAD methods, supplies a restrictive CSP, and never proxies RPC or handles wallet secrets. It has no external listener, remote update process, or telemetry. Browser connections are restricted to HTTPS RPC endpoints; dependencies are bundled locally.

The Windows package includes a verified OpenJS-signed portable Node runtime;
it does not install system-wide. The launcher opens a fixed localhost URL only
after the viewer binds successfully. Keep the included runtime current when
maintaining a fork; this release deliberately has no automatic updater.
Version 0.2.3 uses manual selection and direct account reads. The catalog is
metadata, not proof of ownership. Selected mints, current/linked registrations,
source owner/mint/state/balance, profile authority, exact faction CSS, and every
existing escrow registration are checked on-chain. A missing hint never falls
back to a program-wide or token-owner scan. Profile transaction links are parsed
locally (not fetched as URLs), require a successful SAGE receipt, and resolve
only a uniquely identified profile currently controlled by the ship owner.

After wallet connection, one bounded public-history lookup can identify owned
profiles. It checks up to 12 transaction references/receipts and at most 512
distinct candidate keys with direct reads in batches of at most 100. Historical
participation is only a hint: current PROFILE ownership, supported layout, and
unexpired primary wallet authority are required. Multiple profiles require a
choice; missing history uses an explicit older-page click or manual fallback.
No signing, sending, account-wide scans or background polling occur in lookup.
Review automatically checks mainnet,
the SAGE game account and current blockhash before reading the selected deposit.
This is an access check, not an audit of RPC truthfulness or proof of success.
The public RPC is preselected and paced at 350 ms between request starts.
Custom endpoint URLs remain in tab memory and go only to the chosen provider.
Provider errors are not displayed verbatim. HTTP redirects are rejected,
cookies omitted, rate-limit retries disabled, and requests bounded to 20 seconds.
Changing the URL invalidates readiness and all unsubmitted approvals. Pending
submission records survive changes and reloads. No embedded/shared API key exists.

Submission is explicit and guarded by a same-origin browser lock. The transaction signature is recorded before RPC submission. A timeout leaves the record unresolved and blocks another preparation, even across reloads. This is not global deduplication: separate browser profiles, origins, copies, or cleared storage can bypass it. Never use those as a retry mechanism. A read-only status check clears the guard only on a finalized result. No automatic chain polling occurs.

Report a suspected vulnerability privately to the person who distributed your copy or official Star Atlas support. There is no project-controlled security mailbox yet. Share public transaction IDs and redacted diagnostics only. Do not treat unsolicited Discord DMs or a downloaded file as official support.
