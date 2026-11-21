import { ExamViolation, Participant, McqResponse, CodeDraft, Contest } from '../models/index.js';
import { recordViolation } from '../services/examService.js';
import { clock, phaseFor } from '../services/timerService.js';
import { assert } from '../middleware/errors.js';
export async function violation(req, res) {
  const result = await recordViolation({
    contestId: req.participant.contestId,
    participantId: req.participant._id,
    eventId: req.body.eventId,
    clientMetadata: req.body.clientMetadata,
  });
  res.json({
    violationCount: result.participant?.violationCount || 0,
    examStatus: result.participant?.examStatus,
    duplicate: result.duplicate === true,
    submissionReason: result.participant?.submissionReason,
  });
}
export async function status(req, res) {
  const p = await Participant.findById(req.participant._id).select(
    'violationCount examStatus autoSubmittedAt submissionReason lastViolationAt examFinalizedAt',
  );
  res.json({ participant: p });
}
export async function violations(req, res) {
  res.json({
    violations: await ExamViolation.find({
      contestId: req.participant.contestId,
      participantId: req.participant._id,
    })
      .sort({ serverTimestamp: 1 })
      .lean(),
  });
}
export async function monitoring(req, res) {
  const contest = await Contest.findOne({ _id: req.params.id, mentorId: req.mentor._id });
  assert(contest, 404, 'Contest not found.');
  const [people, answers, drafts, violations] = await Promise.all([
    Participant.find({ contestId: contest._id })
      .select('fullName registerNumber violationCount examStatus submissionReason')
      .lean(),
    McqResponse.find({ contestId: contest._id, selectedOptionIndex: { $ne: null } })
      .select('participantId')
      .lean(),
    CodeDraft.find({ contestId: contest._id, sourceCode: { $ne: '' } })
      .select('participantId questionIndex')
      .lean(),
    ExamViolation.find({ contestId: contest._id }).sort({ serverTimestamp: -1 }).lean(),
  ]);
  const phase = phaseFor(contest);
  res.json({
    monitoring: people.map((p) => ({
      ...p,
      currentQuestionIndex: phase.questionIndex,
      answered:
        answers.filter((a) => String(a.participantId) === String(p._id)).length +
        drafts.filter((d) => String(d.participantId) === String(p._id)).length,
    })),
    violations,
  });
}
export async function contestViolations(req, res) {
  const contest = await Contest.findOne({ _id: req.params.id, mentorId: req.mentor._id });
  assert(contest, 404, 'Contest not found.');
  res.json({
    violations: await ExamViolation.find({ contestId: contest._id })
      .populate('participantId', 'fullName registerNumber')
      .sort({ serverTimestamp: -1 }),
  });
}
