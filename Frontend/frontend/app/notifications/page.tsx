import type { Metadata } from 'next';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { getStaffAccounts, getTasks } from '@/lib/data';

export const metadata: Metadata = { title: 'Notifications & tasks' };

export default async function NotificationsPage() {
  const [staff, tasks] = await Promise.all([getStaffAccounts(), getTasks()]);
  const source = [staff, tasks].some((r) => r.source === 'demo') ? 'demo' : 'live';
  return <NotificationsView staff={staff.data.map((s) => s.name)} source={source} />;
}
