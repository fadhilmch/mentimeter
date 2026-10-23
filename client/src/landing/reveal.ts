import type { Directive } from 'vue'

/** Shared observer: reveals each element the first time it scrolls into view. */
let io: IntersectionObserver | null = null

function observer(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('revealed')
          io?.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
    )
  }
  return io
}

/**
 * v-reveal - the element starts hidden (see the .reveal styles) and fades/rises in
 * when it first enters the viewport. Without IntersectionObserver the element never
 * gets the hidden pre-state, so it simply stays visible. Reduced-motion users get
 * no hidden pre-state either (the styles guard on it).
 */
export const vReveal: Directive = {
  mounted(el) {
    const obs = observer()
    if (!obs) return
    el.classList.add('reveal')
    obs.observe(el)
  },
  unmounted(el) {
    observer()?.unobserve(el)
  },
}
