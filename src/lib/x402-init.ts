/**
 * x402 lazy initialization for Cloudflare Workers.
 * Workers don't support top-level await, so we init on first protected request.
 */

import type { Context, Next } from "hono";
import { x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Caip2Network } from "./network";

type CdpAuthHeaders = {
  verify: Record<string, string>;
  settle: Record<string, string>;
  supported: Record<string, string>;
};

export interface X402InitConfig {
  facilitatorUrl: string;
  network: Caip2Network;
  createAuthHeaders: () => Promise<CdpAuthHeaders>;
  timeoutMs?: number;
  logger?: (message: string) => void;
  isProtectedRequest?: (method: string, path: string) => boolean;
}

const DEFAULT_TIMEOUT_MS = 15000;

/** Creates middleware + resourceServer for x402 lazy initialization. */
export function createX402InitMiddleware(config: X402InitConfig) {
  const {
    facilitatorUrl,
    network,
    createAuthHeaders,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger = console.log,
    isProtectedRequest = () => true,
  } = config;

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    createAuthHeaders,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactEvmScheme(),
  );

  let initPromise: Promise<void> | null = null;

  // Initialize once, cache result. Reset on failure for retry.
  async function ensureInitialized(): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      logger("[x402] initializing facilitator…");

      // Timeout to prevent hanging if facilitator is slow/down
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[x402] init timeout (${timeoutMs}ms)`)), timeoutMs)
      );
      await Promise.race([resourceServer.initialize(), timeout]);

      const kind = resourceServer.getSupportedKind(2, network, "exact");
      if (!kind) {
        throw new Error(`Facilitator does not support "exact" on "${network}"`);
      }

      logger(`[x402] ready: ${kind.scheme}@${kind.network}`);
    })().catch((error) => {
      logger(`[x402] init failed: ${error instanceof Error ? error.message : error}`);
      initPromise = null;
      throw error;
    });

    return initPromise;
  }

  async function middleware(c: Context, next: Next) {
    if (!isProtectedRequest(c.req.method, c.req.path)) {
      return next();
    }

    try {
      await ensureInitialized();
    } catch (error) {
      const requestId = c.get("requestId") ?? "unknown";
      const msg = error instanceof Error ? error.message : "x402 init failed";
      return c.json({ error: msg, requestId }, 500);
    }

    return next();
  }

  return { middleware, resourceServer, ensureInitialized };
}
