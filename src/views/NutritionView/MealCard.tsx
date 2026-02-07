import { useState, useEffect, useRef } from 'react';
import type { MealTemplate } from '../../types/appTypes';

type MealCardProps = {
  meal: MealTemplate;
  isTaken: boolean;
  onToggleTaken: (mealId: string, isTaken: boolean) => void;
  onGramsChange: (mealId: string, grams: number) => void;
  onRemove: (mealId: string) => void;
};

const computeMacro = (per100: string | undefined, grams: number): number => {
  if (per100 == null) return 0;
  const base = parseFloat(per100);
  if (isNaN(base)) return 0;
  return Math.round(base * (grams / 100));
};

function MealCard({
  meal,
  isTaken,
  onToggleTaken,
  onGramsChange,
  onRemove,
}: MealCardProps) {
  const [localGrams, setLocalGrams] = useState<string>(
    meal.grams != null ? String(meal.grams) : '100'
  );
  const [isEditingGrams, setIsEditingGrams] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (meal.grams != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync prop to local state
      setLocalGrams(String(meal.grams));
    }
  }, [meal.grams]);

  const handleGramsChange = (value: string) => {
    setLocalGrams(value);
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onGramsChange(meal.id || '', parsed);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Build macros summary from tags
  const grams = parseFloat(localGrams) || 100;
  const tags = meal.tags || [];
  const proteinTag = tags.find((t) => t.label === 'Protein');
  const carbsTag = tags.find((t) => t.label === 'Carbs');
  const caloriesTag = tags.find((t) => t.label === 'Calories');
  const hasMacros = meal.foodId && (proteinTag || carbsTag || caloriesTag);

  return (
    <div
      className={`mealItem${isTaken ? ' isTaken' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        onToggleTaken(meal.id || '', !isTaken);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleTaken(meal.id || '', !isTaken);
        }
      }}
      aria-pressed={!!isTaken}
    >
      <div className="mealHeader">
        <div className="mealMain">
          <div className="mealNameRow">
            <div className="mealNameText">{meal.name}</div>
            {meal.foodId ? (
              <button
                className="mealEditGramsBtn"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsEditingGrams((prev) => !prev);
                }}
              >
                {isEditingGrams ? 'Done' : 'Edit'}
              </button>
            ) : null}
          </div>
          {hasMacros ? (
            <div className="mealMacrosSummary">
              {`${grams}g`}
              {proteinTag
                ? ` · ${computeMacro(proteinTag.value, grams)}g P`
                : ''}
              {carbsTag
                ? ` · ${computeMacro(carbsTag.value, grams)}g C`
                : ''}
              {caloriesTag
                ? ` · ${computeMacro(caloriesTag.value, grams)} kcal`
                : ''}
            </div>
          ) : null}
          {meal.examples ? (
            <div className="mealExamples">
              <span>
                <b>Examples:</b> {meal.examples}
              </span>
            </div>
          ) : null}
          {meal.foodId && isEditingGrams ? (
            <div
              className="mealGramsRow"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span className="mealGramsLabel">Grams:</span>
              <input
                className="mealGramsInput"
                type="number"
                min="0"
                step="1"
                value={localGrams}
                onChange={(event) => handleGramsChange(event.target.value)}
                aria-label="Grams"
              />
              <span className="mealGramsLabel">g</span>
            </div>
          ) : null}
          <div className="mealTags">
            {tags.map((tag, index) => (
              <div className="mealTag" key={`${meal.id}-${index}`}>
                <span className="mealTagLabel">{tag.label}:</span>
                <span className="mealTagValue">{tag.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mealActions">
          {isTaken ? <div className="mealTaken">Taken</div> : null}
          <button
            className="mealActionRemove"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(meal.id || '');
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default MealCard;
