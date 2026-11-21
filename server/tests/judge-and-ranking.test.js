import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.ONLINECOMPILER_API_KEY = '';
const { env } = await import('../config/env.js');
const { executeTest, runSample } = await import('../services/judgeService.js');
const { rankingComparator } = await import('../services/scoringService.js');
test('ranking honors total score, coding score, qualifying time and stable participant ID', () => {
  const row = (
    participantId,
    mcqScore,
    coding1Score,
    latestQualifyingAt = '2030-01-01T00:00:01Z',
  ) => ({
    participantId,
    mcqScore,
    coding1Score,
    coding2Score: 0,
    totalScore: mcqScore + coding1Score,
    latestQualifyingAt,
  });
  const rows = [
    row('f', 20, 10),
    row('e', 10, 20, '2030-01-01T00:00:02Z'),
    row('c', 10, 20),
    row('a', 10, 20),
    row('z', 30, 1),
    row('n', 0, 0, null),
  ];
  assert.deepEqual(
    rows.sort(rankingComparator).map((r) => r.participantId),
    ['z', 'a', 'c', 'e', 'f', 'n'],
  );
});
test('OnlineCompiler sends Python 3 code, weighted test requests and normalizes output', async () => {
  const originalEnv = { ...env },
    originalFetch = globalThis.fetch,
    calls = [];
  try {
    env.onlineCompilerUrl = 'https://compiler.example.invalid/api';
    env.onlineCompilerKey = 'unit-test-key';
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return Response.json({
        status: 'success',
        output: '42\r\n',
        exit_code: 0,
        time: '0.01',
        memory: '1024',
      });
    };
    const result = await executeTest('print(input())', { input: '42\n', expectedOutput: '42' });
    assert.equal(result.passed, true);
    assert.equal(result.actualOutput, '42\r\n');
    assert.equal(calls[0].url, `${env.onlineCompilerUrl}/run-code-sync/`);
    assert.equal(JSON.parse(calls[0].options.body).compiler, env.onlineCompilerCompiler);
    assert.equal(calls[0].options.headers.Authorization, 'unit-test-key');
  } finally {
    Object.assign(env, originalEnv);
    globalThis.fetch = originalFetch;
  }
});
test('provider failures fall back to manual review and never become accepted results', async () => {
  const originalEnv = { ...env },
    originalFetch = globalThis.fetch;
  try {
    env.onlineCompilerUrl = 'https://compiler.example.invalid/api';
    env.onlineCompilerKey = 'unit-test-key';
    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    const result = await runSample('print(42)', {
      sampleTestCases: [{ input: '', expectedOutput: '42' }],
    });
    assert.equal(result.available, false);
    assert.deepEqual(result.results, []);
    assert.ok(result.message.length > 0);
  } finally {
    Object.assign(env, originalEnv);
    globalThis.fetch = originalFetch;
  }
});
