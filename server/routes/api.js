import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { mentorAuth, studentAuth, publicMentor } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as questions from '../controllers/questionController.js';
import * as contests from '../controllers/contestController.js';
import * as student from '../controllers/studentController.js';
import * as markdownQuestions from '../controllers/markdownQuestionController.js';
import * as exam from '../controllers/examController.js';
export const api = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 40,
  skip: () => env.nodeEnv === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Try again later.' },
});
const runLimit = rateLimit({
  windowMs: 60000,
  limit: 6,
  keyGenerator: (req) => req.participant.id,
  skip: () => env.nodeEnv === 'test',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Please wait before running another sample.' },
});
api.post('/auth/register', authLimit, auth.register);
api.post('/auth/login', authLimit, auth.login);
api.post('/auth/logout', auth.logout);
api.get('/auth/me', mentorAuth, (req, res) => res.json({ mentor: publicMentor(req.mentor) }));
api.use('/questions', mentorAuth);
api.get('/questions', questions.list);
api.post('/questions/mcq', questions.create);
api.post('/questions/coding', questions.create);
api.post('/questions/preview-import', markdownQuestions.uploadMarkdown, markdownQuestions.preview);
api.post(
  '/questions/import-markdown',
  markdownQuestions.uploadMarkdown,
  markdownQuestions.importMarkdown,
);
api.get('/questions/export-markdown', markdownQuestions.exportMarkdown);
api.get('/questions/:id', questions.get);
api.put('/questions/:id', questions.update);
api.delete('/questions/:id', questions.remove);
api.use('/contests', mentorAuth);
api.post('/contests', contests.create);
api.get('/contests', contests.list);
api.get('/contests/:id', contests.get);
api.post('/contests/:id/start', contests.start);
api.post('/contests/:id/end', contests.end);
api.post('/contests/:id/publish', contests.publish);
api.get('/contests/:id/participants', contests.participants);
api.get('/contests/:id/leaderboard', contests.leaderboard);
api.get('/contests/:id/submissions', contests.submissions);
api.get('/contests/:id/monitoring', exam.monitoring);
api.get('/contests/:id/violations', exam.contestViolations);
api.get('/contests/:id/export', contests.exportCsv);
api.post('/submissions/:id/manual-grade', mentorAuth, contests.manualGrade);
api.post(
  '/rooms/join',
  rateLimit({
    windowMs: 60000,
    limit: 180,
    skip: () => env.nodeEnv === 'test',
    message: { message: 'Too many joins. Please retry shortly.' },
  }),
  student.join,
);
api.use('/student', studentAuth);
api.get('/student/contest-state', student.state);
api.get('/student/current-question', student.state);
api.put('/student/mcq-selection', student.selection);
api.post('/student/mcq-submit', student.lock);
api.put('/student/code-draft', student.draft);
api.post('/student/run-sample', runLimit, student.sample);
api.post('/student/submit-code', student.submit);
api.get('/student/submissions', student.submissions);
api.get('/student/results', student.results);
api.post('/exam/violations', exam.violation);
api.get('/exam/status', exam.status);
api.get('/exam/violations', exam.violations);
