import { SvgIconComponent } from '@mui/icons-material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

// The colors are CSS variables (defined in globals.css) so the presentation view's dark theme can change them.
export function getAvatarStyle(
  pseudonym: string,
  isCurrentUser: boolean = false,
): { icon: SvgIconComponent; avatarBg: string; bubbleBg: string } {
  if (isCurrentUser) {
    return {
      icon: PersonIcon,
      avatarBg: 'var(--nx-avatar-user-bg)',
      bubbleBg: 'var(--nx-bubble-user-bg)',
    };
  }

  return {
    icon: PersonOutlineIcon, // other users
    avatarBg: 'var(--nx-avatar-other-bg)',
    bubbleBg: 'var(--nx-bubble-other-bg)',
  };
}

export function getAssistantAvatarStyle(): {
  icon: SvgIconComponent;
  avatarBg: string;
  bubbleBg: string;
} {
  return {
    icon: SmartToyIcon,
    avatarBg: 'var(--nx-avatar-assistant-bg)',
    bubbleBg: 'var(--nx-bubble-assistant-bg)',
  };
}
