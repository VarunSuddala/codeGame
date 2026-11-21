import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, phaseFor, windowFor } from '../services/timerService.js';

const startedAt = new Date('2030-01-02T03:04:05.000Z');
const contest = { status: 'LIVE', startedAt };

test('waiting, cancelled and manually ended contests have no active question', () => {
  for (const [input, expected] of [
    [{ status: 'WAITING' }, 'WAITING'],
    [{ ...contest, status: 'CANCELLED' }, 'CANCELLED'],
    [{ ...contest, status: 'FINISHED' }, 'FINISHED'],
  ]) {
    const phase = phaseFor(input, +startedAt);
    assert.equal(phase.type, expected);
    assert.equal(phase.questionIndex, null);
    assert.equal(phase.remainingSeconds, 0);
  }
});

test('all 22 question windows are contiguous and cover exactly 45 minutes', () => {
  let previousDeadline = +startedAt;
  for (let index = 0; index < 22; index++) {
    const { opensAt, deadline } = windowFor(contest, index);
    assert.equal(+opensAt, previousDeadline);
    assert.equal(+deadline - +opensAt, (index < 20 ? 45 : 900) * 1000);
    const first = phaseFor(contest, +opensAt);
    assert.equal(first.questionIndex, index);
    assert.equal(first.type, index < 20 ? 'MCQ' : 'CODING');
    assert.equal(first.remainingSeconds, index < 20 ? 45 : 900);
    assert.equal(+first.deadline, +deadline);
    const last = phaseFor(contest, +deadline - 1);
    assert.equal(last.questionIndex, index);
    assert.equal(last.remainingSeconds, 1);
    const expired = phaseFor(contest, +deadline);
    assert.equal(expired.questionIndex, index === 21 ? null : index + 1);
    previousDeadline = +deadline;
  }
  assert.equal(previousDeadline - +startedAt, 2700_000);
  assert.equal(phaseFor(contest, previousDeadline).type, 'FINISHED');
});

test('refreshes and reconnects derive the same phase from the stored start time', () => {
  for (const seconds of [0, 44, 45, 899, 900, 1799, 1800, 2699, 2700, 5000]) {
    const now = +startedAt + seconds * 1000;
    assert.deepEqual(phaseFor(contest, now), phaseFor(JSON.parse(JSON.stringify(contest)), now));
  }
});

test('the server clock can be controlled without changing contest timestamps', () => {
  const original = { ...clock };
  try {
    clock.real = false;
    clock.now = () => +startedAt + 900_000;
    assert.equal(phaseFor(contest).questionIndex, 20);
    assert.equal(phaseFor(contest).remainingSeconds, 900);
    clock.now = () => +startedAt + 1800_000;
    assert.equal(phaseFor(contest).questionIndex, 21);
  } finally {
    Object.assign(clock, original);
  }
});
