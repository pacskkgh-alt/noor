// فتح صفحة من الموقع بنفس الحساب: نطلب تذكرة قصيرة العمر ثم نفتح /m/open
import { api, API_URL } from './api';

export async function webUrl(to: string) {
  const { ticket } = await api<{ ticket: string }>('/api/auth/web-ticket', { method: 'POST' });
  return `${API_URL}/m/open?ticket=${encodeURIComponent(ticket)}&to=${encodeURIComponent(to)}`;
}
