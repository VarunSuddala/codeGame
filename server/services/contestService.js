import { randomInt, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import {
  Contest,
  Question,
  Participant,
  McqResponse,
  CodeDraft,
  CodeSubmission,
} from '../models/index.js';
import { assert } from '../middleware/errors.js';
import { hashToken } from '../middleware/auth.js';
import { clock, phaseFor, windowFor, activeWindowFilter, databaseNow } from './timerService.js';
import { env } from '../config/env.js';
import { refreshLeaderboard } from './scoringService.js';
import { broadcastContest, broadcastMentor } from './events.js';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = () =>
  Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
export function safeContest(c) {
  return {
    _id: c._id,
    title: c.title,
    description: c.description,
    roomCode: c.roomCode,
    status: c.status,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    resultsPublished: c.resultsPublished,
    requireRegisterNumber: c.requireRegisterNumber,
  };
}
export function publicQuestion(q) {
  if (!q) return null;
  const {
    type,
    title,
    description,
    difficulty,
    category,
    options,
    inputFormat,
    outputFormat,
    constraints,
    sampleTestCases,
    maxScore,
  } = q.toObject ? q.toObject() : q;
  return {
    type,
    title,
    description,
    difficulty,
    category,
    ...(type === 'MCQ' ? { options } : { inputFormat, outputFormat, constraints, sampleTestCases }),
    maxScore,
  };
}
export async function createContest(mentorId, data) {
  assert(
    data.questionIds.length === 22 && new Set(data.questionIds.map(String)).size === 22,
    400,
    'Select 22 distinct questions.',
  );
  const questions = await Question.find({ _id: { $in: data.questionIds }, mentorId }).lean();
  const ordered = data.questionIds.map((id) => questions.find((q) => String(q._id) === String(id)));
  assert(
    ordered.every(Boolean) &&
      ordered.slice(0, 20).every((q) => q.type === 'MCQ') &&
      ordered.slice(20).every((q) => q.type === 'CODING'),
    400,
    'Select exactly 20 of your MCQs followed by 2 coding problems.',
  );
  const snapshots = ordered.map(({ _id, mentorId, createdAt, updatedAt, __v, ...q }) => ({
    ...q,
    questionId: _id,
  }));
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await Contest.create({
        mentorId,
        title: data.title,
        description: data.description,
        requireRegisterNumber: data.requireRegisterNumber,
        roomCode: roomCode(),
        questionSnapshots: snapshots,
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  throw new Error('Could not generate a unique room code');
}
export async function joinContest(data) {
  const contest = await Contest.findOne({ roomCode: data.roomCode });
  assert(contest, 404, 'Room code not found.');
  assert(contest.status === 'WAITING', 409, 'This contest is not accepting new participants.');
  assert(
    !contest.requireRegisterNumber || data.registerNumber,
    400,
    'Register number is required for this contest.',
  );
  const identityKey = data.registerNumber
    ? `register:${data.registerNumber.normalize('NFKC').toLowerCase()}`
    : `name:${data.fullName.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')}`;
  const secret = randomBytes(32).toString('hex');
  const participant = await Participant.create({
    contestId: contest._id,
    fullName: data.fullName,
    registerNumber: data.registerNumber,
    identityKey,
    sessionTokenHash: hashToken(secret),
    joinedAt: new Date(clock.now()),
  });
  try {
    await McqResponse.insertMany(
      Array.from({ length: 20 }, (_, questionIndex) => ({
        contestId: contest._id,
        participantId: participant._id,
        questionIndex,
      })),
    );
    await CodeDraft.insertMany(
      [20, 21].map((questionIndex) => ({
        contestId: contest._id,
        participantId: participant._id,
        questionIndex,
      })),
    );
    // Admission and starting contend on the same document, so a late join cannot slip in.
    const admitted = await Contest.findOneAndUpdate(
      { _id: contest._id, status: 'WAITING' },
      { $addToSet: { participantIds: participant._id } },
      { returnDocument: 'after' },
    );
    assert(admitted, 409, 'The contest started before your join completed.');
    broadcastContest(contest.id, 'student-joined', {
      participantCount: admitted.participantIds.length,
    });
    broadcastMentor(contest.id, 'student-progress');
    return { participant, contest: admitted, token: `${participant.id}.${secret}` };
  } catch (error) {
    await Promise.all([
      Participant.deleteOne({ _id: participant._id }),
      McqResponse.deleteMany({ participantId: participant._id }),
      CodeDraft.deleteMany({ participantId: participant._id }),
    ]);
    throw error;
  }
}
export async function startContest(contest) {
  assert(contest.questionSnapshots.length === 22, 400, 'Contest questions are incomplete.');
  const updated = await Contest.findOneAndUpdate(
    { _id: contest._id, mentorId: contest.mentorId, status: 'WAITING' },
    { $set: { status: 'LIVE', startedAt: new Date(clock.now()) } },
    { returnDocument: 'after' },
  );
  assert(updated, 409, 'Contest has already started or ended.');
  broadcastContest(contest.id, 'contest-started', {
    startedAt: updated.startedAt,
    serverNow: new Date(clock.now()),
  });
  return updated;
}
export async function getActiveContest(participant, index, type) {
  assert(
    participant.examStatus !== 'AUTO_SUBMITTED' && participant.status !== 'AUTO_SUBMITTED',
    409,
    'This examination has already been finalized.',
  );
  const contest = await Contest.findById(participant.contestId);
  assert(contest, 404, 'Contest not found.');
  const phase = phaseFor(contest);
  assert(
    contest.status === 'LIVE' && phase.type === type && phase.questionIndex === index,
    409,
    'This question is not active. Refresh to recover the current contest phase.',
  );
  return contest;
}
export async function saveMcq(participant, data, lock = false) {
  const contest = await getActiveContest(participant, data.questionIndex, 'MCQ');
  const update = {
    ...(data.selectedOptionIndex != null ? { selectedOptionIndex: data.selectedOptionIndex } : {}),
    ...(lock ? { isLocked: true } : {}),
    submittedAt: new Date(clock.now()),
  };
  const response = await McqResponse.findOneAndUpdate(
    {
      contestId: contest._id,
      participantId: participant._id,
      questionIndex: data.questionIndex,
      isLocked: false,
      $expr: activeWindowFilter(contest, data.questionIndex),
    },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  );
  assert(response, 409, 'Answer is locked or its deadline has passed.');
  broadcastMentor(contest.id, 'student-progress');
  if (lock) {
    await refreshLeaderboard(contest._id);
    broadcastMentor(contest.id, 'leaderboard-updated');
  }
  return response;
}
export async function saveDraft(participant, data) {
  const contest = await getActiveContest(participant, data.questionIndex, 'CODING');
  const draft = await CodeDraft.findOneAndUpdate(
    {
      contestId: contest._id,
      participantId: participant._id,
      questionIndex: data.questionIndex,
      isLocked: false,
      $expr: activeWindowFilter(contest, data.questionIndex),
    },
    { $set: { sourceCode: data.sourceCode } },
    { returnDocument: 'after', runValidators: true },
  );
  assert(draft, 409, 'The coding deadline has passed.');
  return draft;
}
export async function materializeDraft(draft) {
  for (const receipt of draft.receipts) {
    await CodeSubmission.updateOne(
      { _id: receipt.submissionId },
      {
        $setOnInsert: {
          contestId: draft.contestId,
          participantId: draft.participantId,
          questionIndex: draft.questionIndex,
          sourceCode: receipt.sourceCode,
          submittedAt: receipt.submittedAt,
          requestId: receipt.requestId,
          automatic: receipt.automatic,
          judgingStatus: env.onlineCompilerKey ? 'QUEUED' : 'PENDING_MANUAL_REVIEW',
          score: 0,
        },
      },
      { upsert: true, runValidators: true },
    );
  }
  // Do not clear the outbox flag if another request appended a receipt meanwhile.
  await CodeDraft.updateOne(
    { _id: draft._id, $expr: { $eq: [{ $size: '$receipts' }, draft.receipts.length] } },
    { $set: { pendingMaterialization: false } },
    { timestamps: false },
  );
}
export async function submitCode(participant, data) {
  // Idempotent network retries return the same receipt, even after the phase closes.
  let draft = await CodeDraft.findOne({
    contestId: participant.contestId,
    participantId: participant._id,
    questionIndex: data.questionIndex,
  });
  const existing = draft.receipts.find((r) => r.requestId === data.requestId);
  if (existing) {
    assert(
      existing.sourceCode === data.sourceCode,
      409,
      'This request ID was already used for different code.',
    );
    await materializeDraft(draft);
    return CodeSubmission.findById(existing.submissionId);
  }
  const contest = await getActiveContest(participant, data.questionIndex, 'CODING');
  const submissionId = new mongoose.Types.ObjectId();
  const receipt = {
    submissionId,
    requestId: data.requestId,
    sourceCode: data.sourceCode,
    submittedAt: new Date(clock.now()),
    automatic: false,
  };
  // Atomic durable outbox: deadline check, source capture and receipt commit in ONE document.
  draft = await CodeDraft.findOneAndUpdate(
    {
      _id: draft._id,
      isLocked: false,
      'receipts.requestId': { $ne: data.requestId },
      'receipts.59': { $exists: false },
      $expr: activeWindowFilter(contest, data.questionIndex),
    },
    {
      $set: { sourceCode: data.sourceCode, pendingMaterialization: true },
      $push: { receipts: receipt },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!draft) {
    const retry = await CodeDraft.findOne({
      contestId: participant.contestId,
      participantId: participant._id,
      questionIndex: data.questionIndex,
    });
    const found = retry.receipts.find((r) => r.requestId === data.requestId);
    assert(
      found && found.sourceCode === data.sourceCode,
      409,
      'Deadline passed or submission limit (60 per question) reached.',
    );
    await materializeDraft(retry);
    return CodeSubmission.findById(found.submissionId);
  }
  await materializeDraft(draft);
  broadcastMentor(contest.id, 'student-progress');
  return CodeSubmission.findById(submissionId);
}
export async function finalizeDrafts(contest, force = false) {
  if (!contest.startedAt) return;
  for (const questionIndex of [20, 21]) {
    if (!force && windowFor(contest, questionIndex).deadline.getTime() > clock.now()) continue;
    const drafts = await CodeDraft.find({
      contestId: contest._id,
      questionIndex,
      $or: [{ isLocked: false }, { pendingMaterialization: true }],
    });
    for (let draft of drafts) {
      const submissionId = new mongoose.Types.ObjectId();
      // Pipeline copies the last stored source atomically, not a stale read from this worker.
      const updated = await CodeDraft.findOneAndUpdate(
        { _id: draft._id, isLocked: false },
        [
          {
            $set: {
              isLocked: true,
              pendingMaterialization: true,
              receipts: {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $size: '$receipts' }, 0] },
                      { $gt: [{ $strLenCP: { $trim: { input: '$sourceCode' } } }, 0] },
                    ],
                  },
                  [
                    {
                      submissionId: { $literal: submissionId },
                      requestId: { $literal: `automatic-${draft.id}` },
                      sourceCode: '$sourceCode',
                      submittedAt: '$updatedAt',
                      automatic: true,
                    },
                  ],
                  '$receipts',
                ],
              },
            },
          },
        ],
        { returnDocument: 'after', updatePipeline: true },
      );
      draft = updated || draft;
      await materializeDraft(draft);
    }
  }
}
export async function reconcileContest(contest) {
  if (!contest.startedAt) return contest;
  await finalizeDrafts(contest, contest.status === 'FINISHED');
  if (contest.status === 'LIVE' && phaseFor(contest).type === 'FINISHED') {
    const updated = await Contest.findOneAndUpdate(
      { _id: contest._id, status: 'LIVE' },
      {
        $set: {
          status: 'FINISHED',
          endedAt: new Date(new Date(contest.startedAt).getTime() + 2700000),
        },
      },
      { returnDocument: 'after' },
    );
    if (updated) {
      contest = updated;
      broadcastContest(contest.id, 'contest-ended');
    }
  }
  return contest;
}
export async function endContest(contest) {
  assert(contest.status === 'LIVE', 409, 'Only a live contest can be ended.');
  // Lock mutable records first; all later accepted code is already in the durable outbox.
  await McqResponse.updateMany({ contestId: contest._id }, { $set: { isLocked: true } });
  await finalizeDrafts(contest, true);
  const updated = await Contest.findOneAndUpdate(
    { _id: contest._id, status: 'LIVE' },
    { $set: { status: 'FINISHED', endedAt: new Date(clock.now()) } },
    { returnDocument: 'after' },
  );
  assert(updated, 409, 'Contest already ended.');
  broadcastContest(contest.id, 'contest-ended');
  return updated;
}
const phases = new Map();
let reconciling = false;
export async function reconcileAll() {
  if (reconciling) return;
  reconciling = true;
  try {
    // Repair receipts left by a crash, including contests already finished.
    for (const draft of await CodeDraft.find({ pendingMaterialization: true }))
      await materializeDraft(draft);
    for (let contest of await Contest.find({ status: 'LIVE' })) {
      contest = await reconcileContest(contest);
      const phase = phaseFor(contest),
        key = `${phase.type}:${phase.questionIndex}`;
      if (phases.get(contest.id) !== key) {
        phases.set(contest.id, key);
        broadcastContest(contest.id, 'phase-changed', { phase, serverNow: new Date(clock.now()) });
        await refreshLeaderboard(contest._id);
        broadcastMentor(contest.id, 'leaderboard-updated');
      }
    }
  } finally {
    reconciling = false;
  }
}
export async function studentState(participant) {
  let contest = await Contest.findById(participant.contestId);
  contest = await reconcileContest(contest);
  const phase = phaseFor(contest);
  const [response, draft] = await Promise.all([
    phase.type === 'MCQ'
      ? McqResponse.findOne({
          participantId: participant._id,
          questionIndex: phase.questionIndex,
        }).lean()
      : null,
    phase.type === 'CODING'
      ? CodeDraft.findOne({ participantId: participant._id, questionIndex: phase.questionIndex })
          .select('sourceCode updatedAt')
          .lean()
      : null,
  ]);
  return {
    contest: safeContest(contest),
    participant: {
      _id: participant._id,
      fullName: participant.fullName,
      registerNumber: participant.registerNumber,
      violationCount: participant.violationCount,
      examStatus: participant.examStatus,
      submissionReason: participant.submissionReason,
      autoSubmittedAt: participant.autoSubmittedAt,
    },
    participantCount: contest.participantIds.length,
    serverNow: new Date(clock.now()),
    phase,
    question:
      phase.questionIndex == null
        ? null
        : publicQuestion(contest.questionSnapshots[phase.questionIndex]),
    response,
    draft,
  };
}
