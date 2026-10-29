import Link from 'next/link';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-blue-700 hover:bg-blue-50 hover:text-blue-900 disabled:text-slate-400',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md') {
  const sizing = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm';
  return `inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed ${sizing} ${variantClasses[variant]}`;
}

type ButtonProps = React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'sm' | 'md' };

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: 'sm' | 'md' };

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...props }: ButtonLinkProps) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
