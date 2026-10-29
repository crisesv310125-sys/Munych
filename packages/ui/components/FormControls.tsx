import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './FormControls.module.css';

interface FieldWrapProps {
  label?: string;
  onNavy?: boolean;
  children: ReactNode;
}

function FieldWrap({ label, onNavy, children }: FieldWrapProps) {
  return (
    <div className={styles.field}>
      {label && <label className={`${styles.label} ${onNavy ? styles.onNavyLabel : ''}`}>{label}</label>}
      {children}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  onNavy?: boolean;
}

export function Input({ label, onNavy, className, ...rest }: InputProps) {
  return (
    <FieldWrap label={label} onNavy={onNavy}>
      <input className={[styles.control, onNavy ? styles.onNavy : '', className].filter(Boolean).join(' ')} {...rest} />
    </FieldWrap>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  onNavy?: boolean;
  helper?: string;
}

export function Textarea({ label, onNavy, helper, className, ...rest }: TextareaProps) {
  return (
    <FieldWrap label={label} onNavy={onNavy}>
      <textarea
        className={[styles.control, styles.textarea, onNavy ? styles.onNavy : '', className].filter(Boolean).join(' ')}
        {...rest}
      />
      {helper && <span style={{ fontSize: 10, color: '#98A6B5' }}>{helper}</span>}
    </FieldWrap>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, children, className, ...rest }: SelectProps) {
  return (
    <FieldWrap label={label}>
      <select className={[styles.control, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
}
