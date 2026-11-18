import { CalendarDays } from 'lucide-react'

export function Brand() {
  return <span className="brand">
    <span className="brand-icon"><CalendarDays size={21} strokeWidth={2.1} aria-hidden="true" /></span>
    <span>daily<span className="brand-period">.</span></span>
  </span>
}
