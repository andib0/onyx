import type { ReactNode } from 'react';

type TierSectionProps = {
  label: string;
  children?: ReactNode;
};

function TierSection({ label, children }: TierSectionProps) {
  return (
    <div className="supplementTier">
      <div className="small">{label}</div>
      <div className="list supplementList">{children}</div>
    </div>
  );
}

export default TierSection;
