import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const metadata = {
  title: "이미지 출처 · 제목대전",
};

const CREDIT_SOURCES = [
  {
    name: "Pexels",
    license: "Pexels License (상업적 이용 가능, 귀속 불필요)",
    url: "https://www.pexels.com/license/",
    note: "고화질 실제 사진 (동물·자연·사람·기타). 사진 작가는 Pexels 플랫폼에서 확인할 수 있습니다.",
  },
  {
    name: "Wikimedia Commons",
    license: "CC0 1.0 / CC-BY / Public Domain",
    url: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    note: "CC0·퍼블릭도메인 필터링 후 수집. 원본 파일 및 귀속 정보는 Wikimedia Commons에서 확인할 수 있습니다.",
  },
  {
    name: "Metropolitan Museum of Art Open Access",
    license: "CC0 1.0 Universal (Public Domain)",
    url: "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
    note: "Met Museum 소장품은 CC0 라이선스로 공개되어 상업적 이용 및 수정이 자유롭습니다.",
  },
];

export default function CreditsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-foreground">이미지 출처</h1>
      <p className="mt-2 text-muted-foreground">
        게임에 사용된 이미지의 출처와 라이선스입니다.
      </p>

      <h2 className="mt-8 font-serif text-2xl text-foreground">소스별 라이선스</h2>
      <div className="mt-3 space-y-3">
        {CREDIT_SOURCES.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between rounded-2xl border-2 border-foreground/10 bg-card px-4 py-3 transition-colors hover:border-primary"
          >
            <span>
              <span className="block font-bold text-foreground">{s.name}</span>
              <span className="block text-sm text-muted-foreground">
                {s.license}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground/70">
                {s.note}
              </span>
            </span>
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>

      <Link
        href="/"
        className="mt-8 inline-block font-bold text-primary hover:underline"
      >
        ← 로비로 돌아가기
      </Link>
    </div>
  );
}
