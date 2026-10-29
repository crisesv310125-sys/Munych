interface AvatarProps {
  initials: string;
  size?: number;
  color?: string;
  onNavy?: boolean;
}

export function Avatar({ initials, size = 34, color = 'var(--navy)', onNavy }: AvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, size * 0.34),
        fontWeight: 600,
        color: '#FFFFFF',
        flex: 'none',
        background: onNavy ? 'rgba(255,255,255,.12)' : color,
        border: onNavy ? '1px solid rgba(255,255,255,.2)' : 'none',
      }}
    >
      {initials}
    </span>
  );
}
