// Tests can replace clock.now. No client route can set the clock.
export const clock = { now: () => Date.now(), real: true };
export const databaseNow = () => (clock.real ? '$$NOW' : { $literal: new Date(clock.now()) });
export const MCQ_SECONDS = 45;
export const TOTAL_SECONDS = 2700;
export function windowFor(contest, index) {
  const start = new Date(contest.startedAt).getTime();
  const offset = index < 20 ? index * 45 : 900 + (index - 20) * 900;
  return {
    opensAt: new Date(start + offset * 1000),
    deadline: new Date(start + (offset + (index < 20 ? 45 : 900)) * 1000),
  };
}
export function phaseFor(contest, now = clock.now()) {
  if (contest.status === 'CANCELLED')
    return { type: 'CANCELLED', questionIndex: null, remainingSeconds: 0, deadline: null };
  if (!contest.startedAt)
    return { type: 'WAITING', questionIndex: null, remainingSeconds: 0, deadline: null };
  const elapsed = Math.max(0, Math.floor((now - new Date(contest.startedAt).getTime()) / 1000));
  if (contest.status === 'FINISHED' || elapsed >= TOTAL_SECONDS)
    return {
      type: 'FINISHED',
      questionIndex: null,
      remainingSeconds: 0,
      deadline: new Date(new Date(contest.startedAt).getTime() + TOTAL_SECONDS * 1000),
    };
  const index = elapsed < 900 ? Math.floor(elapsed / 45) : elapsed < 1800 ? 20 : 21;
  const { deadline } = windowFor(contest, index);
  return {
    type: index < 20 ? 'MCQ' : 'CODING',
    questionIndex: index,
    remainingSeconds: Math.max(0, Math.ceil((deadline - now) / 1000)),
    deadline,
  };
}
export function activeWindowFilter(contest, index) {
  const { opensAt, deadline } = windowFor(contest, index);
  return { $and: [{ $gte: [databaseNow(), opensAt] }, { $lt: [databaseNow(), deadline] }] };
}
