import { useState } from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import useSWR from "swr";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
};

type PermissionRow = {
  id: string;
  key: string;
  description: string | null;
};

type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  roles: { id: string; name: string }[];
};

type Props = {
  roles: RoleRow[];
  permissions: PermissionRow[];
  loadError: string | null;
  canManage: boolean;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as StaffUser[];
};

const inputClass =
  "mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950";
const labelClass =
  "block text-xs font-medium uppercase tracking-wide text-ink-500";

export default function StaffPage({
  roles,
  permissions,
  loadError,
  canManage,
}: Props) {
  const {
    data: staff,
    error: staffError,
    mutate,
  } = useSWR<StaffUser[]>("/api/staff", fetcher);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, roleId: roleId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Create failed");
      setEmail("");
      setName("");
      setPassword("");
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const patchStaff = async (
    id: string,
    patch: { isActive?: boolean; roleId?: string | null }
  ) => {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message || "Update failed");
      return;
    }
    mutate();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Staff — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Staff & permissions"
        description="Roles are presets of module:action keys. Per-user grants and revokes override role permissions."
      />

      {loadError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load roles/permissions from the database. Apply the CRM
          staff-auth migration and ensure DATABASE_URL is set.
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs opacity-80">
            {loadError}
          </pre>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink-800">Staff users</h2>
        {staffError ? (
          <p className="mt-3 text-sm text-red-600">{staffError.message}</p>
        ) : !staff?.length ? (
          <p className="mt-3 text-sm text-ink-500">No staff users yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-ink-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  {canManage ? (
                    <th className="px-4 py-2.5 font-medium text-right">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {staff.map((user) => (
                  <tr key={user.id} className="border-b border-ink-100">
                    <td className="px-4 py-3">{user.name || "—"}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select
                          className="border border-ink-200 bg-white px-2 py-1 text-xs"
                          value={user.roles[0]?.id ?? ""}
                          onChange={(e) =>
                            patchStaff(user.id, {
                              roleId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">No role</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.roles.map((r) => r.name).join(", ") || "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.isActive ? "text-green-700" : "text-ink-400"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            patchStaff(user.id, { isActive: !user.isActive })
                          }
                          className="text-xs text-ink-600 hover:text-ink-950 underline-offset-2 hover:underline"
                        >
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && (
          <form
            onSubmit={createStaff}
            className="mt-6 max-w-md space-y-3 border border-ink-200 bg-white p-4"
          >
            <h3 className="text-sm font-semibold text-ink-950">Add staff user</h3>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                className={inputClass}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-ink-950 px-4 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create staff user"}
            </button>
          </form>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink-800">Roles</h2>
        {roles.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-ink-300 bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink-800">No roles yet</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {roles.map((role) => (
              <li
                key={role.id}
                className="rounded-lg border border-ink-200 bg-white px-5 py-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium text-ink-950">{role.name}</h3>
                  <span className="text-xs text-ink-500">
                    {role.userCount} user{role.userCount === 1 ? "" : "s"}
                  </span>
                </div>
                {role.description ? (
                  <p className="mt-1 text-sm text-ink-600">{role.description}</p>
                ) : null}
                {role.permissionKeys.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissionKeys.map((key) => (
                      <li
                        key={key}
                        className="rounded border border-ink-200 bg-ink-50 px-2 py-0.5 font-mono text-xs text-ink-700"
                      >
                        {key}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink-800">
          Permission catalog
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-800">
                    {p.key}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">
                    {p.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const permissions = session.user.permissions ?? [];
  if (!permissions.includes("staff:read")) {
    return {
      redirect: { destination: "/dashboard", permanent: false },
    };
  }

  const canManage = permissions.includes("staff:write");

  try {
    const [roles, permissionRows] = await Promise.all([
      prisma.crmRole.findMany({
        orderBy: { name: "asc" },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      }),
      prisma.crmPermission.findMany({ orderBy: { key: "asc" } }),
    ]);

    return {
      props: {
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissionKeys: r.permissions.map((rp) => rp.permission.key),
          userCount: r._count.users,
        })),
        permissions: permissionRows.map((p) => ({
          id: p.id,
          key: p.key,
          description: p.description,
        })),
        loadError: null,
        canManage,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      props: {
        roles: [],
        permissions: [],
        loadError: message,
        canManage,
      },
    };
  }
};
