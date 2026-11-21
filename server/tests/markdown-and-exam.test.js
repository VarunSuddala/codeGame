import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownFile } from '../services/markdownQuestionService.js';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Contest, Participant, McqResponse, CodeDraft, ExamViolation } from '../models/index.js';
import { demoQuestions } from '../data/demoQuestions.js';
import { recordViolation } from '../services/examService.js';

test('Markdown parser imports multiple questions, preserves Python indentation, and sanitizes preview HTML', () => {
  const source = `---
type: mcq
title: Safe question
difficulty: easy
options: [A, B, C, D]
correctAnswer: 1
---
# Question
What is safe? <script>alert(1)</script>
<!-- CODEARENA:QUESTION -->
---
type: coding
title: Indented
difficulty: medium
hiddenTests:
  - input: "1\\n"
    output: "1\\n"
    marks: 30
---
# Problem Statement
Run it.

\`\`\`python
def f():
    return 1
\`\`\`
`;
  const questions = parseMarkdownFile(Buffer.from(source), 'pack.md');
  assert.equal(questions.length, 2);
  assert.equal(questions[0].correctOptionIndex, 1);
  assert.ok(!questions[0].descriptionHtml.includes('<script>'));
  assert.match(questions[1].description, /    return 1/);
  assert.equal(questions[1].hiddenTestCases[0].weight, 30);
});

test('Markdown parser rejects malformed answers, unsupported types, and invalid hidden marks', () => {
  assert.throws(
    () =>
      parseMarkdownFile(
        Buffer.from('---\ntype: mcq\ntitle: Bad\noptions: [A]\n---\ntext'),
        'bad.md',
      ),
    /exactly four/,
  );
  assert.throws(
    () => parseMarkdownFile(Buffer.from('---\ntype: ruby\ntitle: Bad\n---\ntext'), 'bad.md'),
    /type must be/,
  );
  assert.throws(
    () =>
      parseMarkdownFile(
        Buffer.from(
          '---\ntype: coding\ntitle: Bad\nhiddenTests:\n - input: x\n   output: y\n   marks: 2\n---\ntext',
        ),
        'bad.md',
      ),
    /total 30/,
  );
});

test('three tab departures are idempotent and finalize the participant', async (t) => {
  const db = `mongodb://127.0.0.1:27017/codearena_exam_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(db);
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const contestId = new mongoose.Types.ObjectId();
  const participant = await Participant.create({
    contestId,
    fullName: 'Exam Student',
    identityKey: randomUUID(),
    sessionTokenHash: 'a'.repeat(64),
  });
  await Contest.create({
    _id: contestId,
    mentorId: new mongoose.Types.ObjectId(),
    title: 'Exam',
    roomCode: randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase(),
    questionSnapshots: demoQuestions.map((q) => ({
      ...q,
      questionId: new mongoose.Types.ObjectId(),
    })),
  });
  await McqResponse.insertMany(
    Array.from({ length: 20 }, (_, questionIndex) => ({
      contestId,
      participantId: participant._id,
      questionIndex,
    })),
  );
  await CodeDraft.insertMany(
    [20, 21].map((questionIndex) => ({ contestId, participantId: participant._id, questionIndex })),
  );
  for (let i = 0; i < 3; i++)
    await recordViolation({
      contestId,
      participantId: participant._id,
      eventId: `tab-${i}-unique`,
      clientMetadata: { visibilityState: 'hidden' },
    });
  await recordViolation({
    contestId,
    participantId: participant._id,
    eventId: 'tab-2-unique',
    clientMetadata: { visibilityState: 'hidden' },
  });
  const saved = await Participant.findById(participant._id);
  assert.equal(saved.violationCount, 3);
  assert.equal(saved.status, 'AUTO_SUBMITTED');
  assert.equal(saved.submissionReason, 'Auto-submitted after 3 tab-switch violations');
  assert.equal(await ExamViolation.countDocuments({ participantId: participant._id }), 3);
  assert.equal(
    await McqResponse.countDocuments({ participantId: participant._id, isLocked: true }),
    20,
  );
});
