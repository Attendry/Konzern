import { useDarkMode } from '../hooks/useDarkMode';
import '../App.css';

export function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <button
      className="dark-mode-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}