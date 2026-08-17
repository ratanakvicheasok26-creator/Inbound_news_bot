"use client"

import { useState, type ReactNode, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/lib/i18n/LocaleProvider"

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] mb-1">{title}</h1>
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">{subtitle}</p>
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-[13px] text-[var(--text-secondary)]">{footer}</p>
        )}
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
  const { t } = useI18n()
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
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
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
