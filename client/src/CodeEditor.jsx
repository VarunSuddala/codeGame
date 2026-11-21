import React from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};
loader.config({ monaco });
monaco.editor.defineTheme('codearena', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '62738e' },
    { token: 'keyword', foreground: 'b49aff' },
    { token: 'string', foreground: '7ce7c0' },
  ],
  colors: {
    'editor.background': '#0c1221',
    'editor.lineHighlightBackground': '#131c30',
    'editorLineNumber.foreground': '#47546c',
    'editorCursor.foreground': '#9c88ff',
    'editor.selectionBackground': '#40346b',
  },
});
export default function CodeEditor({ value, onChange, readOnly = false }) {
  return (
    <Editor
      height="100%"
      language="python"
      theme="codearena"
      value={value}
      onChange={(v) => onChange(v || '')}
      loading={<div className="empty">Loading editor…</div>}
      options={{
        readOnly,
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        minimap: { enabled: false },
        padding: { top: 20 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
