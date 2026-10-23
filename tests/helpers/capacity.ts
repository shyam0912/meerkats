const randomUUID = () => crypto.randomUUID();
import { MAX_SNAPSHOT_BYTES, whiteboardV2Schema } from '../../contracts';
import { createDrawingSession } from '../../src/drawing/session';
import { serializeSession } from '../../src/persistence/serialization';
import { newRecord } from '../../src/persistence/database';

/** Bounded disposable fixture: one stroke, below the per-stroke coordinate limit. */
export function capacityRecord(bytes = MAX_SNAPSHOT_BYTES) {
  const identity = { id: randomUUID(), context: { classId: null, subjectId: null, classLabel: '', subjectLabel: '' } };
  const session = createDrawingSession({ sessionId: identity.id, classId: null, subjectId: null }, { whiteboard: randomUUID(), annotation: randomUUID() });
  const snapshot = serializeSession(session, identity, null);
  const board = whiteboardV2Schema.parse(snapshot.whiteboard);
  const points = Array<number>(Math.min(180000, Math.ceil(bytes / 28) * 2)).fill(0);
  board.pages[0]!.objects.push({ id: randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 3, points });
  let remaining = bytes - new TextEncoder().encode(JSON.stringify(board)).byteLength;
  for (let i = 0; remaining > 0 && i < points.length; i++) {
    const extra = Math.min(12, remaining);
    points[i] = extra === 1 ? 10 : Number('0.' + '1'.repeat(extra - 1));
    remaining -= extra;
  }
  if (new TextEncoder().encode(JSON.stringify(board)).byteLength !== bytes) throw new Error('Incorrect boundary fixture');
  return newRecord({ ...snapshot, whiteboard: whiteboardV2Schema.parse(board) });
}
