import { PasswordRule } from '../types.internal';

/** Mirrors the backend's `password` validator in llm_engine, so a password that passes here is not rejected there. */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', isMet: (password) => password.length >= 8 },
  {
    id: 'letterAndNumber',
    label: 'At least 1 letter and 1 number',
    isMet: (password) => /[a-zA-Z]/.test(password) && /\d/.test(password),
  },
];

export const unmetPasswordRules = (password: string): PasswordRule[] =>
  PASSWORD_RULES.filter((rule) => !rule.isMet(password));
