/**
 * Manual x402 payment processing.
 *
 * Why manual instead of middleware?
 * The automatic paymentMiddleware settles AFTER the endpoint runs.
 * We need the tx hash BEFORE registering to the contract.
 * Manual processing gives us control over the flow.
 */

import type { Context } from "hono";
import type { Hash } from "viem";
import type { x402ResourceServer } from "@x402/hono";

/**
 * Edge-safe base64 encoding (works in Node, Cloudflare Workers, browser)
 */
function base64EncodeJson(obj: any): string {
  const json = JSON.stringify(obj);
  // Use native btoa if available (browser/edge), otherwise Buffer (Node)
  if (typeof btoa !== "undefined") {
    return btoa(json);
  }
  return Buffer.from(json, "utf-8").toString("base64");
}

/**
 * Edge-safe base64 decoding (works in Node, Cloudflare Workers, browser)
 */
function base64DecodeJson(base64: string): any {
  // Use native atob if available (browser/edge), otherwise Buffer (Node)
  const json = typeof atob !== "undefined" ? atob(base64) : Buffer.from(base64, "base64").toString("utf-8");
  return JSON.parse(json);
}

export interface PaymentConfig {
  network: `${string}:${string}`; // CAIP-2 format
  payTo: `0x${string}`;
  usdcAddress: `0x${string}`;
  prices: {
    create: string; // e.g., "$0.01"
    sign: string;   // e.g., "$0.001"
  };
}

export interface PaymentSuccess {
  success: true;
  txHash: Hash;      // Real transaction hash
  payer: string;     // Wallet that paid
}

export interface PaymentError {
  success: false;
  error: string;
  status: 402 | 400;
  paymentRequiredHeader?: string;
}

export type PaymentResult = PaymentSuccess | PaymentError;

/**
 * Parse price string to atomic units (USDC has 6 decimals)
 * Validates format and uses integer arithmetic to avoid floating point rounding
 */
function parsePrice(price: string): string {
  // Expected format: "$0.01" or "$0.001"
  const match = price.match(/^\$(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid price format: ${price}. Expected format: $0.01`);
  }

  const value = match[1];
  const [whole, decimal = ""] = value.split(".");

  // USDC has 6 decimals, so we need to pad or truncate
  const paddedDecimal = decimal.padEnd(6, "0").slice(0, 6);
  const atomicAmount = whole + paddedDecimal;

  // Remove leading zeros and return
  return BigInt(atomicAmount).toString();
}

/**
 * Build payment requirements for x402
 */
function buildRequirements(config: PaymentConfig, route: "create" | "sign") {
  return {
    scheme: "exact" as const,
    network: config.network,
    amount: parsePrice(config.prices[route]),
    asset: config.usdcAddress,
    payTo: config.payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USDC",
      version: "2",
    },
  };
}

/**
 * Process x402 payment manually.
 *
 * Returns the REAL transaction hash after settlement.
 * This is the key difference from automatic middleware.
 */
export async function processPayment(
  c: Context,
  resourceServer: x402ResourceServer,
  config: PaymentConfig,
  route: "create" | "sign"
): Promise<PaymentResult> {
  // 1. Get payment header
  const paymentHeader = c.req.header("PAYMENT-SIGNATURE") || c.req.header("X-PAYMENT");

  if (!paymentHeader) {
    // Return 402 with payment requirements
    const requirements = buildRequirements(config, route);
    const paymentRequired = {
      x402Version: 2,
      error: "Payment required",
      accepts: [requirements],
    };
    return {
      success: false,
      error: "Payment required",
      status: 402,
      paymentRequiredHeader: base64EncodeJson(paymentRequired),
    };
  }

  // 2. Decode payment payload
  let paymentPayload: any;
  try {
    paymentPayload = base64DecodeJson(paymentHeader);
  } catch {
    return {
      success: false,
      error: "Invalid payment header format",
      status: 400
    };
  }

  const requirements = buildRequirements(config, route);

  // 3. Verify payment authorization
  const verifyResult = await resourceServer.verifyPayment(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      error: verifyResult.invalidReason || "Payment verification failed",
      status: 402,
    };
  }

  // 4. Settle payment - THIS CREATES THE REAL TRANSACTION
  const settleResult = await resourceServer.settlePayment(paymentPayload, requirements);
  if (!settleResult.success) {
    return {
      success: false,
      error: "Payment settlement failed",
      status: 402,
    };
  }

  // 5. Add PAYMENT-RESPONSE header for client transparency
  c.header("PAYMENT-RESPONSE", base64EncodeJson(settleResult));

  // 6. Return real tx hash
  return {
    success: true,
    txHash: settleResult.transaction as Hash,
    payer: (settleResult as any).payer || "unknown",
  };
}

/**
 * Handle payment error response
 */
export function handlePaymentError(c: Context, result: PaymentError, requestId: string) {
  if (result.paymentRequiredHeader) {
    c.header("PAYMENT-REQUIRED", result.paymentRequiredHeader);
  }
  return c.json({ error: result.error, requestId }, result.status);
}
