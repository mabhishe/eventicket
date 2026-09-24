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

const roleTone: Record<string, "blue" | "zinc" | "amber"> = {
  ADMIN: "blue",
  SELLER: "zinc",
  DOOR: "amber",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("SELLER");
  const [error, setError] = useState<string | null>(null);

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
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create user");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("SELLER");
    await load();
  }

  return (
    <Container>
      <PageTitle
        title="Team"
        sub="Sellers confirm payments and sell at the door. Door staff check guests in."
      />
      <ErrorNote message={error} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Everyone</h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-zinc-500">
                    {u.email} · {u._count.soldOrders} orders sold
                  </p>
                </div>
                <Badge tone={roleTone[u.role] ?? "zinc"}>{u.role}</Badge>
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
            <Field label="Password (8+ characters)">
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            <Field label="Role">
              <select
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="SELLER">Seller</option>
                <option value="DOOR">Door staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <button className={btnPrimary}>Add user</button>
          </form>
        </Card>
      </div>
    </Container>
  );
}
