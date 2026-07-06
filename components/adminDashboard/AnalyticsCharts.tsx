"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

const PIE_COLORS = ["#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#7c3aed"];

export function DepartmentBarChart({
  data,
}: {
  data: { name: string; students: number }[];
}) {
  return (
    <div className="card-3d card-hover p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="icon-tile grad-primary h-9 w-9">
          <BarChart3 size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Students by Department
          </p>
          <p className="text-[11px] text-slate-400">
            Active students, current snapshot
          </p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.2)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(99,102,241,0.08)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.25)",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="students"
              fill="url(#barGradient)"
              radius={[8, 8, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function StatusDonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="card-3d card-hover p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="icon-tile grad-emerald h-9 w-9">
          <PieChartIcon size={16} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Student Status Breakdown
          </p>
          <p className="text-[11px] text-slate-400">{total} students total</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={3}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.25)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-1 flex-col gap-2">
            {data.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1.5 font-medium capitalize text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {d.name}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
