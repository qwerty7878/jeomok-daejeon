"use client";
import { useState } from "react";
import { HelpCircle, Pencil, Vote, Trophy, HeartCrack, X } from "lucide-react";
import { GameButton } from "@/components/ui/GameButton";

const STEPS = [
  {
    icon: <Pencil size={28} />,
    title: "사진 보고 제목 짓기",
    desc: "매 라운드마다 사진 한 장이 공개돼요. 제한 시간 안에 가장 웃긴 제목을 지어주세요.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: <Vote size={28} />,
    title: "익명 투표",
    desc: "모두의 제목이 익명으로 공개돼요. 자기 제목 빼고 가장 마음에 드는 제목 하나에 투표하세요.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: <Trophy size={28} />,
    title: "결과 공개",
    desc: "투표가 끝나면 득표수와 작성자가 공개돼요. 가장 많은 표를 받은 제목이 이번 라운드 베스트!",
    color: "text-accent-foreground",
    bg: "bg-accent/20",
  },
  {
    icon: <HeartCrack size={28} />,
    title: "최하위가 목숨을 잃어요",
    desc: "가장 적은 표를 받은 사람이 목숨 하나를 잃어요. 목숨이 모두 떨어지면 탈락! 마지막까지 살아남아야 승리해요.",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
];

export function HowToPlayButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <GameButton variant="outline" size={size} onClick={() => setOpen(true)}>
        <HelpCircle size={15} /> 게임 방법
      </GameButton>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border-2 border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <X size={18} />
            </button>

            <h2 className="mb-5 font-display text-2xl">게임 방법</h2>

            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <div key={i} className={`flex gap-3 rounded-2xl p-4 ${step.bg}`}>
                  <div className={`shrink-0 ${step.color}`}>{step.icon}</div>
                  <div>
                    <p className="font-display text-base font-bold">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-muted p-3 text-center text-sm text-muted-foreground">
              전원 동의하면 결과 화면을 바로 넘길 수 있어요 ⚡
            </div>

            <GameButton onClick={() => setOpen(false)} className="mt-4 w-full font-serif">
              알겠어요!
            </GameButton>
          </div>
        </div>
      )}
    </>
  );
}
