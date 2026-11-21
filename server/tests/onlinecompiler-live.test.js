import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { executeTest } from '../services/judgeService.js';

test(
  'live OnlineCompiler Python 3 call',
  { skip: !env.onlineCompilerKey ? 'ONLINECOMPILER_API_KEY is not configured' : false },
  async () => {
    const result = await executeTest('print(2 + 3)', { input: '', expectedOutput: '5\\n' });
    assert.equal(result.passed, true);
    assert.equal(result.status, 'success');
  },
);
