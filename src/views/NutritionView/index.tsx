import { useEffect, useState } from 'react';

import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import MacroBar from './MacroBar';
import MealCard from './MealCard';
import { parseRangeValue } from '../../utils/formatting';
import type { MealTag, MealTemplate } from '../../types/appTypes';
import { searchFoods, type Food } from '../../api/foods';
import { updateMealGrams } from '../../api/meals';
import { addUserFood, getUserFoods, removeUserFood, type UserFood } from '../../api/userFoods';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_LENGTH } from '../../constants';

type NutritionTarget = {
  k: string;
  v: string;
  n: string;
};

type NutritionViewProps = {
  nutritionTargets: NutritionTarget[];
  mealTemplates: MealTemplate[];
  weekdayName: string;
  selectedMealDay: string;
  mealDayOptions: string[];
  mealCheckMap: Record<string, boolean>;
  onToggleMealCheck: (mealId: string, isChecked: boolean) => void;
  onUpdateMealTemplate: (
    dayName: string,
    mealId: string,
    patch: Partial<MealTemplate>
  ) => void;
  onRemoveMealTemplate: (dayName: string, mealId: string) => void;
  onAddMealTemplate: (dayName: string, template: MealTemplate) => void;
  onSelectMealDay: (dayName: string) => void;
};

function NutritionView({
  nutritionTargets,
  mealTemplates,
  weekdayName,
  selectedMealDay,
  mealDayOptions,
  mealCheckMap,
  onToggleMealCheck,
  onUpdateMealTemplate,
  onRemoveMealTemplate,
  onAddMealTemplate,
  onSelectMealDay,
}: NutritionViewProps) {
  const [foodQuery, setFoodQuery] = useState('');
  const debouncedFoodQuery = useDebouncedValue(foodQuery, SEARCH_DEBOUNCE_MS);
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [userFoods, setUserFoods] = useState<UserFood[]>([]);
  const [userFoodsLoading, setUserFoodsLoading] = useState(false);

  const getTagValue = (meal: MealTemplate, label: string) => {
    const tags = Array.isArray(meal.tags) ? meal.tags : [];
    const found = tags.find(
      (tag) => String(tag.label || '').toLowerCase() === label.toLowerCase()
    );
    return found ? parseRangeValue(found.value) : 0;
  };

  const getTargetValue = (label: string) => {
    const found = nutritionTargets.find(
      (target) => String(target.k || '').toLowerCase() === label.toLowerCase()
    );
    return found ? parseRangeValue(found.v) : 0;
  };

  const sumMeals = (label: string, onlyTaken: boolean) => {
    return mealTemplates.reduce((sum, meal) => {
      if (onlyTaken && !mealCheckMap[meal.id || '']) return sum;
      return sum + getTagValue(meal, label);
    }, 0);
  };

  const macroDefinitions = [
    { key: 'Protein', unit: 'g' },
    { key: 'Carbs', unit: 'g' },
    { key: 'Calories', unit: 'kcal' },
  ];

  const macroData = macroDefinitions.map((macro) => {
    const taken = sumMeals(macro.key, true);
    const planned = sumMeals(macro.key, false);
    const target = getTargetValue(macro.key);
    const percent = target ? Math.min(100, Math.round((taken / target) * 100)) : 0;
    return Object.assign({}, macro, {
      taken,
      planned,
      target,
      percent,
    });
  });

  useEffect(() => {
    const query = debouncedFoodQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results for short query
      setFoodResults([]);
      return;
    }
    let cancelled = false;
    setFoodLoading(true);
    searchFoods(query, 20)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setFoodResults(result.data);
        } else {
          setFoodResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFoodLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFoodQuery]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- set loading before async fetch
    setUserFoodsLoading(true);
    getUserFoods()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setUserFoods(result.data);
        } else {
          setUserFoods([]);
        }
      })
      .finally(() => {
        if (!cancelled) setUserFoodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildMealFromFood = (food: Food): MealTemplate => {
    const tags: MealTag[] = [];
    if (food.proteinPer100g != null) tags.push({ label: 'Protein', value: `${food.proteinPer100g}` });
    if (food.carbsPer100g != null) tags.push({ label: 'Carbs', value: `${food.carbsPer100g}` });
    if (food.caloriesPer100g != null) tags.push({ label: 'Calories', value: `${food.caloriesPer100g}` });
    return {
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      examples: 'Per 100g. Adjust grams to your serving.',
      grams: 100,
      foodId: food.id,
      tags,
    };
  };

  const handleGramsChange = async (mealId: string, grams: number) => {
    const result = await updateMealGrams(mealId, grams);
    if (result.success && result.data) {
      onUpdateMealTemplate(selectedMealDay, mealId, {
        grams: result.data.grams,
        tags: result.data.tags || [],
      });
    }
  };

  const handleSaveFood = async (foodId: string) => {
    const result = await addUserFood(foodId);
    if (result.success && result.data) {
      setUserFoods((prev) => [result.data!].concat(prev.filter((item) => item.id !== result.data!.id)));
    }
  };

  const handleRemoveUserFood = async (id: string) => {
    const result = await removeUserFood(id);
    if (result.success) {
      setUserFoods((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="grid nutritionGrid">
      <Card>
        <div className="row">
          <div>
            <h2>Meal templates</h2>
            <div className="small">Plan for {weekdayName}.</div>
          </div>
          <div className="controls">
            <select
              value={selectedMealDay}
              onChange={(event) => onSelectMealDay(event.target.value)}
              aria-label="Select meal template day"
            >
              {mealDayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="macroGrid">
          {macroData.map((macro) => (
            <MacroBar key={macro.key} macro={macro} />
          ))}
        </div>
        <div className="list">
          {mealTemplates.map((meal) => (
            <MealCard
              key={meal.id || meal.name}
              meal={meal}
              isTaken={!!mealCheckMap[meal.id || '']}
              onToggleTaken={onToggleMealCheck}
              onGramsChange={handleGramsChange}
              onRemove={(mealId) => onRemoveMealTemplate(selectedMealDay, mealId)}
            />
          ))}
        </div>
        <div className="footerNote">
          If the family meal is low-protein, add a "protein patch": 250-300 g
          skyr/cottage cheese.
        </div>
      </Card>

      <Card>
        <div className="row">
          <div>
            <h2>Food library</h2>
            <div className="small">Search the database and add to {selectedMealDay}.</div>
          </div>
          <div className="controls">
            <input
              type="text"
              value={foodQuery}
              onChange={(event) => setFoodQuery(event.target.value)}
              placeholder="Search foods (e.g., chicken, oats)"
              aria-label="Search foods"
            />
          </div>
        </div>
        {foodLoading ? <div className="small">Loading...</div> : null}
        {!foodLoading && debouncedFoodQuery.trim().length >= MIN_SEARCH_LENGTH && !foodResults.length ? (
          <div className="small">No foods found.</div>
        ) : null}
        <div className="list">
          {foodResults.map((food) => {
            const details = [
              food.caloriesPer100g != null ? `${food.caloriesPer100g} kcal` : null,
              food.proteinPer100g != null ? `${food.proteinPer100g} g protein` : null,
              food.carbsPer100g != null ? `${food.carbsPer100g} g carbs` : null,
              food.fatPer100g != null ? `${food.fatPer100g} g fat` : null,
            ]
              .filter(Boolean)
              .join(' \u2022 ');
            return (
              <div key={food.id} className="item">
                <div className="top">
                  <div className="name">
                    {food.name}
                    {food.brand ? ` (${food.brand})` : ''}
                  </div>
                  <div className="controls">
                    <button
                      type="button"
                      onClick={() => onAddMealTemplate(selectedMealDay, buildMealFromFood(food))}
                    >
                      Add
                    </button>
                    <button type="button" onClick={() => handleSaveFood(food.id)}>
                      Save
                    </button>
                  </div>
                </div>
                {details ? <div className="desc">{details}</div> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="row">
          <div>
            <h2>My foods</h2>
            <div className="small">Saved foods you can reuse quickly.</div>
          </div>
        </div>
        {userFoodsLoading ? <div className="small">Loading...</div> : null}
        {!userFoodsLoading && !userFoods.length ? (
          <div className="small">No saved foods yet.</div>
        ) : null}
        <div className="list">
          {userFoods.map((item) => {
            const food = item.food;
            const details = [
              food.caloriesPer100g != null ? `${food.caloriesPer100g} kcal` : null,
              food.proteinPer100g != null ? `${food.proteinPer100g} g protein` : null,
              food.carbsPer100g != null ? `${food.carbsPer100g} g carbs` : null,
              food.fatPer100g != null ? `${food.fatPer100g} g fat` : null,
            ]
              .filter(Boolean)
              .join(' \u2022 ');
            return (
              <div key={item.id} className="item">
                <div className="top">
                  <div className="name">
                    {food.name}
                    {food.brand ? ` (${food.brand})` : ''}
                  </div>
                  <div className="controls">
                    <button
                      type="button"
                      onClick={() => onAddMealTemplate(selectedMealDay, buildMealFromFood(food))}
                    >
                      Add
                    </button>
                    <button type="button" onClick={() => handleRemoveUserFood(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
                {details ? <div className="desc">{details}</div> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2>Targets (lean bulk)</h2>
        <div className="list">
          {nutritionTargets.map((target) => (
            <div className="item" key={target.k}>
              <div className="top">
                <div className="name">{target.k}</div>
                <Pill>
                  <span className="dot dotAccent2" />
                  <span>{target.v}</span>
                </Pill>
              </div>
              <div className="desc">{target.n}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default NutritionView;
