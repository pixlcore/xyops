#!/usr/bin/env node

// Deprecated xyOps database CLI.
// Copyright (c) 2019 - 2026 PixlCore LLC
// Released under the BSD 3-Clause License.
// See the LICENSE.md file in this repository.

// Keep this entrypoint so existing invocations receive migration instructions.
// Do not load configuration or storage: direct database access bypasses the
// running conductor's caches, locking, permissions, and application logic.
process.stderr.write(`The xyOps database CLI (db-cli.js) is deprecated and disabled.

Please use xyCLI, the official command-line interface for xyOps.
xyCLI uses the REST API so changes are handled by the running conductor.

Install:
  npm install -g @pixlcore/xycli

Configure:
  xy config --base_url https://xyops.example.com --api_key YOUR_API_KEY

Examples:
  xy tickets --status open
  xy ticket get --id TICKET_ID
  xy ticket delete --id TICKET_ID

Documentation: https://github.com/pixlcore/xycli
`);

// Return a failure status so scripts cannot mistake this for a completed command.
process.exitCode = 1;
