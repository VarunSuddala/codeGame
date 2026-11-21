import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { demoQuestions } from '../data/demoQuestions.js';

const CONTEST_TITLE = 'CodeArena · Python Classroom Challenge';

async function seed() {
  const email = process.env.DEMO_MENTOR_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_MENTOR_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set DEMO_MENTOR_EMAIL and DEMO_MENTOR_PASSWORD in your private environment before seeding.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('DEMO_MENTOR_EMAIL must be a valid email address.');
  }
  if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'DEMO_MENTOR_PASSWORD must contain at least 10 characters and at most 72 UTF-8 bytes.',
    );
  }
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI before seeding.');

  // Import after configuration checks; the service may also validate application environment.
  const models = await import('../models/index.js');
  const { createContest } = await import('../services/contestService.js');
  const { Mentor, Question, Contest } = models;
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(
    [
      models.Mentor,
      models.Question,
      models.Contest,
      models.Participant,
      models.McqResponse,
      models.CodeDraft,
      models.CodeSubmission,
      models.ContestResult,
    ].map((model) => model.init()),
  );

  let mentor = await Mentor.findOne({ email }).select('+passwordHash');
  if (mentor) {
    if (!(await bcrypt.compare(password, mentor.passwordHash))) {
      throw new Error(
        'The existing mentor password does not match DEMO_MENTOR_PASSWORD. No account password was changed.',
      );
    }
  } else {
    mentor = await Mentor.create({
      name: 'Demo Mentor',
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });
  }

  const questionIds = [];
  let createdQuestions = 0;
  for (const question of demoQuestions) {
    let existing = await Question.findOne({
      mentorId: mentor._id,
      type: question.type,
      title: question.title,
    });
    if (!existing) {
      existing = await Question.create({ ...question, mentorId: mentor._id });
      createdQuestions += 1;
    }
    questionIds.push(existing._id.toString());
  }

  const existingContest = await Contest.findOne({ mentorId: mentor._id, title: CONTEST_TITLE });
  if (!existingContest) {
    // Let the application service validate ordering, create immutable snapshots,
    // set the fixed duration, and allocate a unique room code.
    await createContest(mentor._id, {
      title: CONTEST_TITLE,
      description:
        '20 Python MCQs and two coding rounds. 45 minutes, 100 marks. Compete. Code. Conquer.',
      questionIds,
      requireRegisterNumber: false,
    });
  }
  console.log(
    `Seed complete: ${createdQuestions} questions added; sample contest ${existingContest ? 'preserved' : 'created'}.`,
  );
  console.log(
    'Sign in with your configured mentor credentials to view the contest and its invitation code.',
  );
}

try {
  await seed();
} catch (error) {
  // Driver errors may include credential-bearing URIs. Report a safe diagnostic only.
  const safeMessages = [
    'Set DEMO_MENTOR_EMAIL',
    'DEMO_MENTOR_EMAIL must',
    'DEMO_MENTOR_PASSWORD must',
    'Set MONGO_URI',
    'The existing mentor password',
  ];
  console.error(
    safeMessages.some((prefix) => error.message?.startsWith(prefix))
      ? error.message
      : 'Seed failed. Check database availability, application environment, model validation, and existing demo question compatibility. Credentials are not logged.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
