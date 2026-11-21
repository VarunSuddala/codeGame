import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
const databaseName = `codearena_test_${randomBytes(12).toString('hex')}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.MONGO_URI = `mongodb://127.0.0.1:27017/${databaseName}`;
const { default: mongoose } = await import('mongoose');
const { default: request } = await import('supertest');
const { io } = await import('socket.io-client');
const { createApp } = await import('../app.js');
const { attachSockets } = await import('../sockets/index.js');
const { connectDatabase } = await import('../config/database.js');
const { Question } = await import('../models/index.js');
const { demoQuestions } = await import('../data/demoQuestions.js');
const { createContest } = await import('../services/contestService.js');

function nextEvent(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Missing socket event: ${name}`)), 3000);
    socket.once(name, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}
const cookie = (response) => response.headers['set-cookie'].map((x) => x.split(';')[0]).join('; ');
test(
  'authenticated sockets isolate mentor events and synchronize participants',
  { timeout: 15000 },
  async (t) => {
    const sockets = [];
    const connection = await connectDatabase(process.env.MONGO_URI);
    const app = createApp(),
      server = createServer(app),
      socketServer = attachSockets(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
      sockets.forEach((s) => s.disconnect());
      await new Promise((resolve) => socketServer.close(resolve));
      assert.match(databaseName, /^codearena_test_[a-f0-9]{24}$/);
      assert.equal(connection.name, databaseName);
      await connection.dropDatabase();
      await mongoose.disconnect();
    });
    async function connect(cookies) {
      const socket = io(url, {
        autoConnect: false,
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: cookies ? { Cookie: cookies } : {},
      });
      sockets.push(socket);
      const ready = nextEvent(socket, cookies ? 'connect' : 'connect_error');
      socket.connect();
      await ready;
      return socket;
    }
    const anonymous = await connect();
    assert.equal(anonymous.connected, false);
    const mentor = request.agent(app);
    const auth = await mentor.post('/api/auth/register').send({
      name: 'Socket Mentor',
      email: 'sockets@example.test',
      password: 'SocketPassword-123',
      confirmPassword: 'SocketPassword-123',
    });
    assert.equal(auth.status, 201);
    const questions = await Question.insertMany(
      demoQuestions.map((q) => ({ ...q, mentorId: auth.body.mentor._id })),
    );
    const contest = await createContest(auth.body.mentor._id, {
      title: 'Socket arena',
      questionIds: questions.map((q) => String(q._id)),
      requireRegisterNumber: false,
    });
    const mentorSocket = await connect(cookie(auth));
    const watched = await new Promise((resolve) =>
      mentorSocket.emit('mentor-watch', { contestId: contest.id }, resolve),
    );
    assert.equal(watched.ok, true);
    const student = request.agent(app);
    const joinedEvent = nextEvent(mentorSocket, 'student-joined');
    const joined = await student
      .post('/api/rooms/join')
      .send({ roomCode: contest.roomCode, fullName: 'Socket Student' });
    assert.equal(joined.status, 201);
    assert.deepEqual(await joinedEvent, { participantCount: 1 });
    const studentSocket = await connect(cookie(joined));
    const denied = await new Promise((resolve) =>
      studentSocket.emit('mentor-watch', { contestId: contest.id }, resolve),
    );
    assert.equal(denied.ok, false);
    const startedEvent = nextEvent(studentSocket, 'contest-started');
    assert.equal((await mentor.post(`/api/contests/${contest.id}/start`)).status, 200);
    assert.ok((await startedEvent).startedAt);
    const participantList = await mentor.get(`/api/contests/${contest.id}/participants`);
    assert.equal(participantList.body.participants[0].isConnected, true);
    let leaked = false;
    studentSocket.on('leaderboard-updated', () => {
      leaked = true;
    });
    const leaderboardEvent = nextEvent(mentorSocket, 'leaderboard-updated');
    assert.equal(
      (
        await student
          .post('/api/student/mcq-submit')
          .send({ questionIndex: 0, selectedOptionIndex: demoQuestions[0].correctOptionIndex })
      ).status,
      200,
    );
    await leaderboardEvent;
    const endedEvent = nextEvent(studentSocket, 'contest-ended');
    assert.equal((await mentor.post(`/api/contests/${contest.id}/end`)).status, 200);
    await endedEvent;
    const publication = nextEvent(studentSocket, 'results-published');
    assert.equal((await mentor.post(`/api/contests/${contest.id}/publish`)).status, 200);
    await publication;
    assert.equal(leaked, false, 'Students must not receive private live leaderboard events');
  },
);
