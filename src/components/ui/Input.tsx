'use client';

import { cn } from '@/lib/utils';

export function Input({ 
  className, 
  type = 'text', 
  placeholder,
  value,
  onChange,
  disabled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {props.leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          {props.leftIcon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          props.leftIcon ? 'pl-10' : 'pl-4',
          props.rightIcon ? 'pr-10' : 'pr-4',
          'py-2.5 text-sm',
          className
        )}
        {...props}
      />
      {props.rightIcon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
          {props.rightIcon}
        </div>
      )}
    </div>
  );
}