import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

// These assignments precede every application import, including dotenv loading.
const databaseName = `codearena_test_${randomBytes(12).toString('hex')}`;
const mongoUri = `mongodb://127.0.0.1:27017/${databaseName}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.MONGO_URI = mongoUri;
process.env.ONLINECOMPILER_API_KEY = '';

const { default: request } = await import('supertest');
const { default: mongoose } = await import('mongoose');
const { createApp } = await import('../app.js');
const { connectDatabase } = await import('../config/database.js');
const { env } = await import('../config/env.js');
const { clock } = await import('../services/timerService.js');
const { reconcileContest, reconcileAll } = await import('../services/contestService.js');
const { runWorkerTick } = await import('../services/judgeService.js');
const {
  Mentor,
  Question,
  Contest,
  Participant,
  McqResponse,
  CodeDraft,
  CodeSubmission,
  ContestResult,
} = await import('../models/index.js');
const { demoQuestions } = await import('../data/demoQuestions.js');

const password = 'CodeArena-testing-only-456!';
const mcq = (index) => ({
  title: `Question ${index + 1}`,
  description: 'Which value is two?',
  difficulty: 'EASY',
  category: 'Tests',
  options: ['zero', 'one', 'two', 'three'],
  correctOptionIndex: 2,
  explanation: 'Private answer explanation',
});
const coding = (index) => ({
  title: `Coding ${index + 1}`,
  description: 'Echo the input.',
  difficulty: 'EASY',
  category: 'Tests',
  inputFormat: 'One integer',
  outputFormat: 'The same integer',
  constraints: '0 <= n <= 100',
  sampleTestCases: [{ input: '1', expectedOutput: '1', weight: 1 }],
  hiddenTestCases: [{ input: '83-private-input', expectedOutput: '83-private-output', weight: 30 }],
  referenceSolution: 'print(input()) # private solution',
});

async function success(pending, status) {
  const response = await pending;
  assert.equal(response.status, status, JSON.stringify(response.body));
  return response;
}
async function rejected(pending, allowed = [400, 401, 403, 404, 409, 422]) {
  const response = await pending;
  assert.ok(
    allowed.includes(response.status),
    `Expected rejection, got ${response.status}: ${JSON.stringify(response.body)}`,
  );
  return response;
}
function noSecrets(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(
      ![
        'passwordHash',
        'sessionTokenHash',
        'identityKey',
        'correctOptionIndex',
        'hiddenTestCases',
        'referenceSolution',
        'questionSnapshots',
      ].includes(key),
      `Student response leaked ${key}`,
    );
    noSecrets(child);
  }
  const text = JSON.stringify(value);
  for (const secret of [
    '83-private-input',
    '83-private-output',
    '# private solution',
    'Private answer explanation',
  ]) {
    assert.ok(!text.includes(secret), `Student response leaked ${secret}`);
  }
}

test(
  'real MongoDB API lifecycle: two mentors and twelve independent students',
  { timeout: 120_000 },
  async (t) => {
    const originalClock = { ...clock };
    let testTime = Date.now();
    clock.real = false;
    clock.now = () => testTime;
    let connection;
    t.after(async () => {
      Object.assign(clock, originalClock);
      try {
        if (connection?.readyState === 1) {
          // Never drop a caller-provided/default database, even if configuration changes.
          assert.match(databaseName, /^codearena_test_[a-f0-9]{24}$/);
          assert.equal(connection.name, databaseName);
          assert.equal(connection.host, '127.0.0.1');
          await connection.dropDatabase();
        }
      } finally {
        await mongoose.disconnect();
      }
    });
    connection = await connectDatabase(mongoUri);
    assert.equal(connection.name, databaseName);
    const app = createApp();
    const owner = request.agent(app);
    const outsider = request.agent(app);
    const students = Array.from({ length: 12 }, () => request.agent(app));
    const identities = students.map((_, i) => ({
      fullName: `Student ${String(i + 1).padStart(2, '0')}`,
      registerNumber: `REG-${i + 1}`,
    }));
    const participantIds = [];
    let ownerId,
      contest,
      startedAt,
      submissions = [],
      firstRequestId;
    const questionIds = [];
    const at = (seconds) => {
      testTime = startedAt + seconds * 1000;
    };
    const state = async (agent = students[0]) =>
      (await success(agent.get('/api/student/contest-state'), 200)).body;

    await t.test(
      'registration validates passwords, hashes credentials and issues HttpOnly sessions',
      async () => {
        await rejected(
          request(app).post('/api/auth/register').send({
            name: 'Bad',
            email: 'bad@example.test',
            password,
            confirmPassword: 'different',
          }),
          [400, 422],
        );
        for (const [agent, name, email] of [
          [owner, 'Owner', 'owner@example.test'],
          [outsider, 'Other', 'other@example.test'],
        ]) {
          const response = await success(
            agent
              .post('/api/auth/register')
              .send({ name, email, password, confirmPassword: password }),
            201,
          );
          assert.equal(response.body.mentor.email, email);
          assert.ok(response.headers['set-cookie'].some((cookie) => /HttpOnly/i.test(cookie)));
          assert.equal(response.body.mentor.passwordHash, undefined);
          if (agent === owner) ownerId = response.body.mentor._id;
        }
        const saved = await Mentor.findById(ownerId).select('+passwordHash');
        assert.notEqual(saved.passwordHash, password);
        assert.match(saved.passwordHash, /^\$2[aby]\$/);
        await rejected(
          request(app).post('/api/auth/register').send({
            name: 'Duplicate',
            email: 'owner@example.test',
            password,
            confirmPassword: password,
          }),
          [400, 409],
        );
        await rejected(request(app).get('/api/auth/me'), [401]);
        await rejected(
          request(app).get('/api/auth/me').set('Cookie', 'ca_mentor=forged.jwt.cookie'),
          [401],
        );
        await rejected(
          request(app)
            .post('/api/auth/login')
            .send({ email: 'owner@example.test', password: 'wrong-password' }),
          [401],
        );
        await rejected(
          request(app).post('/api/auth/login').send({ email: 'missing@example.test', password }),
          [401],
        );
        const login = request.agent(app);
        await success(
          login.post('/api/auth/login').send({ email: 'owner@example.test', password }),
          200,
        );
        assert.equal((await success(login.get('/api/auth/me'), 200)).body.mentor._id, ownerId);
        await success(login.post('/api/auth/logout'), 200);
        await rejected(login.get('/api/auth/me'), [401]);
      },
    );

    await t.test('question CRUD enforces validation, ownership and the fixed marks', async () => {
      await rejected(request(app).get('/api/questions'), [401]);
      for (const bad of [
        { options: ['a', 'b', 'c'] },
        { correctOptionIndex: 4 },
        { correctOptionIndex: 0.5 },
        { title: '' },
      ]) {
        await rejected(owner.post('/api/questions/mcq').send({ ...mcq(0), ...bad }), [400, 422]);
      }
      for (const bad of [
        { hiddenTestCases: [] },
        { sampleTestCases: [] },
        { hiddenTestCases: [{ input: '', expectedOutput: '', weight: 31 }] },
        { hiddenTestCases: [{ input: '', expectedOutput: '', weight: 29 }] },
      ]) {
        await rejected(
          owner.post('/api/questions/coding').send({ ...coding(0), ...bad }),
          [400, 422],
        );
      }
      for (let i = 0; i < 22; i++) {
        const response = await success(
          owner
            .post(`/api/questions/${i < 20 ? 'mcq' : 'coding'}`)
            .send(i < 20 ? mcq(i) : coding(i - 20)),
          201,
        );
        assert.equal(response.body.question.maxScore, i < 20 ? 2 : 30);
        questionIds.push(response.body.question._id);
      }
      assert.equal((await success(owner.get('/api/questions'), 200)).body.questions.length, 22);
      assert.equal(
        (await success(owner.get('/api/questions?type=CODING'), 200)).body.questions.length,
        2,
      );
      assert.equal((await success(outsider.get('/api/questions'), 200)).body.questions.length, 0);
      await rejected(outsider.get(`/api/questions/${questionIds[0]}`), [403, 404]);
      await rejected(outsider.put(`/api/questions/${questionIds[0]}`).send(mcq(99)), [403, 404]);
      await rejected(outsider.delete(`/api/questions/${questionIds[0]}`), [403, 404]);
      const extra = (await success(owner.post('/api/questions/mcq').send(mcq(99)), 201)).body
        .question;
      const edited = (
        await success(
          owner
            .put(`/api/questions/${extra._id}`)
            .send({ ...mcq(99), title: 'Edited unused question' }),
          200,
        )
      ).body.question;
      assert.equal(edited.title, 'Edited unused question');
      await success(owner.delete(`/api/questions/${extra._id}`), 200);
      assert.equal(await Question.exists({ _id: extra._id }), null);
    });

    await t.test(
      'contest creation requires exactly 20 distinct MCQs followed by two coding questions',
      async () => {
        const data = {
          title: 'Integration arena',
          description: 'Complete simulated contest',
          requireRegisterNumber: true,
          questionIds,
        };
        for (const invalid of [
          questionIds.slice(1),
          [...questionIds, questionIds[0]],
          [...questionIds.slice(0, 21), questionIds[20]],
          [...questionIds.slice(20), ...questionIds.slice(0, 20)],
        ]) {
          await rejected(
            owner.post('/api/contests').send({ ...data, questionIds: invalid }),
            [400, 422],
          );
        }
        await rejected(outsider.post('/api/contests').send(data), [400, 403, 404]);
        contest = (await success(owner.post('/api/contests').send(data), 201)).body.contest;
        assert.match(contest.roomCode, /^[A-Z0-9]{6}$/);
        const persisted = await Contest.findById(contest._id);
        assert.equal(persisted.totalDurationSeconds, 2700);
        assert.equal(persisted.questionSnapshots.length, 22);
        assert.equal(
          persisted.questionSnapshots.reduce((n, q) => n + q.maxScore, 0),
          100,
        );
        assert.equal((await success(outsider.get('/api/contests'), 200)).body.contests.length, 0);
        for (const suffix of ['', '/participants', '/leaderboard', '/submissions', '/export']) {
          await rejected(outsider.get(`/api/contests/${contest._id}${suffix}`), [403, 404]);
        }
        for (const action of ['start', 'end', 'publish'])
          await rejected(outsider.post(`/api/contests/${contest._id}/${action}`), [403, 404]);
        await rejected(owner.delete(`/api/questions/${questionIds[0]}`), [400, 409]);
        await success(
          owner.put(`/api/questions/${questionIds[0]}`).send({ ...mcq(0), correctOptionIndex: 0 }),
          200,
        );
        assert.equal(
          (await Contest.findById(contest._id)).questionSnapshots[0].correctOptionIndex,
          2,
          'Existing contest keeps its original answer snapshot',
        );
      },
    );

    await t.test(
      'twelve students join; invalid identities and duplicates fail; cookies restore sessions',
      async () => {
        await rejected(
          request(app)
            .post('/api/rooms/join')
            .send({ roomCode: 'BAD!', ...identities[0] }),
          [400, 422],
        );
        await rejected(
          request(app)
            .post('/api/rooms/join')
            .send({ roomCode: '000000', ...identities[0] }),
          [404],
        );
        await rejected(
          request(app)
            .post('/api/rooms/join')
            .send({ roomCode: contest.roomCode, fullName: 'No registration' }),
          [400, 422],
        );
        await rejected(
          request(app)
            .post('/api/rooms/join')
            .send({ roomCode: contest.roomCode, fullName: '', registerNumber: 'X' }),
          [400, 422],
        );
        for (let i = 0; i < students.length; i++) {
          const joined = await success(
            students[i]
              .post('/api/rooms/join')
              .send({ roomCode: contest.roomCode, ...identities[i] }),
            201,
          );
          participantIds.push(joined.body.participant._id);
          noSecrets(joined.body);
          assert.ok(joined.headers['set-cookie'].some((cookie) => /HttpOnly/i.test(cookie)));
        }
        assert.equal(new Set(participantIds).size, 12);
        const restored = await students[0]
          .post('/api/rooms/join')
          .send({ roomCode: contest.roomCode, ...identities[0] });
        assert.ok([200, 201].includes(restored.status), JSON.stringify(restored.body));
        assert.equal(restored.body.participant._id, participantIds[0]);
        await rejected(
          request(app).post('/api/rooms/join').send({
            roomCode: contest.roomCode,
            fullName: 'Impersonator',
            registerNumber: 'reg-1',
          }),
          [400, 409],
        );
        assert.equal(await Participant.countDocuments({ contestId: contest._id }), 12);
        const waiting = await state();
        assert.equal(waiting.participantCount, 12);
        assert.equal(waiting.phase.type, 'WAITING');
        assert.equal(waiting.question, null);
        noSecrets(waiting);
        await rejected(
          students[0]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 2 }),
          [409],
        );
        await rejected(students[0].get(`/api/contests/${contest._id}/submissions`), [401, 403]);
        await rejected(request(app).get('/api/student/contest-state'), [401]);
        await rejected(
          request(app)
            .get('/api/student/contest-state')
            .set('Cookie', `ca_student=${participantIds[0]}.${'0'.repeat(64)}`),
          [401],
        );
      },
    );

    await t.test(
      'owner starts once; every student shares the clock; late joins cannot enter',
      async () => {
        contest = (await success(owner.post(`/api/contests/${contest._id}/start`), 200)).body
          .contest;
        startedAt = +new Date(contest.startedAt);
        assert.equal(startedAt, testTime);
        assert.equal(contest.status, 'LIVE');
        await rejected(owner.post(`/api/contests/${contest._id}/publish`), [409]);
        await rejected(owner.post(`/api/contests/${contest._id}/start`), [400, 409]);
        await rejected(
          request(app)
            .post('/api/rooms/join')
            .send({ roomCode: contest.roomCode, fullName: 'Late', registerNumber: 'LATE' }),
          [400, 409],
        );
        const restored = await students[0]
          .post('/api/rooms/join')
          .send({ roomCode: contest.roomCode, ...identities[0] });
        assert.ok([200, 201].includes(restored.status), JSON.stringify(restored.body));
        assert.equal(restored.body.participant._id, participantIds[0]);
        for (const student of students) {
          const current = await state(student);
          assert.equal(current.phase.questionIndex, 0);
          assert.equal(current.phase.remainingSeconds, 45);
          assert.equal(+new Date(current.serverNow), testTime);
          noSecrets(current);
        }
      },
    );

    await t.test(
      'MCQ autosave, early lock, refresh recovery and exact expiry are enforced',
      async () => {
        await rejected(
          students[0]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 4 }),
          [400, 422],
        );
        await rejected(
          students[0]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 1, selectedOptionIndex: 2 }),
          [409],
        );
        await success(
          students[0]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 1 }),
          200,
        );
        await success(
          students[0].put('/api/student/mcq-selection').send({
            questionIndex: 0,
            selectedOptionIndex: 2,
            participantId: participantIds[1],
            score: 100,
            timestamp: '2099-01-01',
          }),
          200,
        );
        assert.equal((await state()).response.selectedOptionIndex, 2);
        assert.equal(
          (await state(students[1])).response.selectedOptionIndex,
          null,
          'Client cannot write another participant response',
        );
        await success(students[0].post('/api/student/mcq-submit').send({ questionIndex: 0 }), 200);
        assert.equal((await state()).response.isLocked, true);
        await rejected(
          students[0]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 0 }),
          [409],
        );
        await rejected(
          students[0]
            .post('/api/student/mcq-submit')
            .send({ questionIndex: 0, selectedOptionIndex: 0 }),
          [409],
        );
        at(44.999);
        await success(
          students[1]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 2 }),
          200,
        );
        const refresh = (await success(students[1].get('/api/student/current-question'), 200)).body;
        assert.equal(refresh.phase.questionIndex, 0);
        assert.equal(refresh.phase.remainingSeconds, 1);
        assert.equal(refresh.response.selectedOptionIndex, 2);
        at(45);
        await rejected(
          students[1]
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 0 }),
          [409],
        );
        await rejected(
          students[1].post('/api/student/mcq-submit').send({ questionIndex: 0 }),
          [409],
        );
        const next = await state(students[1]);
        assert.equal(next.phase.questionIndex, 1);
        assert.equal(next.phase.remainingSeconds, 45);
        await success(students[2].post('/api/student/mcq-submit').send({ questionIndex: 1 }), 200);
        const board = (await success(owner.get(`/api/contests/${contest._id}/leaderboard`), 200))
          .body;
        assert.equal(
          board.leaderboard.find((row) => row.participantId === participantIds[0]).mcqScore,
          2,
        );
        assert.equal(
          board.leaderboard.find((row) => row.participantId === participantIds[1]).mcqScore,
          2,
        );
        assert.equal(
          board.leaderboard.find((row) => row.participantId === participantIds[2]).mcqScore,
          0,
        );
        assert.equal(
          await McqResponse.countDocuments({ participantId: participantIds[0], questionIndex: 0 }),
          1,
        );
        at(899.999);
        assert.equal((await state()).phase.questionIndex, 19);
        await success(
          students[0]
            .post('/api/student/mcq-submit')
            .send({ questionIndex: 19, selectedOptionIndex: 2 }),
          200,
        );
        await rejected(
          students[0]
            .put('/api/student/code-draft')
            .send({ questionIndex: 20, sourceCode: 'print(1)' }),
          [409],
        );
      },
    );

    await t.test(
      'coding opens at 900s, restores drafts and uses manual fallback without secret leaks',
      async () => {
        at(900);
        const current = await state();
        assert.equal(current.phase.type, 'CODING');
        assert.equal(current.phase.questionIndex, 20);
        assert.equal(current.phase.remainingSeconds, 900);
        noSecrets(current);
        await rejected(
          students[0]
            .post('/api/student/mcq-submit')
            .send({ questionIndex: 19, selectedOptionIndex: 2 }),
          [409],
        );
        await rejected(
          students[0]
            .put('/api/student/code-draft')
            .send({ questionIndex: 21, sourceCode: 'print(1)' }),
          [409],
        );
        await success(
          students[0].put('/api/student/code-draft').send({
            questionIndex: 20,
            sourceCode: 'print("draft")',
            participantId: participantIds[1],
          }),
          200,
        );
        assert.equal((await state()).draft.sourceCode, 'print("draft")');
        assert.equal((await state(students[1])).draft.sourceCode, '');
        const sample = (
          await success(
            students[0]
              .post('/api/student/run-sample')
              .send({ questionIndex: 20, sourceCode: 'print(1)' }),
            200,
          )
        ).body;
        assert.equal(sample.available, false);
        assert.deepEqual(sample.results, []);
        assert.equal(typeof sample.message, 'string');
        assert.equal(
          await CodeSubmission.countDocuments({ contestId: contest._id }),
          0,
          'Running samples never creates a scoring submission',
        );
        const payload = {
          questionIndex: 20,
          sourceCode: 'print("first")',
          requestId: randomUUID(),
        };
        firstRequestId = payload.requestId;
        const first = (
          await success(students[0].post('/api/student/submit-code').send(payload), 201)
        ).body.submission;
        submissions.push(first);
        assert.equal(first.judgingStatus, 'PENDING_MANUAL_REVIEW');
        assert.equal(first.score, 0);
        noSecrets(first);
        const retries = await Promise.all(
          Array.from({ length: 3 }, () =>
            students[0].post('/api/student/submit-code').send(payload),
          ),
        );
        for (const retry of retries) {
          assert.ok([200, 201].includes(retry.status), JSON.stringify(retry.body));
          assert.equal(retry.body.submission._id, first._id);
        }
        assert.equal(
          await CodeSubmission.countDocuments({
            participantId: participantIds[0],
            requestId: payload.requestId,
          }),
          1,
        );
        await rejected(
          students[0]
            .post('/api/student/submit-code')
            .send({ ...payload, sourceCode: 'print("changed")' }),
          [409],
        );
        await success(
          students[0]
            .put('/api/student/code-draft')
            .send({ questionIndex: 20, sourceCode: 'print("later draft")' }),
          200,
        );
        assert.equal((await CodeSubmission.findById(first._id)).sourceCode, payload.sourceCode);
        const otherHistory = (
          await success(
            students[1].get(`/api/student/submissions?participantId=${participantIds[0]}`),
            200,
          )
        ).body;
        assert.deepEqual(otherHistory.submissions, []);
        await rejected(
          students[0].post(`/api/submissions/${first._id}/manual-grade`).send({ score: 30 }),
          [401, 403],
        );
        await rejected(
          outsider.post(`/api/submissions/${first._id}/manual-grade`).send({ score: 30 }),
          [403, 404],
        );
        for (const score of [-1, 31])
          await rejected(
            owner.post(`/api/submissions/${first._id}/manual-grade`).send({ score }),
            [400, 422],
          );
        await success(
          owner
            .post(`/api/submissions/${first._id}/manual-grade`)
            .send({ score: 25, feedback: 'First reviewed submission' }),
          200,
        );
        at(910);
        const second = (
          await success(
            students[0]
              .post('/api/student/submit-code')
              .send({ questionIndex: 20, sourceCode: 'print("worse")', requestId: randomUUID() }),
            201,
          )
        ).body.submission;
        submissions.push(second);
        await success(
          owner
            .post(`/api/submissions/${second._id}/manual-grade`)
            .send({ score: 3, feedback: 'Later incorrect attempt' }),
          200,
        );
        const board = (await success(owner.get(`/api/contests/${contest._id}/leaderboard`), 200))
          .body;
        const row = board.leaderboard.find((row) => row.participantId === participantIds[0]);
        assert.equal(row.coding1Score, 25);
        assert.equal(row.totalScore, 29);
        assert.equal(board.provisional, true);
        assert.equal((await CodeSubmission.findById(first._id)).sourceCode, payload.sourceCode);
        const ownHistory = (await success(students[0].get('/api/student/submissions'), 200)).body;
        assert.equal(ownHistory.submissions.length, 2);
        noSecrets(ownHistory);
      },
    );

    await t.test(
      'configured OnlineCompiler HTTP failure returns sample fallback and queues manual review',
      async () => {
        const originalUrl = env.onlineCompilerUrl;
        const originalKey = env.onlineCompilerKey;
        const originalFetch = globalThis.fetch;
        let calls = 0;
        try {
          env.onlineCompilerUrl = 'https://compiler-failure.invalid/api';
          env.onlineCompilerKey = 'test-key';
          globalThis.fetch = async () => {
            calls++;
            return new Response('unavailable', { status: 503 });
          };
          const sample = (
            await success(
              students[3]
                .post('/api/student/run-sample')
                .send({ questionIndex: 20, sourceCode: 'print(1)' }),
              200,
            )
          ).body;
          assert.equal(sample.available, false);
          assert.deepEqual(sample.results, []);
          assert.ok(sample.message.length > 0);
          const queued = (
            await success(
              students[3].post('/api/student/submit-code').send({
                questionIndex: 20,
                sourceCode: 'print("provider failed")',
                requestId: randomUUID(),
              }),
              201,
            )
          ).body.submission;
          assert.equal(queued.judgingStatus, 'QUEUED');
          await runWorkerTick();
          const saved = await CodeSubmission.findById(queued._id);
          assert.equal(saved.judgingStatus, 'PENDING_MANUAL_REVIEW');
          assert.equal(saved.score, 0);
          assert.equal(saved.sourceCode, 'print("provider failed")');
          assert.ok(calls >= 2, 'Both sample and worker exercised the failing provider');
          noSecrets((await success(students[3].get('/api/student/submissions'), 200)).body);
        } finally {
          env.onlineCompilerUrl = originalUrl;
          env.onlineCompilerKey = originalKey;
          globalThis.fetch = originalFetch;
        }
      },
    );

    await t.test(
      'durable outbox repairs interrupted inserts and queued judging persists weighted results',
      async () => {
        const originalUrl = env.onlineCompilerUrl;
        const originalKey = env.onlineCompilerKey;
        const originalFetch = globalThis.fetch;
        const participantId = participantIds[4];
        const submissionId = new mongoose.Types.ObjectId();
        const receipt = {
          submissionId,
          requestId: randomUUID(),
          sourceCode: 'print("judged")',
          submittedAt: new Date(testTime),
          automatic: false,
        };
        try {
          env.onlineCompilerUrl = 'https://compiler-success.invalid/api';
          env.onlineCompilerKey = 'test-key';
          // Simulate a process exit after the atomic receipt commit but before collection insertion.
          await CodeDraft.updateOne(
            { participantId, questionIndex: 20 },
            { $push: { receipts: receipt }, $set: { pendingMaterialization: true } },
          );
          assert.equal(await CodeSubmission.findById(submissionId), null);
          await reconcileAll();
          await reconcileAll();
          assert.equal(await CodeSubmission.countDocuments({ _id: submissionId }), 1);
          let calls = 0;
          globalThis.fetch = async (_url, options) => {
            calls++;
            const body = JSON.parse(options.body);
            return Response.json(
              body.tests
                ? {
                    verdict: 'accepted',
                    score: 100,
                    tests: body.tests.map(() => ({ verdict: 'accepted', hidden: true })),
                  }
                : {
                    status: 'success',
                    output: '83-private-output',
                    exit_code: 0,
                    time: '0.01',
                    memory: '2048',
                  },
            );
          };
          await runWorkerTick();
          const evaluated = await CodeSubmission.findById(submissionId);
          assert.equal(evaluated.judgingStatus, 'EVALUATED');
          assert.equal(evaluated.score, 30);
          assert.equal(evaluated.testResults[0].passed, true);
          assert.equal(evaluated.executionMetadata.provider, 'OnlineCompiler.io');
          assert.equal(calls, 1);
          assert.equal((await ContestResult.findOne({ participantId })).coding1Score, 30);
          noSecrets((await success(students[4].get('/api/student/submissions'), 200)).body);
        } finally {
          env.onlineCompilerUrl = originalUrl;
          env.onlineCompilerKey = originalKey;
          globalThis.fetch = originalFetch;
        }
      },
    );

    await t.test(
      '1800s closes coding one and creates exactly one immutable fallback per unsent draft',
      async () => {
        at(1799.999);
        await success(
          students[1]
            .put('/api/student/code-draft')
            .send({ questionIndex: 20, sourceCode: 'print("deadline one")' }),
          200,
        );
        await success(
          students[2]
            .put('/api/student/code-draft')
            .send({ questionIndex: 20, sourceCode: '   \n' }),
          200,
        );
        at(1800);
        await rejected(
          students[1]
            .put('/api/student/code-draft')
            .send({ questionIndex: 20, sourceCode: 'print("too late")' }),
          [409],
        );
        await rejected(
          students[1]
            .post('/api/student/submit-code')
            .send({ questionIndex: 20, sourceCode: 'print("too late")', requestId: randomUUID() }),
          [409],
        );
        await reconcileContest(await Contest.findById(contest._id));
        await reconcileAll();
        const fallback = await CodeSubmission.find({
          participantId: participantIds[1],
          questionIndex: 20,
        });
        assert.equal(fallback.length, 1);
        assert.equal(fallback[0].automatic, true);
        assert.equal(fallback[0].sourceCode, 'print("deadline one")');
        assert.equal(fallback[0].judgingStatus, 'PENDING_MANUAL_REVIEW');
        assert.equal(
          await CodeSubmission.countDocuments({
            participantId: participantIds[2],
            questionIndex: 20,
          }),
          0,
          'Whitespace-only draft is not submitted',
        );
        assert.equal(
          await CodeSubmission.countDocuments({
            participantId: participantIds[0],
            questionIndex: 20,
          }),
          2,
          'Explicit submissions suppress automatic draft submission',
        );
        assert.equal(
          (await CodeDraft.findOne({ participantId: participantIds[1], questionIndex: 20 }))
            .isLocked,
          true,
        );
        const current = await state(students[1]);
        assert.equal(current.phase.questionIndex, 21);
        assert.equal(current.phase.remainingSeconds, 900);
        assert.equal(current.draft.sourceCode, '');
        const retry = await students[0].post('/api/student/submit-code').send({
          questionIndex: 20,
          sourceCode: submissions[0].sourceCode,
          requestId: firstRequestId,
        });
        assert.ok([200, 201].includes(retry.status), JSON.stringify(retry.body));
        assert.equal(retry.body.submission._id, submissions[0]._id);
      },
    );

    await t.test(
      '2700s completes the contest, persists drafts, and publishes durable ranked results and CSV',
      async () => {
        at(2699.999);
        await success(
          students[0]
            .put('/api/student/code-draft')
            .send({ questionIndex: 21, sourceCode: 'print("deadline two")' }),
          200,
        );
        at(2700);
        await rejected(
          students[0]
            .put('/api/student/code-draft')
            .send({ questionIndex: 21, sourceCode: 'print("late")' }),
          [409],
        );
        await rejected(
          students[0]
            .post('/api/student/submit-code')
            .send({ questionIndex: 21, sourceCode: 'print("late")', requestId: randomUUID() }),
          [409],
        );
        await reconcileAll();
        await reconcileAll();
        const current = await state();
        assert.equal(current.phase.type, 'FINISHED');
        assert.equal(current.phase.questionIndex, null);
        assert.equal(current.question, null);
        assert.equal((await Contest.findById(contest._id)).status, 'FINISHED');
        const final = await CodeSubmission.find({
          participantId: participantIds[0],
          questionIndex: 21,
        });
        assert.equal(final.length, 1);
        assert.equal(final[0].sourceCode, 'print("deadline two")');
        assert.equal(final[0].automatic, true);
        const unpublished = (await success(students[0].get('/api/student/results'), 200)).body;
        assert.equal(unpublished.published, false);
        assert.ok(!unpublished.leaderboard?.length);
        noSecrets(unpublished);
        const pendingBoard = (
          await success(owner.get(`/api/contests/${contest._id}/leaderboard`), 200)
        ).body;
        assert.equal(pendingBoard.provisional, true);
        for (const submission of await CodeSubmission.find({
          contestId: contest._id,
          judgingStatus: 'PENDING_MANUAL_REVIEW',
        })) {
          await success(
            owner
              .post(`/api/submissions/${submission.id}/manual-grade`)
              .send({ score: 30, feedback: 'Reviewed final code' }),
            200,
          );
        }
        await success(owner.post(`/api/contests/${contest._id}/publish`), 200);
        const result = (await success(students[0].get('/api/student/results'), 200)).body;
        assert.equal(result.published, true);
        assert.equal(result.provisional, false);
        assert.equal(result.result.mcqScore, 4);
        assert.equal(result.result.coding1Score, 25);
        assert.equal(result.result.coding2Score, 30);
        assert.equal(result.result.totalScore, 59);
        assert.equal(result.leaderboard.length, 12);
        assert.deepEqual(
          result.leaderboard.map((row) => row.rank),
          Array.from({ length: 12 }, (_, i) => i + 1),
        );
        assert.equal(result.leaderboard[0].participantId, participantIds[0]);
        noSecrets(result);
        assert.equal(await ContestResult.countDocuments({ contestId: contest._id }), 12);
        const saved = await ContestResult.findOne({
          contestId: contest._id,
          participantId: participantIds[0],
        });
        assert.equal(saved.totalScore, 59);
        const csv = await success(owner.get(`/api/contests/${contest._id}/export`), 200);
        assert.match(csv.headers['content-type'], /text\/csv/);
        assert.match(csv.text, /Student 01/);
        assert.match(csv.text, /REG-1/);
        assert.match(csv.text, /59/);
        assert.equal(csv.text.trim().split(/\r?\n/).length, 13);
        // A new Express instance reads persisted sessions, snapshots and results.
        const freshApp = createApp();
        const freshMentor = request.agent(freshApp);
        await success(
          freshMentor.post('/api/auth/login').send({ email: 'owner@example.test', password }),
          200,
        );
        const persisted = (
          await success(freshMentor.get(`/api/contests/${contest._id}/leaderboard`), 200)
        ).body;
        assert.equal(persisted.leaderboard[0].totalScore, 59);
        assert.equal(persisted.published, true);
      },
    );

    await t.test(
      'another mentor runs an independent contest and can end it early without accepting later changes',
      async () => {
        const ownQuestions = [];
        for (let i = 0; i < 22; i++) {
          const created = await success(
            outsider
              .post(`/api/questions/${i < 20 ? 'mcq' : 'coding'}`)
              .send(i < 20 ? mcq(i) : coding(i - 20)),
            201,
          );
          ownQuestions.push(created.body.question._id);
        }
        const independent = (
          await success(
            outsider.post('/api/contests').send({
              title: 'Independent mentor',
              questionIds: ownQuestions,
              requireRegisterNumber: false,
            }),
            201,
          )
        ).body.contest;
        assert.notEqual(independent.roomCode, contest.roomCode);
        await rejected(owner.get(`/api/contests/${independent._id}`), [403, 404]);
        const student = request.agent(app);
        await success(
          student
            .post('/api/rooms/join')
            .send({ roomCode: independent.roomCode, fullName: 'Independent student' }),
          201,
        );
        await success(outsider.post(`/api/contests/${independent._id}/start`), 200);
        await success(
          student
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 2 }),
          200,
        );
        const ended = (await success(outsider.post(`/api/contests/${independent._id}/end`), 200))
          .body.contest;
        assert.equal(ended.status, 'FINISHED');
        assert.equal((await state(student)).phase.type, 'FINISHED');
        await rejected(
          student
            .put('/api/student/mcq-selection')
            .send({ questionIndex: 0, selectedOptionIndex: 1 }),
          [409],
        );
        await rejected(outsider.post(`/api/contests/${independent._id}/end`), [409]);
        await success(outsider.post(`/api/contests/${independent._id}/publish`), 200);
        const results = (await success(student.get('/api/student/results'), 200)).body;
        assert.equal(results.result.totalScore, 2);
        assert.equal(results.leaderboard.length, 1);
        assert.equal(await CodeSubmission.countDocuments({ contestId: independent._id }), 0);
      },
    );

    await t.test(
      'demo content has exactly 20 MCQs, valid difficulty distribution and two valid coding problems',
      async () => {
        assert.equal(demoQuestions.length, 22);
        const questions = demoQuestions.filter((q) => q.type === 'MCQ');
        assert.equal(questions.length, 20);
        for (const [difficulty, expected] of [
          ['EASY', 8],
          ['MEDIUM', 8],
          ['HARD', 4],
        ])
          assert.equal(questions.filter((q) => q.difficulty === difficulty).length, expected);
        for (const question of demoQuestions)
          await new Question({ ...question, mentorId: ownerId }).validate();
      },
    );
  },
);
