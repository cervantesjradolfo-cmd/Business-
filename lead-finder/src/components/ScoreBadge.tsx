import clsx from 'clsx'
import { scoreTier } from '../lib/scoring'

const TIER_LABEL = { hot: 'Hot', warm: 'Warm', cool: 'Cool' } as const

export default function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tier = scoreTier(score)
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        tier === 'hot' && 'bg-red-100 text-hot',
        tier === 'warm' && 'bg-amber-100 text-amber-700',
        tier === 'cool' && 'bg-slate-100 text-slate-600',
        className,
      )}
      title={`Opportunity score ${score} of 100`}
    >
      <span className="tabular-nums">{score}</span>
      <span>{TIER_LABEL[tier]}</span>
    </span>
  )
}
