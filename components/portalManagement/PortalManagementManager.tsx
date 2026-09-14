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
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface PortalData {
  roles: ManagedRole[];
  modules: ManagedModule[];
  permissions: Permission[];
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
    // The initial permission request intentionally owns the loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rolePermissions = useMemo(() => {
    const map = new Map<string, Permission>();
    data?.permissions
      .filter((permission) => permission.role === selectedRole)
      .forEach((permission) => map.set(permission.module, permission));
    return map;
  }, [data, selectedRole]);

  function getPreset(permission: Permission | undefined) {
    if (!permission?.canView) return "hidden";
    if (permission.canDelete) return "full_access";
    if (permission.canEdit) return "edit";
    return "read_only";
  }

  async function setPreset(module: string, preset: string) {
    const key = `${selectedRole}:${module}`;
    setSavingKey(key);
    try {
      const response = await fetch("/api/admin/portal-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          module,
          preset,
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
                      canView: preset !== "hidden",
                      canEdit: preset === "edit" || preset === "full_access",
                      canDelete: preset === "full_access",
                    }
                  : permission,
              ),
            }
          : current,
      );
      toast.success("Portal access updated.");
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
            Set each module to Hidden, Read Only, Edit, or Full Access.
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
            Admin access is always enabled. Access presets atomically control navigation,
            viewing, editing, and deletion for each managed role.
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
                <th className="w-52 px-5 py-3 text-center">Access level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.modules.map((module) => {
                const permission = rolePermissions.get(module.key);
                const preset = getPreset(permission);
                return (
                  <tr key={module.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{module.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {module.description}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <select
                        value={preset}
                        disabled={savingKey === `${selectedRole}:${module.key}`}
                        onChange={(event) => setPreset(module.key, event.target.value)}
                        aria-label={`${module.label} access level`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="hidden">Hidden</option>
                        <option value="read_only">Read Only</option>
                        <option value="edit">Edit</option>
                        <option value="full_access">Full Access</option>
                      </select>
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