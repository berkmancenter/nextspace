import { useState, useEffect } from 'react';
import { BaseComponentProps } from '../types.internal';

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
    window.addEventListener('mousemove', updateMousePosition);
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []);
  return mousePosition;
};

// Logo used for page headers
export const Logo = ({ className = '' }: BaseComponentProps) => {
  const mousePosition = useMousePosition();
  const lolz = `translate(${Math.min(
    Math.max((mousePosition.x ?? 0) * 0.007, -1),
    2,
  )}px, ${Math.min(Math.max((mousePosition.y ?? 0) * 0.005, -1), 10)}px)`;

  return (
    <div className={className}>
      <svg width="40px" height="23.881px" viewBox="0 0 40 23.881" fill="none" preserveAspectRatio="xMinYMin">
        <path
          d="M 0 11.94 C 0 5.346 5.406 0 12.075 0 L 27.925 0 C 34.594 0 40 5.346 40 11.94 L 40 23.881 L 12.075 23.881 C 5.406 23.881 0 18.535 0 11.94 Z"
          fill="#4845D2"
          id="object-0"
        ></path>
        <path
          d="M 27.925 4.478 L 12.075 4.478 C 7.907 4.478 4.528 7.819 4.528 11.94 C 4.528 16.062 7.907 19.403 12.075 19.403 L 27.925 19.403 C 32.093 19.403 35.472 16.062 35.472 11.94 C 35.472 7.819 32.093 4.478 27.925 4.478 Z"
          fill="#A5B4FC"
          id="object-1"
        ></path>
        <path
          d="M 12.075 15.672 C 14.16 15.672 15.849 14.001 15.849 11.94 C 15.849 9.88 14.16 8.209 12.075 8.209 C 9.991 8.209 8.302 9.88 8.302 11.94 C 8.302 14.001 9.991 15.672 12.075 15.672 Z"
          fill="black"
          id="object-2"
        ></path>
        <path
          d="M 10.566 11.194 C 10.983 11.194 11.321 10.86 11.321 10.448 C 11.321 10.036 10.983 9.701 10.566 9.701 C 10.149 9.701 9.811 10.036 9.811 10.448 C 9.811 10.86 10.149 11.194 10.566 11.194 Z"
          fill="white"
          id="object-3"
          style={{
            transform: lolz,
          }}
        ></path>
        <path
          d="M 28.679 15.672 C 30.763 15.672 32.453 14.001 32.453 11.94 C 32.453 9.88 30.763 8.209 28.679 8.209 C 26.595 8.209 24.906 9.88 24.906 11.94 C 24.906 14.001 26.595 15.672 28.679 15.672 Z"
          fill="black"
          id="object-4"
        ></path>
        <path
          d="M 27.17 11.194 C 27.587 11.194 27.925 10.86 27.925 10.448 C 27.925 10.036 27.587 9.701 27.17 9.701 C 26.753 9.701 26.415 10.036 26.415 10.448 C 26.415 10.86 26.753 11.194 27.17 11.194 Z"
          fill="white"
          id="object-5"
          style={{
            transform: lolz,
          }}
        ></path>
      </svg>
    </div>
  );
};

export default Logo;
