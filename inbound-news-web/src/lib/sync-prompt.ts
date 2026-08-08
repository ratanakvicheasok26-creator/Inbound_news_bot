const DISMISS_KEY = "ib_sync_prompt_dismissed"
const PENDING_KEY = "ib_sync_prompt_pending"

export function isSyncPromptDismissed(): boolean {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(DISMISS_KEY) === "1"
  } catch {
    return true
  }
}

export function dismissSyncPrompt(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DISMISS_KEY, "1")
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
}

/** Call after a guest saves a story — shows soft prompt once until dismissed. */
export function markSyncPromptPending(): void {
  if (typeof window === "undefined") return
  try {
    if (localStorage.getItem(DISMISS_KEY) === "1") return
    localStorage.setItem(PENDING_KEY, "1")
    window.dispatchEvent(new CustomEvent("inbound:sync-prompt"))
  } catch {
    // ignore
  }
}

export function hasSyncPromptPending(): boolean {
  if (typeof window === "undefined") return false
  try {
    return (
      localStorage.getItem(PENDING_KEY) === "1" &&
      localStorage.getItem(DISMISS_KEY) !== "1"
    )
  } catch {
    return false
  }
}
