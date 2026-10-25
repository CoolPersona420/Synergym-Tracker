/* starter splits (exercise names match the default list) */
export const R = ['Rest'];
export const FB_A = ['Full body A', [['Back Squat', 3, '5'], ['Bench Press', 3, '5'], ['Barbell Row', 3, '8'], ['Hanging Leg Raise', 3, '10-12']]];
export const FB_B = ['Full body B', [['Deadlift', 3, '5'], ['Overhead Press', 3, '6-8'], ['Pull-up', 3, '6-10'], ['Walking Lunge', 3, '10']]];
export const FB_C = ['Full body C', [['Front Squat', 3, '6-8'], ['Incline Dumbbell Press', 3, '8-10'], ['Seated Cable Row', 3, '10'], ['Cable Crunch', 3, '12']]];
export const UP_A = ['Upper A', [['Bench Press', 4, '5-6'], ['Barbell Row', 4, '6-8'], ['Overhead Press', 3, '8'], ['Lat Pulldown', 3, '10'], ['Barbell Curl', 2, '10-12'], ['Tricep Pushdown', 2, '10-12']]];
export const LO_A = ['Lower A', [['Back Squat', 4, '5'], ['Romanian Deadlift', 3, '8'], ['Leg Press', 3, '10'], ['Leg Curl', 3, '10-12'], ['Calf Raise', 3, '12']]];
export const UP_B = ['Upper B', [['Incline Dumbbell Press', 4, '8-10'], ['Pull-up', 4, '6-10'], ['Arnold Press', 3, '10'], ['Seated Cable Row', 3, '10'], ['Hammer Curl', 2, '12'], ['Skull Crusher', 2, '12']]];
export const LO_B = ['Lower B', [['Deadlift', 3, '5'], ['Front Squat', 3, '6-8'], ['Bulgarian Split Squat', 3, '10'], ['Hip Thrust', 3, '10'], ['Hanging Leg Raise', 3, '12']]];
export const PUSH = ['Push', [['Bench Press', 4, '6-8'], ['Overhead Press', 3, '8'], ['Incline Dumbbell Press', 3, '10'], ['Lateral Raise', 3, '12-15'], ['Tricep Pushdown', 3, '12']]];
export const PULL = ['Pull', [['Deadlift', 3, '5'], ['Pull-up', 3, '8'], ['Barbell Row', 3, '8-10'], ['Face Pull', 3, '15'], ['Barbell Curl', 3, '10']]];
export const LEGS = ['Legs', [['Back Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '12'], ['Leg Curl', 3, '12'], ['Calf Raise', 4, '12']]];
export const TEMPLATES = [
  { id: 'fb2', name: 'Full Body ×2', days: 2, desc: 'Two full-body days a week. Ideal when time is tight.', plan: [FB_A, R, R, FB_B, R, R, R] },
  { id: 'fb3', name: 'Full Body ×3', days: 3, desc: 'Three full-body sessions with a rest day between each.', plan: [FB_A, R, FB_B, R, FB_C, R, R] },
  { id: 'ul4', name: 'Upper / Lower', days: 4, desc: 'Each muscle twice a week across four sessions.', plan: [UP_A, LO_A, R, UP_B, LO_B, R, R] },
  { id: 'ppl5', name: 'Push / Pull / Legs + Upper / Lower', days: 5, desc: 'Five days mixing PPL with an upper and a lower day.', plan: [PUSH, PULL, LEGS, R, UP_A, LO_A, R] },
  { id: 'ppl6', name: 'Push / Pull / Legs ×2', days: 6, desc: 'The classic six-day split for building muscle.', plan: [PUSH, PULL, LEGS, PUSH, PULL, LEGS, R] }
];
export function recommendTemplate(days, exp) {
  let d = days || 3; if (exp === 'beginner') d = Math.min(d, 4);
  const id = d <= 2 ? 'fb2' : d === 3 ? 'fb3' : d === 4 ? 'ul4' : d === 5 ? 'ppl5' : 'ppl6';
  return TEMPLATES.find(t => t.id === id);
}
