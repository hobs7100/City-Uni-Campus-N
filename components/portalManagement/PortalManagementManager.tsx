"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";

interface ManagedRole {
  key: string;
  label: string;
}

interface ManagedModule {
  key: string;
  label: string;
  description: string;
}

interface Permission {
  role: string;
  module: string;
  canEdit: boolean;
  canDelete: boolean;
}

interface PortalData {
  roles: ManagedRole[];
  modules: ManagedModule[];
  permissions: Permission[];
}

function PermissionSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
      } disabled:cursor-wait disabled:opacity-60`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function PortalManagementManager() {
  const [data, setData] = useState<PortalData | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/portal-management");
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Failed to load portal permissions.");
        return;
      }
      setData(result);
      setSelectedRole((current) => current || result.roles[0]?.key || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rolePermissions = useMemo(() => {
    const map = new Map<string, Permission>();
    data?.permissions
      .filter((permission) => permission.role === selectedRole)
      .forEach((permission) => map.set(permission.module, permission));
    return map;
  }, [data, selectedRole]);

  async function togglePermission(
    module: string,
    action: "edit" | "delete",
    currentValue: boolean,
  ) {
    const key = `${selectedRole}:${module}:${action}`;
    setSavingKey(key);
    try {
      const response = await fetch("/api/admin/portal-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          module,
          action,
          allowed: !currentValue,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Failed to update permission.");
        return;
      }

      setData((current) =>
        current
          ? {
              ...current,
              permissions: current.permissions.map((permission) =>
                permission.role === selectedRole && permission.module === module
                  ? {
                      ...permission,
                      [action === "edit" ? "canEdit" : "canDelete"]: !currentValue,
                    }
                  : permission,
              ),
            }
          : current,
      );
      toast.success(`${action === "edit" ? "Edit" : "Delete"} access ${currentValue ? "locked" : "unlocked"}.`);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <DataFetchLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Portal Management</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Control editing and deletion inside modules for each staff role.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <div className="flex gap-2">
          <LockKeyhole size={17} className="mt-0.5 shrink-0" />
          <p>
            Admin access is always enabled. These switches restrict actions a role already has;
            they do not give a role access to a module it cannot currently open.
          </p>
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Select role
          </p>
          <div className="flex flex-wrap gap-2">
            {data?.roles.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => setSelectedRole(role.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  selectedRole === role.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Module</th>
                <th className="w-40 px-5 py-3 text-center">Edit access</th>
                <th className="w-40 px-5 py-3 text-center">Delete access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.modules.map((module) => {
                const permission = rolePermissions.get(module.key);
                const canEdit = permission?.canEdit ?? true;
                const canDelete = permission?.canDelete ?? true;
                return (
                  <tr key={module.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{module.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {module.description}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <PermissionSwitch
                          checked={canEdit}
                          disabled={savingKey === `${selectedRole}:${module.key}:edit`}
                          label={`${canEdit ? "Lock" : "Unlock"} edit access for ${module.label}`}
                          onChange={() => togglePermission(module.key, "edit", canEdit)}
                        />
                        <span className={`text-[10px] font-bold ${canEdit ? "text-emerald-600" : "text-slate-400"}`}>
                          {canEdit ? "UNLOCKED" : "LOCKED"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <PermissionSwitch
                          checked={canDelete}
                          disabled={savingKey === `${selectedRole}:${module.key}:delete`}
                          label={`${canDelete ? "Lock" : "Unlock"} delete access for ${module.label}`}
                          onChange={() => togglePermission(module.key, "delete", canDelete)}
                        />
                        <span className={`text-[10px] font-bold ${canDelete ? "text-emerald-600" : "text-slate-400"}`}>
                          {canDelete ? "UNLOCKED" : "LOCKED"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}