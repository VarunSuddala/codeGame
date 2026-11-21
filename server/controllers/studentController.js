import { Participant, Contest, CodeSubmission } from '../models/index.js';
import { resolveParticipant, cookieOptions } from '../middleware/auth.js';
import {
  joinInput,
  selectionInput,
  submitMcqInput,
  codeInput,
  codeSubmitInput,
} from '../middleware/validation.js';
import {
  joinContest,
  safeContest,
  studentState,
  saveMcq,
  saveDraft,
  submitCode,
  getActiveContest,
  reconcileContest,
} from '../services/contestService.js';
import { publicSubmission, runSample } from '../services/judgeService.js';
import { refreshLeaderboard } from '../services/scoringService.js';
import { clock } from '../services/timerService.js';
export async function join(req, res) {
  const data = joinInput.parse(req.body);
  const existing = await resolveParticipant(req.cookies.ca_student);
  if (existing) {
    const contest = await Contest.findById(existing.contestId);
    if (contest.roomCode === data.roomCode)
      return res.json({
        participant: { _id: existing._id, fullName: existing.fullName },
        contest: safeContest(contest),
      });
  }
  const { participant, contest, token } = await joinContest(data);
  res
    .cookie('ca_student', token, cookieOptions())
    .status(201)
    .json({
      participant: { _id: participant._id, fullName: participant.fullName },
      contest: safeContest(contest),
    });
}
export async function state(req, res) {
  await Participant.updateOne(
    { _id: req.participant._id },
    { $set: { lastSeenAt: new Date(clock.now()) } },
  );
  res.json(await studentState(req.participant));
}
export async function selection(req, res) {
  res.json({ response: await saveMcq(req.participant, selectionInput.parse(req.body)) });
}
export async function lock(req, res) {
  res.json({ response: await saveMcq(req.participant, submitMcqInput.parse(req.body), true) });
}
export async function draft(req, res) {
  const d = await saveDraft(req.participant, codeInput.parse(req.body));
  res.json({ draft: { sourceCode: d.sourceCode, updatedAt: d.updatedAt } });
}
export async function submit(req, res) {
  res.status(201).json({
    submission: publicSubmission(
      await submitCode(req.participant, codeSubmitInput.parse(req.body)),
    ),
  });
}
export async function sample(req, res) {
  const data = codeInput.parse(req.body);
  const c = await getActiveContest(req.participant, data.questionIndex, 'CODING');
  res.json(await runSample(data.sourceCode, c.questionSnapshots[data.questionIndex]));
}
export async function submissions(req, res) {
  res.json({
    submissions: (
      await CodeSubmission.find({
        participantId: req.participant._id,
        contestId: req.participant.contestId,
      }).sort({ submittedAt: -1 })
    ).map(publicSubmission),
  });
}
export async function results(req, res) {
  const c = await reconcileContest(await Contest.findById(req.participant.contestId));
  const board = await refreshLeaderboard(c._id);
  const result = board.leaderboard.find((r) => String(r.participantId) === req.participant.id);
  res.json({
    result,
    published: board.published,
    provisional: board.provisional,
    leaderboard: board.published
      ? board.leaderboard.map(({ registerNumber, latestQualifyingAt, ...r }) => r)
      : [],
  });
}
