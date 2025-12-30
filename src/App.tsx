import React, { useEffect, useMemo, useState } from "react";

/**
 * No-backend approach:
 * - Picker links contain: { mode:"pick", pickerName, targetName, groupId }
 * - When picker submits book, app generates a Submission Code containing:
 *   { mode:"submission", groupId, targetName, book:{title,author,notes}, createdAt }
 * - Host pastes 4 submission codes -> app generates 4 Reader Links containing:
 *   { mode:"read", groupId, readerName, book, countdownStart }
 *
 * NOTE: This is not cryptographically secure (people could tamper with payloads).
 * For a book club, it's usually fine.
 */

// ---------- tiny helpers (base64url) ----------
function b64urlEncode(str: string) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(str: string) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return decodeURIComponent(escape(atob(s)));
}

function encodePayload(obj: any) {
  return b64urlEncode(JSON.stringify(obj));
}

function decodePayload(token: string) {
  return JSON.parse(b64urlDecode(token));
}

// ---------- routing by URL hash ----------
type Mode = "home" | "host" | "pick" | "read";
function parseHash(): { mode: Mode; token?: string } {
  // #/host
  // #/pick/<token>
  // #/read/<token>
  const h = (window.location.hash || "").replace(/^#/, "");
  const parts = h.split("/").filter(Boolean);
  const first = parts[0] as Mode | undefined;
  if (!first) return { mode: "home" };
  if (first === "host") return { mode: "host" };
  if (first === "pick") return { mode: "pick", token: parts[1] };
  if (first === "read") return { mode: "read", token: parts[1] };
  return { mode: "home" };
}

function setHash(path: string) {
  window.location.hash = path.startsWith("#") ? path : `#${path}`;
}

// ---------- UI ----------
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    style={{
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ccc",
      fontSize: 14,
      ...props.style,
    }}
  />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    style={{
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ccc",
      fontSize: 14,
      minHeight: 90,
      ...props.style,
    }}
  />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
  <button
    {...props}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #111",
      background: "#111",
      color: "white",
      fontWeight: 700,
      cursor: "pointer",
      width: props.style?.width ?? "auto",
      opacity: props.disabled ? 0.6 : 1,
      ...props.style,
    }}
  />
);

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}

// ---------- assignment logic (derangement) ----------
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDerangement(names: string[]): Record<string, string> {
  // returns mapping: picker -> target, with no one assigned to themselves
  // simple retry approach (fine for 4 people)
  const n = names.length;
  if (n < 2) throw new Error("Need at least 2 people.");
  for (let tries = 0; tries < 1000; tries++) {
    const targets = shuffle(names);
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (targets[i] === names[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const map: Record<string, string> = {};
      for (let i = 0; i < n; i++) map[names[i]] = targets[i];
      return map;
    }
  }
  throw new Error("Could not create assignments. Try again.");
}

// ---------- countdown ----------
function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${days}d ${hours}h ${mins}m ${secs}s`;
}

export default function App() {
  const [route, setRoute] = useState(parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>📚 The Dancing Cat Book Club Picks</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => setHash("/host")} style={{ background: "#111" }}>
            Host
          </Button>
          <Button onClick={() => setHash("/")} style={{ background: "#444", borderColor: "#444" }}>
            Home
          </Button>
        </div>
      </div>

      {route.mode === "home" && <Home />}
      {route.mode === "host" && <Host />}
      {route.mode === "pick" && <Pick token={route.token} />}
      {route.mode === "read" && <Read token={route.token} />}
    </div>
  );
}

function Home() {
  return (
    <Card title="The Rules">
      <ol style={{ marginTop: 0 }}>
        <li>Host enters 4 names → gets 4 Picker Links.</li>
        <li>Each person opens their Picker Link → sees who they’re picking for → enters the book.</li>
        <li>They send the Host a Submission Code.</li>
        <li>Host pastes all 4 codes → gets 4 Reader Links + 30-day countdown start.</li>
      </ol>
      <Button onClick={() => setHash("/host")} style={{ width: "100%" }}>
        Start as Host
      </Button>
    </Card>
  );
}

function Host() {
  const [names, setNames] = useState(["", "", "", ""]);
  const cleaned = useMemo(
    () => names.map((n) => n.trim()).filter(Boolean),
    [names]
  );

  const [groupId, setGroupId] = useState(() => `group_${Math.random().toString(16).slice(2)}_${Date.now()}`);
  const [assignments, setAssignments] = useState<Record<string, string> | null>(null);

  const baseUrl = useMemo(() => {
    // Netlify final domain will work; for local, it’s localhost
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  // Submissions host pastes in
  const [submissionCodes, setSubmissionCodes] = useState<string[]>(["", "", "", ""]);
  const [decodedSubs, setDecodedSubs] = useState<any[]>([]);
  const [readerLinks, setReaderLinks] = useState<{ reader: string; link: string }[]>([]);
  const [countdownStart, setCountdownStart] = useState<number | null>(null);

  function generateAssignments() {
    if (cleaned.length !== 4) {
      alert("Please enter exactly 4 names.");
      return;
    }
    const unique = new Set(cleaned.map((n) => n.toLowerCase()));
    if (unique.size !== 4) {
      alert("Names must be unique.");
      return;
    }
    const map = makeDerangement(cleaned);
    setAssignments(map);
    setSubmissionCodes(["", "", "", ""]);
    setDecodedSubs([]);
    setReaderLinks([]);
    setCountdownStart(null);
  }

  function pickerLinkFor(pickerName: string, targetName: string) {
    const token = encodePayload({ mode: "pick", groupId, pickerName, targetName });
    return `${baseUrl}#/pick/${token}`;
  }

  function decodeSubmissions() {
    const subs: any[] = [];
    for (const code of submissionCodes.map((c) => c.trim()).filter(Boolean)) {
      try {
        const payload = decodePayload(code);
        if (payload?.mode !== "submission") continue;
        if (payload?.groupId !== groupId) continue;
        subs.push(payload);
      } catch {
        // ignore
      }
    }
    setDecodedSubs(subs);

    // If we have 4 valid submissions, auto-generate reader links and start countdown
    if (subs.length === 4) {
      const start = Date.now();
      setCountdownStart(start);

      const links = subs.map((s) => {
        const readerName = s.targetName;
        const token = encodePayload({
          mode: "read",
          groupId,
          readerName,
          book: s.book,
          countdownStart: start,
        });
        return { reader: readerName, link: `${baseUrl}#/read/${token}` };
      });

      setReaderLinks(links);
    } else {
      setReaderLinks([]);
      setCountdownStart(null);
    }
  }

  return (
    <>
      <Card title="1) Enter the 4 names">
        <div style={{ display: "grid", gap: 10 }}>
          {names.map((val, i) => (
            <div key={i}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Name {i + 1}</div>
              <Input
                value={val}
                placeholder="e.g., Tae"
                onChange={(e) => {
                  const next = [...names];
                  next[i] = e.target.value;
                  setNames(next);
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <Button onClick={generateAssignments}>Generate Picker Links</Button>
          <Button
            onClick={() => {
              setGroupId(`group_${Math.random().toString(16).slice(2)}_${Date.now()}`);
              setAssignments(null);
              setSubmissionCodes(["", "", "", ""]);
              setDecodedSubs([]);
              setReaderLinks([]);
              setCountdownStart(null);
            }}
            style={{ background: "#444", borderColor: "#444" }}
          >
            New Round
          </Button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10, display: "none" }}>
          Group ID: <code>{groupId}</code>
        </div>
      </Card>

      {assignments && (
        <Card title="2) Send each person their Picker Link">
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
            Copy the link that matches each picker’s name and send it to them.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(assignments).map(([picker, target]) => {
              const link = pickerLinkFor(picker, target);
              return (
                <div key={picker} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{picker}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                    (This link tells them who to pick for — it will not show the book.)
                  </div>
                  <Input value={link} readOnly />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button
                      onClick={() => copyToClipboard(link)}
                      style={{ background: "#222", borderColor: "#222" }}
                    >
                      Copy Link
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {assignments && (
        <Card title="3) Paste the Submission Codes you receive">
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
            Each picker will text/email you a Submission Code after they choose a book.
            Paste all 4 below (order doesn’t matter).
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {submissionCodes.map((val, i) => (
              <div key={i}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Submission Code {i + 1}</div>
                <Input
                  value={val}
                  placeholder="Paste code here"
                  onChange={(e) => {
                    const next = [...submissionCodes];
                    next[i] = e.target.value;
                    setSubmissionCodes(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Button onClick={decodeSubmissions}>Validate / Generate Reader Links</Button>
          </div>

          <div style={{ marginTop: 12, fontSize: 13 }}>
            Status: <b>{decodedSubs.length}</b> valid submissions detected (need 4).
          </div>
        </Card>
      )}

      {readerLinks.length > 0 && countdownStart && (
        <Card title="4) Send each person their Reader Link (countdown starts now)">
          <Countdown start={countdownStart} days={30} />

          <div style={{ fontSize: 13, opacity: 0.85, margin: "10px 0" }}>
            Send the link that matches the <b>reader’s name</b>. Each link reveals the chosen book and shows the same countdown.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {readerLinks.map((r) => (
              <div key={r.reader} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{r.reader}</div>
                <Input value={r.link} readOnly />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button onClick={() => copyToClipboard(r.link)} style={{ background: "#222", borderColor: "#222" }}>
                    Copy Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Pick({ token }: { token?: string }) {
  const [payload, setPayload] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [notes, setNotes] = useState("");
  const [submissionCode, setSubmissionCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!token) throw new Error("Missing token.");
      const p = decodePayload(token);
      if (p?.mode !== "pick") throw new Error("Invalid pick link.");
      setPayload(p);
    } catch (e: any) {
      setError(e.message || "Invalid link.");
    }
  }, [token]);

  function submit() {
    if (!payload) return;
    if (!title.trim() || !author.trim()) {
      alert("Please enter title and author.");
      return;
    }
    const code = encodePayload({
      mode: "submission",
      groupId: payload.groupId,
      targetName: payload.targetName,
      book: { title: title.trim(), author: author.trim(), notes: notes.trim() },
      createdAt: Date.now(),
    });
    setSubmissionCode(code);
  }

  if (error) return <Card title="Pick Link Error">{error}</Card>;
  if (!payload) return <Card title="Loading">…</Card>;

  return (
    <>
      <Card title="Your assignment">
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          Hi <b>{payload.pickerName}</b> — you are picking a book for: <b>{payload.targetName}</b>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          After you submit, you’ll get a Submission Code to send back to the host.
        </div>
      </Card>

      <Card title="Enter the book you chose">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Title</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Author</div>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Notes (optional)</div>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes for them…" />
          </div>

          <Button onClick={submit} style={{ width: "100%" }}>
            Generate Submission Code
          </Button>

          {submissionCode && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>✅ Submission Code</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                Copy this and send it to the host:
              </div>
              <Input value={submissionCode} readOnly />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button onClick={() => copyToClipboard(submissionCode)} style={{ background: "#222", borderColor: "#222" }}>
                  Copy Code
                </Button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                The host will paste all 4 codes to generate the Reader Links (that reveal the books).
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function Read({ token }: { token?: string }) {
  const [payload, setPayload] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!token) throw new Error("Missing token.");
      const p = decodePayload(token);
      if (p?.mode !== "read") throw new Error("Invalid reader link.");
      setPayload(p);
    } catch (e: any) {
      setError(e.message || "Invalid link.");
    }
  }, [token]);

  if (error) return <Card title="Reader Link Error">{error}</Card>;
  if (!payload) return <Card title="Loading">…</Card>;

  return (
    <>
      <Card title={`Your book, ${payload.readerName}`}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{payload.book?.title}</div>
        <div style={{ fontSize: 14, marginTop: 6 }}>by <b>{payload.book?.author}</b></div>
        {payload.book?.notes ? (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            <b>Notes:</b> {payload.book.notes}
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>No notes.</div>
        )}
      </Card>

      <Card title="30-day countdown">
        <Countdown start={payload.countdownStart} days={30} />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Countdown starts from when the host generated these reader links.
        </div>
      </Card>
    </>
  );
}

function Countdown({ start, days }: { start: number; days: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = start + days * 24 * 60 * 60 * 1000;
  const remaining = end - now;

  return (
    <div style={{ fontSize: 18, fontWeight: 900 }}>
      {remaining > 0 ? formatCountdown(remaining) : "⏰ Time’s up!"}
    </div>
  );
}
