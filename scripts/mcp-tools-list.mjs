// The MCP handshake the package check performs against the packed CLI.
import { spawn } from "node:child_process";

/**
 * Starts the packed `codesaga mcp`, performs the handshake, lists its tools and
 * closes stdin, as an MCP host would.
 * @param {string} bin
 * @param {string} repositoryRoot
 * @returns {Promise<string>} the server's stdout
 */
export const mcpToolsList = (bin, repositoryRoot) =>
  new Promise((resolvePromise, reject) => {
    const server = spawn(bin, ["mcp"], { cwd: repositoryRoot });
    let stdout = "";
    server.on("error", reject);
    server.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes('"id":2')) {
        server.stdin.end();
      }
    });
    server.on("close", () => {
      resolvePromise(stdout);
    });
    const initialize = {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "check-cli-package", version: "0.0.0" },
    };
    for (const message of [
      { id: 1, method: "initialize", params: initialize },
      { method: "notifications/initialized" },
      { id: 2, method: "tools/list" },
    ]) {
      server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    }
  });
