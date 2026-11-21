import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required: true,
  ...extra,
});
const integer = { validator: Number.isInteger, message: 'Must be an integer' };
const str = (max = 5000) => ({ type: String, trim: true, maxlength: max });
const testCase = new Schema(
  {
    input: { type: String, default: '', maxlength: 100000 },
    expectedOutput: { type: String, default: '', maxlength: 100000 },
    weight: { type: Number, min: 0.01, max: 30, default: 1 },
  },
  { _id: false },
);
export const questionFields = {
  type: { type: String, enum: ['MCQ', 'CODING'], required: true },
  title: { ...str(200), required: true },
  description: { ...str(15000), required: true },
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'EASY' },
  category: { ...str(100), default: 'Python' },
  options: { type: [String], default: undefined },
  correctOptionIndex: { type: Number, min: 0, max: 3, validate: integer },
  explanation: str(),
  inputFormat: str(),
  outputFormat: str(),
  constraints: str(),
  sampleTestCases: { type: [testCase], default: undefined },
  hiddenTestCases: { type: [testCase], default: undefined },
  referenceSolution: { type: String, maxlength: 32000 },
  maxScore: { type: Number, enum: [2, 30], required: true },
};
function validateQuestion(doc) {
  if (doc.type === 'MCQ') {
    if (doc.options?.length !== 4 || doc.options.some((x) => !x.trim()))
      doc.invalidate('options', 'Exactly four nonempty options are required.');
    if (!Number.isInteger(doc.correctOptionIndex))
      doc.invalidate('correctOptionIndex', 'A correct option is required.');
    if (doc.maxScore !== 2) doc.invalidate('maxScore', 'MCQs are worth two marks.');
  } else {
    if (!doc.sampleTestCases?.length || !doc.hiddenTestCases?.length)
      doc.invalidate('hiddenTestCases', 'Sample and hidden test cases are required.');
    if (doc.maxScore !== 30) doc.invalidate('maxScore', 'Coding questions are worth 30 marks.');
    if (Math.abs((doc.hiddenTestCases || []).reduce((n, t) => n + t.weight, 0) - 30) > 0.001)
      doc.invalidate('hiddenTestCases', 'Hidden test weights must sum to 30.');
  }
}
const mentor = new Schema(
  {
    name: { ...str(100), required: true },
    email: { ...str(254), lowercase: true, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
const question = new Schema(
  { mentorId: ref('Mentor', { index: true }), ...questionFields },
  { timestamps: true, optimisticConcurrency: true },
);
question.pre('validate', function () {
  validateQuestion(this);
});
question.index({ mentorId: 1, type: 1, difficulty: 1 });
const snapshot = new Schema({ questionId: ref('Question'), ...questionFields }, { _id: false });
snapshot.pre('validate', function () {
  validateQuestion(this);
});
const contest = new Schema(
  {
    mentorId: ref('Mentor', { index: true }),
    title: { ...str(200), required: true },
    description: str(),
    roomCode: { type: String, match: /^[A-Z0-9]{6}$/, required: true, unique: true },
    status: {
      type: String,
      enum: ['DRAFT', 'WAITING', 'LIVE', 'FINISHED', 'CANCELLED'],
      default: 'WAITING',
      index: true,
    },
    questionSnapshots: {
      type: [snapshot],
      immutable: true,
      validate: {
        validator: (a) =>
          a.length === 22 &&
          a.slice(0, 20).every((q) => q.type === 'MCQ') &&
          a.slice(20).every((q) => q.type === 'CODING'),
        message: 'Select 20 MCQs followed by 2 coding questions.',
      },
    },
    totalDurationSeconds: { type: Number, enum: [2700], default: 2700, immutable: true },
    startedAt: Date,
    endedAt: Date,
    requireRegisterNumber: { type: Boolean, default: false },
    resultsPublished: { type: Boolean, default: false },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'Participant' }],
  },
  { timestamps: true },
);
contest.index({ mentorId: 1, createdAt: -1 });
const participant = new Schema({
  contestId: ref('Contest'),
  fullName: { ...str(100), required: true },
  registerNumber: str(100),
  identityKey: { type: String, required: true },
  sessionTokenHash: { type: String, required: true, select: false },
  joinedAt: { type: Date, default: Date.now },
  lastSeenAt: Date,
  status: {
    type: String,
    enum: ['JOINED', 'ACTIVE', 'FINISHED', 'AUTO_SUBMITTED'],
    default: 'JOINED',
  },
  violationCount: { type: Number, min: 0, max: 3, default: 0 },
  examStatus: {
    type: String,
    enum: ['WAITING', 'ACTIVE', 'WARNING', 'FINAL_WARNING', 'AUTO_SUBMITTED', 'FINISHED'],
    default: 'WAITING',
  },
  autoSubmittedAt: Date,
  submissionReason: { type: String, maxlength: 300 },
  lastViolationAt: Date,
  examFinalizedAt: Date,
});
participant.index({ contestId: 1, identityKey: 1 }, { unique: true });
participant.index({ contestId: 1, violationCount: 1, examStatus: 1 });
const examViolation = new Schema(
  {
    contestId: ref('Contest'),
    participantId: ref('Participant'),
    eventId: { type: String, required: true, maxlength: 100 },
    violationType: { type: String, enum: ['TAB_DEPARTURE'], required: true },
    serverTimestamp: { type: Date, default: Date.now },
    clientMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
examViolation.index({ participantId: 1, eventId: 1 }, { unique: true });
examViolation.index({ contestId: 1, participantId: 1, serverTimestamp: -1 });
const common = {
  contestId: ref('Contest'),
  participantId: ref('Participant'),
  questionIndex: { type: Number, min: 0, max: 21, required: true, validate: integer },
};
const mcq = new Schema(
  {
    ...common,
    selectedOptionIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
      validate: { validator: (x) => x == null || Number.isInteger(x) },
    },
    isLocked: { type: Boolean, default: false },
    submittedAt: Date,
  },
  { timestamps: true },
);
mcq.index({ contestId: 1, participantId: 1, questionIndex: 1 }, { unique: true });
const receipt = new Schema(
  {
    submissionId: ref('CodeSubmission'),
    requestId: { type: String, required: true },
    sourceCode: { type: String, required: true, maxlength: 32000 },
    submittedAt: { type: Date, required: true },
    automatic: { type: Boolean, default: false },
  },
  { _id: false },
);
const draft = new Schema(
  {
    ...common,
    sourceCode: { type: String, default: '', maxlength: 32000 },
    isLocked: { type: Boolean, default: false },
    pendingMaterialization: { type: Boolean, default: false, index: true },
    receipts: { type: [receipt], default: [] },
  },
  { timestamps: true },
);
draft.index({ contestId: 1, participantId: 1, questionIndex: 1 }, { unique: true });
const submission = new Schema(
  {
    ...common,
    sourceCode: { type: String, required: true, maxlength: 32000, immutable: true },
    submittedAt: { type: Date, required: true, immutable: true },
    requestId: { type: String, required: true, immutable: true },
    automatic: { type: Boolean, default: false, immutable: true },
    judgingStatus: {
      type: String,
      enum: ['QUEUED', 'JUDGING', 'EVALUATED', 'PENDING_MANUAL_REVIEW', 'MANUALLY_GRADED'],
      default: 'QUEUED',
      index: true,
    },
    score: { type: Number, min: 0, max: 30, default: 0 },
    testResults: { type: [Schema.Types.Mixed], default: [] },
    executionMetadata: Schema.Types.Mixed,
    leaseUntil: Date,
    leaseId: String,
    manualGrade: {
      mentorId: { type: Schema.Types.ObjectId, ref: 'Mentor' },
      score: { type: Number, min: 0, max: 30 },
      feedback: str(2000),
      gradedAt: Date,
    },
  },
  { timestamps: true },
);
submission.index(
  { contestId: 1, participantId: 1, questionIndex: 1, requestId: 1 },
  { unique: true },
);
submission.index({ contestId: 1, submittedAt: -1 });
const result = new Schema(
  {
    contestId: ref('Contest'),
    participantId: ref('Participant'),
    mcqScore: { type: Number, min: 0, max: 40, default: 0 },
    coding1Score: { type: Number, min: 0, max: 30, default: 0 },
    coding2Score: { type: Number, min: 0, max: 30, default: 0 },
    totalScore: { type: Number, min: 0, max: 100, default: 0 },
    rank: { type: Number, min: 1 },
    gradingStatus: {
      type: String,
      enum: ['PROVISIONAL', 'PENDING_EVALUATION', 'FINAL'],
      default: 'PROVISIONAL',
    },
    latestQualifyingAt: Date,
  },
  { timestamps: true },
);
result.index({ contestId: 1, participantId: 1 }, { unique: true });
result.index({ contestId: 1, totalScore: -1 });
export const Mentor = mongoose.model('Mentor', mentor);
export const Question = mongoose.model('Question', question);
export const Contest = mongoose.model('Contest', contest);
export const Participant = mongoose.model('Participant', participant);
export const McqResponse = mongoose.model('McqResponse', mcq);
export const CodeDraft = mongoose.model('CodeDraft', draft);
export const CodeSubmission = mongoose.model('CodeSubmission', submission);
export const ContestResult = mongoose.model('ContestResult', result);
export const ExamViolation = mongoose.model('ExamViolation', examViolation);
