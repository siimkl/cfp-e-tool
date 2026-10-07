import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      'Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or leave both unset to publish the setup screen.',
    );
  if (url && (!/^https:\/\/[^/\s]+\/?$/.test(url) || /YOUR_/.test(url)))
    throw new Error(
      'Set VITE_SUPABASE_URL to your HTTPS Supabase project URL.',
    );
  if (key && !key.startsWith('sb_publishable_'))
    throw new Error(
      'The browser configuration requires a Supabase publishable key.',
    );
  if (key && /YOUR_/.test(key))
    throw new Error(
      'Replace the example publishable key with your project key.',
    );
  return { plugins: [react()], base: './' };
});
