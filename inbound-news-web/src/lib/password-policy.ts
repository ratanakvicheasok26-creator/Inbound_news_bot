import zxcvbn from "zxcvbn"

const MIN_LENGTH_WITH_MFA = 8
const MIN_LENGTH_WITHOUT_MFA = 15
const MAX_PASSWORD_LENGTH = 128
const MIN_ZXCVBN_SCORE = 3

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  score: number
  feedback: string
}

export function validatePassword(
  password: string,
  mfaEnabled = false,
): PasswordValidationResult {
  const errors: string[] = []

  if (password.length === 0) {
    return { valid: false, errors: ["Password is required"], score: 0, feedback: "" }
  }

  const minLength = mfaEnabled ? MIN_LENGTH_WITH_MFA : MIN_LENGTH_WITHOUT_MFA
  if (password.length < minLength) {
    errors.push(
      mfaEnabled
        ? `Password must be at least ${MIN_LENGTH_WITH_MFA} characters`
        : `Password must be at least ${MIN_LENGTH_WITHOUT_MFA} characters when MFA is not enabled`,
    )
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`)
  }

  const result = zxcvbn(password)
  const feedbackMessages: string[] = []
  if (result.feedback.warning) {
    feedbackMessages.push(result.feedback.warning)
  }
  feedbackMessages.push(...result.feedback.suggestions)

  if (result.score < MIN_ZXCVBN_SCORE) {
    errors.push("Password is too weak. Try adding more words, avoid common patterns")
  }

  return {
    valid: errors.length === 0,
    errors,
    score: result.score,
    feedback: feedbackMessages.join(". "),
  }
}

function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  return crypto.subtle.digest("SHA-1", data).then((buf) => {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  })
}

export async function checkPasswordBreach(password: string): Promise<{
  breached: boolean
  count: number
}> {
  try {
    const hash = await sha1(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    })

    if (!res.ok) return { breached: false, count: 0 }

    const text = await res.text()
    const lines = text.split("\n")

    for (const line of lines) {
      const [hashSuffix, count] = line.split(":")
      if (hashSuffix.trim() === suffix) {
        const num = parseInt(count.trim(), 10)
        return { breached: num > 0, count: num }
      }
    }

    return { breached: false, count: 0 }
  } catch {
    return { breached: false, count: 0 }
  }
}

export function validateEmail(email: string): boolean {
  if (email.length > 254) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function sanitizeDisplayName(name: string): string {
  return name.trim().slice(0, 100)
}
