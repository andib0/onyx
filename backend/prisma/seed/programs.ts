export const programs = [
  {
    name: 'Lean Bulk - 3 Day PPL',
    description: 'Push/Pull/Legs split optimized for muscle growth while staying relatively lean. Focus on progressive overload with moderate volume. Ideal for intermediate lifters with 1+ years of training experience.',
    goal: 'bulk',
    days: [
      {
        name: 'Push (Chest + Triceps)',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: '3', reps: '6-10', rir: '2', restSeconds: '180', notes: 'Focus on stretch at bottom', progression: 'When you hit 3x10, increase weight', sortOrder: 1 },
          { exerciseName: 'Flat Barbell Bench Press', sets: '3', reps: '6-10', rir: '2', restSeconds: '180', notes: 'Full ROM, touch chest', progression: 'Double progression 6-10', sortOrder: 2 },
          { exerciseName: 'Cable Flyes', sets: '3', reps: '10-15', rir: '1', restSeconds: '90', notes: 'Squeeze at peak contraction', progression: 'Double progression 10-15', sortOrder: 3 },
          { exerciseName: 'Overhead Tricep Extension', sets: '3', reps: '10-15', rir: '1', restSeconds: '90', notes: 'Deep stretch at bottom', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Tricep Pushdowns', sets: '2', reps: '12-15', rir: '0', restSeconds: '60', notes: 'Pump set, full lockout', progression: 'Feel the burn', sortOrder: 5 },
        ]
      },
      {
        name: 'Pull (Back + Biceps)',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Weighted Pull-ups', sets: '3', reps: '6-10', rir: '2', restSeconds: '180', notes: 'Full hang to chin over bar', progression: 'Add weight when hitting 3x10', sortOrder: 1 },
          { exerciseName: 'Barbell Rows', sets: '3', reps: '6-10', rir: '2', restSeconds: '180', notes: 'Controlled eccentric, pull to belly button', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Cable Rows', sets: '3', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Pause at contraction', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Face Pulls', sets: '3', reps: '15-20', rir: '1', restSeconds: '60', notes: 'External rotation at top', progression: 'Light weight, high reps', sortOrder: 4 },
          { exerciseName: 'Barbell Curls', sets: '3', reps: '8-12', rir: '1', restSeconds: '90', notes: 'No swinging', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Hammer Curls', sets: '2', reps: '10-15', rir: '0', restSeconds: '60', notes: 'Brachialis focus', progression: 'Pump set', sortOrder: 6 },
        ]
      },
      {
        name: 'Legs + Shoulders',
        dayOrder: 3,
        exercises: [
          { exerciseName: 'Barbell Squats', sets: '3', reps: '6-10', rir: '2', restSeconds: '180', notes: 'Below parallel', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Romanian Deadlifts', sets: '3', reps: '8-12', rir: '2', restSeconds: '150', notes: 'Feel hamstring stretch', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Leg Press', sets: '3', reps: '10-15', rir: '1', restSeconds: '120', notes: 'Full ROM', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Leg Curls', sets: '3', reps: '10-15', rir: '1', restSeconds: '90', notes: 'Slow eccentric', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Seated Dumbbell Press', sets: '3', reps: '8-12', rir: '2', restSeconds: '120', notes: 'Controlled', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Lateral Raises', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Slight forward lean', progression: 'Light weight, feel it', sortOrder: 6 },
          { exerciseName: 'Calf Raises', sets: '4', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Full stretch at bottom', progression: 'Pause at top', sortOrder: 7 },
        ]
      }
    ]
  },
  {
    name: 'Fat Loss - High Volume',
    description: 'Higher rep ranges and shorter rest periods to maximize calorie burn while preserving muscle during a cut. Upper/Lower split with more training frequency.',
    goal: 'cut',
    days: [
      {
        name: 'Upper Body A',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: '4', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Controlled tempo', progression: 'Maintain weight during cut', sortOrder: 1 },
          { exerciseName: 'Cable Rows', sets: '4', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Squeeze at contraction', progression: 'Maintain strength', sortOrder: 2 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: '3', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Full ROM', progression: 'Maintain', sortOrder: 3 },
          { exerciseName: 'Lat Pulldowns', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Wide grip', progression: 'Maintain', sortOrder: 4 },
          { exerciseName: 'Tricep Dips', sets: '3', reps: 'AMRAP', rir: '0', restSeconds: '60', notes: 'Bodyweight', progression: 'Add reps', sortOrder: 5 },
          { exerciseName: 'Bicep Curls', sets: '3', reps: '12-15', rir: '0', restSeconds: '60', notes: 'Pump', progression: 'Maintain', sortOrder: 6 },
        ]
      },
      {
        name: 'Lower Body',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Goblet Squats', sets: '4', reps: '12-15', rir: '1', restSeconds: '90', notes: 'Deep', progression: 'Maintain', sortOrder: 1 },
          { exerciseName: 'Romanian Deadlifts', sets: '4', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Hamstring stretch', progression: 'Maintain', sortOrder: 2 },
          { exerciseName: 'Walking Lunges', sets: '3', reps: '12 each', rir: '1', restSeconds: '60', notes: 'Long strides', progression: 'Maintain', sortOrder: 3 },
          { exerciseName: 'Leg Curls', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Controlled', progression: 'Maintain', sortOrder: 4 },
          { exerciseName: 'Calf Raises', sets: '4', reps: '15-20', rir: '1', restSeconds: '45', notes: 'Full ROM', progression: 'Maintain', sortOrder: 5 },
        ]
      },
      {
        name: 'Upper Body B',
        dayOrder: 3,
        exercises: [
          { exerciseName: 'Flat Bench Press', sets: '4', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Touch chest', progression: 'Maintain', sortOrder: 1 },
          { exerciseName: 'Barbell Rows', sets: '4', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Controlled', progression: 'Maintain', sortOrder: 2 },
          { exerciseName: 'Lateral Raises', sets: '3', reps: '15-20', rir: '1', restSeconds: '45', notes: 'Light weight', progression: 'Maintain', sortOrder: 3 },
          { exerciseName: 'Face Pulls', sets: '3', reps: '15-20', rir: '1', restSeconds: '45', notes: 'External rotation', progression: 'Maintain', sortOrder: 4 },
          { exerciseName: 'Overhead Tricep Extension', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Deep stretch', progression: 'Maintain', sortOrder: 5 },
          { exerciseName: 'Hammer Curls', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Controlled', progression: 'Maintain', sortOrder: 6 },
        ]
      }
    ]
  },
  {
    name: 'Strength Focus - 5x5',
    description: 'Classic strength program focusing on compound lifts with lower reps and heavier weights. Linear progression - add weight each session. Best for beginners to intermediates.',
    goal: 'strength',
    days: [
      {
        name: 'Day A (Squat/Bench/Row)',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Barbell Squats', sets: '5', reps: '5', rir: '1-2', restSeconds: '180-300', notes: 'Add 2.5kg each session', progression: 'Linear progression', sortOrder: 1 },
          { exerciseName: 'Bench Press', sets: '5', reps: '5', rir: '1-2', restSeconds: '180-300', notes: 'Add 2.5kg each session', progression: 'Linear progression', sortOrder: 2 },
          { exerciseName: 'Barbell Rows', sets: '5', reps: '5', rir: '1-2', restSeconds: '180', notes: 'Add 2.5kg each session', progression: 'Linear progression', sortOrder: 3 },
        ]
      },
      {
        name: 'Day B (Squat/OHP/Deadlift)',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Barbell Squats', sets: '5', reps: '5', rir: '1-2', restSeconds: '180-300', notes: 'Same weight as Day A', progression: 'Linear progression', sortOrder: 1 },
          { exerciseName: 'Overhead Press', sets: '5', reps: '5', rir: '1-2', restSeconds: '180-300', notes: 'Add 2.5kg each session', progression: 'Linear progression', sortOrder: 2 },
          { exerciseName: 'Deadlift', sets: '1', reps: '5', rir: '1', restSeconds: '300', notes: 'One heavy set, add 5kg each session', progression: 'Linear progression', sortOrder: 3 },
        ]
      }
    ]
  },
  {
    name: 'Beginner Full Body 3x/Week',
    description: 'Perfect for beginners. Full body workouts 3 times per week with focus on learning movements and building base strength. Simple, effective, and sustainable.',
    goal: 'general',
    days: [
      {
        name: 'Full Body A',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Goblet Squats', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Focus on form, deep squat', progression: 'Add weight when form is solid', sortOrder: 1 },
          { exerciseName: 'Dumbbell Bench Press', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Control the weight', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Dumbbell Rows', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'One arm at a time', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: '2', reps: '10-12', rir: '2', restSeconds: '90', notes: 'Seated or standing', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Plank', sets: '3', reps: '30-60s', rir: '-', restSeconds: '60', notes: 'Core tight, neutral spine', progression: 'Add time', sortOrder: 5 },
        ]
      },
      {
        name: 'Full Body B',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Romanian Deadlifts', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Feel the hamstrings', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Lat Pulldowns', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Wide grip', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Incline Dumbbell Press', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: '30-45 degree incline', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Lateral Raises', sets: '2', reps: '12-15', rir: '2', restSeconds: '60', notes: 'Light weight', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Leg Curls', sets: '2', reps: '12-15', rir: '2', restSeconds: '90', notes: 'Controlled', progression: 'Double progression', sortOrder: 5 },
        ]
      },
      {
        name: 'Full Body C',
        dayOrder: 3,
        exercises: [
          { exerciseName: 'Leg Press', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Full ROM', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Cable Rows', sets: '3', reps: '10-12', rir: '2', restSeconds: '120', notes: 'Squeeze at contraction', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Dumbbell Flyes', sets: '3', reps: '12-15', rir: '2', restSeconds: '90', notes: 'Feel the stretch', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Face Pulls', sets: '3', reps: '15-20', rir: '2', restSeconds: '60', notes: 'Light weight, external rotation', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Calf Raises', sets: '3', reps: '15-20', rir: '2', restSeconds: '60', notes: 'Full stretch at bottom', progression: 'Double progression', sortOrder: 5 },
        ]
      }
    ]
  },
  {
    name: 'Body Recomposition',
    description: 'For those at maintenance calories looking to build muscle and lose fat simultaneously. Upper/Lower split with moderate intensity and emphasis on progressive overload.',
    goal: 'recomp',
    days: [
      {
        name: 'Upper Body',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Bench Press', sets: '4', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Strength focus', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Barbell Rows', sets: '4', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Pull to belly button', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Incline Dumbbell Press', sets: '3', reps: '8-10', rir: '2', restSeconds: '120', notes: '30 degree incline', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Lat Pulldowns', sets: '3', reps: '8-10', rir: '2', restSeconds: '120', notes: 'Wide grip', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Lateral Raises', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Light weight', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Tricep Pushdowns', sets: '2', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Full lockout', progression: 'Double progression', sortOrder: 6 },
          { exerciseName: 'Bicep Curls', sets: '2', reps: '12-15', rir: '1', restSeconds: '60', notes: 'No swinging', progression: 'Double progression', sortOrder: 7 },
        ]
      },
      {
        name: 'Lower Body',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Squats', sets: '4', reps: '6-8', rir: '2', restSeconds: '180', notes: 'Below parallel', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Romanian Deadlifts', sets: '4', reps: '8-10', rir: '2', restSeconds: '150', notes: 'Hamstring stretch', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Leg Press', sets: '3', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Full ROM', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Leg Curls', sets: '3', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Slow eccentric', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Calf Raises', sets: '4', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Full stretch', progression: 'Double progression', sortOrder: 5 },
        ]
      }
    ]
  },
  {
    name: 'Push Pull Legs 6-Day',
    description: 'Advanced 6-day split hitting each muscle group twice per week. High frequency and volume for maximum hypertrophy. Requires good recovery capacity.',
    goal: 'bulk',
    days: [
      {
        name: 'Push A (Strength)',
        dayOrder: 1,
        exercises: [
          { exerciseName: 'Bench Press', sets: '4', reps: '4-6', rir: '2', restSeconds: '180', notes: 'Heavy day', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Overhead Press', sets: '3', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Standing', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Incline Dumbbell Press', sets: '3', reps: '8-10', rir: '2', restSeconds: '120', notes: '30 degree incline', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Lateral Raises', sets: '4', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Light weight', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Tricep Pushdowns', sets: '3', reps: '10-12', rir: '1', restSeconds: '60', notes: 'Full lockout', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Overhead Tricep Extension', sets: '2', reps: '12-15', rir: '0', restSeconds: '60', notes: 'Deep stretch', progression: 'Pump', sortOrder: 6 },
        ]
      },
      {
        name: 'Pull A (Strength)',
        dayOrder: 2,
        exercises: [
          { exerciseName: 'Deadlift', sets: '3', reps: '4-6', rir: '2', restSeconds: '240', notes: 'Heavy day', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Weighted Pull-ups', sets: '4', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Add weight when able', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Barbell Rows', sets: '3', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Strict form', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Face Pulls', sets: '3', reps: '15-20', rir: '1', restSeconds: '60', notes: 'External rotation', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Barbell Curls', sets: '3', reps: '8-10', rir: '1', restSeconds: '90', notes: 'Controlled', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Hammer Curls', sets: '2', reps: '10-12', rir: '0', restSeconds: '60', notes: 'Brachialis', progression: 'Pump', sortOrder: 6 },
        ]
      },
      {
        name: 'Legs A (Strength)',
        dayOrder: 3,
        exercises: [
          { exerciseName: 'Barbell Squats', sets: '4', reps: '4-6', rir: '2', restSeconds: '240', notes: 'Heavy day', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Romanian Deadlifts', sets: '3', reps: '6-8', rir: '2', restSeconds: '150', notes: 'Hamstring focus', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Leg Press', sets: '3', reps: '8-10', rir: '2', restSeconds: '120', notes: 'Heavy', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Leg Curls', sets: '3', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Slow eccentric', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Calf Raises (Standing)', sets: '4', reps: '10-12', rir: '1', restSeconds: '60', notes: 'Heavy', progression: 'Double progression', sortOrder: 5 },
        ]
      },
      {
        name: 'Push B (Hypertrophy)',
        dayOrder: 4,
        exercises: [
          { exerciseName: 'Incline Dumbbell Press', sets: '4', reps: '8-12', rir: '1', restSeconds: '120', notes: 'Stretch focus', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Cable Flyes', sets: '3', reps: '12-15', rir: '1', restSeconds: '90', notes: 'Peak contraction', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Dumbbell Shoulder Press', sets: '3', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Seated', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Lateral Raises', sets: '4', reps: '15-20', rir: '0', restSeconds: '45', notes: 'Drop set last set', progression: 'Pump', sortOrder: 4 },
          { exerciseName: 'Overhead Tricep Extension', sets: '3', reps: '12-15', rir: '1', restSeconds: '60', notes: 'Deep stretch', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Tricep Kickbacks', sets: '2', reps: '15-20', rir: '0', restSeconds: '45', notes: 'Pump', progression: 'Pump', sortOrder: 6 },
        ]
      },
      {
        name: 'Pull B (Hypertrophy)',
        dayOrder: 5,
        exercises: [
          { exerciseName: 'Lat Pulldowns', sets: '4', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Wide grip', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Cable Rows', sets: '4', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Pause at contraction', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Dumbbell Rows', sets: '3', reps: '10-12', rir: '1', restSeconds: '90', notes: 'One arm', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Reverse Flyes', sets: '3', reps: '15-20', rir: '1', restSeconds: '60', notes: 'Rear delts', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Incline Dumbbell Curls', sets: '3', reps: '10-12', rir: '1', restSeconds: '90', notes: 'Long head stretch', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Preacher Curls', sets: '2', reps: '12-15', rir: '0', restSeconds: '60', notes: 'Short head', progression: 'Pump', sortOrder: 6 },
        ]
      },
      {
        name: 'Legs B (Hypertrophy)',
        dayOrder: 6,
        exercises: [
          { exerciseName: 'Hack Squats', sets: '4', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Quad focus', progression: 'Double progression', sortOrder: 1 },
          { exerciseName: 'Stiff-Leg Deadlifts', sets: '3', reps: '10-12', rir: '1', restSeconds: '120', notes: 'Straight legs', progression: 'Double progression', sortOrder: 2 },
          { exerciseName: 'Leg Extensions', sets: '3', reps: '12-15', rir: '1', restSeconds: '90', notes: 'Peak contraction', progression: 'Double progression', sortOrder: 3 },
          { exerciseName: 'Leg Curls', sets: '3', reps: '12-15', rir: '1', restSeconds: '90', notes: 'Slow eccentric', progression: 'Double progression', sortOrder: 4 },
          { exerciseName: 'Walking Lunges', sets: '3', reps: '12 each', rir: '1', restSeconds: '90', notes: 'Long strides', progression: 'Double progression', sortOrder: 5 },
          { exerciseName: 'Calf Raises (Seated)', sets: '4', reps: '15-20', rir: '0', restSeconds: '45', notes: 'Soleus focus', progression: 'Pump', sortOrder: 6 },
        ]
      }
    ]
  }
];
