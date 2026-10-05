export default function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900">
      <span>DEMO DATA: fictional businesses, not real leads.</span>
      <button type="button" onClick={onExit} className="rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-50">
        Exit demo
      </button>
    </div>
  )
}
