/**
 * Helper checks for payment intake matching.
 * Run: npx tsx scripts/test-payment-intake.js
 */
import assert from "assert";
import {
  extractRefCodes,
  hashWebhookSecret,
  secretsEqual,
  orgHasPaymentAutoMatch,
} from "../lib/paymentIntake.ts";

assert.deepStrictEqual(extractRefCodes("3ums7u"), ["3UMS7U"]);
assert.deepStrictEqual(extractRefCodes("Hi 3UMS7U thanks"), ["3UMS7U"]);
assert.deepStrictEqual(extractRefCodes("random junk"), []);
assert.deepStrictEqual(extractRefCodes("code: 3Ums7U please"), ["3UMS7U"]);
assert.deepStrictEqual(extractRefCodes(""), []);
assert.deepStrictEqual(extractRefCodes(null), []);

assert.strictEqual(
  secretsEqual(hashWebhookSecret("abc"), hashWebhookSecret("abc")),
  true
);
assert.strictEqual(
  secretsEqual(hashWebhookSecret("abc"), hashWebhookSecret("abd")),
  false
);

assert.strictEqual(
  orgHasPaymentAutoMatch({ plan: "PRO", paymentAutoMatchEnabled: false }),
  true
);
assert.strictEqual(
  orgHasPaymentAutoMatch({ plan: "FREE", paymentAutoMatchEnabled: true }),
  true
);
assert.strictEqual(
  orgHasPaymentAutoMatch({ plan: "FREE", paymentAutoMatchEnabled: false }),
  false
);

console.log("payment-intake helper checks OK");
