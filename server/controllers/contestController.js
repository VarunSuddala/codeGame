import { Contest, Participant, CodeSubmission, McqResponse } from '../models/index.js';
import { ownedContest } from '../middleware/auth.js';
import { id, contestInput, gradeInput } from '../middleware/validation.js';
import { assert } from '../middleware/errors.js';
import {
  createContest,
  startContest,
  endContest,
  reconcileContest,
} from '../services/contestService.js';
import { refreshLeaderboard } from '../services/scoringService.js';
import {
  broadcastContest,
  broadcastMentor,
  broadcastParticipant,
  participantConnected,
} from '../services/events.js';
import { clock, phaseFor } from '../services/timerService.js';
const owner = (req) => ownedContest(req.mentor._id, id.parse(req.params.id));
export async function create(req, res) {
  res
    .status(201)
    .json({ contest: await createContest(req.mentor._id, contestInput.parse(req.body)) });
}
export async function list(req, res) {
  const contests = await Contest.find({ mentorId: req.mentor._id })
    .select('-questionSnapshots')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();
  res.json({
    contests: contests.map((c) => ({ ...c, participantCount: c.participantIds.length })),
  });
}
export async function get(req, res) {
  res.json({ contest: await reconcileContest(await owner(req)) });
}
export async function start(req, res) {
  res.json({ contest: await startContest(await owner(req)) });
}
export async function end(req, res) {
  res.json({ contest: await endContest(await owner(req)) });
}
export async function participants(req, res) {
  const c = await owner(req);
  const [people, answers] = await Promise.all([
    Participant.find({ contestId: c._id, _id: { $in: c.participantIds } })
      .select('-identityKey')
      .lean(),
    McqResponse.find({ contestId: c._id, selectedOptionIndex: { $ne: null } })
      .select('participantId')
      .lean(),
  ]);
  const phase = phaseFor(c);
  res.json({
    participants: people.map((p) => ({
      ...p,
      isConnected: participantConnected(p._id),
      currentQuestionIndex: phase.questionIndex,
      progress: `${answers.filter((a) => String(a.participantId) === String(p._id)).length}/20 MCQs answered`,
    })),
  });
}
export async function leaderboard(req, res) {
  const c = await reconcileContest(await owner(req));
  res.json(await refreshLeaderboard(c._id));
}
export async function submissions(req, res) {
  const c = await reconcileContest(await owner(req));
  res.json({
    submissions: await CodeSubmission.find({ contestId: c._id })
      .populate('participantId', 'fullName registerNumber')
      .sort({ submittedAt: -1 }),
  });
}
export async function publish(req, res) {
  const c = await reconcileContest(await owner(req));
  assert(c.status === 'FINISHED', 409, 'Finish the contest before publishing results.');
  await refreshLeaderboard(c._id);
  c.resultsPublished = true;
  await c.save();
  broadcastContest(c.id, 'results-published');
  res.json({ contest: c });
}
export async function manualGrade(req, res) {
  const data = gradeInput.parse(req.body);
  const submission = await CodeSubmission.findById(id.parse(req.params.id));
  assert(submission, 404, 'Submission not found.');
  await ownedContest(req.mentor._id, submission.contestId);
  const saved = await CodeSubmission.findOneAndUpdate(
    { _id: submission._id, judgingStatus: 'PENDING_MANUAL_REVIEW' },
    {
      $set: {
        judgingStatus: 'MANUALLY_GRADED',
        score: data.score,
        manualGrade: {
          mentorId: req.mentor._id,
          score: data.score,
          feedback: data.feedback,
          gradedAt: new Date(clock.now()),
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  assert(saved, 409, 'Only submissions pending manual review can be graded.');
  await refreshLeaderboard(saved.contestId);
  broadcastMentor(saved.contestId, 'leaderboard-updated');
  broadcastParticipant(saved.participantId, 'evaluation-completed');
  res.json({ submission: saved });
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export async function exportCsv(req, res) {
  const c = await reconcileContest(await owner(req));
  const { leaderboard } = await refreshLeaderboard(c._id);
  const columns = [
    'rank',
    'fullName',
    'registerNumber',
    'mcqScore',
    'coding1Score',
    'coding2Score',
    'totalScore',
    'codingProblemsSolved',
    'gradingStatus',
  ];
  const csv = [columns, ...leaderboard.map((row) => columns.map((k) => row[k]))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  res.setHeader('Content-Disposition', `attachment; filename="codearena-${c.roomCode}.csv"`);
  res.type('text/csv').send('\uFEFF' + csv);
}
