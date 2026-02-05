import type { ReactNode } from 'react';

type ToastProps = {
  message?: ReactNode;
  visible?: boolean;
};

function Toast({ message = '', visible = false }: ToastProps) {
  return (
    <div className="toast" style={{ display: visible ? 'block' : 'none' }}>
      {message}
    </div>
  );
}

export default Toast;
