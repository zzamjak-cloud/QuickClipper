import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/** config/access 문서 — 접근 제어 설정 */
export interface AccessConfig {
  admins: string[];
  allowed: string[];
}

/**
 * 접근 제어 설정 조회.
 * 관리자만 읽기 권한이 있으므로, 성공하면 현재 사용자가 관리자라는 뜻.
 * 일반 사용자는 permission-denied → null 반환.
 */
export async function fetchAccessConfig(): Promise<AccessConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'config/access'));
    return snap.exists() ? (snap.data() as AccessConfig) : null;
  } catch {
    return null;
  }
}

/** 허용 이메일 목록 갱신 (관리자 전용) */
export async function updateAllowedEmails(allowed: string[]): Promise<void> {
  await updateDoc(doc(db, 'config/access'), { allowed });
}
