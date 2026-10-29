const MEDALS = [
  { bg: 'var(--medal-1-bg)', fg: 'var(--medal-1-fg)' },
  { bg: 'var(--medal-2-bg)', fg: 'var(--medal-2-fg)' },
  { bg: 'var(--medal-3-bg)', fg: 'var(--medal-3-fg)' },
];

export function Medal({ position, size = 28 }: { position: number; size?: number }) {
  const style = MEDALS[position - 1] ?? { bg: 'var(--medal-rest-bg)', fg: 'var(--medal-rest-fg)' };
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: style.bg,
        color: style.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, size * 0.42),
        fontWeight: 700,
        flex: 'none',
      }}
    >
      {position}
    </span>
  );
}
