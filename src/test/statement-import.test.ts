import { describe, expect, it } from 'vitest';
import { parseStatementText } from '@/lib/statement-import';

describe('parseStatementText', () => {
  it('parses common CSV statement columns into entries', () => {
    const csv = [
      'Date,Description,Debit,Credit',
      '04/20/2026,STARBUCKS,12.45,',
      '04/21/2026,PAYROLL,,2400.00',
    ].join('\n');

    const result = parseStatementText(csv);

    expect(result.warnings).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      date: '2026-04-20',
      description: 'STARBUCKS',
      amount: 12.45,
      type: 'expense',
    });
    expect(result.entries[1]).toMatchObject({
      date: '2026-04-21',
      description: 'PAYROLL',
      amount: 2400,
      type: 'income',
    });
  });

  it('parses pasted statement lines with trailing debit and credit markers', () => {
    const text = [
      '04/22/2026 UBER TRIP 18.70 DR',
      '04/23/2026 INTEREST CREDIT 2.31 CR',
    ].join('\n');

    const result = parseStatementText(text);

    expect(result.warnings).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      date: '2026-04-22',
      description: 'UBER TRIP',
      amount: 18.7,
      type: 'expense',
    });
    expect(result.entries[1]).toMatchObject({
      date: '2026-04-23',
      description: 'INTEREST CREDIT',
      amount: 2.31,
      type: 'income',
    });
  });
});
