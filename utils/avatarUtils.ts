import { SvgIconComponent } from "@mui/icons-material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";

export function getAvatarStyle(
  pseudonym: string,
  isCurrentUser: boolean = false
): { icon: SvgIconComponent; avatarBg: string; bubbleBg: string } {
  if (isCurrentUser) {
    return {
      icon: PersonIcon,
      avatarBg: "#F1D2D6",
      bubbleBg: "#F1D2D6",
    };
  }

  return {
    icon: PersonOutlineIcon, // other users
    avatarBg: "#FAE8C6",
    bubbleBg: "#FAE8C6",
  };
}

export function getAssistantAvatarStyle(): {
  icon: SvgIconComponent;
  avatarBg: string;
  bubbleBg: string;
} {
  return {
    icon: SmartToyIcon,
    avatarBg: "#DDD6FE",
    bubbleBg: "#DDD6FE",
  };
}
