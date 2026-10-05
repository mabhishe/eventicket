import assert from "node:assert/strict";
import {
  DIGEST_HOUR,
  digestHasNews,
  digestHtml,
  digestRecipients,
  digestSubject,
  localClock,
  localDayStart,
  toDigestOrder,
} from "../lib/organizerDigest";

// 2026-10-05 02:00 UTC is 2026-10-04 22:00 in Toronto (EDT, UTC-4).
const tenPm = new Date("2026-10-05T02:00:00.000Z");
const clock = localClock(tenPm, "America/Toronto");
assert.equal(clock?.dateKey, "2026-10-04");
assert.equal(clock?.hour, DIGEST_HOUR);

const start = localDayStart(tenPm, "America/Toronto");
assert.ok(start);
assert.equal(start.toISOString(), "2026-10-04T04:00:00.000Z");

const afternoon = localClock(new Date("2026-10-04T20:00:00.000Z"), "America/Toronto");
assert.equal(afternoon?.hour, 16);
assert.ok((afternoon?.hour ?? 99) < DIGEST_HOUR);

const recipients = digestRecipients(
  ["Owner@Example.com", "owner@example.com", "door@example.com"],
  " info@canosa.ca "
);
assert.deepEqual(recipients, ["Owner@Example.com", "door@example.com", "info@canosa.ca"]);

assert.equal(digestRecipients(["not-an-email", ""], null).length, 0);

const gopal = toDigestOrder({
  buyerName: "Gopal Rao",
  buyerEmail: "gopalrao75@gmail.com",
  refCode: "QDB68J",
  totalCents: 9500,
  payMethod: "ETRANSFER",
  status: "PENDING_PAYMENT",
  event: { title: "Kumar Utsav - 2026", currency: "CAD" },
  items: [{ qty: 1 }, { qty: 1 }, { qty: 1 }, { qty: 1 }],
  payments: [],
});
assert.equal(gopal.ticketCount, 4);
assert.equal(gopal.owingCents, 9500);

const partial = toDigestOrder({
  ...{
    buyerName: "Gopal Rao",
    refCode: "QDB68J",
    totalCents: 9500,
    payMethod: "ETRANSFER",
    status: "PENDING_PAYMENT",
    event: { title: "Kumar Utsav - 2026", currency: "CAD" },
    items: [{ qty: 4 }],
    payments: [{ kind: "RECEIVED", amountCents: 4000 }],
  },
});
assert.equal(partial.owingCents, 5500);
assert.equal(partial.receivedCents, 4000);

assert.equal(
  digestSubject({ registered: 1, paid: 0, waiting: 1 }),
  "Tonight — 1 still unpaid"
);
assert.equal(digestSubject({ registered: 2, paid: 2, waiting: 0 }), "Tonight — 2 paid today");
assert.equal(digestHasNews({ registered: [], paid: [], waiting: [] }), false);
assert.equal(digestHasNews({ registered: [gopal], paid: [], waiting: [] }), true);

const mail = digestHtml({
  orgName: "Canosa",
  registered: [gopal],
  paid: [],
  waiting: [gopal],
});
assert.equal(mail.subject, "Tonight — 1 still unpaid");
assert.match(mail.html, /Gopal Rao/);
assert.match(mail.html, /QDB68J/);
assert.match(mail.html, /\$95\.00/);
assert.match(mail.html, /still unpaid/);
assert.match(mail.html, /No payments confirmed today/);
assert.match(mail.html, /Buyers do not receive this email/);
assert.doesNotMatch(mail.html, /If you didn't place this order/);

console.log("organizer digest checks passed");
