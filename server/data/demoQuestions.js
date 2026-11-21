// Server-only seed content: never import this module into the browser bundle.
const mcq = (
  title,
  description,
  difficulty,
  category,
  options,
  correctOptionIndex,
  explanation,
) => ({
  type: 'MCQ',
  title,
  description,
  difficulty,
  category,
  options,
  correctOptionIndex,
  explanation,
  maxScore: 2,
});

export const demoQuestions = [
  mcq(
    '01 · Python variables',
    'What is printed?\nx = 7\nx = "seven"\nprint(type(x).__name__)',
    'EASY',
    'Variables',
    ['int', 'str', 'float', 'An error occurs'],
    1,
    'A name can be rebound to a different type. Its final value is a string.',
  ),
  mcq(
    '02 · Arithmetic operators',
    'What is printed?\nprint(17 // 5, 17 % 5)',
    'EASY',
    'Arithmetic operators',
    ['3 2', '3.4 2', '2 3', '3 3'],
    0,
    'Integer floor division gives 3 and the remainder is 2: 17 = 3 * 5 + 2.',
  ),
  mcq(
    '03 · Lists',
    'What is printed?\nvalues = [4, 8]\nvalues.append(12)\nprint(len(values), values[-1])',
    'EASY',
    'Lists',
    ['2 8', '3 8', '3 12', '2 12'],
    2,
    'append adds one element. The list has three elements and -1 selects the last.',
  ),
  mcq(
    '04 · Tuples',
    'Which expression creates a tuple containing exactly one integer?',
    'EASY',
    'Tuples',
    ['(5)', '[5]', '{5}', '(5,)'],
    3,
    'The comma creates a one-element tuple; parentheses alone only group an expression.',
  ),
  mcq(
    '05 · Dictionaries',
    'What is printed?\nscores = {"Ada": 10}\nprint(scores.get("Lin", 0))',
    'EASY',
    'Dictionaries',
    ['None', '0', '10', 'KeyError'],
    1,
    'dict.get returns the supplied default when the key is absent without inserting the key.',
  ),
  mcq(
    '06 · Sets',
    'What is printed?\nprint(len({1, 1, 2, 3, 3}))',
    'EASY',
    'Sets',
    ['5', '2', '3', 'An error occurs'],
    2,
    'A set retains distinct values only: 1, 2, and 3.',
  ),
  mcq(
    '07 · For loops',
    'What is printed?\ntotal = 0\nfor i in range(1, 4):\n    total += i\nprint(total)',
    'EASY',
    'For loops',
    ['6', '10', '3', '4'],
    0,
    'range excludes its stop value, so the loop adds 1 + 2 + 3.',
  ),
  mcq(
    '08 · While loops',
    'What is printed?\nn = 3\nwhile n > 0:\n    n -= 1\nprint(n)',
    'EASY',
    'While loops',
    ['3', '1', '-1', '0'],
    3,
    'The loop decrements n to zero and then its condition becomes false.',
  ),
  mcq(
    '09 · Functions',
    'What is printed?\ndef add_item(item, items=None):\n    if items is None:\n        items = []\n    items.append(item)\n    return items\nprint(add_item(1))\nprint(add_item(2))',
    'MEDIUM',
    'Functions',
    ['[1] then [1, 2]', '[1] then [2]', '[2] then [2]', 'An error occurs'],
    1,
    'Each omitted items argument becomes None, so a fresh list is created for each call.',
  ),
  mcq(
    '10 · Recursion',
    'What does f(4) return?\ndef f(n):\n    if n == 0:\n        return 0\n    return n + f(n - 1)',
    'MEDIUM',
    'Recursion',
    ['4', '24', '10', 'Infinite recursion'],
    2,
    'The recursive calls sum 4 + 3 + 2 + 1 + 0. The n == 0 branch terminates recursion.',
  ),
  mcq(
    '11 · Strings',
    'What is printed?\ntext = "arena"\ntext.replace("a", "A")\nprint(text)',
    'MEDIUM',
    'Strings',
    ['Arena', 'ArenA', 'An error occurs', 'arena'],
    3,
    'Strings are immutable. replace returns a new string, but its result was not assigned.',
  ),
  mcq(
    '12 · List slicing',
    'What is printed?\nprint([0, 1, 2, 3, 4, 5][1:5:2])',
    'MEDIUM',
    'List slicing',
    ['[1, 3]', '[1, 3, 5]', '[2, 4]', '[1, 2, 3, 4]'],
    0,
    'The slice starts at index 1, excludes index 5, and takes every second element.',
  ),
  mcq(
    '13 · References and mutability',
    'What is printed?\na = [[1], [2]]\nb = a[:]\nb[0].append(3)\nb.append([4])\nprint(a)',
    'HARD',
    'References and mutability',
    ['[[1], [2]]', '[[1, 3], [2], [4]]', '[[1, 3], [2]]', '[[1], [2], [4]]'],
    2,
    'Slicing copies the outer list but shares the inner lists. Mutating b[0] affects a[0]; appending to b does not affect a.',
  ),
  mcq(
    '14 · Exception handling',
    'What is printed?\ntry:\n    int("x")\nexcept ValueError:\n    print("bad")\nelse:\n    print("ok")\nfinally:\n    print("done")',
    'MEDIUM',
    'Exception handling',
    ['ok then done', 'bad then done', 'bad only', 'done only'],
    1,
    'int raises ValueError, so except runs and else does not. finally runs afterward.',
  ),
  mcq(
    '15 · Time complexity',
    'For a positive integer n, how many iterations does this loop perform asymptotically?\ni = 1\nwhile i < n:\n    i *= 2',
    'HARD',
    'Time complexity',
    ['Theta(n)', 'Theta(n log n)', 'Theta(n squared)', 'Theta(log n)'],
    3,
    'i doubles each iteration. Reaching n takes approximately log base 2 of n iterations.',
  ),
  mcq(
    '16 · Arrays',
    'A Python list is used as a dynamic array. Which operation is O(n) in the worst case for a list of length n?',
    'MEDIUM',
    'Arrays',
    ['Reading values[0]', 'Reading values[-1]', 'Inserting at index 0', 'Calling len(values)'],
    2,
    'Inserting at the front shifts the existing elements. Index access and length lookup are constant time.',
  ),
  mcq(
    '17 · Searching',
    'A binary search maintains a candidate interval [lo, hi) in a sorted list. When values[mid] < target, which update safely discards mid and all smaller candidates?',
    'MEDIUM',
    'Searching',
    ['lo = mid + 1', 'hi = mid', 'lo = mid', 'hi = mid - 1'],
    0,
    'Every element up to and including mid is smaller than target, so the next candidate starts at mid + 1.',
  ),
  mcq(
    '18 · Sorting',
    'What is printed?\nitems = [("A", 2), ("B", 1), ("C", 2)]\nitems.sort(key=lambda item: item[1])\nprint([name for name, score in items])',
    'HARD',
    'Sorting',
    ['["B", "C", "A"]', '["A", "B", "C"]', '["C", "A", "B"]', '["B", "A", "C"]'],
    3,
    'Python sorting is stable: equal-key items A and C retain their original relative order.',
  ),
  mcq(
    '19 · Stack and queue',
    'Which collections.deque operations implement a FIFO queue when new items are added on the right?',
    'MEDIUM',
    'Stack and queue',
    ['append and pop', 'append and popleft', 'appendleft and popleft', 'pop and popleft'],
    1,
    'append adds on the right and popleft removes the oldest item from the left, both in O(1) time.',
  ),
  mcq(
    '20 · Debugging and logic',
    'What is printed?\nfuncs = [lambda: i for i in range(3)]\nprint([f() for f in funcs])',
    'HARD',
    'Debugging and logic',
    ['[0, 1, 2]', '[0, 0, 0]', '[2, 2, 2]', 'NameError'],
    2,
    'Closures look up the shared captured variable when called. The comprehension has finished with i equal to 2. lambda i=i: i would capture each current value.',
  ),
  {
    type: 'CODING',
    title: 'Second Largest Distinct Number',
    difficulty: 'MEDIUM',
    category: 'Arrays and searching',
    description:
      'Given N integers, find the second largest distinct element. Repeated copies of the maximum do not count as a second distinct number. If fewer than two distinct values exist, output NONE.',
    inputFormat:
      'The first line contains N. The next line contains N space-separated integers; arbitrary whitespace between integers is accepted.',
    outputFormat: 'Print the second largest distinct integer, or NONE if it does not exist.',
    constraints: '1 <= N <= 100000; -1000000000 <= each integer <= 1000000000.',
    explanation:
      'For 10 20 20 7 5, the distinct values in decreasing order are 20, 10, 7, 5. The answer is 10.',
    sampleTestCases: [
      { input: '5\n10 20 20 7 5\n', expectedOutput: '10', weight: 1 },
      { input: '3\n4 4 4\n', expectedOutput: 'NONE', weight: 1 },
    ],
    hiddenTestCases: [
      { input: '1\n42\n', expectedOutput: 'NONE', weight: 3 },
      { input: '5\n-8 -3 -3 -10 -5\n', expectedOutput: '-5', weight: 4 },
      { input: '6\n7 7 7 7 7 7\n', expectedOutput: 'NONE', weight: 3 },
      { input: '6\n0 -1 0 -2 -1 -3\n', expectedOutput: '-1', weight: 3 },
      { input: '2\n-1000000000 1000000000\n', expectedOutput: '-1000000000', weight: 3 },
      { input: '7\n9 8 9 8 1 9 2\n', expectedOutput: '8', weight: 3 },
      { input: '6\n1 2 3 4 5 6\n', expectedOutput: '5', weight: 3 },
      {
        input: `10000\n${Array.from({ length: 10000 }, (_, i) => i - 5000).join(' ')}\n`,
        expectedOutput: '4998',
        weight: 4,
      },
      {
        input: `20000\n${Array.from({ length: 20000 }, (_, i) => (i === 19999 ? -1 : 999)).join(' ')}\n`,
        expectedOutput: '-1',
        weight: 4,
      },
    ],
    referenceSolution: `import sys

def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n = data[0]
    largest = None
    second = None
    for value in data[1:n + 1]:
        if largest is None or value > largest:
            second, largest = largest, value
        elif value != largest and (second is None or value > second):
            second = value
    print("NONE" if second is None else second)

if __name__ == "__main__":
    main()
`,
    maxScore: 30,
  },
  {
    type: 'CODING',
    title: 'Balanced Brackets',
    difficulty: 'MEDIUM',
    category: 'Stack and strings',
    description:
      'Given a string containing only (, ), {, }, [, and ], determine whether every opening bracket has a matching closing bracket in the correct nesting order. An empty string is balanced.',
    inputFormat:
      'One line containing the bracket string. An empty line represents an empty string. The line-ending newline is not part of the string.',
    outputFormat: 'Print YES if the brackets are balanced; otherwise print NO.',
    constraints: '0 <= string length <= 100000; every character is one of (){}[].',
    explanation: '([{}]) is correctly nested. ([)] is invalid because ) cannot close [.',
    sampleTestCases: [
      { input: '([{}])\n', expectedOutput: 'YES', weight: 1 },
      { input: '([)]\n', expectedOutput: 'NO', weight: 1 },
    ],
    hiddenTestCases: [
      { input: '\n', expectedOutput: 'YES', weight: 3 },
      { input: ')\n', expectedOutput: 'NO', weight: 3 },
      { input: '((\n', expectedOutput: 'NO', weight: 3 },
      { input: '()[]{}\n', expectedOutput: 'YES', weight: 3 },
      { input: '{[()()]([])}\n', expectedOutput: 'YES', weight: 3 },
      { input: '[(])\n', expectedOutput: 'NO', weight: 3 },
      { input: '())(\n', expectedOutput: 'NO', weight: 3 },
      { input: `${'('.repeat(50000)}${')'.repeat(50000)}`, expectedOutput: 'YES', weight: 3 },
      { input: `${'[]'.repeat(49999)}[}`, expectedOutput: 'NO', weight: 3 },
      { input: '['.repeat(100000), expectedOutput: 'NO', weight: 3 },
    ],
    referenceSolution: `import sys

def main():
    text = sys.stdin.readline().rstrip("\\r\\n")
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for char in text:
        if char in "([{":
            stack.append(char)
        elif not stack or stack.pop() != pairs[char]:
            print("NO")
            return
    print("YES" if not stack else "NO")

if __name__ == "__main__":
    main()
`,
    maxScore: 30,
  },
];
