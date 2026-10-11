import { useState } from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import useSWR from "swr";
import { Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
  StatusBadge,
  Table,
  Td,
  TextField,
  Th,
} from "@/components/ui";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
};

type CatalogRow = {
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
  loadError: string | null;
  canManage: boolean;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as StaffUser[];
};

const rolesFetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as { roles: RoleRow[]; permissions: CatalogRow[] };
};

/** Group catalog rows by module for the role editor checkboxes. */
function groupCatalog(
  rows: { key: string; description: string | null }[]
): {
  module: string;
  items: { key: string; action: string; description: string | null }[];
}[] {
  const groups: {
    module: string;
    items: { key: string; action: string; description: string | null }[];
  }[] = [];
  for (const row of rows) {
    const sep = row.key.indexOf(":");
    const module = sep >= 0 ? row.key.slice(0, sep) : row.key;
    const action = sep >= 0 ? row.key.slice(sep + 1) : row.key;
    const existing = groups.find((g) => g.module === module);
    const item = { key: row.key, action, description: row.description };
    if (existing) existing.items.push(item);
    else groups.push({ module, items: [item] });
  }
  return groups;
}

/** Group module:action keys by module, preserving first-appearance order. */
function groupPermissionKeys(keys: string[]): {
  module: string;
  actions: string[];
}[] {
  const groups: { module: string; actions: string[] }[] = [];
  for (const key of keys) {
    const sep = key.indexOf(":");
    const module = sep >= 0 ? key.slice(0, sep) : key;
    const action = sep >= 0 ? key.slice(sep + 1) : key;
    const existing = groups.find((g) => g.module === module);
    if (existing) existing.actions.push(action);
    else groups.push({ module, actions: [action] });
  }
  return groups;
}

export default function StaffPage({
  roles,
  loadError,
  canManage,
}: Props) {
  const {
    data: staff,
    error: staffError,
    mutate,
  } = useSWR<StaffUser[]>("/api/staff", fetcher);
  const { data: rolesData, mutate: mutateRoles } = useSWR(
    "/api/roles",
    rolesFetcher
  );
  // SSR roles render first paint; the live list takes over once fetched so
  // newly created roles appear without a refresh.
  const liveRoles = rolesData?.roles ?? roles;
  const catalog = rolesData?.permissions ?? [];

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [roleModal, setRoleModal] = useState<
    { mode: "create" } | { mode: "edit"; role: RoleRow } | null
  >(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const openRoleCreate = () => {
    setRoleName("");
    setRoleDesc("");
    setRoleKeys([]);
    setRoleError(null);
    setRoleModal({ mode: "create" });
  };

  const openRoleEdit = (role: RoleRow) => {
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    setRoleKeys(role.permissionKeys);
    setRoleError(null);
    setRoleModal({ mode: "edit", role });
  };

  const toggleRoleKey = (key: string) => {
    setRoleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModal) return;
    setRoleSaving(true);
    setRoleError(null);
    try {
      const res = await fetch(
        roleModal.mode === "create" ? "/api/roles" : `/api/roles/${roleModal.role.id}`,
        {
          method: roleModal.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roleName,
            description: roleDesc || null,
            permissionKeys: roleKeys,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      setRoleModal(null);
      mutateRoles();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: RoleRow) => {
    if (
      !confirm(
        `Delete the "${role.name}" role? Staff users must be reassigned first.`
      )
    )
      return;
    const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Delete failed");
      return;
    }
    mutateRoles();
  };

  const resetForm = () => {
    setEmail("");
    setName("");
    setPassword("");
    setRoleId(roles[0]?.id ?? "");
    setFormError(null);
  };

  const openAdd = () => {
    resetForm();
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setFormError(null);
  };

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
      resetForm();
      mutate();
      closeAdd();
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
        subtitle="Roles are presets of module:action keys. Per-user grants and revokes override role permissions."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={openRoleCreate}>
                <Plus className="h-4 w-4" />
                New role
              </Button>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add staff user
              </Button>
            </div>
          ) : undefined
        }
      />

      {loadError ? (
        <Alert tone="warning" title="Could not load roles/permissions">
          Apply the CRM staff-auth migration and ensure DATABASE_URL is set.
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs opacity-80">
            {loadError}
          </pre>
        </Alert>
      ) : null}

      <section className="mt-8">
        <SectionHeading>Staff users</SectionHeading>
        {staffError ? (
          <Alert tone="danger">{staffError.message}</Alert>
        ) : !staff?.length ? (
          <EmptyState title="No staff users yet" />
        ) : (
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                {canManage ? <Th className="text-right">Actions</Th> : null}
              </>
            }
          >
            {staff.map((user) => (
              <tr key={user.id}>
                <Td>{user.name || "—"}</Td>
                <Td>{user.email}</Td>
                <Td>
                  {canManage ? (
                    <Select
                      className="w-auto py-1 text-xs"
                      value={user.roles[0]?.id ?? ""}
                      onChange={(e) =>
                        patchStaff(user.id, { roleId: e.target.value || null })
                      }
                    >
                      <option value="">No role</option>
                      {liveRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    user.roles.map((r) => r.name).join(", ") || "—"
                  )}
                </Td>
                <Td>
                  <StatusBadge tone={user.isActive ? "success" : "neutral"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                </Td>
                {canManage ? (
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() =>
                        patchStaff(user.id, { isActive: !user.isActive })
                      }
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </Td>
                ) : null}
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="mt-10">
        <SectionHeading>Roles</SectionHeading>
        {liveRoles.length === 0 ? (
          <EmptyState title="No roles yet" />
        ) : (
          <ul className="space-y-3">
            {liveRoles.map((role) => (
              <li key={role.id}>
                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-medium text-ink-900">{role.name}</h3>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 text-xs text-ink-500">
                        {role.userCount} user{role.userCount === 1 ? "" : "s"}
                      </span>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => openRoleEdit(role)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => deleteRole(role)}
                            aria-label={`Delete role ${role.name}`}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                  {role.description ? (
                    <p className="mt-1 text-sm text-ink-600">
                      {role.description}
                    </p>
                  ) : null}
                  {role.permissionKeys.length > 0 ? (
                    <dl className="mt-3 space-y-2.5">
                      {groupPermissionKeys(role.permissionKeys).map((group) => (
                        <div
                          key={group.module}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
                        >
                          <dt className="w-28 shrink-0 text-xs font-medium capitalize text-ink-500">
                            {group.module}
                          </dt>
                          <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {group.actions.map((action) => (
                              <Chip key={action} tone="neutral">
                                <span className="font-mono">{action}</span>
                              </Chip>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={roleModal !== null}
        title={roleModal?.mode === "edit" ? "Edit role" : "New role"}
        description="Pick exactly what this role can do, grouped by module."
        onClose={() => setRoleModal(null)}
        editor
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoleModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" disabled={roleSaving}>
              {roleSaving
                ? "Saving…"
                : roleModal?.mode === "edit"
                  ? "Update role"
                  : "Create role"}
            </Button>
          </>
        }
      >
        <form id="role-form" onSubmit={saveRole} className="space-y-4">
          {roleError && (
            <p role="alert" className="text-sm text-red-600">
              {roleError}
            </p>
          )}
          <Field label="Name" required>
            <TextField
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              required
              placeholder="e.g. Box Office"
            />
          </Field>
          <Field label="Description">
            <TextField
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="What is this role for?"
            />
          </Field>
          <div>
            <p className="mb-2 block text-[0.8rem] font-medium text-ink-700">
              Permissions · {roleKeys.length} selected
            </p>
            {catalog.length === 0 ? (
              <p className="text-sm text-ink-500">
                Loading permission catalog…
              </p>
            ) : (
              <div className="space-y-4">
                {groupCatalog(catalog).map((group) => (
                  <div key={group.module}>
                    <p className="mb-1.5 text-xs font-medium capitalize text-ink-500">
                      {group.module}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-3 rounded-field border border-border px-3 py-2 transition-colors hover:border-ink-300"
                        >
                          <input
                            type="checkbox"
                            checked={roleKeys.includes(item.key)}
                            onChange={() => toggleRoleKey(item.key)}
                            className="mt-1"
                          />
                          <span className="text-sm">
                            <span className="font-mono text-[13px] text-ink-800">
                              {item.action}
                            </span>
                            {item.description && (
                              <span className="block text-xs text-ink-500">
                                {item.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={addOpen}
        title="Add staff user"
        description="Create a CRM login for a staff member."
        onClose={closeAdd}
        footer={
          <>
            <Button variant="secondary" onClick={closeAdd}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" disabled={saving}>
              {saving ? "Creating…" : "Create staff user"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={createStaff} className="space-y-3">
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <Field label="Email" required>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Name">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Password" required>
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          <Field label="Role">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No role</option>
              {liveRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
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
    const roles = await prisma.crmRole.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return {
      props: {
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissionKeys: r.permissions.map((rp) => rp.permission.key),
          userCount: r._count.users,
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
        loadError: message,
        canManage,
      },
    };
  }
};
