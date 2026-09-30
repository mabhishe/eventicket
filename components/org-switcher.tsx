"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string; slug: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  ORG_OWNER: "Owner",
  ORG_ADMIN: "Admin",
  ORG_STAFF: "Staff",
  ORG_DOOR: "Door",
};

/** "Working as" org switcher for the top nav. Hidden when signed out. */
export default function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/active-org")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOrgs(d.organizations || []);
        setActiveId(d.activeOrgId);
      })
      .catch(() => {});
  }, []);

  if (orgs.length === 0) return null;
  const active = orgs.find((o) => o.id === activeId) || orgs[0];

  async function switchOrg(orgId: string) {
    if (orgId === active.id || busy) return;
    setBusy(true);
    const res = await fetch("/api/auth/active-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (res.ok) {
      // Full reload: guarantees every server component re-renders for the org.
      window.location.href = "/admin";
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden text-xs uppercase tracking-wide text-stone-400 md:inline">
        Working as
      </span>
      {orgs.length === 1 ? (
        <span className="font-medium">
          {ROLE_LABEL[active.role] || active.role} · {active.name}
        </span>
      ) : (
        <select
          className="max-w-44 cursor-pointer rounded-lg border border-stone-300 bg-transparent px-2 py-1 text-sm font-medium dark:border-stone-700"
          value={active.id}
          disabled={busy}
          onChange={(e) => switchOrg(e.target.value)}
          aria-label="Switch organization"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {ROLE_LABEL[o.role] || o.role} · {o.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
