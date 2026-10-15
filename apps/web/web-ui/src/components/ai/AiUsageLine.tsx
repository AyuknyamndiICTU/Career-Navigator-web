import { AiMeta, costLabel, formatTokens } from '@/lib/ai-usage';

type Props = {
  meta?: AiMeta | null;
  /** Running output-token estimate while the answer streams. */
  streamingTokens?: number;
};

/** "↑ 1,240 · ↓ 312 tokens · free · gemini-3.8-flash (your key)" under an AI answer. */
export default function AiUsageLine({ meta, streamingTokens }: Props) {
  if (!meta && streamingTokens === undefined) return null;

  const parts: string[] = [];
  if (meta?.usage && streamingTokens === undefined) {
    parts.push(`↑ ${formatTokens(meta.usage.inputTokens)}`);
    parts.push(`↓ ${formatTokens(meta.usage.outputTokens)} tokens`);
    parts.push(costLabel(meta.usage));
  } else if (streamingTokens !== undefined) {
    parts.push(`↓ ~${formatTokens(streamingTokens)} tokens`);
  }
  if (meta?.cached) parts.push('cached');
  if (meta?.model) parts.push(`${meta.model}${meta.viaOwnKey ? ' (your key)' : ''}`);

  return (
    <div className="mt-1.5 text-[11px] font-medium text-slate-400 tabular-nums" aria-label="AI usage">
      {parts.join(' · ')}
    </div>
  );
}
