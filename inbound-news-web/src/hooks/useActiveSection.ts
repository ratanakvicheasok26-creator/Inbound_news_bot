"use client"

import { useState, useEffect } from "react"

export function useActiveSection(sectionIds: string[]) {
  const [active, setActive] = useState("")
  useEffect(() => {
    if (sectionIds.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sectionIds])
  return active
}
