import type { Metadata } from 'next';
import { LoginForm } from '@/components/layout/login-form';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Sign in' };

/** Only same-site paths, so a crafted link cannot send users elsewhere after signing in. */
function safeNext(value: string | string[] | undefined): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        <CardHeader title="Sign in" description="Use your staff account" />
        <CardBody>
          <LoginForm next={safeNext(next)} />
        </CardBody>
      </Card>
    </div>
  );
}
