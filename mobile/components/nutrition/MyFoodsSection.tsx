import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import type { Food } from "../../api/foods";
import type { UserFood } from "../../api/userFoods";
import { colors, spacing, fontSizes } from "../../theme";

interface MyFoodsSectionProps {
  myFoods: UserFood[];
  onAddFood: (food: Food) => void;
  onRemoveFood: (id: string) => void;
}

export default function MyFoodsSection({
  myFoods,
  onAddFood,
  onRemoveFood,
}: MyFoodsSectionProps) {
  if (myFoods.length === 0) return null;

  return (
    <Card title="My Foods">
      {myFoods.map((uf) => (
        <View key={uf.id} style={styles.foodResult}>
          <View style={styles.foodInfo}>
            <Text style={styles.foodName} numberOfLines={1}>
              {uf.food.name}
            </Text>
            {uf.food.brand ? (
              <Text style={styles.foodBrand} numberOfLines={1}>
                {uf.food.brand}
              </Text>
            ) : null}
          </View>
          <View style={styles.foodActions}>
            <Pressable
              onPress={() => onAddFood(uf.food)}
              hitSlop={8}
              style={styles.foodActionBtn}
            >
              <Text style={styles.foodActionText}>Add</Text>
            </Pressable>
            <Pressable
              onPress={() => onRemoveFood(uf.id)}
              hitSlop={8}
              style={styles.foodActionBtn}
            >
              <Text style={[styles.foodActionText, { color: colors.danger }]}>x</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  foodResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    minHeight: 48,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  foodBrand: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  foodActions: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  foodActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 36,
    alignItems: "center",
  },
  foodActionText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: "600",
  },
});
