import type { ReactNode } from 'react';

type BadgeProps = {
  children?: ReactNode;
  tag?: string;
  className?: string;
};

function Badge({ children, tag = '', className = '' }: BadgeProps) {
  const classes = ['badge', className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tag={tag}>
      {children}
    </span>
  );
}

export default Badge;
