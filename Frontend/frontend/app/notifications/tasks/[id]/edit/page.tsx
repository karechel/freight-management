import type { Metadata } from 'next';
import { TaskFormView } from '@/components/notifications/task-form';
import { getStaffAccounts } from '@/lib/data';

export const metadata: Metadata = { title: 'Edit task' };

export default async function EditTaskPage({ params }: PageProps<'/notifications/tasks/[id]/edit'>) {
  const [{ id }, staff] = await Promise.all([params, getStaffAccounts()]);
  return <TaskFormView taskId={id} staff={staff.data.map((s) => s.name)} source={staff.source} />;
}
