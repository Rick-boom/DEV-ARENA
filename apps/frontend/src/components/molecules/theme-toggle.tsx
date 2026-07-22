import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectTheme } from '@/store/selectors.js';
import { themeToggled } from '@/store/slices/theme-slice.js';
import { ThemeMode } from '@/types/ui.types.js';

const NEXT_LABEL = {
  [ThemeMode.LIGHT]: 'Switch to dark theme',
  [ThemeMode.DARK]: 'Use system theme',
  [ThemeMode.SYSTEM]: 'Switch to light theme',
} as const;

/**
 * ThemeToggle (molecule). Cycles light → dark → system. The icon shows
 * the CURRENT mode and the aria-label states what pressing it will do —
 * the two most common ways people read a toggle.
 */
export function ThemeToggle() {
  const dispatch = useAppDispatch();
  const { mode } = useAppSelector(selectTheme);
  const Icon = mode === ThemeMode.LIGHT ? Sun : mode === ThemeMode.DARK ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => dispatch(themeToggled())}
      aria-label={NEXT_LABEL[mode]}
      title={NEXT_LABEL[mode]}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </Button>
  );
}
