import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Usage: EMAIL=user@example.com NEW_PASSWORD=... npx tsx src/scripts/set-user-password.ts
// Sets (or creates) a Supabase Auth user's password via the admin API.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.EMAIL;
const newPassword = process.env.NEW_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!email || !newPassword) {
    console.error('Usage: EMAIL=user@example.com NEW_PASSWORD=... npx tsx src/scripts/set-user-password.ts');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
    const target = email!.toLowerCase();
    let foundId: string | null = null;
    let page = 1;

    while (!foundId) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const match = data.users.find((u) => u.email?.toLowerCase() === target);
        if (match) {
            foundId = match.id;
            console.log(`Found user ${match.id} (providers: ${match.app_metadata?.providers?.join(', ') ?? 'unknown'})`);
            break;
        }
        if (data.users.length < 200) break;
        page += 1;
    }

    if (foundId) {
        const { error } = await supabase.auth.admin.updateUserById(foundId, {
            password: newPassword!,
            email_confirm: true,
        });
        if (error) throw error;
        console.log(`Password updated for ${target}`);
    } else {
        const { data, error } = await supabase.auth.admin.createUser({
            email: target,
            password: newPassword!,
            email_confirm: true,
        });
        if (error) throw error;
        console.log(`User did not exist — created ${data.user?.id} with the given password`);
    }
}

run().catch((err) => {
    console.error('Failed:', err.message ?? err);
    process.exit(1);
});
