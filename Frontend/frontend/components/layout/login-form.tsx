'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { ErrorSummary, TextField } from '@/components/ui/form';
import { useValidatedForm } from '@/components/ui/use-validated-form';
import { ApiError, signInRequest } from '@/lib/api/browser';
import { useCurrentUser } from './current-user';

type Field = 'email' | 'password';
const FORM_ID = 'login';
const labels: Record<Field, string> = { email: 'Email', password: 'Password' };

function validate(values: Record<Field, string>) {
  const errors: Partial<Record<Field, string>> = {};
  if (!values.email.trim()) errors.email = 'Enter your email.';
  if (!values.password) errors.password = 'Enter your password.';
  return { errors, input: Object.keys(errors).length === 0 ? values : undefined };
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { session, signedIn } = useCurrentUser();
  const form = useValidatedForm<Record<Field, string>, Field, Record<Field, string>>(
    FORM_ID,
    { email: '', password: '' },
    validate,
    labels,
  );
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (session.status === 'signed_in') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">You are signed in as {session.user.name ?? session.user.email}.</p>
        <ButtonLink href={next} variant="secondary">
          Continue
        </ButtonLink>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    const input = form.submit();
    if (!input) return;
    setBusy(true);
    try {
      const { user } = await signInRequest(input.email.trim(), input.password);
      signedIn(user);
      router.push(next);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'Sign-in failed. Try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ErrorSummary id={form.summaryId} errors={form.summary} />
      {failure && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {failure}
        </p>
      )}
      <TextField
        {...form.field('email')}
        label={labels.email}
        type="email"
        autoComplete="username"
        required
        value={form.values.email}
        onChange={(value) => form.set('email', value)}
      />
      <TextField
        {...form.field('password')}
        label={labels.password}
        type="password"
        autoComplete="current-password"
        required
        value={form.values.password}
        onChange={(value) => form.set('password', value)}
      />
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
