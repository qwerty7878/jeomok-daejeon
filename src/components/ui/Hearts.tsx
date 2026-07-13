import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function Hearts({
  lives,
  max,
  size = 16,
  breaking = false,
}: {
  lives: number;
  max: number;
  size?: number;
  breaking?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`남은 목숨 ${lives}개`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < lives;
        const isBreaking = breaking && i === lives;
        return (
          <Heart
            key={i}
            size={size}
            className={cn(
              filled
                ? "fill-rose-600 text-rose-600"
                : "fill-muted text-muted-foreground/30",
              isBreaking && "gs-heartbreak fill-rose-600 text-rose-600"
            )}
          />
        );
      })}
    </div>
  );
}
