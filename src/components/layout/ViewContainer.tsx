import type { ReactNode } from 'react';

type ViewContainerProps = {
  active?: boolean;
  children?: ReactNode;
};

function ViewContainer({ active = false, children }: ViewContainerProps) {
  return <section style={{ display: active ? '' : 'none' }}>{children}</section>;
}

export default ViewContainer;
