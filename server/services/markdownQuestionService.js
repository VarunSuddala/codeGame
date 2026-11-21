import YAML from 'yaml';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import { assert } from '../middleware/errors.js';

export const QUESTION_MARKER = '<!-- CODEARENA:QUESTION -->';
const MAX_BYTES = 1024 * 1024;
const MAX_QUESTIONS = 100;
const safeHtml = (markdown) =>
  sanitizeHtml(marked.parse(markdown || ''), {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter(
      (tag) => !['style', 'script', 'iframe', 'form', 'input'].includes(tag),
    ),
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], code: ['class'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
const section = (body, heading) => {
  const match = body.match(new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'im'));
  return match ? match[1].trim() : '';
};
const normalizeTests = (tests, field) => {
  assert(
    Array.isArray(tests) && tests.length > 0,
    400,
    `${field} must contain at least one test case.`,
  );
  return tests.map((test, index) => {
    assert(
      test && typeof test.input === 'string' && typeof test.output === 'string',
      400,
      `${field}[${index}] requires input and output strings.`,
    );
    const weight = Number(test.marks ?? test.weight ?? 1);
    assert(
      Number.isFinite(weight) && weight > 0 && weight <= 30,
      400,
      `${field}[${index}] has an invalid weight.`,
    );
    return { input: test.input, expectedOutput: test.output, weight };
  });
};
export function parseMarkdownFile(buffer, filename = 'questions.md') {
  assert(/\.md$/i.test(filename), 400, 'Only UTF-8 .md files are supported.');
  assert(buffer.length <= MAX_BYTES, 400, 'Markdown file exceeds the 1 MB limit.');
  const text = buffer.toString('utf8');
  assert(!text.includes('\u0000'), 400, 'Markdown contains an invalid NUL character.');
  const blocks = text
    .split(QUESTION_MARKER)
    .map((block) => block.trim())
    .filter(Boolean);
  assert(
    blocks.length > 0 && blocks.length <= MAX_QUESTIONS,
    400,
    `Use between 1 and ${MAX_QUESTIONS} question blocks.`,
  );
  return blocks.map((block, index) => {
    const front = block.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    assert(front, 400, `Question ${index + 1}: YAML front matter is required.`);
    let meta;
    try {
      meta = YAML.parse(front[1]) || {};
    } catch (error) {
      assert(false, 400, `Question ${index + 1}: malformed YAML (${error.message}).`);
    }
    const body = front[2].trim();
    const type = String(meta.type || '').toLowerCase();
    assert(
      type === 'mcq' || type === 'coding',
      400,
      `Question ${index + 1}: type must be mcq or coding.`,
    );
    assert(
      typeof meta.title === 'string' && meta.title.trim(),
      400,
      `Question ${index + 1}: title is required.`,
    );
    const difficulty = String(meta.difficulty || 'easy').toUpperCase();
    assert(
      ['EASY', 'MEDIUM', 'HARD'].includes(difficulty),
      400,
      `Question ${index + 1}: invalid difficulty.`,
    );
    if (type === 'mcq') {
      assert(
        Array.isArray(meta.options) &&
          meta.options.length === 4 &&
          meta.options.every((x) => String(x).trim()),
        400,
        `Question ${index + 1}: exactly four options are required.`,
      );
      assert(
        Number.isInteger(meta.correctAnswer) && meta.correctAnswer >= 0 && meta.correctAnswer < 4,
        400,
        `Question ${index + 1}: correctAnswer must be a zero-based option index.`,
      );
      return {
        type: 'MCQ',
        title: meta.title.trim(),
        description: body,
        descriptionHtml: safeHtml(body),
        difficulty,
        category: String(meta.category || 'General'),
        options: meta.options.map(String),
        correctOptionIndex: meta.correctAnswer,
        explanation: section(body, 'Explanation'),
        maxScore: 2,
      };
    }
    const hidden = normalizeTests(meta.hiddenTests, 'hiddenTests');
    assert(
      Math.abs(hidden.reduce((sum, test) => sum + test.weight, 0) - 30) < 0.001,
      400,
      `Question ${index + 1}: hidden test marks must total 30.`,
    );
    const samples = meta.sampleTests
      ? normalizeTests(meta.sampleTests, 'sampleTests')
      : [{ input: '', expectedOutput: '', weight: 1 }];
    return {
      type: 'CODING',
      title: meta.title.trim(),
      description: body,
      descriptionHtml: safeHtml(body),
      difficulty,
      category: String(meta.category || 'General'),
      inputFormat: section(body, 'Input Format'),
      outputFormat: section(body, 'Output Format'),
      constraints: section(body, 'Constraints'),
      sampleTestCases: samples,
      hiddenTestCases: hidden,
      referenceSolution: typeof meta.referenceSolution === 'string' ? meta.referenceSolution : '',
      maxScore: 30,
    };
  });
}
export function exportQuestion(q, includePrivate = true) {
  const meta = {
    type: q.type.toLowerCase(),
    title: q.title,
    difficulty: q.difficulty.toLowerCase(),
    category: q.category,
  };
  if (q.type === 'MCQ')
    Object.assign(meta, {
      options: q.options,
      correctAnswer: includePrivate ? q.correctOptionIndex : undefined,
    });
  else
    Object.assign(meta, {
      language: 'python',
      maxScore: 30,
      sampleTests: q.sampleTestCases?.map((x) => ({ input: x.input, output: x.expectedOutput })),
      ...(includePrivate
        ? {
            hiddenTests: q.hiddenTestCases?.map((x) => ({
              input: x.input,
              output: x.expectedOutput,
              marks: x.weight,
            })),
            referenceSolution: q.referenceSolution,
          }
        : {}),
    });
  const clean = Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined));
  const front = YAML.stringify(clean).trim();
  return `---\n${front}\n---\n\n${q.description || ''}\n`;
}
