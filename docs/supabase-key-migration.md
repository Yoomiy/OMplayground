# Supabase publishable and secret key migration

The app now requires the new variable names; revoked legacy keys have no fallback.
Create keys in Supabase Dashboard → Settings → API Keys.

| Deployment | Variable | Value |
| --- | --- | --- |
| Web build | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| Game, Minecraft, Rocket, Wobble servers | `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| Supabase Edge Functions (automatic) | `SUPABASE_SECRET_KEYS` | JSON object: `default` secret key |
| `import-bulk-kids` Edge Function (automatic) | `SUPABASE_PUBLISHABLE_KEYS` | JSON object: `default` publishable key |

Keep existing Supabase URL variables. The web key must belong to the same project
as the server keys. Never put a secret key in a `VITE_` variable.
Supabase automatically supplies the two plural key variables to hosted Edge
Functions. The functions parse these JSON objects and select the `default` key.
Confirm both variables exist under Edge Functions → Secrets and that your project
has keys named `default`, then redeploy all three functions. You do not need to
copy keys into custom Edge Function secrets. A differently named key requires
changing the selected name in code.

## Deployment after the Railway compromise

1. Secure the hosting account and deployment pipeline before installing fresh
   credentials. Use a trusted deployment environment; a secret key still grants
   privileged database access and bypasses RLS.
2. Set the web and game-server variables above on each applicable service and
   in local ignored env files; hosted Edge Function variables are automatic. Remove the old `VITE_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` deployment variables.
3. Rebuild and deploy the web app (Vite embeds its key at build time). Restart or
   redeploy all backend services and deploy the Edge Functions.
4. Verify sign-in, an ordinary user's database access, Realtime updates, game
   admission/saving, and an admin Edge Function. Confirm non-admin callers remain
   denied. Legacy keys should remain revoked.

Game and Minecraft currently also use the Supabase server key to sign classroom
board, delegate, and presenter capabilities. Give these two services the same
new secret key. Rotation invalidates outstanding capabilities; reload/rejoin
classroom sessions. Rocket and Wobble use separate ticket signing secrets.

Local launchers read `SUPABASE_SECRET_KEY` from `apps/game-server/.env` unless
overridden in their game-specific ignored env files or process environment.
No real credentials are supplied by this migration.

Raw REST requests send the new key in `apikey` only. User access tokens remain
JWTs and go in `Authorization: Bearer …`. SDK clients receive the new key through
`createClient`; application code does not decode API keys as JWTs.

Migration reference: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
