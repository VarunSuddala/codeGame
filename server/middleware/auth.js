import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Mentor, Participant, Contest } from '../models/index.js';
import { env } from '../config/env.js';
import { assert } from './errors.js';
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: env.nodeEnv === 'production' ? 'none' : 'strict',
  secure: env.nodeEnv === 'production',
  path: '/',
  maxAge: 7 * 86400000,
});
export const publicMentor = (mentor) => ({
  _id: mentor._id,
  name: mentor.name,
  email: mentor.email,
});
export function mentorToken(mentor) {
  return jwt.sign({ sub: mentor.id, role: 'MENTOR' }, env.jwtSecret, {
    expiresIn: '7d',
    issuer: 'codearena',
    audience: 'codearena-mentor',
    algorithm: 'HS256',
  });
}
export async function resolveMentor(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: 'codearena',
      audience: 'codearena-mentor',
      algorithms: ['HS256'],
    });
    if (payload.role !== 'MENTOR') return null;
    return await Mentor.findById(payload.sub);
  } catch {
    return null;
  }
}
export async function resolveParticipant(token) {
  if (typeof token !== 'string' || !/^[a-f\d]{24}\.[a-f\d]{64}$/.test(token)) return null;
  const [participantId, secret] = token.split('.');
  const p = await Participant.findById(participantId).select('+sessionTokenHash');
  if (
    !p ||
    !timingSafeEqual(Buffer.from(p.sessionTokenHash, 'hex'), Buffer.from(hashToken(secret), 'hex'))
  )
    return null;
  const admitted = await Contest.exists({ _id: p.contestId, participantIds: p._id });
  return admitted ? p : null;
}
export async function mentorAuth(req, res, next) {
  req.mentor = await resolveMentor(req.cookies.ca_mentor);
  assert(req.mentor, 401, 'Mentor login required.');
  next();
}
export async function studentAuth(req, res, next) {
  req.participant = await resolveParticipant(req.cookies.ca_student);
  assert(
    req.participant,
    401,
    'Student session required. Reopen this contest in the browser used to join.',
  );
  next();
}
export async function ownedContest(mentorId, contestId) {
  const contest = await Contest.findOne({ _id: contestId, mentorId });
  assert(contest, 404, 'Contest not found.');
  return contest;
}
