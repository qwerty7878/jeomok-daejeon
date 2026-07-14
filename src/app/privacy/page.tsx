import Link from "next/link";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata = {
  title: "개인정보처리방침 · 제목대전",
};

const EFFECTIVE_DATE = "2026년 7월 14일";
const CONTACT_EMAIL = "gimssiyu771@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-foreground">개인정보처리방침</h1>
      <p className="mt-2 text-muted-foreground">
        시행일: {EFFECTIVE_DATE}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="font-serif text-2xl text-foreground">1. 수집하는 정보</h2>
          <p className="mt-2 text-muted-foreground">
            제목대전은 회원가입 없이 이용하는 서비스입니다. 이메일, 실명, 전화번호 등
            개인 식별 정보를 수집하지 않습니다. 게임 진행을 위해 아래 정보만 최소한으로 수집합니다.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">익명 세션 ID</strong> — 로그인 없이 이용자를 구분하기 위해
              브라우저에 무작위로 생성되는 값입니다. 실명·연락처와 연결되지 않습니다.
            </li>
            <li>
              <strong className="text-foreground">닉네임</strong> — 게임 중 다른 참가자에게 표시하기 위해
              직접 입력하는 값입니다.
            </li>
            <li>
              <strong className="text-foreground">게임 데이터</strong> — 참여한 방, 채팅 메시지, 제출한 제목,
              투표 내역 등 게임 진행에 필요한 데이터입니다.
            </li>
            <li>
              <strong className="text-foreground">직접 업로드한 이미지</strong> — 방장이 커스텀 이미지 모드를
              선택한 경우에만 업로드되며, 해당 방 전용으로 사용됩니다.
            </li>
            <li>
              <strong className="text-foreground">신고 내용</strong> — 부적절한 채팅·제목을 신고할 때 신고자의
              세션 ID와 신고 대상 내용이 저장됩니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">2. 브라우저 저장 정보 (로컬 스토리지)</h2>
          <p className="mt-2 text-muted-foreground">
            서버가 아닌 이용자의 브라우저에 아래 값을 저장합니다. 브라우저 설정에서 언제든 삭제할 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            <li><code className="text-xs">sessionId</code> — 익명 세션 식별자</li>
            <li><code className="text-xs">nickname</code> — 마지막으로 사용한 닉네임</li>
            <li><code className="text-xs">jdj_game_count</code> — 광고 노출 빈도 조절용 게임 판수 카운트</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">3. 광고 및 쿠키 (Google AdSense)</h2>
          <p className="mt-2 text-muted-foreground">
            제목대전은 Google AdSense를 통해 광고를 게재하며, 이 과정에서 Google 및 광고 파트너가
            쿠키를 사용해 맞춤형 광고를 제공할 수 있습니다. Google은 이용자의 이전 방문 또는 다른 사이트
            방문 이력을 기반으로 광고를 게재하기 위해 광고 쿠키를 사용합니다.
          </p>
          <p className="mt-2 text-muted-foreground">
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary hover:underline"
            >
              Google 광고 설정
            </a>
            {" "}에서 맞춤 광고를 언제든 해제할 수 있으며, 자세한 내용은{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary hover:underline"
            >
              Google의 광고 정책
            </a>
            에서 확인할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">4. 방문 통계 (Google Analytics)</h2>
          <p className="mt-2 text-muted-foreground">
            서비스 개선을 위해 Google Analytics를 사용해 방문자 수, 이용 페이지 등 통계 정보를
            익명으로 수집할 수 있습니다. 개인을 식별할 수 있는 정보는 수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">5. 인프라 제공업체</h2>
          <p className="mt-2 text-muted-foreground">
            서비스 운영을 위해 아래 업체의 인프라를 사용하며, 각 업체의 자체 정책에 따라
            접속 로그(IP 주소 등)가 처리될 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Vercel — 웹 호스팅 및 서버 실행</li>
            <li>Supabase — 데이터베이스 및 실시간 통신, 이미지 저장</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">6. 데이터 보관 및 삭제</h2>
          <p className="mt-2 text-muted-foreground">
            게임 방과 관련된 데이터(채팅, 제출, 투표, 업로드 이미지)는 방이 삭제되면 함께 삭제됩니다.
            장기간 활동이 없는 방은 자동 정리 절차에 따라 삭제됩니다. 브라우저에 저장된 세션 ID와
            닉네임은 브라우저 저장소를 지우면 즉시 삭제됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">7. 아동의 개인정보</h2>
          <p className="mt-2 text-muted-foreground">
            제목대전은 만 14세 미만 아동으로부터 의도적으로 개인정보를 수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">8. 방침 변경</h2>
          <p className="mt-2 text-muted-foreground">
            법령 또는 서비스 변경에 따라 이 방침의 내용이 변경될 수 있으며, 변경 시 이 페이지를 통해 고지합니다.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">9. 문의</h2>
          <p className="mt-2 text-muted-foreground">
            개인정보 관련 문의는 아래 이메일로 연락해주세요.
          </p>
          <p className="mt-2 font-bold text-foreground">{CONTACT_EMAIL}</p>
        </section>
      </div>

      <Link
        href="/"
        className="mt-10 inline-block font-bold text-primary hover:underline"
      >
        ← 로비로 돌아가기
      </Link>

      <div className="mt-10">
        <AdBanner />
      </div>
    </div>
  );
}
