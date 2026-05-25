import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error";
interface ToastItem { id: string; message: string; type: ToastType; }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg border backdrop-blur-sm",
              t.type === "success"
                ? "bg-nexus-accent/20 border-nexus-accent/40 text-nexus-accent"
                : "bg-nexus-error/20 border-nexus-error/40 text-nexus-error",
            )}
          >
            {t.type === "success" ? <CheckCircle size={15} /> : <XCircle size={15} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
