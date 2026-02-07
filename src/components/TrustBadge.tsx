'use client';

interface TrustBadgeProps {
  score: number;
  label?: string;
  compact?: boolean;
}

function getTrustStyles(score: number): { className: string; label: string } {
  if (score >= 80) {
    return { className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Excellent' };
  }
  if (score >= 65) {
    return { className: 'bg-sky-500/20 text-sky-300 border-sky-500/40', label: 'Strong' };
  }
  if (score >= 50) {
    return { className: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'Moderate' };
  }
  return { className: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Caution' };
}

export function TrustBadge({ score, label = 'Trust', compact = false }: TrustBadgeProps) {
  const styles = getTrustStyles(score);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles.className}`}
      title={`Trust score: ${score} (${styles.label})`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className={compact ? 'font-semibold' : 'font-bold'}>{score}</span>
    </span>
  );
}
