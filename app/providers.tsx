"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "!bg-white dark:!bg-slate-800 !text-slate-900 dark:!text-slate-100",
          duration: 3500,
        }}
      />
    </ThemeProvider>
  );
}
