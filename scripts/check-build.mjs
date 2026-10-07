import { readdirSync, readFileSync } from 'node:fs';
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) check(path);
    else if (
      /OPENAI_API_KEY|SUPABASE_SECRET_KEY|sb_secret_[A-Za-z0-9_-]{10,}|"role"\s*:\s*"service_role"/.test(
        readFileSync(path, 'utf8'),
      )
    )
      throw new Error('Forbidden server credential marker in ' + path);
  }
}
check('dist');
console.log('Built assets checked: no server credential markers.');
