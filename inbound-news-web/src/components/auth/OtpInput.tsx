"use client"

import { useRef, useEffect } from "react"

interface OtpInputProps {
  value: string[]
  onChange: (otp: string[]) => void
  disabled?: boolean
  onComplete?: (code: string) => void
}

export function OtpInput({ value, onChange, disabled = false, onComplete }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus the first empty input on mount if available
    const firstEmptyIndex = value.findIndex((digit) => !digit)
    const indexToFocus = firstEmptyIndex !== -1 ? firstEmptyIndex : 0
    if (inputRefs.current[indexToFocus] && !disabled) {
      inputRefs.current[indexToFocus]?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

  function handleInputChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    // Extract only digits
    const digits = val.replace(/\D/g, "")
    
    if (!digits) {
      // Input cleared
      const newOtp = [...value]
      newOtp[idx] = ""
      onChange(newOtp)
      return
    }

    if (digits.length > 1) {
      // Multiple digits entered/pasted into single field
      handlePastedCode(digits, idx)
      return
    }

    const newOtp = [...value]
    newOtp[idx] = digits[0] || ""
    onChange(newOtp)

    // Auto-advance to next input
    if (digits[0] && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }

    // Trigger complete if 6 digits are now filled
    if (newOtp.every((d) => d.length === 1)) {
      onComplete?.(newOtp.join(""))
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!value[idx] && idx > 0) {
        // Current input is empty, focus previous and clear it
        e.preventDefault()
        const newOtp = [...value]
        newOtp[idx - 1] = ""
        onChange(newOtp)
        inputRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault()
      inputRefs.current[idx - 1]?.focus()
    } else if (e.key === "ArrowRight" && idx < 5) {
      e.preventDefault()
      inputRefs.current[idx + 1]?.focus()
    }
  }

  function handlePastedCode(pastedText: string, startIdx = 0) {
    const digits = pastedText.replace(/\D/g, "").slice(0, 6)
    if (!digits) return

    const newOtp = [...value]
    for (let i = 0; i < digits.length; i++) {
      const targetIdx = startIdx + i
      if (targetIdx < 6) {
        newOtp[targetIdx] = digits[i] || ""
      }
    }
    onChange(newOtp)

    const nextIndex = Math.min(startIdx + digits.length, 5)
    inputRefs.current[nextIndex]?.focus()

    if (newOtp.every((d) => d.length === 1)) {
      onComplete?.(newOtp.join(""))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    handlePastedCode(pastedText, 0)
  }

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full my-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6} // Allow pasting up to 6 in one box, handled in handleInputChange / handlePaste
          value={value[idx] || ""}
          disabled={disabled}
          onChange={(e) => handleInputChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className="w-11 h-13 sm:w-13 sm:h-14 text-center text-xl font-bold font-mono bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all disabled:opacity-50"
          aria-label={`Digit ${idx + 1} of 6`}
        />
      ))}
    </div>
  )
}
