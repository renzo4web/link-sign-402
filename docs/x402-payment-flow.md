# x402 Payment Flow - Complete Guide

## Problem x402 Solves

Traditional API monetization:
1. User creates account → sets up payment → subscribes → receives API key
2. High friction, many steps

With x402:
1. User makes request → signs with wallet → pays → receives response
2. **No accounts, no API keys, instant payment**

---

## Complete Flow (Step by Step)

### 1️⃣ Client makes request without payment
```
POST /api/create
Body: { docHash: "0x123..." }
```

### 2️⃣ Middleware detects protected route → responds 402
```
HTTP 402 Payment Required
Body: {
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia", 
    "maxAmountRequired": "1000000",  // 1 USDC (6 decimals)
    "payTo": "0x7cAb494A110172Bc14852Ce983d567aF438a6Ae2"
  }]
}
```

### 3️⃣ Client (browser/wagmi) signs EIP-3009 authorization
User signs with MetaMask a message that says:
> "I authorize transferring 1 USDC from my wallet to 0x7cAb... valid for 60 seconds"

**Important:** This is NOT a transaction, it's just a **signature**. User doesn't spend gas.

The signature structure:
```json
{
  "from": "0x6835223E82...",     // User's wallet (payer)
  "to": "0x7cAb494A...",         // Your wallet (payTo)
  "value": "1000000",            // 1 USDC (6 decimals)
  "validBefore": "1733888187",   // Expires in 60 sec
  "validAfter": "0",
  "nonce": "0x..."
}
```

### 4️⃣ Client resends request with `X-PAYMENT` header
```
POST /api/create
X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1l... (base64)
Body: { docHash: "0x123..." }
```

The header contains:
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "authorization": {
      "from": "0x6835...",     // User's wallet (payer)
      "to": "0x7cAb...",       // Your wallet (payTo)
      "value": "1000000",      // 1 USDC
      "validBefore": "...",    // Expires in 60 sec
      "nonce": "..."
    },
    "signature": "0xabc..."    // User's signature
  }
}
```

### 5️⃣ Middleware verifies with Facilitator
```
POST https://api.cdp.coinbase.com/x402/verify
Body: {
  "x402Version": 1,
  "paymentHeader": "...",
  "paymentRequirements": {...}
}

Response: {
  "isValid": true,
  "payer": "0x6835223E82236c9e9fb90a8D53E28A2D7b937395"
}
```

**At this point:** The payment is **cryptographically valid** but not yet executed on-chain.

---

## 🎯 CRITICAL: When to Return Resources

### ⚠️ Verification vs Settlement

| Stage | What Happened | Is Payment Complete? | Should Return Resource? |
|-------|---------------|---------------------|------------------------|
| **After Verify** | Signature is valid | ❌ No (not on-chain yet) | ❌ **NO - DO NOT RETURN** |
| **After Settle** | Transaction executed on-chain | ✅ Yes | ✅ **YES - SAFE TO RETURN** |

### The Safe Pattern

```typescript
app.post('/api/create', async (c) => {
  // ✅ YOU ARE HERE - Payment is already verified AND settled
  // The middleware only lets this handler run AFTER verify + settle
  
  const { docHash } = await c.req.json()
  
  // ✅ SAFE: Return the resource the user paid for
  return c.json({
    status: 'created',
    docHash,
    network: 'base-sepolia',
    contractAddress: '0x7cAb494A110172Bc14852Ce983d567aF438a6Ae2'
  })
  
  // After your handler returns, middleware adds X-PAYMENT-RESPONSE header
})
```

---

## 6️⃣ Your handler executes (PAYMENT ALREADY VERIFIED)

```typescript
app.post('/api/create', async (c) => {
  // ✅ At this point:
  // - Payment signature is valid
  // - You can safely return the resource
  
  const { docHash } = await c.req.json()
  
  return c.json({ 
    status: 'created', 
    docHash 
  })
})
```

### 7️⃣ Middleware executes SETTLE (on-chain transaction)

**After your handler returns**, the middleware calls:

```
POST https://api.cdp.coinbase.com/x402/settle
```

The facilitator executes the actual blockchain transaction:
- Calls `transferWithAuthorization` on USDC contract
- **From:** `0x6835...` (user's wallet)
- **To:** `0x7cAb...` (your wallet)
- **Amount:** 1 USDC
- **Gas:** Paid by facilitator (not user)

Transaction on Base Sepolia:
```
0xdb5e52760139a6c11e29e03c88c62d412232fd7c3f03c0ab96942546b71fbd61
```

### 8️⃣ Response reaches client with settlement confirmation
```
HTTP 200 OK
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVl... (base64)
Body: { status: "created", docHash: "0x123..." }
```

Decoded `X-PAYMENT-RESPONSE`:
```json
{
  "success": true,
  "network": "base-sepolia",
  "payer": "0x6835223E82236c9e9fb90a8D53E28A2D7b937395",
  "transaction": "0xdb5e52760139a6c11e29e03c88c62d412232fd7c3f03c0ab96942546b71fbd61"
}
```

---

## Middleware Execution Order

```typescript
app.use(paymentMiddleware(...))  // 1. Middleware registered

app.post('/api/create', handler) // 2. Route handler registered

// When request comes in:
// ↓
// 1. paymentMiddleware runs
//    ├─ No X-PAYMENT header? → Return 402
//    ├─ Has X-PAYMENT header? → Verify with facilitator
//    │  ├─ Invalid? → Return 402
//    │  └─ Valid? → Continue to handler ✅
// 2. YOUR HANDLER runs
//    └─ Return response
// 3. paymentMiddleware resumes
//    └─ Settle payment (on-chain transaction)
//    └─ Add X-PAYMENT-RESPONSE header
// 4. Response sent to client
```

---

## The Actors

| Actor | Role | Responsibility |
|-------|------|----------------|
| **Client (browser + wagmi)** | Signs authorization | Creates EIP-3009 signature with MetaMask |
| **Your server (Hono)** | Protects routes | Uses x402 middleware to verify before serving content |
| **Facilitator (CDP)** | Verifies & executes | Validates signatures and broadcasts transactions |
| **USDC Contract** | Transfers funds | Executes `transferWithAuthorization` |

---

## EIP-3009: The Magic Behind It

EIP-3009 allows:
1. User signs **off-chain** (free, no gas)
2. Anyone can execute the transfer **on-chain** using that signature
3. Gas is paid by the facilitator (CDP), not the user

That's why the user only signs in MetaMask but doesn't pay gas fees.

### The USDC Contract Call

```solidity
// What the facilitator calls on USDC contract:
transferWithAuthorization(
  from: 0x6835...,        // User's wallet
  to: 0x7cAb...,          // Your wallet
  value: 1000000,         // 1 USDC (6 decimals)
  validAfter: 0,
  validBefore: 1733888187,
  nonce: 0x...,
  v: 27,                  // Signature components
  r: 0x...,
  s: 0x...
)
```

---

## Testnet vs Mainnet Facilitators

| Facilitator | Network | Verifies? | Settles (on-chain)? | Cost |
|-------------|---------|-----------|---------------------|------|
| `x402.org/facilitator` | base-sepolia / solana-devnet | ✅ | ❌ | Free |
| `@coinbase/x402` (CDP) | base-sepolia / base / solana | ✅ | ✅ | Requires CDP API keys |

### Why testnet facilitator doesn't settle:

The public testnet facilitator only validates signatures to:
- Save testnet gas costs
- Simplify development/testing
- Let you test the full flow without blockchain transactions

---

## Your Configuration

```typescript
import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'

const app = new Hono()

const payTo = '0x7cAb494A110172Bc14852Ce983d567aF438a6Ae2' as `0x${string}`

// Middleware: Protects routes requiring payment
app.use(
  paymentMiddleware(
    payTo,           // Your wallet that receives payments
    {
      'POST /api/create': {
        price: '$1.00',
        network: 'base-sepolia',  // Use 'base' for mainnet
        config: {
          description: 'Create a new document contract',
        },
      },
    },
    facilitator      // CDP handles verify + settle
  )
)

// Handler: Only executes after payment is verified
app.post('/api/create', async (c) => {
  // ✅ SAFE: Payment is verified, user paid
  const { docHash } = await c.req.json()
  
  return c.json({
    status: 'created',
    docHash,
    network: 'base-sepolia',
    contractAddress: payTo,
  })
})

export default app
```

---

## Environment Variables

Required for CDP facilitator:

```bash
CDP_API_KEY_ID=your-api-key-id
CDP_API_KEY_SECRET=your-api-key-secret
```

Get these from [cdp.coinbase.com](https://cdp.coinbase.com)

---

## Visual Flow

```
┌─────────────┐    1. POST /api/create (no payment)
│   Browser   │ ──────────────────────────────────────┐
│   + Wagmi   │                                       │
└─────────────┘                                       ▼
                                              ┌──────────────┐
      ▲                                       │ Your Server  │
      │ 2. 402 Payment Required               │    (Hono)    │
      │    "Pay 1 USDC to 0x7cAb..."          └──────────────┘
      │
┌─────────────┐    
│   Browser   │    3. User signs in MetaMask
│   + Wagmi   │       (NOT a transaction, just signature)
└─────────────┘    
      │
      │ 4. POST /api/create + X-PAYMENT header
      ▼
┌──────────────┐    5. Verify    ┌─────────────┐
│ Your Server  │ ──────────────► │ Facilitator │
│    (Hono)    │ ◄────────────── │    (CDP)    │
└──────────────┘    isValid=true └─────────────┘
      │
      │ 6. Your handler runs
      │    ✅ SAFE: Return resource
      ▼
┌──────────────┐    7. Settle    ┌─────────────┐
│  Middleware  │ ──────────────► │ Facilitator │
│              │                 │    (CDP)    │
└──────────────┘                 └─────────────┘
      │                                │
      │ 8. Add X-PAYMENT-RESPONSE      │ Executes on-chain
      │    header to response          │ USDC transferred!
      ▼                                ▼
┌──────────────┐              ┌─────────────────┐
│   Response   │              │  Base Sepolia   │
│ + settlement │              │   Blockchain    │
│   receipt    │              │ tx: 0xdb5e52... │
└──────────────┘              └─────────────────┘
```

---

## Common Questions

### Q: When is it safe to return the resource?

**A:** Inside your route handler. The middleware only lets your handler run after verifying the payment signature is valid.

```typescript
app.post('/api/create', async (c) => {
  // ✅ You are here = Payment verified
  // Safe to return paid content
  return c.json({ data: 'paid content' })
})
```

### Q: What if the settle fails after I return the resource?

**A:** The middleware verifies the payment is cryptographically valid before your handler runs. If settle fails (e.g., insufficient funds), the transaction will revert, but you already verified the user authorized the payment correctly.

For production, consider:
- Setting a reasonable timeout (`maxTimeoutSeconds`)
- Monitoring failed settlements
- Implementing retry logic if needed

### Q: Can I access the settlement transaction hash in my handler?

**A:** No. The settlement happens **after** your handler returns. The `X-PAYMENT-RESPONSE` header is added by the middleware after your handler completes. The client receives this header in the response.

### Q: How do I test without real money?

**A:** Use testnet:
- Network: `base-sepolia`
- Get testnet USDC from [Coinbase Faucet](https://faucet.circle.com/)
- Use CDP facilitator with testnet network

### Q: What happens if the user's signature expires?

**A:** Signatures have a `validBefore` timestamp (default 60 seconds). If the facilitator receives an expired signature, it returns `isValid: false` and your handler never runs.

---

## Security Considerations

1. **Always verify before returning resources**: The middleware handles this automatically
2. **Set reasonable timeouts**: Default is 60 seconds for payment validity
3. **Monitor failed settlements**: Check logs for settlement errors
4. **Use HTTPS in production**: Protect payment headers in transit
5. **Validate payment amounts**: Ensure the amount in the signature matches your price

---

## Debugging

Enable detailed logs to see the full flow:

```typescript
app.post('/api/create', async (c) => {
  console.log('[Payment Info]', {
    hasPaymentHeader: !!c.req.header('x-payment'),
    path: c.req.path,
    method: c.req.method,
  })
  
  // Your logic
  const response = c.json({ data: 'result' })
  
  // Check if settlement header was added
  console.log('[Settlement]', {
    hasSettlementHeader: !!response.headers.get('x-payment-response')
  })
  
  return response
})
```

On the client side, check the response headers:
```javascript
const response = await fetch('/api/create', {
  method: 'POST',
  headers: { 'X-PAYMENT': paymentHeader },
  body: JSON.stringify({ docHash })
})

console.log('Settlement:', response.headers.get('x-payment-response'))
```

---

## Next Steps

1. **For production**: Switch to `network: 'base'` (mainnet)
2. **For Solana**: Use `network: 'solana'` with a Solana wallet address
3. **For discovery**: Add metadata to routes for x402 Bazaar listing
4. **For scaling**: Consider implementing caching and rate limiting

---

## References

- [x402 Specification](https://github.com/coinbase/x402)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [CDP Documentation](https://docs.cdp.coinbase.com)
- [x402 Bazaar](https://x402.org)
