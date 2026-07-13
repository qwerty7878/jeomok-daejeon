"use client";
import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";

export function TimerBar({
  deadline,
  total,
  label,
  onExpire,
}: {
  deadline: string | null;
  total: number;
  label?: string;
  onExpire?: () => void;
}) {
  const seconds = useCountdown(deadline, onExpire);
  const ratio = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const urgent = seconds <= 5 && seconds > 0 && deadline !== null;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums", urgent ? "text-primary" : "text-foreground")}>
          {seconds}초
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            urgent ? "bg-primary" : ratio > 0.4 ? "bg-secondary" : "bg-accent"
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
