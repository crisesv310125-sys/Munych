import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  dashed?: boolean;
}

export function Card({ interactive, dashed, className, ...rest }: CardProps) {
  const classes = [styles.card, interactive ? styles.interactive : '', dashed ? styles.dashed : '', className]
    .filter(Boolean)
    .join(' ');
  return <div className={classes} {...rest} />;
}
