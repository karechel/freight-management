// Form primitives: labelled fields with hint and error text wired up for
// assistive technology, plus an error summary. Controlled inputs only.

import { AlertIcon } from './icons';

export const inputClass =
  'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-2 focus:outline-offset-1 focus:outline-blue-600';

const invalidClass = 'border-red-500 bg-red-50/40';

export const fieldId = (formId: string, name: string) => `${formId}-${name}`;

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({ id, label, required, hint, error, className = '', children }: FieldShellProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="text-red-700" aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          <span className="font-normal text-slate-500"> (optional)</span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs font-medium text-red-700">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function controlProps(id: string, required: boolean | undefined, hint: unknown, error: string | undefined) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return {
    id,
    name: id,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
}

interface BaseFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
}

export function TextField({
  inputMode,
  placeholder,
  maxLength,
  autoComplete = 'off',
  list,
  ...props
}: BaseFieldProps & {
  inputMode?: 'text' | 'numeric' | 'decimal';
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  /** id of a <datalist> with suggestions. */
  list?: string;
}) {
  const { id, label, value, onChange, required, hint, error, className } = props;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        type="text"
        {...controlProps(id, required, hint, error)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        list={list}
        className={`${inputClass} w-full ${error ? invalidClass : ''}`}
      />
    </FieldShell>
  );
}

export function SelectField({
  options,
  placeholder,
  ...props
}: BaseFieldProps & { options: { value: string; label: string }[]; placeholder?: string }) {
  const { id, label, value, onChange, required, hint, error, className } = props;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        {...controlProps(id, required, hint, error)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-full ${error ? invalidClass : ''}`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ rows = 3, maxLength, ...props }: BaseFieldProps & { rows?: number; maxLength?: number }) {
  const { id, label, value, onChange, required, hint, error, className } = props;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        {...controlProps(id, required, hint, error)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className={`${inputClass} h-auto w-full py-2 ${error ? invalidClass : ''}`}
      />
    </FieldShell>
  );
}

/** Date (`type="date"`) or date-and-time (`type="datetime-local"`) input, in Nairobi time. */
export function DateField({
  withTime = false,
  onNow,
  ...props
}: BaseFieldProps & { withTime?: boolean; /** Shows a "Now" button that fills in the current time. */ onNow?: () => void }) {
  const { id, label, value, onChange, required, hint, error, className } = props;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="flex gap-2">
        <input
          type={withTime ? 'datetime-local' : 'date'}
          {...controlProps(id, required, hint, error)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} min-w-0 flex-1 ${error ? invalidClass : ''}`}
        />
        {onNow && (
          <button
            type="button"
            onClick={onNow}
            className="h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          >
            Now<span className="sr-only"> – fill in the current time for {label}</span>
          </button>
        )}
      </div>
    </FieldShell>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
  className = '',
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4 rounded border-slate-300 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Group of related fields with a visible heading. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-t border-slate-200 px-4 py-5 first:border-t-0 sm:px-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-sm font-semibold text-slate-900" aria-hidden="true">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

export interface SummaryError {
  id: string;
  label: string;
  message: string;
}

/** List of validation errors linking to each field. Focus it (by `id`) after a failed submit. */
export function ErrorSummary({ id, errors }: { id: string; errors: SummaryError[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      id={id}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
    >
      <p id={`${id}-title`} className="flex items-center gap-2 font-semibold">
        <AlertIcon className="size-4" />
        {errors.length === 1 ? 'There is 1 problem to fix' : `There are ${errors.length} problems to fix`}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {errors.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(e.id)?.focus();
              }}
              className="rounded underline hover:text-red-950 focus-visible:outline-2 focus-visible:outline-red-600"
            >
              {e.label}: {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
