import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  Outlet,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Library,
  Trophy,
  User,
  LogOut,
  Plus,
  ArrowRight,
  Code2,
  Users,
  Zap,
  ShieldCheck,
  Terminal,
  Menu,
  X,
  ChevronRight,
  Target,
} from 'lucide-react';
import { api } from './api';
import { Brand, Button, Field, ErrorBox, Loading } from './ui';
import { Dashboard, Contests, ContestWizard, ContestDetail, Profile } from './Mentor';
import { QuestionBank } from './Questions';
import { Join, StudentArena, StudentResults } from './Student';
const Auth = createContext(null);
export const useAuth = () => useContext(Auth);
export default function App() {
  const [mentor, setMentor] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/auth/me')
      .then((d) => setMentor(d.mentor))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return (
    <Auth.Provider value={{ mentor, setMentor, loading }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route path="/mentor" element={<MentorLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="contests" element={<Contests />} />
          <Route path="contests/new" element={<ContestWizard />} />
          <Route path="contests/:id" element={<ContestDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/join" element={<Join />} />
        <Route path="/student" element={<StudentArena />} />
        <Route path="/student/results" element={<StudentResults />} />
        <Route
          path="*"
          element={
            <div className="standalone">
              <Brand />
              <h1>This arena doesn’t exist.</h1>
              <Link className="btn" to="/">
                Back to home
              </Link>
            </div>
          }
        />
      </Routes>
    </Auth.Provider>
  );
}
function Landing() {
  const { mentor } = useAuth();
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Built for you</a>
        </div>
        <div className="row">
          <Link className="text-link" to={mentor ? '/mentor' : '/login'}>
            {mentor ? 'Dashboard' : 'Mentor log in'}
          </Link>
          <Link className="btn secondary small" to="/join">
            Join a contest <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="pill">
              <span className="dot" /> THE NEXT CHALLENGE STARTS HERE
            </div>
            <h1>
              Compete.
              <br />
              Code.
              <br />
              <span>Conquer.</span>
            </h1>
            <p>
              Turn coding practice into a shared experience. Create challenges, bring your students
              together, and watch their potential come to life.
            </p>
            <div className="hero-actions">
              <Link className="btn" to={mentor ? '/mentor' : '/register'}>
                Create your arena <ArrowRight size={18} />
              </Link>
              <Link className="btn secondary" to="/join">
                Join with a room code
              </Link>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={16} />
              <span>Your questions. Your room. Your rules.</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="CodeArena contest format illustration">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-card">
              <div className="visual-card-top">
                <span className="window-dots">● ● ●</span>
                <span>challenge.py</span>
                <Code2 size={16} />
              </div>
              <div className="code-art">
                <div>
                  <i>01</i>
                  <span className="purple">def</span> <span className="cyan">next_challenge</span>
                  (you):
                </div>
                <div>
                  <i>02</i> skills = you.<span className="cyan">learn</span>()
                </div>
                <div>
                  <i>03</i> <span className="purple">while</span> you.curious:
                </div>
                <div>
                  <i>04</i> skills += <span className="cyan">practice</span>()
                </div>
                <div>
                  <i>05</i> you.<span className="cyan">level_up</span>()
                </div>
                <div>
                  <i>06</i> <span className="purple">return</span>{' '}
                  <span className="green">"Your next level"</span>
                </div>
              </div>
              <div className="visual-terminal">
                <Terminal size={15} />
                <span>
                  Ready for your next breakthrough<span className="cursor">▌</span>
                </span>
              </div>
            </div>
            <div className="floating-card challenge-float">
              <span className="square-icon purple-bg">
                <Trophy size={23} />
              </span>
              <div>
                <strong>One shared challenge</strong>
                <small>Limitless possibilities</small>
              </div>
              <Zap className="cyan" size={18} />
            </div>
            <div className="floating-card format-float">
              <span className="dot" />
              <strong>20 MCQs</strong>
              <span className="muted">+</span>
              <strong>2 coding challenges</strong>
            </div>
            <div className="visual-caption">THINK. BUILD. COMPETE. GROW.</div>
          </div>
        </section>
        <section className="format-strip">
          <div>
            <strong>20</strong>
            <span>concept questions</span>
          </div>
          <div>
            <strong>02</strong>
            <span>coding challenges</span>
          </div>
          <div>
            <strong>
              <Zap size={28} />
            </strong>
            <span>live progress</span>
          </div>
          <div>
            <strong>
              <Users size={28} />
            </strong>
            <span>one connected room</span>
          </div>
        </section>
        <section id="features" className="landing-section">
          <div className="eyebrow">LESS SETUP. MORE SPARK.</div>
          <h2>Everything a great contest needs.</h2>
          <p>From the first question to the final leaderboard, all in one place.</p>
          <div className="feature-grid">
            {[
              {
                icon: Library,
                title: 'Your question bank',
                text: 'Build a reusable collection of concept questions and coding problems, organized your way.',
              },
              {
                icon: Zap,
                title: 'A truly live arena',
                text: 'Synchronized rounds, instant progress, and a shared room that keeps everyone on the same page.',
              },
              {
                icon: Target,
                title: 'Every effort counts',
                text: 'Sample tests, transparent judging, and mentor review give every submission a fair chance.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <article className="panel feature-card" key={title}>
                <span className="square-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="landing-section how-section">
          <div>
            <div className="eyebrow">FROM IDEA TO ARENA</div>
            <h2>
              Three steps.
              <br />A room full of possibility.
            </h2>
            <Link className="text-link cyan" to="/register">
              Get started as a mentor <ArrowRight size={16} />
            </Link>
          </div>
          <div className="steps">
            {[
              [
                'Build your challenge',
                'Pick 20 multiple-choice questions and two coding problems.',
              ],
              [
                'Bring everyone together',
                'Share a room code. Your students join without an account.',
              ],
              [
                'Let the learning begin',
                'Start the contest, follow live progress, and publish your results.',
              ],
            ].map(([title, text], i) => (
              <div className="step" key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Built for curious minds and the mentors behind them.</span>
        <Link to="/join">
          Enter the arena <ChevronRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
function AuthPage({ register = false }) {
  const { mentor, setMentor } = useAuth(),
    navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (mentor) return <Navigate to="/mentor" replace />;
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (register && form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    if (register && new TextEncoder().encode(form.password).length > 72) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }
    setBusy(true);
    try {
      const d = await api(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: form,
      });
      if (d.mentor) setMentor(d.mentor);
      else setMentor((await api('/auth/me')).mentor);
      navigate('/mentor');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="pill">
            <Code2 size={14} /> BUILT FOR MENTORS
          </span>
          <h1>
            Make room for
            <br />
            <span>the next great mind.</span>
          </h1>
          <p>Give your students a challenge worth showing up for.</p>
          <div className="auth-feature">
            <Library />A question bank that grows with you
          </div>
          <div className="auth-feature">
            <Users />
            Your own live competition room
          </div>
          <div className="auth-feature">
            <Trophy />
            Progress you can actually see
          </div>
        </div>
        <small>Every breakthrough starts with a little challenge.</small>
      </div>
      <div className="auth-form-wrap">
        <Link className="back-link" to="/">
          ← Back to CodeArena
        </Link>
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">YOUR MENTOR WORKSPACE</div>
          <h1>{register ? 'Start something great.' : 'Welcome back.'}</h1>
          <p>
            {register
              ? 'Create your account and build your first arena.'
              : 'Your next great contest is waiting for you.'}
          </p>
          <ErrorBox error={error} />
          {register && (
            <Field label="Full name">
              <input
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@college.edu"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              minLength={register ? 10 : undefined}
              maxLength={72}
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={register ? 'At least 10 characters' : 'Enter your password'}
            />
          </Field>
          {register && (
            <Field label="Confirm password">
              <input
                type="password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Enter your password again"
              />
            </Field>
          )}
          <Button busy={busy} className="full">
            {register ? 'Create mentor account' : 'Sign in to your arena'}
            <ArrowRight size={17} />
          </Button>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to CodeArena?'}{' '}
            <Link to={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="divider" />
          <p className="auth-switch">
            Here to compete? <Link to="/join">Join a contest</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
function MentorLayout() {
  const { mentor, loading, setMentor } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  useEffect(() => setOpen(false), [location.pathname]);
  if (loading) return <Loading />;
  if (!mentor) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <button
        className="mobile-menu icon-btn"
        aria-label="Toggle navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <div className="workspace-label">MENTOR WORKSPACE</div>
        <nav>
          {[
            ['/mentor', 'Overview', LayoutDashboard],
            ['/mentor/questions', 'Question bank', Library],
            ['/mentor/contests', 'My contests', Trophy],
            ['/mentor/profile', 'Profile', User],
          ].map(([to, label, Icon]) => (
            <NavLink end={to === '/mentor'} key={to} to={to}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-tip">
          <span className="square-icon">
            <Zap size={19} />
          </span>
          <h4>Set the next challenge.</h4>
          <p>
            A little competition.
            <br />A lot of possibility.
          </p>
          <Link to="/mentor/contests/new">
            Create a contest <ArrowRight size={15} />
          </Link>
        </div>
        <div className="sidebar-account">
          <span className="avatar">{mentor.name?.slice(0, 1)}</span>
          <div>
            <strong>{mentor.name}</strong>
            <small>Mentor account</small>
          </div>
          <button
            className="icon-btn"
            title="Log out"
            onClick={async () => {
              try {
                await api('/auth/logout', { method: 'POST' });
                setMentor(null);
                navigate('/');
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} />{' '}
            <strong>
              {location.pathname.includes('questions')
                ? 'Question bank'
                : location.pathname.includes('contests')
                  ? 'Contests'
                  : location.pathname.includes('profile')
                    ? 'Profile'
                    : 'Overview'}
            </strong>
          </span>
          <Link className="topbar-create" to="/mentor/contests/new">
            <Plus size={15} /> Create contest
          </Link>
        </header>
        <main className="workspace-main">
          <ErrorBox error={error} />
          <Outlet />
        </main>
        <div className="workspace-footer">
          <span>CodeArena · A space to think bigger.</span>
          <span>Learn. Challenge. Grow.</span>
        </div>
      </div>
    </div>
  );
}
