import type { ReactNode } from 'react'

export default function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 text-slate-400">{icon}</div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
    </div>
  )
}
