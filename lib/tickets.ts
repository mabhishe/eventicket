import { randomInt } from "crypto";
import QRCode from "qrcode";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/** Short, human-readable ticket code, e.g. "K7Q2M9XD". */
export function newTicketCode(length = 8): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return s;
}

/** QR payload for a ticket: the ticket's public URL. */
export function ticketUrl(code: string): string {
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return `${base}/t/${code}`;
}

/** PNG data-URL of the ticket QR code. */
export async function ticketQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(ticketUrl(code), { margin: 1, width: 320 });
}

/**
 * PNG data-URL of an order's group-pass QR. Encodes the raw order refCode
 * (e.g. "K7Q2XD"): one code for the whole party, scanned once per person
 * at the door and once per meal at the food line.
 */
export async function orderQrDataUrl(refCode: string): Promise<string> {
  return QRCode.toDataURL(refCode.trim().toUpperCase(), {
    margin: 1,
    width: 320,
  });
}

/** Pull a ticket code out of a scanned QR payload (URL or raw code). */
export function extractCode(scanned: string): string {
  const s = scanned.trim();
  const m = s.match(/\/t\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/);
  if (m) return m[1].toUpperCase();
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
