"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  _count: { soldOrders: number };
};

const roleTone: Record<string, "blue" | "stone" | "amber"> = {
  ORG_OWNER: "blue",
  ORG_ADMIN: "blue",
  ORG_STAFF: "stone",
  DOOR: "amber",
  ORG_DOOR: "amber",
};

const roleLabel: Record<string, string> = {
  ORG_OWNER: "Owner",
  ORG_ADMIN: "Admin",
  ORG_STAFF: "Staff",
  ORG_DOOR: "Door",
  ADMIN: "Admin",
  SELLER: "Staff",
  DOOR: "Door",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ORG_STAFF");
  const [error, setError] = useState<string | null>(null);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    else setError(data.error || "Could not load users");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUpgradeNeeded(false);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create user");
      setUpgradeNeeded(!!data.upgradeRequired);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("ORG_STAFF");
    await load();
  }

  return (
    <Container>
      <PageTitle
        title="Team"
        sub="Sellers confirm payments and sell at the door. Door staff check guests in."
      />
      <ErrorNote message={error} />
      {upgradeNeeded && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This is a Free-plan limit.{" "}
          <a href="/admin/settings" className="font-semibold underline">
            Upgrade to Pro
          </a>{" "}
          for unlimited team seats.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Everyone</h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
              >
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-stone-500">
                    {u.email} · {u._count.soldOrders} orders sold
                  </p>
                </div>
                <Badge tone={roleTone[u.role] ?? "stone"}>{roleLabel[u.role] ?? u.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Add someone</h2>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password (8+ characters, blank if they already have a login)">
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </Field>
            <Field label="Role">
              <select
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="ORG_STAFF">Staff — sell &amp; confirm payments</option>
                <option value="ORG_DOOR">Door staff — check guests in</option>
                <option value="ORG_ADMIN">Admin — manage events &amp; team</option>
                <option value="ORG_OWNER">Owner — everything</option>
              </select>
            </Field>
            <button className={btnPrimary}>Add user</button>
          </form>
        </Card>
      </div>
    </Container>
  );
}
