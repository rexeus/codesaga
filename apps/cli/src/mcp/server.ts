// Owns the MCP server: the toolkit served over stdio under codesaga's name and version.
import { Layer, Logger } from "effect";
import { McpProtocol, McpServer } from "effect/ai";

import { version } from "../version.js";
import { makeHandlers } from "./handlers.js";
import { CodesagaToolkit } from "./tools.js";

/**
 * Serves `analyze`, `inspect` and `check` over newline-delimited JSON-RPC on
 * stdin and stdout. Stdout carries protocol messages only, so every log line
 * goes to stderr. Launching the layer ends when stdin closes.
 */
export const McpServerLive = McpServer.toolkit(CodesagaToolkit).pipe(
  Layer.provideMerge(CodesagaToolkit.toLayer(makeHandlers)),
  Layer.provide(
    McpServer.layerStdio({
      name: "codesaga",
      version,
      // A client that offers none of these gets the first, so the newest leads.
      protocols: [
        McpProtocol.v2025_11_25,
        McpProtocol.v2025_06_18,
        McpProtocol.v2025_03_26,
        McpProtocol.v2024_11_05,
      ],
    }),
  ),
  Layer.provide(Layer.succeed(Logger.LogToStderr, true)),
);
