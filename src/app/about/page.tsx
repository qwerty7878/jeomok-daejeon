import Link from "next/link";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata = {
  title: "소개 · 제목대전",
  description: "제목대전은 사진 한 장에 제목을 짓고 서로 투표하는 실시간 파티 게임입니다.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-foreground">소개</h1>
      <p className="mt-2 text-muted-foreground">제목대전이 어떤 서비스인지 소개합니다.</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="font-serif text-2xl text-foreground">무엇을 하는 서비스인가요</h2>
          <p className="mt-2 text-muted-foreground">
            제목대전은 여러 명이 같은 사진 한 장을 보고 각자 제목을 지어 제출한 뒤, 서로의 제목에
            투표하는 실시간 멀티플레이 파티 게임입니다. 매 라운드 가장 적은 표를 받은 참가자는
            목숨을 하나 잃고, 목숨을 모두 잃으면 게임에서 탈락합니다. 끝까지 살아남은 사람이 우승합니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">어떻게 참여하나요</h2>
          <p className="mt-2 text-muted-foreground">
            회원가입이나 로그인이 필요 없습니다. 닉네임 하나만 정하면 바로 방을 만들거나
            기존 방에 참여할 수 있습니다. 참가자 간 실시간 통신은 Supabase Realtime을 통해 이루어지며,
            제출한 제목은 투표가 시작되기 전까지 다른 참가자에게 공개되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">운영 정보</h2>
          <p className="mt-2 text-muted-foreground">
            제목대전은 개인이 만들고 운영하는 비상업 목적의 웹 게임 프로젝트입니다. 서버 운영비를
            충당하기 위해 Google AdSense를 통한 광고를 게재하고 있으며, 게임 진행 화면(제목 작성·투표
            중)에는 광고를 노출하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">사용하는 이미지</h2>
          <p className="mt-2 text-muted-foreground">
            게임에 사용되는 사진은 CC0·퍼블릭도메인 등 저작권 문제가 없는 출처에서만 수집합니다.
            자세한 출처와 라이선스는{" "}
            <Link href="/credits" className="font-bold text-primary hover:underline">
              이미지 출처
            </Link>{" "}
            페이지에서 확인할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">더 알아보기</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <Link href="/privacy" className="font-bold text-primary hover:underline">
                개인정보처리방침
              </Link>{" "}
              — 어떤 정보를 왜 수집하는지
            </li>
            <li>
              <Link href="/contact" className="font-bold text-primary hover:underline">
                문의하기
              </Link>{" "}
              — 버그 제보, 신고, 기타 문의
            </li>
          </ul>
        </section>
      </div>

      <Link href="/" className="mt-10 inline-block font-bold text-primary hover:underline">
        ← 로비로 돌아가기
      </Link>

      <div className="mt-10">
        <AdBanner />
      </div>
    </div>
  );
}
