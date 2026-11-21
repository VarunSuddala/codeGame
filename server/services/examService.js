import { Participant, Contest, ExamViolation, McqResponse, CodeDraft } from '../models/index.js';
import { assert } from '../middleware/errors.js';
import { clock } from './timerService.js';
import { materializeDraft } from './contestService.js';
import { refreshLeaderboard } from './scoringService.js';
import { broadcastMentor, broadcastParticipant } from './events.js';

export async function finalizeParticipantAttempt(contestId, participantId, reason) {
  const finalizedAt = new Date(clock.now());
  const participant = await Participant.findOneAndUpdate(
    { _id: participantId, contestId, status: { $ne: 'AUTO_SUBMITTED' } },
    {
      $set: {
        status: 'AUTO_SUBMITTED',
        examStatus: 'AUTO_SUBMITTED',
        autoSubmittedAt: finalizedAt,
        examFinalizedAt: finalizedAt,
        submissionReason: reason,
      },
    },
    { returnDocument: 'after' },
  );
  if (!participant) return Participant.findById(participantId);
  await McqResponse.updateMany({ contestId, participantId }, { $set: { isLocked: true } });
  const drafts = await CodeDraft.find({ contestId, participantId, isLocked: false });
  for (const draft of drafts) {
    const locked = await CodeDraft.findOneAndUpdate(
      { _id: draft._id, isLocked: false },
      { $set: { isLocked: true, pendingMaterialization: draft.receipts.length > 0 } },
      { returnDocument: 'after' },
    );
    if (locked?.pendingMaterialization) await materializeDraft(locked);
  }
  await refreshLeaderboard(contestId);
  broadcastMentor(contestId, 'participant-auto-submitted', {
    participantId,
    violationCount: participant.violationCount,
    reason,
  });
  broadcastParticipant(participantId, 'exam-auto-submitted', {
    reason,
    violationCount: participant.violationCount,
  });
  return participant;
}

export async function recordViolation({ contestId, participantId, eventId, clientMetadata = {} }) {
  assert(
    typeof eventId === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(eventId),
    400,
    'A valid eventId is required.',
  );
  let violation;
  try {
    violation = await ExamViolation.create({
      contestId,
      participantId,
      eventId,
      violationType: 'TAB_DEPARTURE',
      clientMetadata: {
        visibilityState: String(clientMetadata.visibilityState || '').slice(0, 20),
        userAgent: String(clientMetadata.userAgent || '').slice(0, 300),
      },
      serverTimestamp: new Date(clock.now()),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const current = await Participant.findById(participantId).select(
      'violationCount examStatus submissionReason',
    );
    return { duplicate: true, participant: current };
  }
  const participant = await Participant.findOneAndUpdate(
    {
      _id: participantId,
      contestId,
      status: { $ne: 'AUTO_SUBMITTED' },
      examStatus: { $ne: 'AUTO_SUBMITTED' },
      violationCount: { $lt: 3 },
    },
    { $inc: { violationCount: 1 }, $set: { lastViolationAt: new Date(clock.now()) } },
    { returnDocument: 'after' },
  );
  if (!participant)
    return {
      duplicate: false,
      participant: await Participant.findById(participantId),
      ignored: true,
    };
  const examStatus =
    participant.violationCount === 1
      ? 'WARNING'
      : participant.violationCount === 2
        ? 'FINAL_WARNING'
        : 'AUTO_SUBMITTED';
  await Participant.updateOne({ _id: participant._id }, { $set: { examStatus } });
  const updated = await Participant.findById(participant._id);
  broadcastMentor(contestId, 'exam-violation', {
    participantId,
    violationCount: updated.violationCount,
    examStatus: updated.examStatus,
    serverTimestamp: violation.serverTimestamp,
  });
  if (updated.violationCount >= 3)
    await finalizeParticipantAttempt(
      contestId,
      participantId,
      'Auto-submitted after 3 tab-switch violations',
    );
  return { duplicate: false, participant: await Participant.findById(participantId) };
}
