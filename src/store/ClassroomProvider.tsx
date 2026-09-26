import { useEffect, useState, type ReactNode } from "react";
import { ClassroomContext } from "./classroom-context";
import { newRecord, SessionRepository, type LocalRecord } from "../persistence/database";
import { snapshotSchema } from "../persistence/serialization";
import { api } from "../persistence/api";
import { uuid } from "../../contracts";
import { DEMO_SCENE_ID } from "../drawing/scene";

async function restore(): Promise<LocalRecord | undefined> {
  if (window.location.pathname !== "/workspace") return undefined;
  const id = new URLSearchParams(window.location.search).get("session");
  if (!id) return undefined;
  uuid.parse(id);
  const record = await new SessionRepository().load(id);
  if (record) return record;
  if (import.meta.env.VITE_API_ENABLED !== "true") throw new Error("Session is not stored on this device");
  const remote = await api.get(id);
  const whiteboard = remote.documents.find(d => d.document.owner.target.kind === "whiteboard")?.document;
  const annotations = Object.fromEntries(remote.documents.flatMap(({ document }) =>
    document.owner.target.kind === "annotation" ? [[document.owner.target.sceneId, document]] : []));
  if (!whiteboard || !annotations[DEMO_SCENE_ID]) throw new Error("Server session is incomplete");
  const result = newRecord(snapshotSchema.parse({ schemaVersion: 1, identity: { id, context: remote.context },
    whiteboard, annotations, mode: "whiteboard", selection: null }));
  result.sync = Object.fromEntries(remote.documents.map(d => [d.document.id, {
    serverRevision: d.serverRevision, acknowledgedLocalRevision: d.document.localRevision,
  }]));
  return new SessionRepository().save(result);
}
// React Strict Mode replays effects. Recovery (including its first device transaction)
// is one operation per page load, not a second concurrent writer.
let startupRecovery: Promise<LocalRecord | undefined> | undefined;
function ReadyClassroom({ children, restored }: { children: ReactNode; restored?: LocalRecord }) {
  const [selectedClass, setSelectedClass] = useState(restored?.snapshot.identity.context.classLabel ?? "");
  const [selectedSubject, setSelectedSubject] = useState(restored?.snapshot.identity.context.subjectLabel ?? "");
  const [sessionId, setSessionId] = useState(() => restored?.snapshot.identity.id ?? crypto.randomUUID());
  return <ClassroomContext.Provider value={{
    selectedClass, selectedSubject, sessionId, restored: restored?.snapshot.identity.id === sessionId ? restored : undefined,
    setSelectedClass: value => { setSelectedClass(value); setSelectedSubject(""); setSessionId(crypto.randomUUID()); },
    setSelectedSubject: value => { setSelectedSubject(value); setSessionId(crypto.randomUUID()); },
    startQuickWorkspace: () => { setSelectedClass(""); setSelectedSubject(""); setSessionId(crypto.randomUUID()); },
  }}>{children}</ClassroomContext.Provider>;
}
export function ClassroomProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<{ ready: boolean; record?: LocalRecord; error?: boolean }>({ ready: false });
  useEffect(() => {
    let active = true;
    startupRecovery ??= restore();
    void startupRecovery.then(record => { if (active) setBoot({ ready: true, record }); })
      .catch(() => { if (active) setBoot({ ready: false, error: true }); });
    return () => { active = false; };
  }, []);
  if (boot.error) return <main className="p-10"><h1>Session recovery needs attention</h1>
    <p>The session could not be restored. Stored data has been left untouched. Retry, or start a separate workspace.</p>
    <button className="workspace-button" onClick={() => window.location.reload()}>Retry recovery</button>
    <a className="workspace-button" href="/">Start a separate workspace</a></main>;
  if (!boot.ready) return <main className="p-10" role="status">Restoring teaching session…</main>;
  return <ReadyClassroom restored={boot.record}>{children}</ReadyClassroom>;
}
