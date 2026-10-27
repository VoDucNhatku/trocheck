import type { components } from '@/lib/api/generated';
type DTO = components['schemas'];
export type SessionUser = DTO['SessionUser'];
export type Role = SessionUser['roles'][number];
export type AnalysisResult = DTO['AnalysisResult'];
export type AnalysisCreated = DTO['AnalysisCreated'];
export type MarketSummary = DTO['MarketSummaryDTO'];
export type TeamPosts = DTO['TeamPosts'];
export type ReviewQueue = DTO['ReviewQueue'];
export type ReviewDetail = DTO['ReviewDetail'];
export type ReviewSaved = DTO['ReviewSaved'];
export type TokenInfo = DTO['ExtensionTokenInfo'];
export type TokenCreated = DTO['ExtensionTokenCreated'];
export type LabResult = DTO['LabResultDTO'];
export type EvalRuns = DTO['EvalRuns'];
export type EvalResult = DTO['EvalResult'];
export type IngestPost = DTO['IngestPost'];
export type ReviewDecision = DTO['ReviewDecision'];
export function hasRole(user: SessionUser, ...roles: Role[]) {
  return user.roles.includes('admin') || roles.some(role => user.roles.includes(role));
}
export const ROLE_NAME: Record<Role, string> = {
  renter: 'Người đọc tin', collector: 'Thu thập', reviewer: 'Kiểm duyệt', researcher: 'Nghiên cứu', admin: 'Quản trị',
};
