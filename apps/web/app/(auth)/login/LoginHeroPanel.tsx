// 로그인 좌측 히어로 패널 — 브랜드 사진 + 카피(표현 계층만). page.tsx 200줄 상한 분리.
import Image from 'next/image';

export function LoginHeroPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
      <Image
        src="/login-hero.jpg"
        alt=""
        fill
        priority
        quality={90}
        className="object-cover"
        aria-hidden
      />
      {/* 텍스트 가독성용 어두운 그라디언트 오버레이 */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0b1020]/55 via-[#0b1020]/25 to-transparent"
        aria-hidden
      />

      <div className="relative flex w-full flex-col px-14 py-16 text-white">
        {/* 로고 (흰색 처리) */}
        <div className="flex flex-col gap-1.5">
          <Image
            src="/energyx-logo.png"
            alt="ENERGYX"
            width={168}
            height={29}
            quality={100}
            className="brightness-0 invert"
            style={{ height: 'auto', objectFit: 'contain' }}
            priority
          />
          <p className="text-[12px] font-semibold tracking-[0.18em] text-white/80">
            KPI PERFORMANCE SYSTEM
          </p>
        </div>

        {/* 카피 (남은 영역 수직 중앙) */}
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[40px] font-bold leading-[1.28] tracking-tight">
            성과를 데이터로 연결하고
            <br />더 공정하게 평가합니다
          </h1>
          <p className="mt-6 max-w-[440px] text-[15px] leading-relaxed text-white/85">
            KPI 수립부터 중간점검, 본인평가, 상사평가, 등급 산정과 보상 연계까지
            <br />
            하나의 흐름으로 관리하는 에너지엑스 맞춤형 성과관리 솔루션입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
