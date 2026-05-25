import { cn } from "@/lib/cn";

export type SphereState = "idle" | "listening" | "processing" | "error";

interface Props {
  state?: SphereState;
  size?: number;
}

const STATE_PULSE: Record<SphereState, string> = {
  idle: "animate-pulse-slow",
  listening: "animate-pulse-fast",
  processing: "animate-pulse-fast",
  error: "",
};

const STATE_LABEL: Record<SphereState, string> = {
  idle: "Dormindo",
  listening: "Ouvindo",
  processing: "Processando",
  error: "Erro",
};

export function Sphere({ state = "idle", size = 280 }: Props) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      {/* Outer halo */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-radial blur-3xl",
          STATE_PULSE[state],
        )}
        style={{
          background: `radial-gradient(circle at center, ${
            state === "error" ? "rgba(239,68,68,0.5)" :
            state === "processing" ? "rgba(29,78,216,0.65)" :
            "rgba(76,201,255,0.5)"
          }, transparent 70%)`,
        }}
      />
      {/* Rotating ring */}
      <div className={cn("absolute inset-4 rounded-full border border-white/10 animate-spin-slow")} />
      {/* Inner sphere */}
      <div
        className={cn(
          "relative rounded-full bg-gradient-radial border border-white/20",
          "shadow-[0_0_60px_rgba(76,201,255,0.4)]",
          STATE_PULSE[state],
        )}
        style={{
          width: size * 0.6,
          height: size * 0.6,
          background: `radial-gradient(circle at 30% 30%, ${
            state === "error" ? "#fca5a5" :
            state === "processing" ? "#93c5fd" :
            "#a5e9ff"
          }, ${
            state === "error" ? "#7f1d1d" :
            state === "processing" ? "#1e3a8a" :
            "#0c4a6e"
          })`,
        }}
      />
      <div className="absolute bottom-2 text-xs uppercase tracking-widest text-white/50">
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
