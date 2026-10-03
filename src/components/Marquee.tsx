import { Pause, Play } from 'lucide-react'
import { useState } from 'react'

const items = [
  'Free delivery & setup',
  'Sanitized after every rental',
  'Fully licensed & insured',
  'Weather-safe rescheduling',
  'On-time, every time',
  'Locally owned',
  'No deposit until confirmed',
]

export function Marquee() {
  const [paused, setPaused] = useState(false)
  return (
    <div className="relative -rotate-1 border-y-4 border-ink bg-sun py-3">
      <div className="group flex overflow-hidden" aria-label="Why families choose us">
        <ul
          className={`flex shrink-0 animate-marquee gap-8 pr-8 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none ${paused ? '[animation-play-state:paused]' : ''}`}
        >
          {[...items, ...items].map((t, i) => (
            <li
              key={i}
              aria-hidden={i >= items.length ? 'true' : undefined}
              className="flex items-center gap-8 font-display text-xl font-extrabold whitespace-nowrap text-ink sm:text-2xl"
            >
              {t}
              <svg viewBox="0 0 24 24" className="size-6 text-pop" aria-hidden="true">
                <path fill="currentColor" d="M12 2l2.9 6.6L22 9.3l-5.4 4.8L18.2 21 12 17.3 5.8 21l1.6-6.9L2 9.3l7.1-.7z" />
              </svg>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? 'Play scrolling banner' : 'Pause scrolling banner'}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-ink text-sun motion-reduce:hidden"
      >
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
    </div>
  )
}
