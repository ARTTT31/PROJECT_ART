import {
  ALL_PERIOD,
  type FinanceEntry,
  categoryTotals,
  dayLabel,
  filterByPeriod,
  filterEntries,
  groupByDay,
  monthKeyOf,
  monthLabel,
  monthOptions,
  monthlySeries,
  parseAmountInput,
  summarize,
  toCsv,
} from './summary';

const entry = (
  id: string,
  date: string,
  amount: number,
  type: FinanceEntry['type'] = 'expense',
): FinanceEntry => ({ id, type, label: id, amount, date });

const NOW = new Date(2026, 9, 30); // 30 Oct 2026

describe('monthKeyOf', () => {
  it('keeps the year and month of a dated entry', () => {
    expect(monthKeyOf('2026-10-30')).toBe('2026-10');
  });

  it('rejects unusable values instead of guessing', () => {
    expect(monthKeyOf('')).toBe('');
    expect(monthKeyOf(undefined)).toBe('');
    expect(monthKeyOf('30/10/2026')).toBe('');
  });
});

describe('monthOptions', () => {
  it('always offers the current month, newest first', () => {
    const options = monthOptions(
      [entry('a', '2026-08-01', 100), entry('b', '2026-10-29', 50)],
      NOW,
    );
    expect(options.map((option) => option.key)).toEqual(['2026-10', '2026-08']);
  });

  it('does not duplicate a month that already has entries', () => {
    const options = monthOptions([entry('a', '2026-10-01', 100)], NOW);
    expect(options.map((option) => option.key)).toEqual(['2026-10']);
  });

  it('labels months in Thai', () => {
    expect(monthLabel('2026-01')).toContain('มกราคม');
  });
});

describe('filterByPeriod', () => {
  const entries = [
    entry('sep', '2026-09-05', 100),
    entry('oct1', '2026-10-01', 200),
    entry('oct2', '2026-10-30', 300),
  ];

  it('keeps only the selected month', () => {
    expect(filterByPeriod(entries, '2026-10').map((e) => e.id)).toEqual(['oct1', 'oct2']);
  });

  it('returns everything for the all-time period', () => {
    expect(filterByPeriod(entries, ALL_PERIOD)).toHaveLength(3);
  });
});

describe('summarize', () => {
  it('splits income from expense and rounds to satang', () => {
    const totals = summarize([
      entry('i1', '2026-10-01', 1000.1, 'income'),
      entry('i2', '2026-10-02', 0.2, 'income'),
      entry('e1', '2026-10-02', 300.05),
    ]);
    expect(totals).toEqual({ income: 1000.3, expense: 300.05, balance: 700.25, count: 3 });
  });

  it('reports a negative balance when spending wins', () => {
    expect(
      summarize([entry('e', '2026-10-01', 50), entry('i', '2026-10-01', 20, 'income')]),
    ).toEqual({ income: 20, expense: 50, balance: -30, count: 2 });
  });

  it('is empty for no entries', () => {
    expect(summarize([])).toEqual({ income: 0, expense: 0, balance: 0, count: 0 });
  });
});

describe('groupByDay', () => {
  it('groups per day, newest day first', () => {
    const days = groupByDay(
      [
        entry('old', '2026-10-28', 10),
        entry('new1', '2026-10-30', 20, 'income'),
        entry('new2', '2026-10-30', 5),
      ],
      NOW,
    );

    expect(days.map((day) => day.date)).toEqual(['2026-10-30', '2026-10-28']);
    expect(days[0].income).toBe(20);
    expect(days[0].expense).toBe(5);
    expect(days[0].label).toBe('วันนี้');
  });

  it('names yesterday, then falls back to a dated label', () => {
    expect(dayLabel('2026-10-29', NOW)).toBe('เมื่อวาน');
    expect(dayLabel('2026-10-01', NOW)).toContain('ต.ค.');
  });
});

describe('monthlySeries', () => {
  it('returns six calendar months, oldest first, with per-month totals', () => {
    const series = monthlySeries(
      [
        entry('may', '2026-05-02', 400),
        entry('oct1', '2026-10-01', 100, 'income'),
        entry('oct2', '2026-10-20', 60),
        entry('outside', '2026-01-01', 999),
      ],
      6,
      NOW,
    );

    expect(series.map((point) => point.key)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(series[0].expense).toBe(400);
    expect(series[5]).toMatchObject({ income: 100, expense: 60 });
    expect(series[1]).toMatchObject({ income: 0, expense: 0 });
  });

  it('rolls back across a year boundary', () => {
    const series = monthlySeries([], 3, new Date(2026, 0, 15));
    expect(series.map((point) => point.key)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('parseAmountInput', () => {
  it('accepts plain and thousands-separated amounts', () => {
    expect(parseAmountInput('35.5')).toBe(35.5);
    expect(parseAmountInput('1,200')).toBe(1200);
    expect(parseAmountInput(' 1,200.50 ')).toBe(1200.5);
  });

  it('rejects trailing garbage that parseFloat used to accept', () => {
    expect(parseAmountInput('12abc')).toBeNull();
    expect(parseAmountInput('1.2.3')).toBeNull();
    expect(parseAmountInput('1.234')).toBeNull();
  });

  it('rejects zero, negatives and amounts above the server cap', () => {
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
    expect(parseAmountInput('1000000001')).toBeNull();
    expect(parseAmountInput('')).toBeNull();
  });
});

describe('filterEntries', () => {
  const entries = [
    { ...entry('a', '2026-10-01', 100), label: 'ข้าวผัด', category: 'อาหาร' },
    { ...entry('b', '2026-10-02', 50, 'income'), label: 'เงินเดือน', category: 'เงินเดือน' },
  ];

  it('filters by type', () => {
    expect(filterEntries(entries, { type: 'income' }).map((e) => e.id)).toEqual(['b']);
  });

  it('searches labels and categories, case-insensitively', () => {
    expect(filterEntries(entries, { search: 'ข้าว' }).map((e) => e.id)).toEqual(['a']);
    expect(filterEntries(entries, { search: 'อาหาร' }).map((e) => e.id)).toEqual(['a']);
    expect(filterEntries(entries, { search: '' })).toHaveLength(2);
  });

  it('combines search and type', () => {
    expect(filterEntries(entries, { search: 'เงิน', type: 'expense' })).toEqual([]);
  });
});

describe('categoryTotals', () => {
  it('groups by category, biggest first, and keeps uncategorised rows', () => {
    const rows = categoryTotals([
      entry('a', '2026-10-01', 100),
      { ...entry('b', '2026-10-02', 60), category: 'อาหาร' },
      { ...entry('c', '2026-10-03', 45), category: 'อาหาร' },
      entry('income', '2026-10-04', 500, 'income'),
    ]);

    expect(rows).toEqual([
      { category: 'อาหาร', total: 105, count: 2 },
      { category: 'ไม่ระบุหมวด', total: 100, count: 1 },
    ]);
  });

  it('can break down income instead', () => {
    const rows = categoryTotals(
      [
        { ...entry('i', '2026-10-01', 900, 'income'), category: 'เงินเดือน' },
        entry('e', '2026-10-01', 100),
      ],
      'income',
    );

    expect(rows).toEqual([{ category: 'เงินเดือน', total: 900, count: 1 }]);
  });
});

describe('toCsv', () => {
  it('writes a quoted header and quotes free-text cells', () => {
    const csv = toCsv([
      {
        id: 'a',
        type: 'expense',
        label: 'ข้าวผัด "พิเศษ", ไข่ดาว',
        amount: 65.5,
        date: '2026-10-02',
        category: 'อาหาร',
      },
    ]).split('\r\n');

    expect(csv[0]).toBe('"วันที่","ประเภท","หมวดหมู่","รายการ","จำนวนเงิน"');
    expect(csv[1]).toBe('"2026-10-02","รายจ่าย","อาหาร","ข้าวผัด ""พิเศษ"", ไข่ดาว","65.50"');
  });

  it('sorts newest day first and leaves a missing category empty', () => {
    const csv = toCsv([entry('old', '2026-09-01', 10), entry('new', '2026-10-01', 20)]).split(
      '\r\n',
    );

    expect(csv[1]).toContain('2026-10-01');
    expect(csv[2]).toContain('2026-09-01');
    expect(csv[1]).toContain('"",');
  });
});
