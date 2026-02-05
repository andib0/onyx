type TimelineFilterProps = {
  showAllTimeline: boolean;
  onToggleTimeline: () => void;
};

function TimelineFilter({ showAllTimeline, onToggleTimeline }: TimelineFilterProps) {
  return (
    <button onClick={onToggleTimeline} type="button">
      {showAllTimeline ? 'Show current + next' : 'Show all'}
    </button>
  );
}

export default TimelineFilter;
