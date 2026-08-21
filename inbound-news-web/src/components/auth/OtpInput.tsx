"use client"

import { useRef, useEffect } from "react"

interface OtpInputProps {
  value: string[]
  onChange: (otp: string[]) => void
  disabled?: boolean
  onComplete?: (code: string) => void
  length?: number
}

export function OtpInput({ value, onChange, disabled = false, onComplete, length }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const numBoxes = length || 6

  useEffect(() => {
    // Focus the first empty input on mount if available
    const firstEmptyIndex = value.findIndex((digit) => !digit)
    const indexToFocus = firstEmptyIndex !== -1 ? firstEmptyIndex : 0
    if (inputRefs.current[indexToFocus] && !disabled) {
      inputRefs.current[indexToFocus]?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleInputChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    const digits = val.replace(/\D/g, "")
    
    if (!digits) {
      const newOtp = [...value]
      newOtp[idx] = ""
      onChange(newOtp)
      return
    }

    if (digits.length > 1) {
      handlePastedCode(digits, idx)
      return
    }

    const newOtp = [...value]
    newOtp[idx] = digits[0] || ""
    onChange(newOtp)

    if (digits[0] && idx < numBoxes - 1) {
      inputRefs.current[idx + 1]?.focus()
    }

    if (newOtp.length >= numBoxes && newOtp.slice(0, numBoxes).every((d) => d.length === 1)) {
      onComplete?.(newOtp.slice(0, numBoxes).join(""))
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!value[idx] && idx > 0) {
        e.preventDefault()
        const newOtp = [...value]
        newOtp[idx - 1] = ""
        onChange(newOtp)
        inputRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault()
      inputRefs.current[idx - 1]?.focus()
    } else if (e.key === "ArrowRight" && idx < numBoxes - 1) {
      e.preventDefault()
      inputRefs.current[idx + 1]?.focus()
    }
  }

  function handlePastedCode(pastedText: string, startIdx = 0) {
    const digits = pastedText.replace(/\D/g, "")
    if (!digits) return

    const targetLength = digits.length >= 8 ? 8 : (length || 6)
    const newOtp = Array.from({ length: targetLength }, (_, i) => "")

    for (let i = 0; i < digits.length && i < targetLength; i++) {
      newOtp[i] = digits[i]
    }
    onChange(newOtp)

    const nextIndex = Math.min(startIdx + digits.length, targetLength - 1)
    inputRefs.current[nextIndex]?.focus()

    if (newOtp.every((d) => d && d.length === 1)) {
      onComplete?.(newOtp.join(""))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    handlePastedCode(pastedText, 0)
  }

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full my-4 flex-wrap">
      {Array.from({ length: numBoxes }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={numBoxes}
          value={value[idx] || ""}
          disabled={disabled}
          onChange={(e) => handleInputChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className="w-9 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold font-mono bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all disabled:opacity-50"
          aria-label={`Digit ${idx + 1} of ${numBoxes}`}
        />
      ))}
    </div>
  )
}
