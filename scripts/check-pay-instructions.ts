import { orderConfirmationHtml, payInstructionsText, shell } from "../lib/email";
import {
  DEFAULT_EMAIL,
  ensurePayInstructions,
  orderVars,
  renderVars,
} from "../lib/messaging";

const etransfer = payInstructionsText({
  payMethod: "ETRANSFER",
  refCode: "433T5U",
  totalCents: 9500,
  currency: "CAD",
  etransferEmail: "info@canosa.ca",
});
const expected =
  "Send $95.00 CAD by Interac e-Transfer to info@canosa.ca. Put reference code 433T5U in the e-Transfer message.";
if (etransfer !== expected) {
  throw new Error(`etransfer copy mismatch:\n${etransfer}`);
}

const zelle = payInstructionsText({
  payMethod: "ZELLE",
  refCode: "9AZM6J",
  totalCents: 4000,
  currency: "USD",
  zelleHandle: "pay@example.com",
});
if (!zelle.includes("Zelle to pay@example.com") || !zelle.includes("memo")) {
  throw new Error(`zelle copy mismatch: ${zelle}`);
}

const cash = payInstructionsText({
  payMethod: "CASH",
  refCode: "433T5U",
  totalCents: 9500,
  currency: "CAD",
  cashNote: "Pay at the door.",
});
if (cash.includes("433T5U") || !cash.includes("Pay at the door.")) {
  throw new Error(`cash copy should keep the note and skip the code: ${cash}`);
}

const oldSaved = `<p>Hi {{buyer.name}},</p>
<p>Your reference code is <strong>{{order.refCode}}</strong> and your total due is <strong>{{order.total}}</strong>.</p>
<p>Once the organizer confirms your full payment, each person gets their own QR code.</p>`;
const patched = ensurePayInstructions("ORDER_RECEIVED", oldSaved);
if (!patched.includes("{{order.payInstructions}}")) {
  throw new Error("saved template did not gain pay instructions");
}
if (patched.indexOf("{{order.payInstructions}}") > patched.indexOf("Once the organizer")) {
  throw new Error("pay instructions were not placed after the reference code");
}
if (ensurePayInstructions("ORDER_RECEIVED", patched) !== patched) {
  throw new Error("pay instructions were inserted twice");
}
if (ensurePayInstructions("TICKETS_ISSUED", oldSaved) !== oldSaved) {
  throw new Error("ticket email should stay unchanged");
}

const vars = orderVars(
  {
    id: "ord_1",
    buyerName: "Ansuman Mishra",
    refCode: "433T5U",
    totalCents: 9500,
    payMethod: "ETRANSFER",
  },
  {
    id: "evt_1",
    slug: "kumar-utsav-2026",
    title: "KUMAR UTSAV - 2026",
    date: "2026-11-01T17:00:00.000Z",
    timezone: "America/Toronto",
    currency: "CAD",
    etransferEmail: "info@canosa.ca",
  },
  "CANOSA"
);
const rendered = renderVars(DEFAULT_EMAIL.ORDER_RECEIVED.body, vars);
if (!rendered.includes(expected)) {
  throw new Error(`default order email missing pay line:\n${rendered}`);
}
if (!rendered.includes("433T5U")) {
  throw new Error("default order email missing reference code");
}

const rich = orderConfirmationHtml(
  {
    id: "ord_1",
    buyerName: "Ansuman Mishra",
    buyerEmail: "a@example.com",
    payMethod: "ETRANSFER",
    refCode: "433T5U",
    totalCents: 9500,
    currency: "CAD",
    items: [{ qty: 1, name: "Family", holderName: null }],
  },
  {
    title: "KUMAR UTSAV - 2026",
    date: new Date("2026-11-01T17:00:00.000Z"),
    venue: "Bishop Allen Academy",
    timezone: "America/Toronto",
    brandColor: null,
    etransferEmail: "info@canosa.ca",
    zelleHandle: null,
    cashNote: null,
  },
  "https://eventpass.example/order/ord_1"
);
if (!rich.includes("info@canosa.ca") || !rich.includes("433T5U") || !rich.includes("e-Transfer message")) {
  throw new Error("rich order email missing e-transfer instructions");
}

const savedLikeProduction = `<p>Hi {{buyer.name}},</p>
<p>We've got your order for <strong>{{event.title}}</strong> ({{event.date}}).</p>
<p>Your reference code is <strong>{{order.refCode}}</strong> and your total due is <strong>{{order.total}}</strong>.</p>
<p>Once the organizer confirms your full payment, each person gets their own QR code.</p>
<p><a href="{{order.url}}">View your order</a></p>`;
const preview = shell({
  accent: "#c2410c",
  preheader: "Order received — KUMAR UTSAV - 2026",
  body: renderVars(ensurePayInstructions("ORDER_RECEIVED", savedLikeProduction), vars),
});
if (!preview.includes(expected) || !preview.includes("Hi Ansuman Mishra")) {
  throw new Error("saved order email did not render the e-transfer sentence");
}

console.log("pay instructions ok");
