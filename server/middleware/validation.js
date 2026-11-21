import { z } from 'zod';
export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
const text = (max = 5000) => z.string().trim().max(max);
const required = (max = 5000) => text(max).min(1);
export const registerInput = z
  .object({
    name: required(100),
    email: z
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine((x) => Buffer.byteLength(x) <= 72, 'Password must be at most 72 UTF-8 bytes'),
    confirmPassword: z.string(),
  })
  .refine((x) => x.password === x.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });
export const loginInput = z.object({
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  password: z.string().min(1).max(72),
});
const base = {
  title: required(200),
  description: required(15000),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
  category: text(100).default('Python'),
};
const testCase = z.object({
  input: z.string().max(100000).default(''),
  expectedOutput: z.string().max(100000).default(''),
  weight: z.number().positive().max(30).default(1),
});
export const mcqInput = z.object({
  ...base,
  options: z.array(required(2000)).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
  explanation: text().default(''),
});
export const codingInput = z
  .object({
    ...base,
    inputFormat: required(),
    outputFormat: required(),
    constraints: required(),
    sampleTestCases: z.array(testCase).min(1).max(10),
    hiddenTestCases: z.array(testCase).min(1).max(30),
    referenceSolution: z.string().max(32000).default(''),
  })
  .refine((x) => Math.abs(x.hiddenTestCases.reduce((n, t) => n + t.weight, 0) - 30) < 0.001, {
    path: ['hiddenTestCases'],
    message: 'Hidden test weights must total 30',
  });
export const contestInput = z.object({
  title: required(200),
  description: text().default(''),
  questionIds: z
    .array(id)
    .length(22)
    .refine((a) => new Set(a).size === 22, 'Questions must be unique'),
  requireRegisterNumber: z.boolean().default(false),
});
export const joinInput = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/),
  fullName: required(100),
  registerNumber: text(100).default(''),
});
export const selectionInput = z.object({
  questionIndex: z.number().int().min(0).max(19),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export const submitMcqInput = selectionInput.partial({ selectedOptionIndex: true });
export const codeInput = z.object({
  questionIndex: z.number().int().min(20).max(21),
  sourceCode: z.string().max(32000),
});
export const codeSubmitInput = codeInput.extend({
  sourceCode: z
    .string()
    .max(32000)
    .refine((s) => s.trim().length > 0, 'Code cannot be empty'),
  requestId: z.uuid(),
});
export const gradeInput = z.object({
  score: z
    .number()
    .min(0)
    .max(30)
    .refine((x) => Math.round(x * 100) === x * 100, 'At most two decimals'),
  feedback: text(2000).default(''),
});
