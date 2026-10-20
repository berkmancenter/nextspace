import { PASSWORD_RULES, unmetPasswordRules } from '../../utils/passwordRules';

describe('unmetPasswordRules', () => {
  it('returns no rules for a password the backend accepts', () => {
    expect(unmetPasswordRules('abcdefg1')).toEqual([]);
  });

  it('flags a password shorter than 8 characters', () => {
    expect(unmetPasswordRules('abc1').map((rule) => rule.id)).toEqual(['length']);
  });

  it('flags a password with no number', () => {
    expect(unmetPasswordRules('abcdefgh').map((rule) => rule.id)).toEqual(['letterAndNumber']);
  });

  it('flags a password with no letter', () => {
    expect(unmetPasswordRules('12345678').map((rule) => rule.id)).toEqual(['letterAndNumber']);
  });

  it('flags every rule for an empty password', () => {
    expect(unmetPasswordRules('')).toEqual(PASSWORD_RULES);
  });
});
