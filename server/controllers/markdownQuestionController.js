import multer from 'multer';
import crypto from 'node:crypto';
import { Question } from '../models/index.js';
import { assert } from '../middleware/errors.js';
import { parseMarkdownFile, exportQuestion } from '../services/markdownQuestionService.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 20, fileSize: 1024 * 1024 },
});
export const uploadMarkdown = upload.array('files', 20);
function parseFiles(files) {
  assert(files?.length, 400, 'Upload at least one Markdown file.');
  return files.flatMap((file) =>
    parseMarkdownFile(file.buffer, file.originalname).map((question) => ({
      ...question,
      sourceFile: file.originalname,
    })),
  );
}
export async function preview(req, res) {
  res.json({ questions: parseFiles(req.files) });
}
export async function importMarkdown(req, res) {
  const questions = parseFiles(req.files);
  const existing = await Question.find({ mentorId: req.mentor._id })
    .select('title description')
    .lean();
  const seen = new Set(
    existing.map((q) =>
      crypto.createHash('sha256').update(`${q.title}\n${q.description}`).digest('hex'),
    ),
  );
  const imported = [],
    errors = [];
  for (const [index, question] of questions.entries()) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${question.title}\n${question.description}`)
      .digest('hex');
    if (seen.has(fingerprint)) {
      errors.push({ index, message: 'Likely duplicate question skipped.' });
      continue;
    }
    try {
      const saved = await Question.create({ ...question, mentorId: req.mentor._id });
      imported.push(saved);
      seen.add(fingerprint);
    } catch (error) {
      errors.push({ index, message: error.message });
    }
  }
  res
    .status(imported.length ? 201 : 400)
    .json({ imported: imported.length, failed: errors.length, errors, questions: imported });
}
export async function exportMarkdown(req, res) {
  const filter = { mentorId: req.mentor._id };
  if (req.query.id) filter._id = req.query.id;
  const questions = await Question.find(filter).sort({ createdAt: 1 });
  assert(questions.length, 404, 'No questions found.');
  res
    .type('text/markdown')
    .attachment('codearena-questions.md')
    .send(questions.map((q) => exportQuestion(q)).join('\n<!-- CODEARENA:QUESTION -->\n\n'));
}
