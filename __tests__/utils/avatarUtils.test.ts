import { getAssistantAvatarStyle, getAvatarStyle } from '../../utils/avatarUtils';

describe('avatarUtils', () => {
  // The presentation view's dark theme changes these colors, so they have to be theme tokens
  // (defined in globals.css) rather than fixed colors.
  it('gives the current user, other users and the assistant their own color tokens', () => {
    expect(getAvatarStyle('me', true)).toMatchObject({
      avatarBg: 'var(--nx-avatar-user-bg)',
      bubbleBg: 'var(--nx-bubble-user-bg)',
    });
    expect(getAvatarStyle('someone else')).toMatchObject({
      avatarBg: 'var(--nx-avatar-other-bg)',
      bubbleBg: 'var(--nx-bubble-other-bg)',
    });
    expect(getAssistantAvatarStyle()).toMatchObject({
      avatarBg: 'var(--nx-avatar-assistant-bg)',
      bubbleBg: 'var(--nx-bubble-assistant-bg)',
    });
  });
});
