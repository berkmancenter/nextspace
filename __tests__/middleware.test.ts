/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import decryptCookie from '../utils/Decrypt';
import { CURRENT_COOKIE_VERSION } from '../utils/cookieValidator';

let mockSessionToken: string | undefined;
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (mockSessionToken ? { value: mockSessionToken } : undefined),
  }),
}));

jest.mock('../utils/Decrypt', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function signInAs(authType: 'guest' | 'user' | 'admin') {
  mockSessionToken = 'encrypted-session';
  (decryptCookie as jest.Mock).mockResolvedValue({
    payload: {
      access: 'access-token',
      refresh: 'refresh-token',
      userId: 'user-123',
      authType,
      version: CURRENT_COOKIE_VERSION,
    },
  });
}

function visit(path: string) {
  return middleware(new NextRequest(`http://localhost:8080${path}`));
}

describe('middleware on admin routes', () => {
  beforeEach(() => {
    mockSessionToken = undefined;
    (decryptCookie as jest.Mock).mockReset();
  });

  it('lets an admin through', async () => {
    signInAs('admin');

    const response = await visit('/admin/events');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });

  it('shows a logged-in non-admin the not-found page, keeping the address they typed', async () => {
    signInAs('user');

    const response = await visit('/admin/events');

    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:8080/404');
    expect(response.headers.get('location')).toBeNull();
  });

  it('sends a guest to sign up', async () => {
    signInAs('guest');

    const response = await visit('/admin/events');

    expect(response.headers.get('location')).toBe('http://localhost:8080/signup');
  });

  it('sends a visitor with no session to sign up', async () => {
    const response = await visit('/admin/events');

    expect(response.headers.get('location')).toBe('http://localhost:8080/signup');
  });

  it('clears a cookie from an older version and sends the visitor to sign up', async () => {
    mockSessionToken = 'encrypted-session';
    (decryptCookie as jest.Mock).mockResolvedValue({
      payload: {
        access: 'access-token',
        refresh: 'refresh-token',
        userId: 'user-123',
        authType: 'admin',
        version: '1',
      },
    });

    const response = await visit('/admin/events');

    expect(response.headers.get('location')).toBe('http://localhost:8080/signup');
    expect(response.headers.get('set-cookie')).toMatch(/nextspace-session=;.*Max-Age=0/i);
  });
});

describe('middleware on other routes', () => {
  beforeEach(() => {
    mockSessionToken = undefined;
    (decryptCookie as jest.Mock).mockReset();
  });

  it('lets a logged-in non-admin through to the hallway and their rooms', async () => {
    signInAs('user');

    for (const path of ['/hallway', '/room/abc123']) {
      const response = await visit(path);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
    }
  });
});
