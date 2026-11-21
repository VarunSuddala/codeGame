import { Question, Contest } from '../models/index.js';
import { mcqInput, codingInput, id } from '../middleware/validation.js';
import { assert } from '../middleware/errors.js';
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function list(req, res) {
  const filter = { mentorId: req.mentor._id };
  for (const field of ['type', 'difficulty', 'category'])
    if (typeof req.query[field] === 'string') filter[field] = req.query[field].slice(0, 100);
  if (typeof req.query.search === 'string' && req.query.search.trim())
    filter.title = { $regex: escapeRegex(req.query.search.trim().slice(0, 100)), $options: 'i' };
  res.json({ questions: await Question.find(filter).sort({ createdAt: -1 }).limit(2000) });
}
export async function create(req, res) {
  const type = req.path.endsWith('/mcq') ? 'MCQ' : 'CODING';
  const data = (type === 'MCQ' ? mcqInput : codingInput).parse(req.body);
  res.status(201).json({
    question: await Question.create({
      ...data,
      type,
      maxScore: type === 'MCQ' ? 2 : 30,
      mentorId: req.mentor._id,
    }),
  });
}
export async function ownedQuestion(req) {
  const q = await Question.findOne({ _id: id.parse(req.params.id), mentorId: req.mentor._id });
  assert(q, 404, 'Question not found.');
  return q;
}
export async function get(req, res) {
  res.json({ question: await ownedQuestion(req) });
}
export async function update(req, res) {
  const question = await ownedQuestion(req);
  const data = (question.type === 'MCQ' ? mcqInput : codingInput).parse(req.body);
  Object.assign(question, data);
  await question.save();
  res.json({ question });
}
export async function remove(req, res) {
  const question = await ownedQuestion(req);
  assert(
    !(await Contest.exists({ 'questionSnapshots.questionId': question._id })),
    409,
    'This question is used by a contest. You can edit it for future contests; existing snapshots stay unchanged.',
  );
  await question.deleteOne();
  res.json({ message: 'Question deleted.' });
}
