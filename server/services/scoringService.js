import {
  Contest,
  Participant,
  McqResponse,
  CodeSubmission,
  ContestResult,
} from '../models/index.js';
import { clock, windowFor, phaseFor } from './timerService.js';
const locks = new Map();
export const rankingComparator = (a, b) =>
  b.totalScore - a.totalScore ||
  b.coding1Score + b.coding2Score - (a.coding1Score + a.coding2Score) ||
  b.mcqScore - a.mcqScore ||
  new Date(a.latestQualifyingAt || 8640000000000000).getTime() -
    new Date(b.latestQualifyingAt || 8640000000000000).getTime() ||
  String(a.participantId).localeCompare(String(b.participantId));
export function refreshLeaderboard(contestId) {
  const key = String(contestId);
  const job = (locks.get(key) || Promise.resolve()).catch(() => {}).then(() => compute(contestId));
  locks.set(key, job);
  job
    .finally(() => {
      if (locks.get(key) === job) locks.delete(key);
    })
    .catch(() => {});
  return job;
}
async function compute(contestId) {
  const contest = await Contest.findById(contestId);
  const participants = await Participant.find({
    contestId,
    _id: { $in: contest.participantIds },
  }).lean();
  const [responses, submissions] = await Promise.all([
    McqResponse.find({ contestId }).lean(),
    CodeSubmission.find({ contestId }).lean(),
  ]);
  const finished = phaseFor(contest).type === 'FINISHED';
  const rows = participants
    .map((p) => {
      const answers = responses.filter(
        (r) =>
          String(r.participantId) === String(p._id) &&
          r.selectedOptionIndex != null &&
          (r.isLocked ||
            (contest.startedAt && windowFor(contest, r.questionIndex).deadline <= clock.now())),
      );
      const correct = answers.filter(
        (r) =>
          r.selectedOptionIndex === contest.questionSnapshots[r.questionIndex].correctOptionIndex,
      );
      const own = submissions.filter((s) => String(s.participantId) === String(p._id));
      const scored = own.filter((s) => ['EVALUATED', 'MANUALLY_GRADED'].includes(s.judgingStatus));
      const best = [20, 21].map(
        (index) =>
          scored
            .filter((s) => s.questionIndex === index)
            .sort(
              (a, b) => b.score - a.score || new Date(a.submittedAt) - new Date(b.submittedAt),
            )[0],
      );
      const mcqScore = correct.length * 2,
        coding1Score = best[0]?.score || 0,
        coding2Score = best[1]?.score || 0;
      const dates = [
        ...correct.map((r) => new Date(r.submittedAt || r.updatedAt).getTime()),
        ...best.filter((s) => s?.score > 0).map((s) => new Date(s.submittedAt).getTime()),
      ];
      const pending = own.some((s) => !['EVALUATED', 'MANUALLY_GRADED'].includes(s.judgingStatus));
      return {
        participantId: p._id,
        fullName: p.fullName,
        registerNumber: p.registerNumber || '',
        mcqScore,
        coding1Score,
        coding2Score,
        totalScore: Math.round((mcqScore + coding1Score + coding2Score) * 100) / 100,
        codingProblemsSolved: best.filter((s) => s?.score === 30).length,
        latestQualifyingAt: dates.length ? new Date(Math.max(...dates)) : null,
        gradingStatus: pending ? 'PENDING_EVALUATION' : finished ? 'FINAL' : 'PROVISIONAL',
      };
    })
    .sort(rankingComparator)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  if (rows.length)
    await ContestResult.bulkWrite(
      rows.map(({ fullName, registerNumber, codingProblemsSolved, ...r }) => ({
        updateOne: {
          filter: { contestId, participantId: r.participantId },
          update: { $set: r },
          upsert: true,
        },
      })),
    );
  return {
    leaderboard: rows,
    published: contest.resultsPublished,
    provisional: !finished || rows.some((r) => r.gradingStatus !== 'FINAL'),
  };
}
