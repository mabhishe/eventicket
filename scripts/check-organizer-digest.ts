import assert from "node:assert/strict";
import {
  DIGEST_HOUR,
  digestHasNews,
  digestHtml,
  digestRecipients,
  digestSubject,
  partitionDigest,
  classifyAge,
  classifyMeal,
  countLines,
  formatHeadcount,
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
  items: [
    { qty: 1, ticketType: { name: "KIDS (5-10 yrs)" }, mealOption: { name: "Veg - NOG", tag: "veg" } },
    { qty: 1, ticketType: { name: "CANOSA MEMBER - ADULT" }, mealOption: { name: "Veg", tag: "veg" } },
    { qty: 1, ticketType: { name: "CANOSA MEMBER - ADULT" }, mealOption: { name: "Veg", tag: "veg" } },
    { qty: 1, ticketType: { name: "CANOSA MEMBER - ADULT" }, mealOption: { name: "Non-veg", tag: "nonveg" } },
  ],
  payments: [],
});
assert.equal(gopal.ticketCount, 4);
assert.equal(gopal.owingCents, 9500);
assert.equal(classifyAge("KIDS (5-10 yrs)"), "kid");
assert.equal(classifyAge("CANOSA MEMBER - ADULT"), "adult");
assert.equal(classifyMeal("Veg - NOG", "veg"), "nog");
assert.equal(classifyMeal("Veg", "veg"), "veg");
assert.equal(classifyMeal("Chicken", "nonveg"), "nonveg");
const gopalCounts = countLines(gopal.lines);
assert.deepEqual(formatHeadcount(gopalCounts), [
  "Adult 3 · Kid 1",
  "Veg 2 · Non-veg 1 · No onion garlic veg 1",
]);

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

const groups = partitionDigest({ registered: [gopal], paid: [gopal], waiting: [gopal] });
assert.equal(groups.newUnpaid.length, 1);
assert.equal(groups.newPaid.length, 0);
assert.equal(groups.paidEarlier.length, 0);
assert.equal(groups.waitingEarlier.length, 0);

const mail = digestHtml({
  orgName: "Canosa",
  registered: [gopal],
  paid: [gopal],
  waiting: [gopal],
  headcount: [{ eventTitle: "Kumar Utsav - 2026", lines: gopal.lines }],
});
assert.equal(mail.subject, "Tonight — 1 still unpaid");
assert.equal(mail.html.match(/Gopal Rao/g)?.length, 1);
assert.match(mail.html, /1 new order, still unpaid/);
assert.match(mail.html, /New today, not paid yet \(1\)/);
assert.doesNotMatch(mail.html, /Paid today/);
assert.doesNotMatch(mail.html, /Still unpaid from before today/);
assert.match(mail.html, /QDB68J/);
assert.match(mail.html, /\$95\.00/);
assert.match(mail.html, /owing/);
assert.match(mail.html, /Adult 3 · Kid 1/);
assert.match(mail.html, /No onion garlic veg 1/);
assert.match(mail.html, /3 adult · 1 kid · 2 veg · 1 non-veg · 1 no onion garlic veg/);
assert.match(mail.html, /Buyers do not receive this email/);
assert.doesNotMatch(mail.html, /If you didn't place this order/);

const paidToday = toDigestOrder({
  buyerName: "Binay Ranjan Swain",
  buyerEmail: "swain.binayranjan@gmail.com",
  refCode: "UQD02V",
  totalCents: 7400,
  payMethod: "ETRANSFER",
  status: "CONFIRMED",
  event: { title: "Kumar Utsav - 2026", currency: "CAD" },
  items: [{ qty: 2, ticketType: { name: "CANOSA MEMBER - ADULT" }, mealOption: { name: "Non-veg", tag: "nonveg" } }],
  payments: [{ kind: "RECEIVED", amountCents: 7400 }],
});
const paidEarlier = toDigestOrder({
  buyerName: "Earlier Guest",
  refCode: "OLDER1",
  totalCents: 2500,
  payMethod: "ETRANSFER",
  status: "CONFIRMED",
  event: { title: "Kumar Utsav - 2026", currency: "CAD" },
  items: [{ qty: 1, ticketType: { name: "CANOSA MEMBER - ADULT" } }],
  payments: [{ kind: "RECEIVED", amountCents: 2500 }],
});
const waitingEarlier = toDigestOrder({
  buyerName: "Older Unpaid",
  refCode: "OLDER2",
  totalCents: 5000,
  payMethod: "ETRANSFER",
  status: "PENDING_PAYMENT",
  event: { title: "Kumar Utsav - 2026", currency: "CAD" },
  items: [{ qty: 2, ticketType: { name: "CANOSA MEMBER - ADULT" } }],
  payments: [],
});
const split = digestHtml({
  orgName: "Canosa",
  registered: [gopal, paidToday],
  paid: [paidToday, paidEarlier],
  waiting: [gopal, waitingEarlier],
});
assert.equal(split.html.match(/Gopal Rao/g)?.length, 1);
assert.equal(split.html.match(/Binay Ranjan Swain/g)?.length, 1);
assert.match(split.html, /2 new orders: 1 paid, 1 still unpaid/);
assert.match(split.html, /New today, paid \(1\)/);
assert.match(split.html, /New today, not paid yet \(1\)/);
assert.match(split.html, /Paid today, ordered earlier \(1\)/);
assert.match(split.html, /Earlier Guest/);
assert.match(split.html, /Still unpaid from before today \(1\)/);
assert.match(split.html, /Older Unpaid/);
assert.equal(split.subject, "Tonight — 2 still unpaid");

console.log("organizer digest checks passed");
