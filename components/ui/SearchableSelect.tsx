"use client";

import Select, { GroupBase, Props as SelectProps } from "react-select";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export default function SearchableSelect(
  props: SelectProps<SelectOption, boolean, GroupBase<SelectOption>>
) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <Select
      classNamePrefix="rs"
      isClearable
      {...props}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "42px",
          borderRadius: "0.5rem",
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          borderColor: state.isFocused ? "#6366f1" : isDark ? "#334155" : "#cbd5e1",
          boxShadow: state.isFocused ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
          "&:hover": { borderColor: "#6366f1" },
        }),
        menu: (base) => ({
          ...base,
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          zIndex: 50,
        }),
        singleValue: (base) => ({ ...base, color: isDark ? "#f1f5f9" : "#0f172a" }),
        input: (base) => ({ ...base, color: isDark ? "#f1f5f9" : "#0f172a" }),
        placeholder: (base) => ({ ...base, color: isDark ? "#64748b" : "#94a3b8" }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected
            ? "#6366f1"
            : state.isFocused
            ? isDark
              ? "#334155"
              : "#eef2ff"
            : "transparent",
          color: state.isSelected ? "#ffffff" : isDark ? "#f1f5f9" : "#0f172a",
        }),
      }}
    />
  );
}
