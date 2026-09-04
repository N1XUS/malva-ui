import type { MlvTaskboard, MlvTaskboardMoveRequest } from './taskboard.types';

const authorizedRequests = new WeakSet<object>();
const boardsRequiringSessionAuthorization = new WeakSet<object>();

export function beginMlvTaskboardDragAuthorization<TItem>(
  board: MlvTaskboard<TItem>,
  hasPolicy: boolean,
): void {
  if (hasPolicy) boardsRequiringSessionAuthorization.add(board);
}

export function authorizeMlvTaskboardMoveRequest<TItem>(
  request: MlvTaskboardMoveRequest<TItem>,
): void {
  authorizedRequests.add(request);
}

export function isMlvTaskboardMoveRequestAuthorized<TItem>(
  request: MlvTaskboardMoveRequest<TItem>,
): boolean {
  return authorizedRequests.has(request);
}

export function requiresMlvTaskboardSessionAuthorization<TItem>(
  board: MlvTaskboard<TItem>,
): boolean {
  return boardsRequiringSessionAuthorization.has(board);
}
