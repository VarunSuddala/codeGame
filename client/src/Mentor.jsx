import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Plus,
  Trophy,
  Users,
  Library,
  Activity,
  Clock,
  Search,
  Code2,
  ListChecks,
  ChevronRight,
  Check,
  Play,
  Square,
  Download,
  Send,
  Eye,
  CheckCircle2,
  ShieldCheck,
  Mail,
  User,
} from 'lucide-react';
import { api, API_BASE, date, human, idOf, isLive, isOver } from './api';
import { useAuth } from './App';
import {
  PageHead,
  Button,
  Badge,
  Empty,
  Loading,
  ErrorBox,
  Field,
  Modal,
  useLoad,
  useRealtime,
  Connection,
  CopyButton,
  Leaderboard,
} from './ui';
export function Dashboard() {
  const { mentor } = useAuth();
  const { data, error, loading } = useLoad(async () => {
    const [c, q] = await Promise.all([api('/contests'), api('/questions')]);
    return { contests: c.contests, questions: q.questions };
  }, []);
  const contests = data?.contests || [],
    questions = data?.questions || [];
  return (
    <>
      <PageHead
        eyebrow="LET’S BUILD SOMETHING GREAT"
        title={`Welcome back, ${mentor.name.split(' ')[0]}.`}
        description="A new day. A new challenge. A chance to make a difference."
      >
        <Link className="btn" to="/mentor/contests/new">
          <Plus size={17} />
          Create contest
        </Link>
      </PageHead>
      <ErrorBox error={error} />
      <div className="dashboard-banner">
        <div>
          <span className="pill">
            <span className="dot" /> YOUR NEXT GREAT CONTEST
          </span>
          <h2>Give curiosity a place to compete.</h2>
          <p>Pick your questions. Open your room. Let great minds do their thing.</p>
          <Link to="/mentor/contests/new" className="btn light">
            Build a new arena <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art">
          <div className="trophy-orbit" />
          <Trophy size={89} strokeWidth={1.2} />
          <span className="spark spark-one">+</span>
          <span className="spark spark-two">✦</span>
          <Code2 className="banner-code" size={30} />
        </div>
      </div>
      <div className="stats-grid">
        {[
          [Trophy, 'Total contests', contests.length, 'Your challenges, all in one place'],
          [
            Activity,
            'Live right now',
            contests.filter((c) => isLive(c.status)).length,
            'Competition in motion',
          ],
          [
            Library,
            'Question bank',
            questions.length,
            `${questions.filter((q) => q.type === 'MCQ').length} MCQ · ${questions.filter((q) => q.type === 'CODING').length} coding`,
          ],
          [
            Users,
            'Total participants',
            contests.reduce((n, c) => n + (c.participantCount || 0), 0),
            'Across all your arenas',
          ],
        ].map(([Icon, label, value, sub], i) => (
          <div className="panel stat-card" key={label}>
            <div>
              <span>{label}</span>
              <span className={`square-icon tone-${i}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong>{loading ? '—' : value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent contests</h2>
              <p>Your arenas at a glance</p>
            </div>
            <Link to="/mentor/contests" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {loading ? (
            <Loading />
          ) : contests.length ? (
            <div className="contest-list">
              {contests.slice(0, 5).map((c) => (
                <Link key={idOf(c)} className="contest-list-row" to={`/mentor/contests/${idOf(c)}`}>
                  <span className="square-icon">
                    <Trophy size={20} />
                  </span>
                  <div>
                    <strong>{c.title}</strong>
                    <small>
                      {date(c.createdAt)} · {c.roomCode}
                    </small>
                  </div>
                  <Badge value={c.status} />
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={Trophy} title="Your first arena is waiting">
              <p>Create a contest and invite your students.</p>
              <Link to="/mentor/contests/new" className="text-link cyan">
                Create a contest <ArrowRight size={16} />
              </Link>
            </Empty>
          )}
        </section>
        <section className="panel quick-start">
          <div className="panel-heading">
            <div>
              <h2>Make it happen</h2>
              <p>A few good places to start</p>
            </div>
            <span>✦</span>
          </div>
          {[
            [
              Library,
              'Grow your question bank',
              'Add something worth thinking about.',
              '/mentor/questions',
            ],
            [
              Plus,
              'Create a new contest',
              '20 MCQs. 2 problems. One challenge.',
              '/mentor/contests/new',
            ],
            [Users, 'Join as a participant', 'Step into the student experience.', '/join'],
          ].map(([Icon, title, desc, to]) => (
            <Link key={to} to={to}>
              <span className="square-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
          <div className="mentor-note">
            <ShieldCheck size={18} />
            <p>Every contest is private to your workspace. You decide when results go live.</p>
          </div>
        </section>
      </div>
    </>
  );
}
export function Contests() {
  const { data, error, loading } = useLoad(() => api('/contests'));
  const [tab, setTab] = useState('all'),
    [search, setSearch] = useState('');
  const contests = (data?.contests || []).filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) &&
      (tab === 'all' ||
        (tab === 'live'
          ? isLive(c.status)
          : tab === 'completed'
            ? isOver(c.status)
            : !isLive(c.status) && !isOver(c.status))),
  );
  return (
    <>
      <PageHead
        title="Your arenas, all here."
        description="Create the challenge. Bring people together. See what happens."
      >
        <Link to="/mentor/contests/new" className="btn">
          <Plus size={17} />
          Create contest
        </Link>
      </PageHead>
      <div className="list-toolbar">
        <div className="tabs">
          {['all', 'waiting', 'live', 'completed'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {human(t)}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search contests"
            placeholder="Find a contest…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : contests.length ? (
        <div className="contest-grid">
          {contests.map((c) => (
            <Link to={`/mentor/contests/${idOf(c)}`} className="panel contest-card" key={idOf(c)}>
              <div className="section-heading">
                <span className="square-icon">
                  <Trophy />
                </span>
                <Badge value={c.status} />
              </div>
              <h2>{c.title}</h2>
              <p>{c.description || 'Your next challenge awaits.'}</p>
              <div className="contest-meta">
                <span>
                  <ListChecks size={15} />
                  20 MCQs
                </span>
                <span>
                  <Code2 size={15} />2 coding
                </span>
              </div>
              <div className="contest-card-bottom">
                <span>
                  ROOM <strong>{c.roomCode}</strong>
                </span>
                <ArrowRight size={19} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty icon={Trophy} title="No contests here yet">
            <p>Build your next challenge in just a few steps.</p>
            <Link className="btn" to="/mentor/contests/new">
              <Plus size={16} />
              Create contest
            </Link>
          </Empty>
        </div>
      )}
    </>
  );
}
export function ContestWizard() {
  const navigate = useNavigate();
  const { data, error, loading } = useLoad(() => api('/questions'));
  const [step, setStep] = useState(0),
    [form, setForm] = useState({ title: '', description: '', requireRegisterNumber: true }),
    [selected, setSelected] = useState([]),
    [search, setSearch] = useState(''),
    [type, setType] = useState('MCQ'),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState('');
  const questions = data?.questions || [],
    chosen = selected.map((id) => questions.find((q) => idOf(q) === id)).filter(Boolean),
    mcq = chosen.filter((q) => q.type === 'MCQ'),
    coding = chosen.filter((q) => q.type === 'CODING');
  const valid = mcq.length === 20 && coding.length === 2;
  function toggle(q) {
    setFailure('');
    const id = idOf(q);
    if (selected.includes(id)) setSelected(selected.filter((v) => v !== id));
    else if ((q.type === 'MCQ' ? mcq.length : coding.length) < (q.type === 'MCQ' ? 20 : 2))
      setSelected([...selected, id]);
    else
      setFailure(
        `You already selected ${q.type === 'MCQ' ? '20 MCQs' : '2 coding problems'}. Remove one to choose another.`,
      );
  }
  async function create() {
    setBusy(true);
    setFailure('');
    try {
      const d = await api('/contests', {
        method: 'POST',
        body: { ...form, questionIds: [...mcq, ...coding].map(idOf) },
      });
      navigate(`/mentor/contests/${idOf(d.contest)}`);
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title="Build your next arena"
        description="A great challenge starts with a little intention."
      />
      <div className="wizard-steps">
        {['The essentials', 'Choose questions', 'Ready to launch'].map((s, i) => (
          <div className={step >= i ? 'active' : ''} key={s}>
            <span>{step > i ? <Check size={15} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <ErrorBox error={error || failure} />
      {step === 0 ? (
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(1);
          }}
        >
          <div className="section-heading">
            <h2>Give your contest an identity</h2>
            <Trophy className="purple" />
          </div>
          <p className="muted">
            Something memorable. Something your students will want to be part of.
          </p>
          <Field label="Contest title">
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. The Friday Code Challenge"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What’s the challenge? Who’s it for?"
            />
          </Field>
          <label className="checkbox-panel">
            <input
              type="checkbox"
              checked={form.requireRegisterNumber}
              onChange={(e) => setForm({ ...form, requireRegisterNumber: e.target.checked })}
            />
            <div>
              <strong>Ask for a register number</strong>
              <small>Help identify students in the final results and CSV export.</small>
            </div>
          </label>
          <div className="modal-actions">
            <Link className="btn secondary" to="/mentor/contests">
              Cancel
            </Link>
            <Button>
              Choose questions <ArrowRight size={17} />
            </Button>
          </div>
        </form>
      ) : step === 1 ? (
        <>
          <div className="selection-summary">
            <div>
              <ListChecks />
              <strong>
                {mcq.length}
                <span>/20</span>
              </strong>
              <span>MCQs selected</span>
            </div>
            <div>
              <Code2 />
              <strong>
                {coding.length}
                <span>/2</span>
              </strong>
              <span>Coding problems selected</span>
            </div>
            <p>
              Questions run in the order you select them,
              <br />
              with coding problems after the MCQs.
            </p>
          </div>
          <div className="panel">
            <div className="filter-bar">
              <div className="tabs">
                <button className={type === 'MCQ' ? 'active' : ''} onClick={() => setType('MCQ')}>
                  Multiple choice
                </button>
                <button
                  className={type === 'CODING' ? 'active' : ''}
                  onClick={() => setType('CODING')}
                >
                  Coding problems
                </button>
              </div>
              <div className="search-input">
                <Search size={16} />
                <input
                  aria-label="Search available questions"
                  placeholder="Find the right challenge…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {loading ? (
              <Loading />
            ) : (
              questions
                .filter(
                  (q) =>
                    q.type === type &&
                    `${q.title} ${q.category}`.toLowerCase().includes(search.toLowerCase()),
                )
                .map((q) => (
                  <label
                    className={`pick-question ${selected.includes(idOf(q)) ? 'selected' : ''}`}
                    key={idOf(q)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(idOf(q))}
                      onChange={() => toggle(q)}
                    />
                    <div>
                      <strong>{q.title}</strong>
                      <small>{q.category || 'General'}</small>
                    </div>
                    <Badge value={q.difficulty} />
                    {selected.includes(idOf(q)) && (
                      <span className="selection-number">
                        {chosen
                          .filter((c) => c.type === q.type)
                          .findIndex((c) => idOf(c) === idOf(q)) + 1}
                      </span>
                    )}
                  </label>
                ))
            )}
            {!loading && !questions.some((q) => q.type === type) && (
              <Empty title="Add questions to get started">
                <Link className="text-link cyan" to="/mentor/questions">
                  Open question bank <ArrowRight size={16} />
                </Link>
              </Empty>
            )}
          </div>
          <div className="wizard-actions">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={!valid} onClick={() => setStep(2)}>
              Review contest <ArrowRight size={17} />
            </Button>
          </div>
        </>
      ) : (
        <div className="panel form-panel">
          <div className="review-hero">
            <span className="empty-icon">
              <Trophy size={34} />
            </span>
            <h2>{form.title}</h2>
            <p>{form.description || 'A fresh challenge for curious minds.'}</p>
          </div>
          <div className="review-details">
            <span>
              Multiple-choice questions<strong>20</strong>
            </span>
            <span>
              Coding challenges<strong>2</strong>
            </span>
            <span>
              Duration<strong>45 minutes</strong>
            </span>
            <span>
              Total marks<strong>100</strong>
            </span>
            <span>
              Register number<strong>{form.requireRegisterNumber ? 'Required' : 'Optional'}</strong>
            </span>
          </div>
          <h3>Question sequence</h3>
          <ol className="question-sequence">
            {[...mcq, ...coding].map((q) => (
              <li key={idOf(q)}>
                <span>{q.title}</span>
                <Badge value={q.type} />
              </li>
            ))}
          </ol>
          <div className="info-box">
            20 MCQs × 45 seconds (2 marks each), followed by 2 coding problems × 15 minutes (30
            marks each). Total: 45 minutes and 100 marks. Creating the contest opens a waiting room;
            you choose when to start.
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back to questions
            </Button>
            <Button busy={busy} disabled={!valid} onClick={create}>
              Create contest <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
export function ContestDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('participants'),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [confirm, setConfirm] = useState(null),
    [inspect, setInspect] = useState(null);
  const inflight = useRef(false);
  async function refresh() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const [c, p, l, s, m] = await Promise.all([
        api(`/contests/${id}`),
        api(`/contests/${id}/participants`),
        api(`/contests/${id}/leaderboard`),
        api(`/contests/${id}/submissions`),
        api(`/contests/${id}/monitoring`),
      ]);
      setData({
        contest: c.contest,
        participants: p.participants,
        leaderboard: l.leaderboard,
        published: l.published,
        provisional: l.provisional,
        submissions: s.submissions,
        monitoring: m.monitoring,
      });
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      inflight.current = false;
    }
  }
  const connected = useRealtime(refresh, id);
  async function action(name) {
    setBusy(name);
    setError('');
    try {
      await api(`/contests/${id}/${name}`, { method: 'POST' });
      setConfirm(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function download() {
    setBusy('export');
    try {
      const r = await fetch(`${API_BASE}/contests/${id}/export`, { credentials: 'include' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw Error(d.message || d.error || 'Could not export results.');
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `codearena-${data.contest.roomCode}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  if (!data)
    return (
      <>
        <ErrorBox error={error} />
        <Loading />
      </>
    );
  const { contest, participants = [], leaderboard = [], submissions = [], monitoring = [] } = data;
  const ended = isOver(contest.status),
    live = isLive(contest.status);
  return (
    <>
      <Link className="back-link" to="/mentor/contests">
        ← All contests
      </Link>
      <PageHead eyebrow="YOUR LIVE ARENA" title={contest.title} description={contest.description}>
        <Badge value={contest.status} />
        <Connection connected={connected} />
      </PageHead>
      <ErrorBox error={error} />
      <div className="room-banner">
        <div>
          <span className="eyebrow">INVITE YOUR PARTICIPANTS</span>
          <div className="room-code">{contest.roomCode}</div>
          <small>Share this code or send a direct invitation link.</small>
        </div>
        <div className="room-actions">
          <CopyButton text={contest.roomCode} label="Copy code" />
          <CopyButton
            text={`${location.origin}/join?room=${contest.roomCode}`}
            label="Copy invite link"
          />
          {!live && !ended && (
            <Button busy={busy === 'start'} onClick={() => setConfirm('start')}>
              <Play size={16} />
              Start contest
            </Button>
          )}
          {live && (
            <Button variant="danger" onClick={() => setConfirm('end')}>
              <Square size={16} />
              End contest
            </Button>
          )}
          {ended && (
            <Button
              disabled={data.published}
              busy={busy === 'publish'}
              onClick={() => setConfirm('publish')}
            >
              <Send size={16} />
              {data.published ? 'Results published' : 'Publish results'}
            </Button>
          )}
        </div>
      </div>
      <div className="stats-grid">
        <Metric icon={Users} label="Participants" value={participants.length} />
        <Metric
          icon={Activity}
          label="Connected"
          value={participants.filter((p) => p.isConnected || p.connected || p.online).length}
        />
        <Metric icon={Code2} label="Code submissions" value={submissions.length} />
        <Metric
          icon={Clock}
          label="Awaiting review"
          value={submissions.filter((s) => s.judgingStatus === 'PENDING_MANUAL_REVIEW').length}
        />
      </div>
      <section className="panel">
        <div className="monitor-toolbar">
          <div className="tabs">
            {['participants', 'monitoring', 'leaderboard', 'submissions'].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
                {human(t)}
              </button>
            ))}
          </div>
          <Button variant="ghost small" onClick={download} busy={busy === 'export'}>
            <Download size={16} />
            Export CSV
          </Button>
        </div>
        {tab === 'monitoring' ? (
          monitoring.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Register number</th>
                    <th>Current question</th>
                    <th>Answered</th>
                    <th>Tab switches</th>
                    <th>Exam status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.map((p) => (
                    <tr key={idOf(p)}>
                      <td>{p.fullName}</td>
                      <td>{p.registerNumber || '—'}</td>
                      <td>
                        {p.currentQuestionIndex == null
                          ? '—'
                          : `Question ${p.currentQuestionIndex + 1}`}
                      </td>
                      <td>{p.answered}</td>
                      <td>{p.violationCount}/3</td>
                      <td>
                        <Badge value={p.examStatus} />
                      </td>
                      <td>{p.submissionReason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Users} title="No students yet">
              <p>Monitoring will appear when students join.</p>
            </Empty>
          )
        ) : tab === 'participants' ? (
          participants.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Register number</th>
                    <th>Connection</th>
                    <th>Joined</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={idOf(p)}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar small">{p.fullName?.[0]}</span>
                          <strong>{p.fullName}</strong>
                        </div>
                      </td>
                      <td>{p.registerNumber || '—'}</td>
                      <td>
                        <Badge
                          value={p.isConnected || p.connected || p.online ? 'CONNECTED' : 'OFFLINE'}
                        />
                      </td>
                      <td>{date(p.joinedAt || p.createdAt)}</td>
                      <td>
                        {p.currentQuestionIndex != null
                          ? `Question ${p.currentQuestionIndex + 1}`
                          : '—'}
                        {p.progress && <small className="block">{p.progress}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Users} title="Your room is ready">
              <p>Share the room code and watch your participants arrive.</p>
            </Empty>
          )
        ) : tab === 'leaderboard' ? (
          <>
            {data.provisional && (
              <div className="info-box inset">
                Scores are provisional while the contest is live or submissions still need review.
              </div>
            )}
            <Leaderboard rows={leaderboard} />
          </>
        ) : submissions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Problem</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Submitted</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={idOf(s)}>
                    <td>
                      <strong>
                        {s.participantId?.fullName ||
                          participants.find((p) => idOf(p) === idOf(s.participantId))?.fullName ||
                          'Participant'}
                      </strong>
                      <small className="block">{s.participantId?.registerNumber}</small>
                    </td>
                    <td>
                      {s.questionTitle ||
                        s.question?.title ||
                        `Coding ${(s.questionIndex ?? 20) - 19}`}
                    </td>
                    <td>
                      <Badge value={s.judgingStatus} />
                    </td>
                    <td>{s.score ?? '—'}</td>
                    <td>{date(s.submittedAt || s.createdAt)}</td>
                    <td>
                      <Button variant="ghost small" onClick={() => setInspect(s)}>
                        <Eye size={15} />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Code2} title="Waiting for the first submission">
            <p>Code submissions and judging status will appear here.</p>
          </Empty>
        )}
      </section>
      {confirm && (
        <Modal
          title={
            confirm === 'start'
              ? 'Ready to start the contest?'
              : confirm === 'end'
                ? 'End the contest now?'
                : 'Publish the leaderboard?'
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === 'start'
              ? 'All participants will begin together. The server controls question timing, and completed questions cannot be revisited.'
              : confirm === 'end'
                ? 'The contest will stop for every participant. They will no longer be able to submit answers.'
                : data.provisional
                  ? 'Some submissions are still being reviewed. Published scores will remain provisional until judging finishes.'
                  : 'Participants will be able to view their scores and the shared leaderboard.'}
          </p>
          <ErrorBox error={error} />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === 'end' ? 'danger' : ''}
              busy={!!busy}
              onClick={() => action(confirm)}
            >
              {human(confirm)} contest{confirm === 'publish' ? ' results' : ''}
            </Button>
          </div>
        </Modal>
      )}
      {inspect && (
        <SubmissionReview
          submission={inspect}
          onClose={() => setInspect(null)}
          onSaved={() => {
            setInspect(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
function Metric({ icon: Icon, label, value }) {
  return (
    <div className="panel stat-card">
      <div>
        <span>{label}</span>
        <span className="square-icon">
          <Icon size={19} />
        </span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}
function SubmissionReview({ submission: s, onClose, onSaved }) {
  const [score, setScore] = useState(s.score ?? ''),
    [feedback, setFeedback] = useState(s.manualGrade?.feedback || s.feedback || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      wide
      title={`Submission · ${s.participantId?.fullName || 'Participant'}`}
      onClose={onClose}
    >
      <div className="section-heading">
        <Badge value={s.judgingStatus} />
        <small>{date(s.submittedAt || s.createdAt)}</small>
      </div>
      <h3>Submitted source</h3>
      <pre className="source-code">
        {s.sourceCode || s.code || 'Source code is not available in this submission.'}
      </pre>
      {(s.manualGrade?.feedback || s.feedback) && (
        <div className="info-box">{s.manualGrade?.feedback || s.feedback}</div>
      )}
      {(s.testResults || s.results)?.length > 0 && (
        <div className="test-results">
          {(s.testResults || s.results).map((r, i) => (
            <div key={i}>
              <strong>Test {i + 1}</strong>
              <Badge value={r.status || 'PENDING'} />
              {r.actualOutput != null && <pre>{r.actualOutput}</pre>}
            </div>
          ))}
        </div>
      )}
      {s.judgingStatus === 'PENDING_MANUAL_REVIEW' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api(`/submissions/${idOf(s)}/manual-grade`, {
                method: 'POST',
                body: { score: Number(score), feedback },
              });
              onSaved();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Mentor review</h3>
          <p className="muted">
            Assign a score after inspecting the solution. This updates the leaderboard.
          </p>
          <ErrorBox error={error} />
          <div className="form-grid">
            <Field label="Score (out of 30)">
              <input
                type="number"
                min="0"
                max={30}
                step="0.01"
                required
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </Field>
            <Field label="Feedback">
              <textarea
                required
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Explain your assessment…"
              />
            </Field>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={onClose}>
              Close
            </Button>
            <Button busy={busy}>
              <CheckCircle2 size={17} />
              Save grade
            </Button>
          </div>
        </form>
      )}
      {s.judgingStatus !== 'PENDING_MANUAL_REVIEW' && (
        <div className="info-box">
          {s.judgingStatus === 'EVALUATED' || s.judgingStatus === 'MANUALLY_GRADED'
            ? `Graded: ${s.score ?? 0} / 30 points.`
            : 'This submission is being evaluated. Manual grading becomes available if automatic judging cannot finish.'}
        </div>
      )}
    </Modal>
  );
}
export function Profile() {
  const { mentor } = useAuth();
  return (
    <>
      <PageHead
        title="Your mentor profile"
        description="The person behind the next great challenge."
      />
      <div className="panel profile-card">
        <span className="avatar large">{mentor.name?.[0]}</span>
        <h2>{mentor.name}</h2>
        <Badge value="MENTOR" />
        <div className="profile-details">
          <div>
            <User size={18} />
            <span>
              Full name<strong>{mentor.name}</strong>
            </span>
          </div>
          <div>
            <Mail size={18} />
            <span>
              Email address<strong>{mentor.email}</strong>
            </span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>
              Workspace access<strong>Your own questions and contests</strong>
            </span>
          </div>
        </div>
        <p className="muted">Your account details identify your private mentor workspace.</p>
        <Link className="btn secondary" to="/mentor">
          Back to overview <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
