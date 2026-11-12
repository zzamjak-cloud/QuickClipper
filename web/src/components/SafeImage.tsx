import { useState } from 'react';

interface Props {
  src?: string;
  className?: string;
  /** 이미지를 감싸는 래퍼 클래스 — 실패 시 래퍼째 숨겨 빈 자리가 남지 않게 한다 */
  wrapperClassName?: string;
}

/** 기사 이미지: 지연 로딩, 리퍼러 미전송(핫링크 차단 회피), 없거나 로드 실패하면 렌더링하지 않음 */
export function SafeImage({ src, className, wrapperClassName }: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div className={wrapperClassName}>
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={className}
      />
    </div>
  );
}
