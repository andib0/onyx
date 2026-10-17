// Canonical exercise catalogue — mirrors backend/prisma/seed/exercises.ts
// (name + primaryMuscle + equipment) and adds what the client needs for logic:
// secondary muscles (fractional set counting, Pelland et al. 2024: direct 1.0,
// indirect 0.5) and aliases (program/legacy names → one canonical name so a
// lift's history never splits, audit 05 #10).

export type Equipment = "Barbell" | "Dumbbell" | "Cable" | "Machine" | "Bodyweight";

export type Muscle =
  | "Chest"
  | "Back"
  | "Shoulders" // front + side delts
  | "Rear Delts"
  | "Biceps"
  | "Triceps"
  | "Quads"
  | "Hamstrings"
  | "Glutes"
  | "Calves"
  | "Core";

export type CatalogExercise = {
  name: string;
  equipment: Equipment;
  primary: Muscle;
  secondary?: Muscle[];
  aliases?: string[];
};

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // Chest
  {
    name: "Barbell Bench Press",
    equipment: "Barbell",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["Bench Press", "Flat Bench Press", "Flat Barbell Bench Press", "Bench"],
  },
  {
    name: "Incline Barbell Bench Press",
    equipment: "Barbell",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["Incline Bench Press", "Incline Barbell Press"],
  },
  {
    name: "Dumbbell Bench Press",
    equipment: "Dumbbell",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["DB Bench Press", "Flat Dumbbell Press", "Dumbbell Press"],
  },
  {
    name: "Incline Dumbbell Press",
    equipment: "Dumbbell",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["Incline DB Press", "Incline Dumbbell Bench Press"],
  },
  {
    name: "Cable Fly",
    equipment: "Cable",
    primary: "Chest",
    aliases: ["Cable Flyes", "Cable Flies", "Cable Crossover"],
  },
  {
    name: "Dumbbell Fly",
    equipment: "Dumbbell",
    primary: "Chest",
    aliases: ["Dumbbell Flyes", "Dumbbell Flies", "DB Fly"],
  },
  {
    name: "Machine Chest Press",
    equipment: "Machine",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["Chest Press", "Seated Chest Press"],
  },
  {
    name: "Push-Up",
    equipment: "Bodyweight",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
    aliases: ["Push Ups", "Pushups"],
  },
  {
    name: "Chest Dip",
    equipment: "Bodyweight",
    primary: "Chest",
    secondary: ["Triceps", "Shoulders"],
  },
  // Back
  {
    name: "Deadlift",
    equipment: "Barbell",
    primary: "Back",
    secondary: ["Hamstrings", "Glutes"],
    aliases: ["Conventional Deadlift", "Barbell Deadlift"],
  },
  {
    name: "Barbell Row",
    equipment: "Barbell",
    primary: "Back",
    secondary: ["Biceps", "Rear Delts"],
    aliases: ["Barbell Rows", "Bent Over Row", "Bent-Over Barbell Row", "Pendlay Row"],
  },
  {
    name: "Pull-Up",
    equipment: "Bodyweight",
    primary: "Back",
    secondary: ["Biceps"],
    aliases: ["Pull Ups", "Pullups"],
  },
  {
    name: "Weighted Pull-Up",
    equipment: "Bodyweight",
    primary: "Back",
    secondary: ["Biceps"],
    aliases: ["Weighted Pull-ups", "Weighted Pullups"],
  },
  {
    name: "Chin-Up",
    equipment: "Bodyweight",
    primary: "Back",
    secondary: ["Biceps"],
    aliases: ["Chin Ups", "Chinups"],
  },
  {
    name: "Lat Pulldown",
    equipment: "Cable",
    primary: "Back",
    secondary: ["Biceps"],
    aliases: ["Lat Pulldowns", "Lat Pull Down", "Pulldown"],
  },
  {
    name: "Seated Cable Row",
    equipment: "Cable",
    primary: "Back",
    secondary: ["Biceps", "Rear Delts"],
    aliases: ["Cable Rows", "Cable Row", "Seated Row"],
  },
  {
    name: "Dumbbell Row",
    equipment: "Dumbbell",
    primary: "Back",
    secondary: ["Biceps", "Rear Delts"],
    aliases: ["Dumbbell Rows", "One Arm Dumbbell Row", "DB Row"],
  },
  {
    name: "Face Pull",
    equipment: "Cable",
    primary: "Rear Delts",
    secondary: ["Back"],
    aliases: ["Face Pulls"],
  },
  // Legs
  {
    name: "Back Squat",
    equipment: "Barbell",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Squat", "Squats", "Barbell Squat", "Barbell Squats", "Barbell Back Squat"],
  },
  {
    name: "Front Squat",
    equipment: "Barbell",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Front Squats"],
  },
  {
    name: "Hack Squat",
    equipment: "Machine",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Hack Squats"],
  },
  {
    name: "Goblet Squat",
    equipment: "Dumbbell",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Goblet Squats"],
  },
  {
    name: "Leg Press",
    equipment: "Machine",
    primary: "Quads",
    secondary: ["Glutes"],
  },
  {
    name: "Romanian Deadlift",
    equipment: "Barbell",
    primary: "Hamstrings",
    secondary: ["Glutes"],
    aliases: ["Romanian Deadlifts", "RDL", "RDLs"],
  },
  {
    name: "Stiff-Leg Deadlift",
    equipment: "Barbell",
    primary: "Hamstrings",
    secondary: ["Glutes"],
    aliases: ["Stiff-Leg Deadlifts", "Stiff Legged Deadlift"],
  },
  {
    name: "Leg Curl",
    equipment: "Machine",
    primary: "Hamstrings",
    aliases: ["Leg Curls", "Lying Leg Curl", "Seated Leg Curl", "Hamstring Curl"],
  },
  {
    name: "Leg Extension",
    equipment: "Machine",
    primary: "Quads",
    aliases: ["Leg Extensions"],
  },
  {
    name: "Bulgarian Split Squat",
    equipment: "Dumbbell",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Bulgarian Split Squats", "Split Squat"],
  },
  {
    name: "Walking Lunge",
    equipment: "Dumbbell",
    primary: "Quads",
    secondary: ["Glutes"],
    aliases: ["Walking Lunges", "Lunges", "Lunge"],
  },
  {
    name: "Hip Thrust",
    equipment: "Barbell",
    primary: "Glutes",
    secondary: ["Hamstrings"],
    aliases: ["Hip Thrusts", "Barbell Hip Thrust"],
  },
  {
    name: "Calf Raise",
    equipment: "Machine",
    primary: "Calves",
    aliases: ["Calf Raises", "Standing Calf Raise", "Calf Raises (Standing)"],
  },
  {
    name: "Seated Calf Raise",
    equipment: "Machine",
    primary: "Calves",
    aliases: ["Calf Raises (Seated)", "Seated Calf Raises"],
  },
  // Shoulders
  {
    name: "Overhead Press",
    equipment: "Barbell",
    primary: "Shoulders",
    secondary: ["Triceps"],
    aliases: [
      "OHP",
      "Military Press",
      "Standing Overhead Press",
      "Barbell Overhead Press",
    ],
  },
  {
    name: "Seated Dumbbell Press",
    equipment: "Dumbbell",
    primary: "Shoulders",
    secondary: ["Triceps"],
    aliases: ["Dumbbell Shoulder Press", "DB Shoulder Press", "Seated DB Press"],
  },
  {
    name: "Lateral Raise",
    equipment: "Dumbbell",
    primary: "Shoulders",
    aliases: ["Lateral Raises", "Side Lateral Raise", "Dumbbell Lateral Raise"],
  },
  {
    name: "Rear Delt Fly",
    equipment: "Dumbbell",
    primary: "Rear Delts",
    aliases: ["Reverse Fly", "Reverse Flyes", "Reverse Flies", "Rear Delt Flyes"],
  },
  {
    name: "Arnold Press",
    equipment: "Dumbbell",
    primary: "Shoulders",
    secondary: ["Triceps"],
  },
  // Arms
  {
    name: "Barbell Curl",
    equipment: "Barbell",
    primary: "Biceps",
    aliases: ["Barbell Curls"],
  },
  {
    name: "Dumbbell Curl",
    equipment: "Dumbbell",
    primary: "Biceps",
    aliases: ["Dumbbell Curls", "Bicep Curls", "Bicep Curl", "Biceps Curl"],
  },
  {
    name: "Incline Dumbbell Curl",
    equipment: "Dumbbell",
    primary: "Biceps",
    aliases: ["Incline Dumbbell Curls", "Incline DB Curl"],
  },
  {
    name: "Hammer Curl",
    equipment: "Dumbbell",
    primary: "Biceps",
    aliases: ["Hammer Curls"],
  },
  {
    name: "Preacher Curl",
    equipment: "Barbell",
    primary: "Biceps",
    aliases: ["Preacher Curls", "EZ Bar Preacher Curl"],
  },
  {
    name: "Triceps Pushdown",
    equipment: "Cable",
    primary: "Triceps",
    aliases: [
      "Tricep Pushdowns",
      "Tricep Pushdown",
      "Triceps Pushdowns",
      "Rope Pushdown",
    ],
  },
  {
    name: "Overhead Triceps Extension",
    equipment: "Dumbbell",
    primary: "Triceps",
    aliases: ["Overhead Tricep Extension", "Overhead Tricep Extensions"],
  },
  {
    name: "Triceps Kickback",
    equipment: "Dumbbell",
    primary: "Triceps",
    aliases: ["Tricep Kickbacks", "Tricep Kickback"],
  },
  {
    name: "Triceps Dip",
    equipment: "Bodyweight",
    primary: "Triceps",
    secondary: ["Chest", "Shoulders"],
    aliases: ["Tricep Dips", "Dips", "Dip", "Weighted Dips", "Weighted Dip"],
  },
  {
    name: "Skull Crusher",
    equipment: "Barbell",
    primary: "Triceps",
    aliases: ["Skull Crushers", "Lying Triceps Extension"],
  },
  {
    name: "Close-Grip Bench Press",
    equipment: "Barbell",
    primary: "Triceps",
    secondary: ["Chest"],
    aliases: ["Close Grip Bench"],
  },
  // Core
  { name: "Plank", equipment: "Bodyweight", primary: "Core", aliases: ["Planks"] },
  {
    name: "Hanging Leg Raise",
    equipment: "Bodyweight",
    primary: "Core",
    aliases: ["Hanging Leg Raises"],
  },
  {
    name: "Cable Crunch",
    equipment: "Cable",
    primary: "Core",
    aliases: ["Cable Crunches"],
  },
  {
    name: "Ab Wheel Rollout",
    equipment: "Bodyweight",
    primary: "Core",
    aliases: ["Ab Wheel", "Ab Rollout"],
  },
];
