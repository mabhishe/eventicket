import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { issueTickets } from "@/lib/orders";
import { sendEmail, appUrl } from "@/lib/email";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Let an unpaid order through the door. The order stays pending, tickets
 * are issued once, and the reason is stored with the staff member who
 * approved it. A later full payment confirms the same tickets.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, [
    "ORG_OWNER",
    "ORG_ADMIN",
    "ORG_STAFF",
    "ORG_DOOR",
  ]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const reason = String(body.reason || "").trim();
  if (reason.length < 8) {
    return NextResponse.json(
      { error: "Describe why they are being admitted before the balance is paid" },
      { status: 400 }
    );
  }

  const order = await db.order.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { event: true, items: { include: { ticketType: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order is cancelled" }, { status: 400 });
  }
  if (order.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "This order is already confirmed" },
      { status: 400 }
    );
  }

  const already = order.emergencyAdmittedAt != null;
  if (!already) {
    await db.order.update({
      where: { id },
      data: {
        emergencyAdmittedAt: new Date(),
        emergencyAdmitReason: reason,
        emergencyAdmittedById: auth.user.id,
      },
    });
  }

  const tickets = await issueTickets(id, { allowPending: true });
  if (!already && order.buyerEmail) {
    const base = appUrl();
    const links = tickets
      .map((t) => {
        const name = t.holderName || order.buyerName;
        const href = base ? `${base}/t/${t.code}` : `/t/${t.code}`;
        return `<li>${name}: <a href="${href}">${href}</a></li>`;
      })
      .join("");
    try {
      await sendEmail({
        to: order.buyerEmail,
        subject: `Admitted — payment still due for ${order.event.title}`,
        html: `<p>Hi ${order.buyerName.split(" ")[0]},</p>
<p>You have been admitted to <strong>${order.event.title}</strong> while payment is still outstanding. Each person shows their own QR:</p>
<ul>${links}</ul>
<p>The balance on this order is still due.</p>`,
      });
    } catch (e) {
      console.error("[emergency-admit] email failed", e instanceof Error ? e.message : e);
    }
  }

  const updated = await db.order.findUnique({ where: { id } });
  return NextResponse.json({ order: updated, tickets, already });
}
