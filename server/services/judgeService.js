import { randomUUID } from 'node:crypto';
import { CodeSubmission, Contest } from '../models/index.js';
import { env } from '../config/env.js';
import { clock } from './timerService.js';
import { refreshLeaderboard } from './scoringService.js';
import { broadcastMentor, broadcastParticipant } from './events.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const configured = () => Boolean(env.onlineCompilerKey && env.onlineCompilerUrl);
export const normalizeOutput = (s) =>
  String(s || '')
    .replace(/\r\n/g, '\n')
    .trimEnd();
class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.quota = status === 402 || status === 403 || status === 429;
  }
}
const retryable = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
export async function onlineCompilerRequest(path, body, idempotencyKey) {
  let lastError;
  for (let attempt = 0; attempt <= env.onlineCompilerRetries; attempt++) {
    try {
      const response = await fetch(`${env.onlineCompilerUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: env.onlineCompilerKey,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(65000),
        redirect: 'error',
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const error = new ProviderError(
        payload.error || `OnlineCompiler returned HTTP ${response.status}`,
        response.status,
      );
      if (!retryable(response.status) || attempt === env.onlineCompilerRetries) throw error;
      lastError = error;
      const retryAfter = Number(response.headers.get('retry-after'));
      await pause(
        Number.isFinite(retryAfter) ? Math.min(10000, retryAfter * 1000) : 250 * 2 ** attempt,
      );
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      lastError = error;
      if (attempt === env.onlineCompilerRetries) throw error;
      await pause(250 * 2 ** attempt);
    }
  }
  throw lastError || new Error('OnlineCompiler request failed');
}
let activeExecutions = 0;
async function withConcurrency(task) {
  while (activeExecutions >= env.onlineCompilerConcurrency) await pause(25);
  activeExecutions++;
  try {
    return await task();
  } finally {
    activeExecutions--;
  }
}
export async function executeTest(sourceCode, test) {
  if (!configured()) throw new Error('OnlineCompiler judging is not configured');
  const result = await withConcurrency(() =>
    onlineCompilerRequest('/run-code-sync/', {
      compiler: env.onlineCompilerCompiler,
      code: sourceCode,
      input: test.input,
      time_limit: 2,
      memory_limit: 512,
    }),
  );
  return {
    passed:
      result.status === 'success' &&
      result.exit_code === 0 &&
      normalizeOutput(result.output) === normalizeOutput(test.expectedOutput),
    actualOutput: String(result.output || '').slice(0, 64000),
    status: result.status || 'unknown',
    error: result.error || '',
    time: result.time,
    memory: result.memory,
  };
}
export async function runSample(sourceCode, question) {
  if (!configured())
    return {
      available: false,
      results: [],
      message: 'Judging unavailable. Your code can still be submitted for manual review.',
    };
  try {
    const results = [];
    for (const sample of question.sampleTestCases)
      results.push({
        input: sample.input,
        expectedOutput: sample.expectedOutput,
        ...(await executeTest(sourceCode, sample)),
      });
    return { available: true, results };
  } catch (error) {
    return {
      available: false,
      results: [],
      quota: error.quota === true,
      message: 'Judging unavailable. Save or submit your code for manual review.',
    };
  }
}
let activeWorkers = 0;
export async function runWorkerTick() {
  if (activeWorkers >= env.onlineCompilerConcurrency) return;
  activeWorkers++;
  try {
    const leaseId = randomUUID();
    const now = new Date(clock.now());
    const submission = await CodeSubmission.findOneAndUpdate(
      {
        $or: [{ judgingStatus: 'QUEUED' }, { judgingStatus: 'JUDGING', leaseUntil: { $lt: now } }],
      },
      {
        $set: {
          judgingStatus: 'JUDGING',
          leaseUntil: new Date(clock.now() + 20 * 60 * 1000),
          leaseId,
        },
      },
      { returnDocument: 'after', sort: { submittedAt: 1 } },
    );
    if (!submission) return;
    let update;
    try {
      if (!configured()) throw new Error('OnlineCompiler judging is not configured');
      const contest = await Contest.findById(submission.contestId);
      const question = contest.questionSnapshots[submission.questionIndex];
      const provider = await withConcurrency(() =>
        onlineCompilerRequest(
          '/run-tests/',
          {
            compiler: env.onlineCompilerCompiler,
            code: submission.sourceCode,
            tests: question.hiddenTestCases.map((test) => ({
              input: test.input,
              expected_output: test.expectedOutput,
              hidden: true,
              weight: test.weight,
            })),
            scoring: 'weighted',
            stop_on_failure: false,
            time_limit: 2,
            memory_limit: 512,
          },
          `submission-${submission.id}`,
        ),
      );
      const results = (provider.tests || []).map((result, index) => ({
        passed: result.verdict === 'accepted',
        verdict: result.verdict,
        weight: question.hiddenTestCases[index]?.weight || 0,
        time: result.time,
        memory: result.memory,
        error: result.error || '',
      }));
      const score = Math.min(
        30,
        Math.round(
          question.hiddenTestCases.reduce(
            (sum, test, index) => sum + (results[index]?.passed ? test.weight : 0),
            0,
          ) * 100,
        ) / 100,
      );
      update = {
        judgingStatus: 'EVALUATED',
        score,
        testResults: results,
        executionMetadata: {
          provider: 'OnlineCompiler.io',
          verdict: provider.verdict,
          providerScore: provider.score,
          evaluatedAt: new Date(clock.now()),
        },
      };
    } catch (error) {
      update = {
        judgingStatus: 'PENDING_MANUAL_REVIEW',
        executionMetadata: {
          provider: 'OnlineCompiler.io',
          reason: error.quota
            ? 'OnlineCompiler quota or capacity limit reached; mentor review required.'
            : 'OnlineCompiler unavailable; mentor review required.',
          providerStatus: error.status,
          failedAt: new Date(clock.now()),
        },
      };
    }
    const saved = await CodeSubmission.findOneAndUpdate(
      { _id: submission._id, judgingStatus: 'JUDGING', leaseId },
      { $set: update, $unset: { leaseId: 1, leaseUntil: 1 } },
      { returnDocument: 'after' },
    );
    if (saved) {
      await refreshLeaderboard(saved.contestId);
      broadcastMentor(saved.contestId, 'leaderboard-updated');
      broadcastParticipant(saved.participantId, 'evaluation-completed', {
        submissionId: saved._id,
        judgingStatus: saved.judgingStatus,
        score: saved.score,
      });
    }
  } finally {
    activeWorkers--;
  }
}
export function publicSubmission(s) {
  return {
    _id: s._id,
    questionIndex: s.questionIndex,
    sourceCode: s.sourceCode,
    submittedAt: s.submittedAt,
    judgingStatus: s.judgingStatus,
    score: s.score,
    automatic: s.automatic,
    feedback: s.manualGrade?.feedback || '',
  };
}
