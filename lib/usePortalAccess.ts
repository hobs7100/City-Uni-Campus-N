"use client";

import { useEffect, useState } from "react";
import type { PortalAccess } from "@/lib/portalPermissions";
import type { PortalModule } from "@/lib/portalPermissionsConfig";

const lockedAccess: PortalAccess = { canEdit: false, canDelete: false };

export function usePortalAccess(module: PortalModule) {
  const [access, setAccess] = useState<PortalAccess>(lockedAccess);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      try {
        const response = await fetch(`/api/portal-access?module=${encodeURIComponent(module)}`);
        const data = await response.json();
        if (!cancelled && response.ok) {
          setAccess({
            canEdit: data.canEdit === true,
            canDelete: data.canDelete === true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [module]);

  return { ...access, loading };
}