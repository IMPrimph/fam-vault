import { useSyncExternalStore } from 'react'
import { subscribeTheme, getTheme, setTheme, cycleTheme, THEMES } from '../lib/theme'

/**
 * Reads from the shared theme store rather than holding local state.
 *
 * The sidebar and the mobile header each mount their own toggle. With
 * per-instance useState they drifted apart — one would still believe the theme
 * was light after the other had changed it. A single external store keeps every
 * consumer in sync, which matters more now that there are three themes to
 * cycle through.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light')

  return {
    theme,
    themes: THEMES,
    setTheme,
    cycleTheme,
    isDark: theme === 'dark',
  }
}
