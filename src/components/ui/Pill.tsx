import type { ReactNode } from 'react';

type PillProps = {
  children?: ReactNode;
  className?: string;
};

function Pill({ children, className = '' }: PillProps) {
  const classes = ['pill', className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}

export default Pill;
