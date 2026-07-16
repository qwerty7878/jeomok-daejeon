import Link from "next/link";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata = {
  title: "문의하기 · 제목대전",
  description: "제목대전 이용 중 버그, 신고, 기타 문의사항을 접수하는 페이지입니다.",
};

const CONTACT_EMAIL = "gimssiyu771@gmail.com";

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-foreground">문의하기</h1>
      <p className="mt-2 text-muted-foreground">
        서비스 이용 중 궁금한 점이나 문제가 있다면 아래 이메일로 연락해주세요.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="font-serif text-2xl text-foreground">문의 이메일</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-3 inline-block rounded-2xl border-2 border-foreground/10 bg-card px-4 py-3 font-bold text-primary transition-colors hover:border-primary"
          >
            {CONTACT_EMAIL}
          </a>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">어떤 문의를 받나요</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>버그 제보 — 게임 진행 중 오류가 발생한 상황을 최대한 자세히 적어주세요.</li>
            <li>
              부적절한 채팅·제목 신고 — 게임 중 채팅창에서 바로 신고할 수도 있지만, 캡처 등
              추가 증빙이 필요하면 이메일로 보내주세요.
            </li>
            <li>개인정보처리방침 관련 문의</li>
            <li>기타 서비스 이용 문의</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">응답 시간</h2>
          <p className="mt-2 text-muted-foreground">
            개인이 운영하는 서비스라 답변까지 며칠 걸릴 수 있습니다. 양해 부탁드립니다.
          </p>
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
