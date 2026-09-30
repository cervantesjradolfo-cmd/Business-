import { business } from '../data/site'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="size-10 shrink-0" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="#2563EB" />
        <path d="M7 33V18l5-5 5 5v-5l3-4 3 4v5l5-5 5 5v15z" fill="#FCD34D" />
        <path d="M16 33v-6a4 4 0 0 1 8 0v6z" fill="#EC4899" />
        <circle cx="12" cy="11" r="1.6" fill="#fff" />
        <circle cx="28" cy="11" r="1.6" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-xl font-extrabold ${light ? 'text-white' : 'text-ink'}`}>
          {business.name}
        </span>
        <span className={`block text-xs font-bold tracking-wider uppercase ${light ? 'text-sun' : 'text-pop'}`}>
          {business.tagline}
        </span>
      </span>
    </span>
  )
}
