let io;
export function setSocketServer(server) {
  io = server;
}
export function participantConnected(participantId) {
  return Boolean(io?.sockets.adapter.rooms.get(`participant:${participantId}`)?.size);
}
export function broadcastContest(contestId, event, payload = {}) {
  io?.to(`contest:${contestId}`).emit(event, payload);
}
export function broadcastMentor(contestId, event, payload = {}) {
  io?.to(`mentor:${contestId}`).emit(event, payload);
}
export function broadcastParticipant(participantId, event, payload = {}) {
  io?.to(`participant:${participantId}`).emit(event, payload);
}
