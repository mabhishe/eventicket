import { buyerInviteEmailBlock, buyerInviteUrl } from "../lib/email";

process.env.APP_URL = "https://eventpass.aicloudconsult.com";

const url = buyerInviteUrl({
  slug: "kumar-utsav-2026-7sxfu",
  inviteCode: "THM2UUHR",
  title: "KUMAR UTSAV - 2026",
  date: "2026-11-01T17:00:00.000Z",
  venue: "Bishop Allen Academy, Etobicoke",
  description: "Celebrating Odisha's Heritage",
});

if (!url.includes("/e/kumar-utsav-2026-7sxfu?invite=THM2UUHR&v=")) {
  throw new Error(`invite url missing code: ${url}`);
}

const html = buyerInviteEmailBlock({
  slug: "kumar-utsav-2026-7sxfu",
  inviteCode: "THM2UUHR",
  title: "KUMAR UTSAV - 2026",
  date: "2026-11-01T17:00:00.000Z",
  venue: "Bishop Allen Academy, Etobicoke",
  description: "Celebrating Odisha's Heritage",
  timezone: "America/Toronto",
});

const checks = [
  ["banner", html.includes("/e/kumar-utsav-2026-7sxfu/share.jpg")],
  ["going", html.includes("I'm going to KUMAR UTSAV - 2026!")],
  ["joining", html.includes("Are you joining?")],
  ["link", html.includes(url.replace(/&/g, "&amp;"))],
  ["noon", html.includes("12:00 p.m.")],
];
for (const [name, ok] of checks) {
  if (!ok) throw new Error(`invite email missing ${name}`);
}
if (buyerInviteEmailBlock({ ...{
  slug: "kumar-utsav-2026-7sxfu",
  inviteCode: "",
  title: "KUMAR UTSAV - 2026",
  date: "2026-11-01T17:00:00.000Z",
} })) {
  throw new Error("empty invite code should not render a block");
}

console.log("invite email ok", url);
