import bcrypt from 'bcryptjs';
import { Mentor } from '../models/index.js';
import { registerInput, loginInput } from '../middleware/validation.js';
import { assert } from '../middleware/errors.js';
import { cookieOptions, mentorToken, publicMentor } from '../middleware/auth.js';
export async function register(req, res) {
  const data = registerInput.parse(req.body);
  const mentor = await Mentor.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
  });
  res
    .cookie('ca_mentor', mentorToken(mentor), cookieOptions())
    .status(201)
    .json({ mentor: publicMentor(mentor) });
}
const dummyHash = bcrypt.hashSync('constant-time-invalid-password', 12);
export async function login(req, res) {
  const data = loginInput.parse(req.body);
  const mentor = await Mentor.findOne({ email: data.email }).select('+passwordHash');
  const valid = await bcrypt.compare(data.password, mentor?.passwordHash || dummyHash);
  assert(mentor && valid, 401, 'Invalid email or password.');
  res
    .cookie('ca_mentor', mentorToken(mentor), cookieOptions())
    .json({ mentor: publicMentor(mentor) });
}
export function logout(req, res) {
  res
    .clearCookie('ca_mentor', { ...cookieOptions(), maxAge: undefined })
    .json({ message: 'Logged out.' });
}
