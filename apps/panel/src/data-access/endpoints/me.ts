import { apiFetch } from '../apiClient';
import type { Me } from '../apiTypes';

export function getMe(): Promise<Me> {
  return apiFetch<Me>('/me');
}
