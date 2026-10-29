import { Card } from './Card';

export function EmptyState({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Card
      dashed
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--un-blue)', cursor: 'pointer' }}
        >
          {action.label} ›
        </button>
      )}
    </Card>
  );
}
