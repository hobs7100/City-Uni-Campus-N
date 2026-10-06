"use client";

import { analyticsFilterFields, changeAnalyticsFilter, filterChoices, type AnalyticsFilters, type AnalyticsOptions } from "./analyticsFilters";

export default function AnalyticsFilterFields({ filters, options, onChange }: {
  filters: AnalyticsFilters;
  options: AnalyticsOptions;
  onChange: (filters: AnalyticsFilters) => void;
}) {
  return <>{analyticsFilterFields.map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-500">{label}
    <select value={filters[key] ?? ""} onChange={(event) => onChange(changeAnalyticsFilter(options, filters, key, event.target.value))}
      className="mt-1 block max-w-[240px] rounded border px-2 py-2 text-sm">
      <option value="">All</option>
      {filterChoices(options, key, filters).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  </label>)}</>;
}
