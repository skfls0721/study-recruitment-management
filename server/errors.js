export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const bad = (message='요청 값이 올바르지 않습니다.') => new AppError(400, 'BAD_INPUT', message);
export const missing = (what='대상') => new AppError(404, 'NOT_FOUND', `${what}을 찾을 수 없습니다.`);
export const forbidden = () => new AppError(403, 'FORBIDDEN', '이 작업을 수행할 권한이 없습니다.');
export const conflict = (message='현재 조건에서는 처리할 수 없습니다.') => new AppError(409, 'CONFLICT', message);
