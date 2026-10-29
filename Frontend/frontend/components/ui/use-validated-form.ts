'use client';

import { useState } from 'react';
import type { FieldErrors } from '@/lib/validation';
import { fieldId, type SummaryError } from './form';

interface Validation<K extends string, I> {
  errors: FieldErrors<K>;
  input?: I;
}

/**
 * Holds form values and errors. Errors appear after the first submit and are
 * then re-checked on every change, so they clear as the user fixes them.
 *
 * The error summary lists fields in the order of `labels`, followed by any
 * other error keys (e.g. dynamic line-item fields) named by `labelFor`.
 */
export function useValidatedForm<V, K extends string, I>(
  formId: string,
  initial: V,
  validate: (values: V) => Validation<K, I>,
  labels: Partial<Record<K, string>>,
  labelFor: (key: K) => string = (key) => key,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const [submitted, setSubmitted] = useState(false);
  const summaryId = `${formId}-error-summary`;

  function update(change: (values: V) => V) {
    const next = change(values);
    setValues(next);
    if (submitted) setErrors(validate(next).errors);
  }

  function set<F extends keyof V>(field: F, value: V[F]) {
    update((v) => ({ ...v, [field]: value }));
  }

  /** Validates; returns the typed input, or undefined and moves focus to the error summary. */
  function submit(): I | undefined {
    setSubmitted(true);
    const result = validate(values);
    setErrors(result.errors);
    if (!result.input) requestAnimationFrame(() => document.getElementById(summaryId)?.focus());
    return result.input;
  }

  const known = Object.keys(labels) as K[];
  const extra = (Object.keys(errors) as K[]).filter((k) => !known.includes(k));
  const summary: SummaryError[] = [...known, ...extra]
    .filter((k) => errors[k])
    .map((k) => ({ id: fieldId(formId, k), label: labels[k] ?? labelFor(k), message: errors[k] as string }));

  return {
    values,
    set,
    update,
    errors,
    submit,
    summary,
    summaryId,
    /** Props shared by every field: id, current error. */
    field: (name: K) => ({ id: fieldId(formId, name), error: errors[name] }),
  };
}
