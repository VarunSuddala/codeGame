import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Trophy,
  Users,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Code2,
  Play,
  Send,
  Terminal,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api, API_BASE, human, idOf } from './api';
import {
  Brand,
  Button,
  Field,
  ErrorBox,
  Badge,
  Loading,
  Empty,
  Connection,
  useRealtime,
  Leaderboard,
  PageHead,
} from './ui';
const CodeEditor = lazy(() => import('./CodeEditor'));
function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function Join() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const [form, setForm] = useState({
      roomCode: params.get('room')?.toUpperCase() || '',
      fullName: '',
      registerNumber: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="join-page">
      <div className="join-nav">
        <Brand />
        <Link to="/login" className="text-link">
          Mentor sign in <ArrowRight size={15} />
        </Link>
      </div>
      <main className="join-content">
        <div className="join-illustration">
          <div className="join-orbit" />
          <span className="join-symbol">
            <Code2 size={49} />
          </span>
          <span className="join-spark">✦</span>
        </div>
        <div className="eyebrow">YOUR NEXT CHALLENGE AWAITS</div>
        <h1>Step into the arena.</h1>
        <p>Bring your curiosity. We’ll bring the challenge.</p>
        <form
          className="panel join-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/rooms/join', { method: 'POST', body: form });
              navigate('/student');
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ErrorBox error={error} />
          <Field label="Room code">
            <input
              className="room-input"
              required
              maxLength={12}
              value={form.roomCode}
              onChange={(e) =>
                setForm({ ...form, roomCode: e.target.value.toUpperCase().replace(/\s/g, '') })
              }
              placeholder="ENTER CODE"
              autoComplete="off"
            />
          </Field>
          <Field label="Your full name">
            <input
              required
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="How should we call you?"
            />
          </Field>
          <Field
            label="Register number"
            hint="Required if your mentor has enabled it for this contest."
          >
            <input
              value={form.registerNumber}
              onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
              placeholder="Your student register number"
            />
          </Field>
          <Button busy={busy} className="full">
            Join the arena <ArrowRight size={17} />
          </Button>
          <div className="join-note">
            <ShieldCheck size={15} />
            No account needed. Just a little courage.
          </div>
        </form>
        <Link className="back-link" to="/">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
export function StudentArena() {
  const navigate = useNavigate();
  const [state, setState] = useState(null),
    [error, setError] = useState('');
  const inflight = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function refresh() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const d = await api('/student/contest-state');
      if (active.current) {
        setState({ ...d, clockOffset: new Date(d.serverNow).getTime() - Date.now() });
        setError('');
        if (d.phase?.type === 'FINISHED') navigate('/student/results', { replace: true });
      }
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      inflight.current = false;
    }
  }
  const connected = useRealtime(refresh);
  if (!state)
    return (
      <div className="student-page">
        <header className="student-header">
          <Brand />
          <Link to="/join" className="text-link">
            Join a room
          </Link>
        </header>
        <ErrorBox error={error} />
        {error ? (
          <Empty title="Couldn’t load your contest">
            <p>Check your connection, or join a room to begin.</p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
            <Link className="text-link" to="/join">
              Join a room
            </Link>
          </Empty>
        ) : (
          <Loading />
        )}
      </div>
    );
  const { contest, participant, phase } = state;
  const livePhase = phase.type === 'MCQ' || phase.type === 'CODING';
  const examKey = `codearena-exam-started:${contest._id}:${participant._id}`;
  const [examStarted, setExamStarted] = useState(() => sessionStorage.getItem(examKey) === '1');
  const exam = useFullscreenExam(examStarted && livePhase);
  const [warningDismissed, setWarningDismissed] = useState(false);
  useExamVisibility({
    active: examStarted && livePhase && participant.examStatus !== 'AUTO_SUBMITTED',
    refresh,
  });
  useEffect(() => {
    if (participant.violationCount < 3) setWarningDismissed(false);
  }, [participant.violationCount]);
  async function enterExam() {
    const ok = await exam.enter();
    if (ok) {
      sessionStorage.setItem(examKey, '1');
      setExamStarted(true);
    }
  }
  if (participant.examStatus === 'AUTO_SUBMITTED')
    return <AutoSubmittedPage participant={participant} />;
  return (
    <div className={examStarted ? 'student-page exam-mode' : 'student-page'}>
      {(!examStarted || phase.type === 'WAITING') && (
        <header className="student-header">
          <Brand />
          <div className="student-contest-title">
            <strong>{contest.title}</strong>
            <span>ROOM {contest.roomCode}</span>
          </div>
          <div className="row">
            <Connection connected={connected} />
            <span className="avatar small">{participant.fullName?.[0]}</span>
            <span className="student-name">{participant.fullName}</span>
          </div>
        </header>
      )}
      <ErrorBox error={error} />
      {phase.type === 'WAITING' ? (
        <StudentLobby state={state} />
      ) : phase.type === 'CANCELLED' ? (
        <Empty title="This contest has been cancelled">
          <p>Your mentor has closed this arena.</p>
          <Link className="btn" to="/join">
            Join another room
          </Link>
        </Empty>
      ) : livePhase && !examStarted ? (
        <ExamRules
          participant={participant}
          error={exam.error}
          unsupported={exam.unsupported}
          onStart={enterExam}
        />
      ) : livePhase ? (
        <>
          {!exam.isFullscreen && (
            <FullscreenRestoreOverlay error={exam.error} onRestore={enterExam} />
          )}
          {!warningDismissed &&
            participant.violationCount > 0 &&
            participant.violationCount < 3 && (
              <ViolationWarningModal
                count={participant.violationCount}
                onContinue={() => setWarningDismissed(true)}
              />
            )}
          <div className="student-round-bar">
            <div>
              <span className="eyebrow">
                {phase.type === 'MCQ'
                  ? 'ROUND 01 · CONCEPT CHALLENGE'
                  : 'ROUND 02 · CODE CHALLENGE'}
              </span>
              <strong>
                Question {phase.questionIndex + 1}
                <span> / 22</span>
              </strong>
            </div>
            <div className="question-dots" aria-label={`Question ${phase.questionIndex + 1} of 22`}>
              {Array.from({ length: 22 }, (_, i) => (
                <span
                  key={i}
                  className={`${i < phase.questionIndex ? 'done' : ''} ${i === phase.questionIndex ? 'current' : ''} ${i >= 20 ? 'coding-dot' : ''}`}
                />
              ))}
            </div>
            <Timer phase={phase} offset={state.clockOffset} />
          </div>
          {state.question ? (
            phase.type === 'MCQ' ? (
              <MCQ key={`${contest._id}:${phase.questionIndex}`} state={state} refresh={refresh} />
            ) : (
              <Coding
                key={`${contest._id}:${phase.questionIndex}`}
                state={state}
                refresh={refresh}
              />
            )
          ) : (
            <Loading />
          )}
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
}
function useFullscreenExam(active) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState('');
  const unsupported = typeof document.documentElement.requestFullscreen !== 'function';
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  async function enter() {
    if (unsupported) {
      setError(
        'Fullscreen is not supported by this browser. Your mentor should be informed before you continue.',
      );
      return false;
    }
    try {
      await document.documentElement.requestFullscreen();
      setError('');
      return true;
    } catch {
      setError('Fullscreen permission was denied. Use the retry button or inform your mentor.');
      return false;
    }
  }
  return { isFullscreen: active ? isFullscreen : false, error, unsupported, enter };
}
function useExamVisibility({ active, refresh }) {
  const hidden = useRef(false);
  useEffect(() => {
    if (!active) return undefined;
    const send = () => {
      if (hidden.current || document.visibilityState !== 'hidden') return;
      hidden.current = true;
      const body = JSON.stringify({
        eventId: requestId(),
        clientMetadata: { visibilityState: 'hidden', userAgent: navigator.userAgent },
      });
      const blob = new Blob([body], { type: 'application/json' });
      if (!navigator.sendBeacon?.(`${API_BASE}/exam/violations`, blob))
        fetch(`${API_BASE}/exam/violations`, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
        }).catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === 'visible') {
        hidden.current = false;
        refresh();
      }
    };
    document.addEventListener('visibilitychange', send);
    document.addEventListener('visibilitychange', visible);
    return () => {
      document.removeEventListener('visibilitychange', send);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [active, refresh]);
}
function ExamRules({ participant, error, unsupported, onStart }) {
  return (
    <main className="exam-rules panel">
      <span className="eyebrow">CODEARENA EXAMINATION</span>
      <h1>CodeArena Examination Rules</h1>
      <ol>
        <li>The examination runs in fullscreen mode.</li>
        <li>
          Switching tabs is monitored: warning 1, warning 2, then automatic submission on warning 3.
        </li>
        <li>Answers cannot be changed after submission and MCQs cannot be revisited.</li>
        <li>
          The shared contest clock continues through refreshes, minimization, and fullscreen
          recovery.
        </li>
        <li>Browser monitoring is best-effort and cannot prevent operating-system shortcuts.</li>
      </ol>
      <p>
        Candidate: <strong>{participant.fullName}</strong>
      </p>
      <ErrorBox error={error} />
      <Button onClick={onStart}>
        {unsupported ? 'Retry Fullscreen' : 'Enter Fullscreen & Start'} <ShieldCheck size={17} />
      </Button>
    </main>
  );
}
function FullscreenRestoreOverlay({ error, onRestore }) {
  return (
    <div className="fullscreen-overlay">
      <div className="panel">
        <Lock size={30} />
        <h2>Return to fullscreen</h2>
        <p>Fullscreen ended. Your timer has not been reset.</p>
        <ErrorBox error={error} />
        <Button onClick={onRestore}>Return to Fullscreen</Button>
      </div>
    </div>
  );
}
function ViolationWarningModal({ count, onContinue }) {
  return (
    <div className="fullscreen-overlay">
      <div className="panel warning-panel">
        <AlertCircle size={30} />
        <h2>{count === 1 ? 'WARNING 1 OF 3' : 'FINAL WARNING — 2 OF 3'}</h2>
        <p>
          {count === 1
            ? 'Tab switching was detected. Further violations may result in automatic submission.'
            : 'One more tab switch will automatically submit your examination.'}
        </p>
        <Button onClick={onContinue}>Continue Examination</Button>
      </div>
    </div>
  );
}
function AutoSubmittedPage({ participant }) {
  return (
    <main className="student-page auto-submitted">
      <div className="panel">
        <AlertCircle size={42} />
        <h1>EXAMINATION AUTO-SUBMITTED</h1>
        <p>Your attempt was automatically submitted after three tab-switch violations.</p>
        <p>Your previously saved answers have been preserved.</p>
        <Badge>Auto submitted</Badge>
        <small>{participant.submissionReason}</small>
      </div>
    </main>
  );
}
function Timer({ phase, offset }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(
    0,
    phase.deadline
      ? Math.ceil((new Date(phase.deadline).getTime() - now - offset) / 1000)
      : phase.remainingSeconds || 0,
  );
  return (
    <div className={`timer ${seconds < 30 ? 'urgent' : ''}`} role="timer">
      <Clock size={19} />
      <div>
        <strong>
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0')}
          :{(seconds % 60).toString().padStart(2, '0')}
        </strong>
        <small>{seconds === 0 ? 'Syncing next question…' : 'TIME REMAINING'}</small>
      </div>
    </div>
  );
}
function StudentLobby({ state }) {
  return (
    <main className="lobby">
      <div className="lobby-beacon">
        <Users size={40} />
        <span />
      </div>
      <div className="pill">
        <span className="dot" /> YOU’RE IN THE RIGHT PLACE
      </div>
      <h1>
        Take a breath.
        <br />
        Your arena is getting ready.
      </h1>
      <p>
        You’re in, <strong>{state.participant.fullName}</strong>. Your mentor will start the contest
        shortly.
        <br />
        This screen will update automatically.
      </p>
      <div className="lobby-room panel">
        <span className="eyebrow">{state.contest.title}</span>
        <strong>{state.contest.roomCode}</strong>
        <div>
          <Users size={17} />
          {state.participantCount ?? 1} participant{state.participantCount === 1 ? '' : 's'} in the
          room
        </div>
      </div>
      <div className="lobby-rules">
        <div>
          <span>01</span>
          <h3>Think it through</h3>
          <p>20 multiple-choice questions, one at a time.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Make it work</h3>
          <p>Two coding problems. Test samples before submitting.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Stay in the moment</h3>
          <p>Each question has a timer. Previous questions stay closed.</p>
        </div>
      </div>
      <div className="waiting-indicator">
        <span />
        <span />
        <span />
        Waiting for your mentor to start
      </div>
    </main>
  );
}
function useExpired(phase, offset) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  return !!phase.deadline && now + (offset || 0) >= new Date(phase.deadline).getTime();
}
function MCQ({ state, refresh }) {
  const { question: q, phase, response } = state;
  const expired = useExpired(phase, state.clockOffset);
  const closed = () =>
    !!phase.deadline && Date.now() + (state.clockOffset || 0) >= new Date(phase.deadline).getTime();
  const [selection, setSelection] = useState(response?.selectedOptionIndex ?? null),
    [locked, setLocked] = useState(!!response?.isLocked),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = useRef(false),
    alive = useRef(true),
    queue = useRef(Promise.resolve()),
    abort = useRef(new AbortController());
  useEffect(() => {
    alive.current = true;
    abort.current = new AbortController();
    return () => {
      alive.current = false;
      abort.current.abort();
    };
  }, []);
  useEffect(() => {
    if (response?.isLocked) setLocked(true);
    if (!dirty.current) setSelection(response?.selectedOptionIndex ?? null);
  }, [response?.selectedOptionIndex, response?.isLocked]);
  function choose(index) {
    if (locked || busy || closed()) return;
    dirty.current = true;
    setSelection(index);
    setSaving(true);
    setError('');
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!alive.current || closed()) return;
        await api('/student/mcq-selection', {
          method: 'PUT',
          signal: abort.current.signal,
          body: { questionIndex: phase.questionIndex, selectedOptionIndex: index },
        });
      });
    const current = queue.current;
    current
      .then(() => {
        if (alive.current && queue.current === current) {
          setSaving(false);
          setError('');
        }
      })
      .catch((e) => {
        if (alive.current) {
          setSaving(false);
          setError(e.message);
        }
      });
  }
  async function submit() {
    if (closed()) return;
    setBusy(true);
    setError('');
    try {
      await queue.current.catch(() => {});
      if (!alive.current || closed()) return;
      await api('/student/mcq-submit', {
        method: 'POST',
        signal: abort.current.signal,
        body: { questionIndex: phase.questionIndex, selectedOptionIndex: selection },
      });
      if (alive.current) {
        setLocked(true);
        refresh();
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="mcq-main">
      <div className="mcq-info">
        <Badge value={q.difficulty} />
        <span>{q.category}</span>
        <span>Question {phase.questionIndex + 1} of 20</span>
      </div>
      <h1>{q.title}</h1>
      <div className="question-description">{q.description}</div>
      <div className="mcq-options">
        {(q.options || []).map((option, i) => (
          <button
            disabled={locked || busy || expired}
            key={i}
            className={`mcq-option ${selection === i ? 'selected' : ''}`}
            onClick={() => choose(i)}
          >
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{option}</span>
            {selection === i ? <CheckCircle2 size={21} /> : <span className="option-radio" />}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      <div className="mcq-bottom">
        <span className="save-status">
          {locked ? (
            <>
              <Lock size={15} />
              Answer locked
            </>
          ) : saving ? (
            <>
              <Loader2 size={15} className="spin" />
              Saving selection…
            </>
          ) : selection != null && !error ? (
            <>
              <CheckCircle2 size={15} />
              Selection saved
            </>
          ) : (
            <>Select one answer to continue</>
          )}
        </span>
        <Button busy={busy} disabled={selection == null || locked || expired} onClick={submit}>
          {expired ? (
            'Time is up'
          ) : locked ? (
            'Submitted'
          ) : (
            <>
              Lock answer <ArrowRight size={17} />
            </>
          )}
        </Button>
      </div>
      {locked ? (
        <div className="locked-state">
          <CheckCircle2 size={25} />
          <div>
            <strong>You’re all set for this question.</strong>
            <p>Your answer is locked. The next question opens when the timer ends.</p>
          </div>
        </div>
      ) : (
        <div className="mcq-note">
          <ShieldCheck size={15} />
          Your selection saves automatically. Locking your answer is final.
        </div>
      )}
    </main>
  );
}
const initialCode =
  '# Write your Python solution here.\n# Read input from stdin and print your answer to stdout.\n\n';
function Coding({ state, refresh }) {
  const { question: q, phase, draft } = state;
  const expired = useExpired(phase, state.clockOffset);
  const closed = () =>
    !!phase.deadline && Date.now() + (state.clockOffset || 0) >= new Date(phase.deadline).getTime();
  const [source, setSource] = useState(() => draft?.sourceCode ?? initialCode),
    [saveStatus, setSaveStatus] = useState('Draft restored'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [results, setResults] = useState(null),
    [submissions, setSubmissions] = useState([]),
    [bottomTab, setBottomTab] = useState('samples');
  const timer = useRef(null),
    alive = useRef(true),
    abort = useRef(new AbortController()),
    queue = useRef(Promise.resolve()),
    latest = useRef(source),
    submissionRequest = useRef(null);
  useEffect(() => {
    alive.current = true;
    abort.current = new AbortController();
    loadSubmissions();
    const t = setInterval(loadSubmissions, 3000);
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      clearInterval(t);
      abort.current.abort();
    };
  }, []);
  useEffect(() => {
    if (expired) clearTimeout(timer.current);
  }, [expired]);
  async function loadSubmissions() {
    try {
      const d = await api('/student/submissions', { signal: abort.current.signal });
      if (alive.current)
        setSubmissions(
          (d.submissions || []).filter((s) => s.questionIndex === phase.questionIndex),
        );
    } catch (e) {
      if (alive.current && e.name !== 'AbortError') setError(e.message);
    }
  }
  function save(value) {
    if (closed()) return Promise.resolve();
    setSaveStatus('Saving draft…');
    queue.current = queue.current
      .catch(() => {})
      .then(() => {
        if (!alive.current || closed()) return;
        return api('/student/code-draft', {
          method: 'PUT',
          signal: abort.current.signal,
          body: { questionIndex: phase.questionIndex, sourceCode: value },
        });
      });
    const job = queue.current;
    job
      .then(() => {
        if (alive.current && queue.current === job) {
          setSaveStatus('All changes saved');
        }
      })
      .catch((e) => {
        if (alive.current) {
          setSaveStatus('Draft not synced');
          setError(e.message);
        }
      });
    return job;
  }
  function change(value) {
    if (closed()) return;
    latest.current = value;
    setSource(value);
    submissionRequest.current = null;
    clearTimeout(timer.current);
    setSaveStatus('Unsaved changes');
    timer.current = setTimeout(() => save(value), 650);
  }
  async function run() {
    if (closed()) return;
    setBusy('run');
    setError('');
    try {
      const d = await api('/student/run-sample', {
        method: 'POST',
        signal: abort.current.signal,
        body: { questionIndex: phase.questionIndex, sourceCode: latest.current },
      });
      if (alive.current) {
        setResults(d);
        setBottomTab('samples');
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy('');
    }
  }
  async function submit() {
    if (closed()) return;
    setBusy('submit');
    setError('');
    clearTimeout(timer.current);
    try {
      await save(latest.current);
      if (!alive.current || closed()) return;
      if (!submissionRequest.current) submissionRequest.current = requestId();
      await api('/student/submit-code', {
        method: 'POST',
        signal: abort.current.signal,
        body: {
          questionIndex: phase.questionIndex,
          sourceCode: latest.current,
          requestId: submissionRequest.current,
        },
      });
      if (alive.current) {
        setBottomTab('submissions');
        await loadSubmissions();
        refresh();
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy('');
    }
  }
  return (
    <main className="coding-layout">
      <section className="problem-pane">
        <div className="pane-title">
          <Code2 size={17} />
          Problem statement
          <Badge value={q.difficulty} />
        </div>
        <div className="problem-content">
          <span className="eyebrow">CODING CHALLENGE {phase.questionIndex - 19} OF 2</span>
          <h1>{q.title}</h1>
          <div className="question-description">{q.description}</div>
          {[
            ['inputFormat', 'Input format'],
            ['outputFormat', 'Output format'],
            ['constraints', 'Constraints'],
          ].map(
            ([key, label]) =>
              q[key] && (
                <section key={key}>
                  <h3>{label}</h3>
                  <div className="question-description">{q[key]}</div>
                </section>
              ),
          )}
          {(q.sampleTestCases || []).map((t, i) => (
            <section key={i}>
              <h3>Sample {i + 1}</h3>
              <div className="sample-box">
                <label>INPUT</label>
                <pre>{t.input || '(empty)'}</pre>
                <label>EXPECTED OUTPUT</label>
                <pre>{t.expectedOutput || '(empty)'}</pre>
              </div>
            </section>
          ))}
          <div className="info-box">
            <ShieldCheck size={17} />
            <span>
              Hidden tests evaluate your solution after submission. If automatic judging is
              unavailable, your mentor will review it.
            </span>
          </div>
        </div>
      </section>
      <section className="editor-pane">
        <div className="pane-title">
          <span className="file-tab">
            <Code2 size={16} />
            solution.py
          </span>
          <span className="language-label">Python 3</span>
          <span className="save-status">{expired ? 'Time is up · editor locked' : saveStatus}</span>
        </div>
        <div className="editor-container">
          <Suspense fallback={<Loading />}>
            <CodeEditor value={source} onChange={change} readOnly={busy === 'submit' || expired} />
          </Suspense>
        </div>
        <div className="editor-actions">
          <span>
            <Terminal size={15} />
            Standard input / output
          </span>
          <div className="row">
            <Button
              variant="secondary small"
              disabled={!!busy || expired}
              busy={busy === 'run'}
              onClick={run}
            >
              <Play size={15} />
              Run samples
            </Button>
            <Button
              className="small"
              disabled={!!busy || expired}
              busy={busy === 'submit'}
              onClick={submit}
            >
              <Send size={15} />
              Submit code
            </Button>
          </div>
        </div>
        <ErrorBox error={error} />
        <div className="console-panel">
          <div className="tabs">
            <button
              className={bottomTab === 'samples' ? 'active' : ''}
              onClick={() => setBottomTab('samples')}
            >
              Sample results
            </button>
            <button
              className={bottomTab === 'submissions' ? 'active' : ''}
              onClick={() => setBottomTab('submissions')}
            >
              Submissions{' '}
              {submissions.length > 0 && <span className="count">{submissions.length}</span>}
            </button>
          </div>
          <div className="console-content">
            {bottomTab === 'samples' ? (
              results ? (
                <>
                  {results.available === false && (
                    <div className="info-box">
                      {results.message ||
                        'Automatic execution is unavailable. You can still submit your solution for mentor review.'}
                    </div>
                  )}
                  {results.message && results.available !== false && <p>{results.message}</p>}
                  {(results.results || []).map((r, i) => (
                    <div className="sample-result" key={i}>
                      <div className="section-heading">
                        <strong>Sample {i + 1}</strong>
                        <Badge
                          value={
                            r.passed === true ? 'PASSED' : r.passed === false ? 'FAILED' : r.status
                          }
                        />
                      </div>
                      <div className="form-grid">
                        <div>
                          <small>EXPECTED</small>
                          <pre>{r.expectedOutput || '(empty)'}</pre>
                        </div>
                        <div>
                          <small>YOUR OUTPUT</small>
                          <pre>{r.actualOutput || '(empty)'}</pre>
                        </div>
                      </div>
                      {r.error && <ErrorBox error={r.error} />}
                    </div>
                  ))}
                </>
              ) : (
                <div className="console-empty">
                  <Terminal size={25} />
                  <p>Run the samples to see your output here.</p>
                  <small>Sample results don’t affect your score.</small>
                </div>
              )
            ) : submissions.length ? (
              submissions.map((s) => (
                <div className="submission-entry" key={idOf(s)}>
                  <div className="section-heading">
                    <strong>Submission received</strong>
                    <Badge value={s.judgingStatus} />
                  </div>
                  <p>
                    {['EVALUATED', 'MANUALLY_GRADED'].includes(s.judgingStatus)
                      ? `Score: ${s.score ?? 0} / 30`
                      : 'Your submission is awaiting evaluation.'}
                  </p>
                  {s.feedback && <p>{s.feedback}</p>}
                  {s.judgingStatus === 'PENDING_MANUAL_REVIEW' && (
                    <p className="cyan">
                      Your mentor will review this solution. This is not a failed submission.
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="console-empty">
                <Send size={24} />
                <p>No code submitted for this problem yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
export function StudentResults() {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const inflight = useRef(false);
  async function refresh() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      setData(await api('/student/results'));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      inflight.current = false;
    }
  }
  const connected = useRealtime(refresh);
  const result = data?.result;
  return (
    <div className="student-page">
      <header className="student-header">
        <Brand />
        <Connection connected={connected} />
        <Link className="text-link" to="/join">
          Join another arena <ArrowRight size={16} />
        </Link>
      </header>
      <main className="results-main">
        <div className="results-hero">
          <span className="results-trophy">
            <Trophy size={49} />
          </span>
          <div className="eyebrow">EVERY CHALLENGE IS A STEP FORWARD</div>
          <h1>You showed up. You gave it your all.</h1>
          <p>The contest is complete. Take a moment to appreciate how far you’ve come.</p>
        </div>
        <ErrorBox error={error} />
        {!data ? (
          <Loading />
        ) : (
          <>
            {data.provisional && (
              <div className="info-box">
                These results are provisional. Some code submissions still need evaluation or mentor
                review.
              </div>
            )}
            {result && (
              <>
                <div className="results-name">
                  <h2>{result.fullName || 'Your performance'}</h2>
                  <Badge
                    value={result.gradingStatus || (data.provisional ? 'PROVISIONAL' : 'FINAL')}
                  />
                </div>
                <div className="stats-grid">
                  {[
                    ['MCQ score', `${result.mcqScore ?? 0} / 40`],
                    ['Coding 01', `${result.coding1Score ?? 0} / 30`],
                    ['Coding 02', `${result.coding2Score ?? 0} / 30`],
                    ['Total score', `${result.totalScore ?? 0} / 100`],
                  ].map(([label, value]) => (
                    <div className="panel stat-card" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <p className="results-detail muted">
                  Coding problems solved: {result.codingProblemsSolved ?? 0} / 2
                  {data.published && result.rank != null && <> · Your rank: #{result.rank}</>}
                </p>
              </>
            )}
            {data.published ? (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{data.provisional ? 'Current standings' : 'The final standings'}</h2>
                    <p>A room full of effort. A moment to celebrate.</p>
                  </div>
                  <Trophy size={21} />
                </div>
                <Leaderboard rows={data.leaderboard || []} />
              </section>
            ) : (
              <div className="panel results-waiting">
                <Lock size={30} />
                <h2>The shared leaderboard is on its way.</h2>
                <p>
                  Your own scores are shown above. Everyone’s rankings will appear as soon as your
                  mentor publishes the results.
                </p>
                <div className="waiting-indicator">
                  <span />
                  <span />
                  <span />
                  Waiting for leaderboard publication
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
