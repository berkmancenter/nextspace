import { useState, useEffect } from "react";
import { BaseComponentProps } from "../types.internal";

// Can't forget the easter egg!
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({
    x: null,
    y: null,
  });
  useEffect(() => {
    const updateMousePosition = (ev: { clientX: any; clientY: any }) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);
  return mousePosition;
};

// Logo used for page headers
export const Logo = ({ className = "" }: BaseComponentProps) => {
  const mousePosition = useMousePosition();
  const lolz = `translate(${Math.min(
    Math.max((mousePosition.x ?? 0) * 0.007, -1),
    5
  )}px, ${Math.min(Math.max((mousePosition.y ?? 0) * 0.005, -1), 10)}px)`;

  return (
    <div className={className}>
      <svg width="67" height="40" viewBox="0 0 67 40" fill="none">
        <path
          d="M0 20C0 8.9543 9.05567 0 20.2264 0H46.7736C57.9444 0 67 8.9543 67 20V40H20.2264C9.05567 40 0 31.0457 0 20Z"
          fill="#4845D2"
        />
        <path
          d="M46.7736 7.5H20.2264C13.2447 7.5 7.58491 13.0964 7.58491 20C7.58491 26.9036 13.2447 32.5 20.2264 32.5H46.7736C53.7553 32.5 59.4151 26.9036 59.4151 20C59.4151 13.0964 53.7553 7.5 46.7736 7.5Z"
          fill="#A5B4FC"
        />
        <path
          d="M20.2264 26.25C23.7173 26.25 26.5472 23.4518 26.5472 20C26.5472 16.5482 23.7173 13.75 20.2264 13.75C16.7356 13.75 13.9057 16.5482 13.9057 20C13.9057 23.4518 16.7356 26.25 20.2264 26.25Z"
          fill="black"
        />
        <path
          d="M17.6981 18.75C18.3963 18.75 18.9623 18.1904 18.9623 17.5C18.9623 16.8096 18.3963 16.25 17.6981 16.25C16.9999 16.25 16.434 16.8096 16.434 17.5C16.434 18.1904 16.9999 18.75 17.6981 18.75Z"
          fill="white"
          style={{
            transform: lolz,
          }}
        />
        <path
          d="M48.0377 26.25C51.5286 26.25 54.3585 23.4518 54.3585 20C54.3585 16.5482 51.5286 13.75 48.0377 13.75C44.5469 13.75 41.717 16.5482 41.717 20C41.717 23.4518 44.5469 26.25 48.0377 26.25Z"
          fill="black"
        />
        <path
          d="M45.5094 18.75C46.2076 18.75 46.7736 18.1904 46.7736 17.5C46.7736 16.8096 46.2076 16.25 45.5094 16.25C44.8113 16.25 44.2453 16.8096 44.2453 17.5C44.2453 18.1904 44.8113 18.75 45.5094 18.75Z"
          fill="white"
          style={{
            transform: lolz,
          }}
        />
      </svg>
    </div>
  );
};

export default Logo;
