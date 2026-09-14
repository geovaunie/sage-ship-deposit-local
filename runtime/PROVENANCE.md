# Bundled Windows runtime

Node.js v24.18.0, Windows x64, unmodified `node.exe`.

- Original executable: the locally installed Node.js runtime.
- Authenticode signature checked before packaging: **Valid**, OpenJS Foundation.
- SHA-256: `9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de`
- Official source and license: https://github.com/nodejs/node/tree/v24.18.0
- Included LICENSE downloaded from https://raw.githubusercontent.com/nodejs/node/v24.18.0/LICENSE

This executable only runs the included static-file viewer. It is not installed
system-wide, is not a wallet, and is not a signing service. No automatic updater
is included. Windows ARM64 may require x64 emulation; this package targets x64.
Other platforms can use the included source with their own Node.js runtime.
