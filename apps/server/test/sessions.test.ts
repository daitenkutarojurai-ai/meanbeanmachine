import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROTOCOL_VERSION, type Sequenced, type ServerMessage } from '@mbm/engine';
import { Lobby } from '../src/rooms.ts';
import { Sessions, type Socket } from '../src/sessions.ts';

class FakeSocket implements Socket {
  readyState = 1;
  got: Sequenced<ServerMessage>[] = [];
  send(data: string): void {
    this.got.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | undefined {
    return this.got.filter((m) => m.t === t).at(-1) as Extract<ServerMessage, { t: T }> | undefined;
  }
}

function join(sessions: Sessions, name: string) {
  const socket = new FakeSocket();
  const h = sessions.connect(socket);
  h.message(JSON.stringify({ t: 'hello', name, v: PROTOCOL_VERSION }));
  return { socket, h, welcome: socket.last('welcome')! };
}

test('a dropped player resumes its seat and receives what it missed', () => {
  const clock = { t: 0 };
  const lobby = new Lobby(() => clock.t);
  lobby.stop();
  const sessions = new Sessions(lobby);
  const a = join(sessions, 'ann');
  const b = join(sessions, 'ben');
  a.h.message(JSON.stringify({ t: 'quick', level: 1 }));
  b.h.message(JSON.stringify({ t: 'quick', level: 1 }));
  assert.ok(a.socket.last('start') && b.socket.last('start'), 'quick match starts');
  clock.t += 4000;

  // Ann sends 6 frames, then her connection drops.
  a.h.message(JSON.stringify({ t: 'frames', from: 0, inputs: [0, 0, 0, 0, 0, 0], acks: [] }));
  const seenSeq = Math.max(...a.socket.got.map((m) => m.seq ?? 0));
  a.socket.readyState = 3;
  a.h.close();

  // Ben keeps playing; Ann's copies of his frames pile up on the server.
  b.h.message(JSON.stringify({ t: 'frames', from: 0, inputs: [0, 0, 0], acks: [] }));
  b.h.message(JSON.stringify({ t: 'frames', from: 3, inputs: [0, 0, 0], acks: [] }));
  assert.equal(b.socket.last('left'), undefined, 'opponent is not told during the grace period');

  // Ann comes back on a new socket.
  const again = new FakeSocket();
  const h2 = sessions.connect(again);
  h2.message(JSON.stringify({ t: 'resume', id: a.welcome.id, token: a.welcome.token, lastSeq: seenSeq, v: PROTOCOL_VERSION }));
  const resumed = again.last('resumed');
  assert.ok(resumed, 'resumed');
  assert.equal(resumed.framesReceived, 6);
  const missed = again.got.filter((m) => m.t === 'frames');
  assert.deepEqual(missed.map((m) => (m.t === 'frames' ? m.from : -1)), [0, 3]);
  assert.ok(missed.every((m) => (m.seq ?? 0) > seenSeq));

  // A resend that overlaps what the server has is accepted.
  h2.message(JSON.stringify({ t: 'frames', from: 3, inputs: [0, 0, 0, 0, 0, 0], acks: [] }));
  assert.equal(b.socket.last('frames')?.from, 3, 'the resend reached the opponent');
  assert.equal(b.socket.last('roundOver'), undefined, 'no desync forfeit');
});

test('a wrong token cannot take over a session', () => {
  const lobby = new Lobby();
  lobby.stop();
  const sessions = new Sessions(lobby);
  const a = join(sessions, 'ann');
  const thief = new FakeSocket();
  sessions.connect(thief).message(JSON.stringify({ t: 'resume', id: a.welcome.id, token: 'nope', lastSeq: 0, v: PROTOCOL_VERSION }));
  assert.ok(thief.last('resumeFailed'));
  assert.equal(thief.readyState, 3);
});
