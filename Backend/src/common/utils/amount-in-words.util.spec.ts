import { amountInWords } from './amount-in-words.util';

describe('amountInWords', () => {
  // The figure from the receipt this format was taken from — if nothing else
  // passes, this one must.
  it('matches the sample receipt', () => {
    expect(amountInWords(36700)).toBe(
      'Rupees Thirty Six Thousand Seven Hundred Only',
    );
  });

  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only');
  });

  it.each([
    [1, 'Rupees One Only'],
    [15, 'Rupees Fifteen Only'],
    [20, 'Rupees Twenty Only'],
    [42, 'Rupees Forty Two Only'],
    [100, 'Rupees One Hundred Only'],
    [101, 'Rupees One Hundred One Only'],
    [999, 'Rupees Nine Hundred Ninety Nine Only'],
    [1000, 'Rupees One Thousand Only'],
    [30400, 'Rupees Thirty Thousand Four Hundred Only'],
  ])('spells %i', (amount, expected) => {
    expect(amountInWords(amount)).toBe(expected);
  });

  // Indian grouping is the whole point: 120000 is "One Lakh Twenty Thousand",
  // never "One Hundred Twenty Thousand".
  describe('groups by lakh and crore, not thousand and million', () => {
    it.each([
      [100000, 'Rupees One Lakh Only'],
      [120000, 'Rupees One Lakh Twenty Thousand Only'],
      [250000, 'Rupees Two Lakh Fifty Thousand Only'],
      [1000000, 'Rupees Ten Lakh Only'],
      [10000000, 'Rupees One Crore Only'],
      [12345678, 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only'],
    ])('spells %i', (amount, expected) => {
      expect(amountInWords(amount)).toBe(expected);
    });

    it('recurses past ninety-nine crore', () => {
      expect(amountInWords(1_000_000_000)).toBe('Rupees One Hundred Crore Only');
    });
  });

  describe('paise', () => {
    it('stays silent when there are none', () => {
      expect(amountInWords(500)).toBe('Rupees Five Hundred Only');
    });

    it('spells them when there are', () => {
      expect(amountInWords(500.5)).toBe('Rupees Five Hundred and Fifty Paise Only');
      expect(amountInWords(1234.56)).toBe(
        'Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only',
      );
    });

    // Float arithmetic upstream must not leak "Ninety Nine Paise" onto a
    // receipt whose figures read as a round number.
    it('rounds rather than truncating', () => {
      expect(amountInWords(0.1 + 0.2)).toBe('Rupees Zero and Thirty Paise Only');
      expect(amountInWords(99.999)).toBe('Rupees One Hundred Only');
    });
  });

  describe('degrades safely', () => {
    it('treats a non-finite amount as zero', () => {
      expect(amountInWords(NaN)).toBe('Rupees Zero Only');
      expect(amountInWords(Infinity)).toBe('Rupees Zero Only');
    });

    // A refund line should read as negative rather than silently flipping sign.
    it('marks a negative amount', () => {
      expect(amountInWords(-500)).toBe('Minus Rupees Five Hundred Only');
    });
  });
});
