"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/session";

const RoleContext = createContext<UserRole>("admin");

export function RoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useUserRole(): UserRole {
  return useContext(RoleContext);
}
