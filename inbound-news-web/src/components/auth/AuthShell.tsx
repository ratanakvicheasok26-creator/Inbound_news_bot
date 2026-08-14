"use client"

import { useState, type ReactNode, type InputHTMLAttributes } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="container py-12 md:py-16">
      <div className="max-w-[440px] mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 md:p-8">
        <h1 className="page-title mb-2">{title}</h1>
        <p className="text-[14px] text-[var(--text-secondary)] mb-6">{subtitle}</p>
        {children}
        <div className="mt-6 pt-4 border-t border-[var(--border)] text-center">
          <Link
            href="/"
            className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            ← Back to Inbound Reports
          </Link>
        </div>
      </div>
    </div>
  )
}

export const authInputClass =
  "w-full px-3 h-11 bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[15px] focus:outline-none focus:border-[var(--text-secondary)]"

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function PasswordInput({ value, onChange, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={`${authInputClass} ${className ?? ""}`.trim() + " pr-11"}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--red-subtle-bg)] text-[13px] text-[var(--accent)]">
      {message}
    </div>
  )
}

export function AuthSuccess({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[13px] text-[var(--text-primary)]">
      {message}
    </div>
  )
}
