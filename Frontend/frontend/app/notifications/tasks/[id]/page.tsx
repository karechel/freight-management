import type { Metadata } from 'next';
import { TaskDetailView } from '@/components/notifications/task-detail-view';
import { getTasks } from '@/lib/data';

// Tasks can be created in the browser session, so an unknown id is handled by
// the client view instead of notFound().

export const metadata: Metadata = { title: 'Task' };

export default async function TaskPage({ params }: PageProps<'/notifications/tasks/[id]'>) {
  const [{ id }, tasks] = await Promise.all([params, getTasks()]);
  return <TaskDetailView taskId={id} source={tasks.source} />;
}
