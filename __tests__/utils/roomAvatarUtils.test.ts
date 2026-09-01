import { getRoomInitials, getRoomNameInitials } from '../../utils/roomAvatarUtils';

describe('getRoomInitials', () => {
  it('returns the first letter of the first and last word for a two-word name', () => {
    expect(getRoomInitials('Priya Raghunathan')).toBe('PR');
  });

  it('uppercases initials from a lowercase name', () => {
    expect(getRoomInitials('miriam halevi')).toBe('MH');
  });

  it('uses the first and last word for a three-word name', () => {
    expect(getRoomInitials('Ravi Kumar Deshpande')).toBe('RD');
  });

  it('handles a single-word name by taking its first two letters', () => {
    expect(getRoomInitials('Berkie')).toBe('BE');
  });

  it('handles a single-letter name', () => {
    expect(getRoomInitials('X')).toBe('X');
  });

  it('handles accented characters', () => {
    expect(getRoomInitials('Lucía Navarro')).toBe('LN');
  });

  it('collapses extra whitespace between words', () => {
    expect(getRoomInitials('  Priya   Raghunathan  ')).toBe('PR');
  });

  it('returns an empty string for an empty name', () => {
    expect(getRoomInitials('')).toBe('');
  });
});

describe('getRoomNameInitials', () => {
  it('takes the first letter of each of the first two words', () => {
    expect(getRoomNameInitials('Digital Rights Reading Group')).toBe('DR');
  });

  it('takes the first two letters when the first word is an acronym', () => {
    expect(getRoomNameInitials('BKC Community Room')).toBe('BK');
  });

  it('treats a trailing acronym as an ordinary word', () => {
    expect(getRoomNameInitials('Algorithmic Accountability WG')).toBe('AA');
  });

  it('handles a single-word name by taking its first two letters', () => {
    expect(getRoomNameInitials('Commons')).toBe('CO');
  });

  it('collapses extra whitespace between words', () => {
    expect(getRoomNameInitials('  Platform   Governance  Cohort ')).toBe('PG');
  });

  it('returns an empty string for an empty name', () => {
    expect(getRoomNameInitials('')).toBe('');
  });
});
