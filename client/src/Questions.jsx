import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Library,
  Code2,
  ListChecks,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  Upload,
  Download,
} from 'lucide-react';
import { api, API_BASE, idOf, human } from './api';
import { PageHead, Button, Badge, Empty, Loading, ErrorBox, Field, Modal, useLoad } from './ui';
const blankQuestion = (type) => ({
  type,
  title: '',
  description: '',
  difficulty: 'EASY',
  category: '',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  explanation: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  sampleTestCases: [{ input: '', expectedOutput: '', weight: 1 }],
  hiddenTestCases: [{ input: '', expectedOutput: '', weight: 30 }],
  referenceSolution: '',
});
export function QuestionBank() {
  const [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [difficulty, setDifficulty] = useState(''),
    [category, setCategory] = useState(''),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState('');
  const [importing, setImporting] = useState(false);
  const { data, error, loading, refresh } = useLoad(() => api('/questions'), []);
  const questions = data?.questions || [];
  const filtered = questions.filter(
    (q) =>
      (!type || q.type === type) &&
      (!difficulty || q.difficulty === difficulty) &&
      (!category || q.category === category) &&
      `${q.title} ${q.description} ${q.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Your question bank"
        description="Good questions spark great thinking. Build your collection."
      >
        <div className="row">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <Upload size={16} /> Import Markdown
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = `${API_BASE}/questions/export-markdown`;
            }}
          >
            <Download size={16} /> Export Markdown
          </Button>
          <Button onClick={() => setEditing(blankQuestion('MCQ'))}>
            <Plus size={17} /> Add question
          </Button>
        </div>
      </PageHead>
      <div className="stat-row compact">
        <div className="mini-stat">
          <Library size={19} />
          <strong>{questions.length}</strong>
          <span>Total questions</span>
        </div>
        <div className="mini-stat">
          <ListChecks size={19} />
          <strong>{questions.filter((q) => q.type === 'MCQ').length}</strong>
          <span>Multiple choice</span>
        </div>
        <div className="mini-stat">
          <Code2 size={19} />
          <strong>{questions.filter((q) => q.type === 'CODING').length}</strong>
          <span>Coding problems</span>
        </div>
      </div>
      <div className="panel">
        <div className="filter-bar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search questions"
              placeholder="Search your questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select aria-label="Question type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="MCQ">Multiple choice</option>
            <option value="CODING">Coding</option>
          </select>
          <select
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">All difficulties</option>
            {['EASY', 'MEDIUM', 'HARD'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {[...new Set(questions.map((q) => q.category).filter(Boolean))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <ErrorBox error={error || actionError} />
        {loading ? (
          <Loading />
        ) : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Difficulty</th>
                  <th>Category</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={idOf(q)}>
                    <td>
                      <button
                        className="question-title"
                        onClick={async () => {
                          try {
                            setEditing((await api(`/questions/${idOf(q)}`)).question);
                          } catch (e) {
                            setActionError(e.message);
                          }
                        }}
                      >
                        {q.title}
                      </button>
                      <small className="truncate">{q.description}</small>
                    </td>
                    <td>
                      <span className="type-label">
                        {q.type === 'MCQ' ? <ListChecks size={15} /> : <Code2 size={15} />}{' '}
                        {q.type === 'MCQ' ? 'MCQ' : 'Coding'}
                      </span>
                    </td>
                    <td>
                      <Badge value={q.difficulty} />
                    </td>
                    <td className="muted">{q.category || 'General'}</td>
                    <td>
                      <div className="row">
                        <button
                          className="icon-btn"
                          title={`Edit ${q.title}`}
                          onClick={async () => {
                            try {
                              setEditing((await api(`/questions/${idOf(q)}`)).question);
                            } catch (e) {
                              setActionError(e.message);
                            }
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn danger-text"
                          title={`Delete ${q.title}`}
                          onClick={() => {
                            setActionError('');
                            setDeleting(q);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Library}
            title={
              questions.length ? 'No matching questions' : 'Your next great question starts here'
            }
          >
            <p>
              {questions.length
                ? 'Try a different search or filter.'
                : 'Add MCQs and coding problems to build your first contest.'}
            </p>
            <Button variant="secondary" onClick={() => setEditing(blankQuestion('MCQ'))}>
              <Plus size={16} />
              Add a question
            </Button>
          </Empty>
        )}
        <div className="panel-footer">
          {filtered.length} question{filtered.length === 1 ? '' : 's'} in your collection
        </div>
      </div>
      {editing && (
        <QuestionForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {importing && (
        <MarkdownImport
          onClose={() => setImporting(false)}
          onSaved={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
      {deleting && (
        <Modal title="Delete this question?" onClose={() => setDeleting(null)}>
          <p>
            “{deleting.title}” will be removed from your question bank. Existing contest snapshots
            are kept.
          </p>
          <ErrorBox error={actionError} />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/questions/${idOf(deleting)}`, { method: 'DELETE' });
                  setDeleting(null);
                  refresh();
                } catch (e) {
                  setActionError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete question
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function MarkdownImport({ onClose, onSaved }) {
  const [files, setFiles] = useState([]),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function previewFiles() {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      files.forEach((file) => body.append('files', file));
      const r = await fetch(`${API_BASE}/questions/preview-import`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || 'Could not parse Markdown.');
      setPreview(d.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      files.forEach((file) => body.append('files', file));
      const r = await fetch(`${API_BASE}/questions/import-markdown`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || d.errors?.[0]?.message || 'Import failed.');
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import Markdown questions" onClose={onClose}>
      <p>
        Use YAML front matter and separate multiple questions with{' '}
        <code>&lt;!-- CODEARENA:QUESTION --&gt;</code>.
      </p>
      <input
        type="file"
        accept=".md,text/markdown"
        multiple
        onChange={(e) => setFiles([...e.target.files])}
      />
      <ErrorBox error={error} />
      {preview && (
        <div className="import-preview">
          <strong>{preview.length} question(s) parsed</strong>
          {preview.map((q, i) => (
            <div key={i}>
              <Badge value={q.type} /> <strong>{q.title}</strong>
              <small className="block">{q.description.slice(0, 160)}</small>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="ghost" busy={busy} disabled={!files.length} onClick={previewFiles}>
          Preview
        </Button>
        <Button busy={busy} disabled={!preview?.length} onClick={save}>
          Import selected
        </Button>
      </div>
    </Modal>
  );
}
function QuestionForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...blankQuestion(initial.type), ...initial }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const edit = !!idOf(initial);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key, label, area = false, required = true, hint) => (
    <Field label={label} hint={hint}>
      {area ? (
        <textarea
          required={required}
          rows={key === 'description' ? 4 : 3}
          value={form[key] || ''}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          required={required}
          value={form[key] || ''}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (
        form.type === 'CODING' &&
        Math.abs(form.hiddenTestCases.reduce((n, t) => n + Number(t.weight), 0) - 30) > 0.001
      )
        throw Error('Hidden test weights must total exactly 30 points.');
      if (form.type === 'MCQ' && new Set(form.options.map((o) => o.trim())).size !== 4)
        throw Error('Provide four distinct answer options.');
      await api(edit ? `/questions/${idOf(initial)}` : `/questions/${form.type.toLowerCase()}`, {
        method: edit ? 'PUT' : 'POST',
        body: form,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={edit ? 'Edit question' : 'Create a question'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        {!edit && (
          <div className="segmented">
            <button
              type="button"
              className={form.type === 'MCQ' ? 'active' : ''}
              onClick={() =>
                setForm({
                  ...blankQuestion('MCQ'),
                  title: form.title,
                  description: form.description,
                  category: form.category,
                  difficulty: form.difficulty,
                })
              }
            >
              <ListChecks size={17} />
              Multiple choice
            </button>
            <button
              type="button"
              className={form.type === 'CODING' ? 'active' : ''}
              onClick={() =>
                setForm({
                  ...blankQuestion('CODING'),
                  title: form.title,
                  description: form.description,
                  category: form.category,
                  difficulty: form.difficulty,
                })
              }
            >
              <Code2 size={17} />
              Coding problem
            </button>
          </div>
        )}
        {text('title', 'Question title')}
        {text('description', form.type === 'MCQ' ? 'Question prompt' : 'Problem statement', true)}
        <div className="form-grid">
          <Field label="Difficulty">
            <select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {['EASY', 'MEDIUM', 'HARD'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {text('category', 'Category')}
        </div>
        {form.type === 'MCQ' ? (
          <>
            <div className="field">
              <span>
                Answer options <small>Choose the correct answer</small>
              </span>
              {form.options.map((option, i) => (
                <div
                  className={`answer-edit ${Number(form.correctOptionIndex) === i ? 'correct' : ''}`}
                  key={i}
                >
                  <input
                    type="radio"
                    name="correctAnswer"
                    aria-label={`Option ${i + 1} is correct`}
                    checked={Number(form.correctOptionIndex) === i}
                    onChange={() => set('correctOptionIndex', i)}
                  />
                  <span>{String.fromCharCode(65 + i)}</span>
                  <input
                    required
                    aria-label={`Answer option ${i + 1}`}
                    value={option}
                    onChange={(e) =>
                      set(
                        'options',
                        form.options.map((o, n) => (n === i ? e.target.value : o)),
                      )
                    }
                  />
                  {Number(form.correctOptionIndex) === i && <CheckCircle2 size={18} />}
                </div>
              ))}
            </div>
            {text('explanation', 'Explanation', true, false)}
          </>
        ) : (
          <>
            <div className="form-grid">
              {text('inputFormat', 'Input format', true)}
              {text('outputFormat', 'Output format', true)}
            </div>
            {text('constraints', 'Constraints', true)}
            <TestCases
              label="Sample test cases"
              cases={form.sampleTestCases}
              onChange={(v) => set('sampleTestCases', v)}
            />
            <TestCases
              label="Hidden test cases"
              cases={form.hiddenTestCases}
              onChange={(v) => set('hiddenTestCases', v)}
            />
            {text(
              'referenceSolution',
              'Reference solution (Python)',
              true,
              false,
              'For mentor review only. Never shown to participants.',
            )}
          </>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy}>{edit ? 'Save changes' : 'Add to question bank'}</Button>
        </div>
      </form>
    </Modal>
  );
}
function TestCases({ label, cases = [], onChange }) {
  return (
    <div className="test-cases">
      <div className="section-heading">
        <h3>
          {label}
          {label.startsWith('Hidden') && (
            <small className="block">
              {cases.reduce((n, t) => n + Number(t.weight), 0)} / 30 points · weights must total 30
            </small>
          )}
        </h3>
        <Button
          type="button"
          variant="ghost small"
          onClick={() => onChange([...cases, { input: '', expectedOutput: '', weight: 1 }])}
        >
          <Plus size={15} />
          Add test
        </Button>
      </div>
      {cases.map((c, i) => (
        <div className="test-case-edit" key={i}>
          <div className="section-heading">
            <small>CASE {i + 1}</small>
            <button
              type="button"
              disabled={cases.length === 1}
              className="icon-btn"
              aria-label={`Remove ${label} ${i + 1}`}
              onClick={() => onChange(cases.filter((_, n) => n !== i))}
            >
              <X size={15} />
            </button>
          </div>
          <div className="form-grid">
            <Field label="Input">
              <textarea
                rows={2}
                value={c.input}
                onChange={(e) =>
                  onChange(cases.map((t, n) => (n === i ? { ...t, input: e.target.value } : t)))
                }
              />
            </Field>
            <Field label="Expected output">
              <textarea
                rows={2}
                value={c.expectedOutput}
                onChange={(e) =>
                  onChange(
                    cases.map((t, n) => (n === i ? { ...t, expectedOutput: e.target.value } : t)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Weight">
            <input
              type="number"
              min="0.01"
              max="30"
              step="0.01"
              required
              value={c.weight ?? 1}
              onChange={(e) =>
                onChange(
                  cases.map((t, n) => (n === i ? { ...t, weight: Number(e.target.value) } : t)),
                )
              }
            />
          </Field>
        </div>
      ))}
    </div>
  );
}
