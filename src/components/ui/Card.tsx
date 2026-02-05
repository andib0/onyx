import type { CSSProperties, ReactNode } from 'react';

type CardProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function Card({ children, className = '', style }: CardProps) {
  const classes = ['card', className].filter(Boolean).join(' ');
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

export default Card;
