import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectTheme, selectUser } from '@/store/selectors.js';
import { themeSet } from '@/store/slices/theme-slice.js';
import { useAuth } from '@/hooks/use-auth.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { ThemeMode } from '@/types/ui.types.js';
import { cn } from '@/utils/cn.js';

const THEME_OPTIONS = [
  { mode: ThemeMode.LIGHT, label: 'Light' },
  { mode: ThemeMode.DARK, label: 'Dark' },
  { mode: ThemeMode.SYSTEM, label: 'System' },
] as const;

/** Settings: appearance and session controls owned by this shell. */
export function SettingsPage() {
  useDocumentTitle('Settings');
  const dispatch = useAppDispatch();
  const { mode } = useAppSelector(selectTheme);
  const user = useAppSelector(selectUser);
  const { logout } = useAuth();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>System follows your device setting automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Theme" className="flex gap-2">
            {THEME_OPTIONS.map((option) => {
              const active = mode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => dispatch(themeSet(option.mode))}
                  className={cn(
                    'flex-1 rounded-lg border px-4 py-2.5 text-[13px] transition-colors',
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => void logout()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
