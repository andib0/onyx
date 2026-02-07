import type { MealTemplate } from '../../types/appTypes';

type NutritionFocusSectionProps = {
  mealTemplates: MealTemplate[];
  mealCheckMap: Record<string, boolean>;
  onToggleMealCheck: (mealId: string, isChecked: boolean) => void;
};

function NutritionFocusSection({
  mealTemplates,
  mealCheckMap,
  onToggleMealCheck,
}: NutritionFocusSectionProps) {
  const takenCount = mealTemplates.filter((m) => mealCheckMap[m.id || '']).length;
  const allDone = takenCount === mealTemplates.length && mealTemplates.length > 0;

  return (
    <section className="focusPanel">
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Nutrition</div>
          <h2>Today&apos;s meals</h2>
        </div>
        <div className="focusMeta">
          <span>
            {takenCount}/{mealTemplates.length} eaten
          </span>
        </div>
      </div>
      {allDone ? (
        <div className="focusComingUp">All meals eaten for today.</div>
      ) : mealTemplates.length === 0 ? (
        <div className="focusComingUp">No meals scheduled for today.</div>
      ) : (
        <div className="focusList">
          {mealTemplates.map((meal) => {
            const mealId = meal.id || '';
            const isTaken = !!mealCheckMap[mealId];
            return (
              <button
                key={mealId || meal.name}
                type="button"
                className={`focusListItem${isTaken ? ' focusListItemDone' : ''}`}
                onClick={() => onToggleMealCheck(mealId, !isTaken)}
              >
                <div>
                  <div className="focusListTitle">{meal.name}</div>
                  {meal.tags && meal.tags.length > 0 ? (
                    <div className="focusListMeta">
                      {meal.tags
                        .map((tag) => `${tag.label}: ${tag.value}`)
                        .join(' · ')}
                    </div>
                  ) : null}
                </div>
                <span className="focusListAction">
                  {isTaken ? 'Done' : 'Mark'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default NutritionFocusSection;
