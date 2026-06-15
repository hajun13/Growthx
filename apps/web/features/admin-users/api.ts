/**
 * admin-users feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 *
 * ⚠ 에러: 생성 클라이언트는 @growthx/contracts 의 ApiError 를 throw 한다(@/lib/api 의 것과 형태 동일하나 별개 클래스).
 *   사용자 커맨드의 err.code/err.message 분기는 contracts ApiError 로 잡아야 한다 → 여기서 재노출.
 */
import {
  usersControllerList,
  usersControllerGet,
  usersControllerCreate,
  usersControllerUpdate,
  usersControllerResign,
  usersControllerReactivate,
  usersControllerRemove,
  ApiError as ContractsApiError,
  type CreateUserDto,
  type UpdateUserDto,
} from '@growthx/contracts';
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';

/** 생성 클라이언트가 throw 하는 에러 클래스(.code/.message). 페이지의 분기에서 사용. */
export { ContractsApiError as ApiError };

/** UserDto ↔ @/lib/types User 는 구조 동일 — 도메인 타입으로 노출. */
function toUser(dto: unknown): User {
  return dto as User;
}

export interface UserListParams {
  departmentId?: string;
  q?: string;
  includeInactive?: boolean;
  pageSize?: number;
}

/** 사용자 목록 — apiGetList 와 동일하게 { data } 형태로 반환(뷰는 usersData.data 사용). */
export async function fetchUsers(
  params: UserListParams = {},
): Promise<{ data: User[] }> {
  const res = await usersControllerList({
    departmentId: params.departmentId,
    q: params.q,
    includeInactive: params.includeInactive ? 'true' : undefined,
    pageSize: params.pageSize != null ? String(params.pageSize) : undefined,
  });
  // res.data = 봉투 { data: UserDto[], meta } → res.data.data 가 목록.
  return { data: (res.data.data ?? []) as User[] };
}

/** 단건 조회(현재 화면 미사용이나 슬라이스 데이터 표면으로 노출). */
export async function fetchUser(id: string): Promise<User> {
  const res = await usersControllerGet(id);
  return toUser(res.data.data);
}

// ── 명령(쓰기, hr_admin) — 봉투 unwrap 후 반환 ──────────────
// 라이프사이클: resign·reactivate·remove(하드)·purge(완전).
export const userCommands = {
  create: async (body: CreateUserRequest): Promise<User> => {
    const res = await usersControllerCreate(body as CreateUserDto);
    // 201(생성) 응답은 본문 없이 data 가 void 일 수 있음 → 단건 봉투면 풀어서 반환.
    return toUser((res.data as { data?: unknown } | void)?.data);
  },
  update: async (id: string, body: UpdateUserRequest): Promise<User> => {
    const res = await usersControllerUpdate(id, body as UpdateUserDto);
    return toUser(res.data.data);
  },
  // 퇴사: employmentStatus=resigned, isActive=false (멱등). → User.
  resign: async (id: string): Promise<User> => {
    const res = await usersControllerResign(id);
    return toUser(res.data.data);
  },
  // 복직: active, isActive=true. → User.
  reactivate: async (id: string): Promise<User> => {
    const res = await usersControllerReactivate(id);
    return toUser(res.data.data);
  },
  // 하드 삭제(기본). 활성/이력 있으면 409 throw. 성공 → { id }.
  remove: async (id: string): Promise<{ id: string }> => {
    const res = await usersControllerRemove(id);
    return res.data.data as { id: string };
  },
  // 완전 삭제(이력 포함 cascade). 성공 → { id, purged:true }.
  purge: async (id: string): Promise<{ id: string; purged?: boolean }> => {
    const res = await usersControllerRemove(id, { force: 'true' });
    return res.data.data as { id: string; purged?: boolean };
  },
};
