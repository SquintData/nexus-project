import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ToastProvider } from "@/lib/toast";
import { cn } from "@/lib/cn";

export function Shell() {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen">
        {open && (
          <div
            className="fixed inset-0 z-20 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:relative md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <Sidebar onClose={() => setOpen(false)} />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] md:hidden">
            <button
              onClick={() => setOpen(true)}
              className="text-white/60 hover:text-white"
            >
              <Menu size={20} strokeWidth={1.4} />
            </button>
            <div className="flex items-center gap-2.5">
              <img src="/nexus-logo.png" alt="" className="w-7 h-7 object-contain" />
              <span className="text-base font-semibold tracking-tight">NEXUS</span>
            </div>
          </div>
          <main className="flex-1 overflow-auto p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
