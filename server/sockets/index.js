import { Server } from 'socket.io';
import { resolveMentor, resolveParticipant, ownedContest } from '../middleware/auth.js';
import { allowedOrigin } from '../middleware/origin.js';
import { setSocketServer, broadcastMentor } from '../services/events.js';
import { id } from '../middleware/validation.js';
import { env } from '../config/env.js';
function cookies(raw = '') {
  return Object.fromEntries(
    raw
      .split(';')
      .filter((x) => x.includes('='))
      .map((x) => {
        const pos = x.indexOf('=');
        return [x.slice(0, pos).trim(), decodeURIComponent(x.slice(pos + 1))];
      }),
  );
}
export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    maxHttpBufferSize: 16000,
    cors: { origin: env.origins, credentials: true },
    allowRequest: (req, callback) =>
      callback(
        null,
        allowedOrigin(
          req.headers.origin,
          req.headers.host,
          env.nodeEnv === 'production' ? 'https' : 'http',
        ),
      ),
  });
  io.use(async (socket, next) => {
    try {
      const c = cookies(socket.handshake.headers.cookie);
      const [mentor, participant] = await Promise.all([
        resolveMentor(c.ca_mentor),
        resolveParticipant(c.ca_student),
      ]);
      if (!mentor && !participant) return next(new Error('Authentication required'));
      socket.data.mentor = mentor;
      socket.data.participant = participant;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  io.on('connection', (socket) => {
    const p = socket.data.participant;
    if (p) {
      socket.join(`contest:${p.contestId}`);
      socket.join(`participant:${p._id}`);
    }
    socket.on('mentor-watch', async (data, ack) => {
      try {
        if (!socket.data.mentor) throw new Error('Mentor required');
        const c = await ownedContest(socket.data.mentor._id, id.parse(data?.contestId));
        // Only one watched contest per connection.
        for (const room of socket.rooms) if (room.startsWith('mentor:')) socket.leave(room);
        socket.join(`mentor:${c._id}`);
        socket.join(`contest:${c._id}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch {
        if (typeof ack === 'function') ack({ ok: false });
      }
    });
    socket.on('disconnect', () => {
      if (p) broadcastMentor(p.contestId, 'student-disconnected', { participantId: p._id });
    });
  });
  setSocketServer(io);
  return io;
}
