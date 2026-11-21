import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Code2, Loader2, X, AlertCircle, Radio } from 'lucide-react';
import { human, socket } from './api';
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Code2 size={24} />
      </span>
      Code<span>Arena</span>
      <i>BETA</i>
    </Link>
  );
}
export function Button({ children, busy, variant = '', className = '', ...props }) {
  return (
    <button {...props} disabled={props.disabled || busy} className={`btn ${variant} ${className}`}>
      {busy ? <Loader2 size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Badge({ value }) {
  return <span className={`badge ${String(value).toLowerCase()}`}>{human(value)}</span>;
}
export function ErrorBox({ error }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{error.message || error}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty">
      <Loader2 className="spin" />
      <p>Loading your arena…</p>
    </div>
  );
}
export function Empty({ icon: Icon = Code2, title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || 'MENTOR WORKSPACE'}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </div>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const close = useRef(),
    closeAction = useRef(onClose);
  closeAction.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    const key = (e) => {
      if (e.key === 'Escape') closeAction.current();
      if (e.key === 'Tab') {
        const els = [
          ...close.current
            .closest('[role="dialog"]')
            .querySelectorAll('button:not(:disabled),input,textarea,select,a[href]'),
        ];
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button ref={close} className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function useLoad(load, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const ref = useRef(load);
  ref.current = load;
  const refresh = async () => {
    try {
      const next = await ref.current();
      setData(next);
      setError('');
      return next;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let live = true;
    setLoading(true);
    setData(null);
    ref
      .current()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, deps);
  return { data, setData, error, setError, loading, refresh };
}
export function useRealtime(refresh, contestId) {
  const ref = useRef(refresh);
  ref.current = refresh;
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const update = () => ref.current();
    const connect = () => {
      setConnected(true);
      if (contestId) socket.emit('mentor-watch', { contestId });
      update();
    };
    const disconnect = () => setConnected(false);
    const events = [
      'contest-started',
      'contest-ended',
      'phase-changed',
      'student-joined',
      'student-disconnected',
      'leaderboard-updated',
      'evaluation-completed',
      'results-published',
      'student-progress',
    ];
    socket.on('connect', connect);
    socket.on('disconnect', disconnect);
    events.forEach((e) => socket.on(e, update));
    socket.connect();
    if (socket.connected) connect();
    const interval = setInterval(update, 2500);
    return () => {
      clearInterval(interval);
      socket.off('connect', connect);
      socket.off('disconnect', disconnect);
      events.forEach((e) => socket.off(e, update));
      socket.disconnect();
    };
  }, [contestId]);
  return connected;
}
export function Connection({ connected }) {
  return (
    <span className={`connection ${connected ? 'connected' : ''}`}>
      <Radio size={13} />
      {connected ? 'Live connection' : 'Syncing every 2.5s'}
    </span>
  );
}
export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            if (navigator.clipboard && window.isSecureContext)
              await navigator.clipboard.writeText(text);
            else {
              const input = document.createElement('textarea');
              input.value = text;
              document.body.appendChild(input);
              input.select();
              const ok = document.execCommand('copy');
              input.remove();
              if (!ok) throw Error('Copy unavailable. Select and copy the room code manually.');
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        {copied ? <Check size={16} /> : null}
        {copied ? 'Copied!' : label}
      </Button>
      <ErrorBox error={error} />
    </>
  );
}
export function Leaderboard({ rows = [] }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Participant</th>
            <th>MCQ / 40</th>
            <th>Code 01 / 30</th>
            <th>Code 02 / 30</th>
            <th>Total / 100</th>
            <th>Solved</th>
            <th>Judging</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.participantId || i}>
              <td>
                <span className={`rank rank-${row.rank || i + 1}`}>{row.rank || i + 1}</span>
              </td>
              <td>
                <strong>{row.fullName}</strong>
                {row.registerNumber && <small className="block">{row.registerNumber}</small>}
              </td>
              <td>{row.mcqScore ?? '—'}</td>
              <td>{row.coding1Score ?? '—'}</td>
              <td>{row.coding2Score ?? '—'}</td>
              <td className="score">{row.totalScore ?? '—'}</td>
              <td>{row.codingProblemsSolved ?? 0} / 2</td>
              <td>
                <Badge value={row.gradingStatus || 'PENDING'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="The leaderboard is warming up">
      <p>Scores appear here as participants complete questions.</p>
    </Empty>
  );
}
