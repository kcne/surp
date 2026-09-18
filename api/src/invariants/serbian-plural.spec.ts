import { serbianPlural } from './serbian-plural';

describe('serbianPlural', () => {
  const reservations = (count: number) =>
    serbianPlural(count, 'rezervaciju', 'rezervacije', 'rezervacija');

  it('uses the singular for 1 and for counts ending in 1', () => {
    expect(reservations(1)).toBe('1 rezervaciju');
    expect(reservations(21)).toBe('21 rezervaciju');
    expect(reservations(101)).toBe('101 rezervaciju');
  });

  it('uses the paucal for 2 to 4 and for counts ending in them', () => {
    expect(reservations(2)).toBe('2 rezervacije');
    expect(reservations(4)).toBe('4 rezervacije');
    expect(reservations(23)).toBe('23 rezervacije');
    expect(reservations(93)).toBe('93 rezervacije');
  });

  it('uses the genitive plural for everything else', () => {
    expect(reservations(0)).toBe('0 rezervacija');
    expect(reservations(5)).toBe('5 rezervacija');
    expect(reservations(27)).toBe('27 rezervacija');
  });

  it('keeps the teens on the genitive plural', () => {
    expect(reservations(11)).toBe('11 rezervacija');
    expect(reservations(12)).toBe('12 rezervacija');
    expect(reservations(14)).toBe('14 rezervacija');
  });
});
