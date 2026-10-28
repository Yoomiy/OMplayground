# Legacy public asset retirement

The unused `apps/web/public/minecraft-assets` directory is removed: 1,946 files,
9,154,674 bytes, including old textures and 133 audio recordings. Its two import
scripts and root helper commands are retired. Each file has a hash-verified
backup and matches its recorded Git preimage.

The consumer audit covers active app/shared/script/research code, public game
files, project instructions and workflow configuration. Only the two obsolete
import scripts and their root commands referenced the directory. A guarded
read-only check also finds zero matching catalog thumbnail/game URLs, avatar
preset images or profile-avatar URLs in the configured Supabase project. It uses
exact counts via three HEAD requests; no row values are returned and no hosted
data is written. This is an observation of current configuration, not a guarantee
about arbitrary future URL changes.

All 574 unrelated public files are preserved byte-for-byte, including
`legacy/minecraft/thumbnail.png`, which the home-page catalog still uses. Other
games, Stockfish, classroom media and profile assets are unaffected.

The replacement does not use the removed art or recordings. Its texture pixels
come from the MIT engine's procedural generator, and its material/ambient audio
is synthesized locally. The current engine notices and complete provenance stay
in [UPSTREAM.md](../UPSTREAM.md). The game build/content/release identity is
unchanged; removing these files does not add a new renderer or content format.

The production app build passes and drops from 2,696 to 750 distribution files.
Every remaining production file is byte-identical to the prior verified build;
only the 1,946 obsolete public files disappear. The browser boundary retains 45
new game modules and zero forbidden imports. Actual local PostgreSQL production
composition and the complete React school journey pass with two mount/exit
cycles and complete tracked GPU/worker/socket/audio closure. The owned database
stops. This uses fixture Auth/PostgREST/Storage with SFU disabled, not hosted or
physical-device qualification.

This is source/public-file retirement only. No database cleanup, migration,
catalog update, process stop, production routing change or deployment is performed.
Actual hosted school/recovery and physical-school-PC qualification remain open.
