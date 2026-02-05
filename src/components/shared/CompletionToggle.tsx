type CompletionToggleProps = {
  isComplete?: boolean;
};

function CompletionToggle({ isComplete = false }: CompletionToggleProps) {
  if (!isComplete) return null;
  return <div className="blockTaken">Done</div>;
}

export default CompletionToggle;
