import 'dotenv/config';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { officerAccounts, officerAudit } from '../db/schema.js';
import { loadConfig } from '../config.js';
import { hashPassword, PASSWORD_MIN } from '../auth/password.js';

function maskedInput(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || !input.setRawMode) {
      reject(new Error('Bootstrap requires an interactive TTY; never pass passwords in CLI args'));
      return;
    }
    process.stdout.write(prompt);
    let value = '';
    const cleanup = () => {
      input.removeListener('data', receive);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const receive = (buffer: Buffer) => {
      const content = buffer.toString('utf8');
      if (content === '\u0003') { cleanup(); reject(new Error('Cancelled')); return; }
      if (content === '\r' || content === '\n') { cleanup(); resolve(value); return; }
      if (content === '\u007f' || content === '\b') {
        value = Array.from(value).slice(0, -1).join('');
      } else if (!content.includes('\u001b')) {
        value += content;
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on('data', receive);
  });
}

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username || !/^[a-z][a-z0-9_.-]{2,31}$/.test(username)) {
    throw new Error('Usage: yarn workspace @aeter/api bootstrap:leader <username>');
  }
  const config = loadConfig(process.env);
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 });
  try {
    const db = drizzle(pool);
    const existing = await db.select({ id: officerAccounts.id }).from(officerAccounts).limit(1);
    if (existing.length) throw new Error('Officer accounts already exist; bootstrap is disabled');
    const password = await maskedInput('New Guild Leader password (hidden): ');
    const confirmed = await maskedInput('Confirm password (hidden): ');
    if (password.length < PASSWORD_MIN || password.length > 128 || password !== confirmed) {
      throw new Error('Password mismatch or outside 12–128 character policy');
    }
    const hash = await hashPassword(password);
    const account = await db.transaction(async tx => {
      // Serialized first-owner bootstrap against other concurrent bootstrap shells.
      await tx.execute('SELECT pg_advisory_xact_lock(832175, 9101)');
      const existingUnderLock = await tx.select({ id: officerAccounts.id }).from(officerAccounts).limit(1);
      if (existingUnderLock.length) throw new Error('Officer accounts already exist');
      const created = await tx.insert(officerAccounts).values({
        username, displayName: 'Guild Leader', passwordHash: hash,
        role: 'GUILD_LEADER', mustChangePassword: false
      }).returning({ id: officerAccounts.id });
      await tx.insert(officerAudit).values({
        actorId: created[0].id, targetId: created[0].id, action: 'INITIAL_LEADER_BOOTSTRAP'
      });
      return created[0];
    });
    // Never log the password or hash.
    console.log(`Guild Leader account ${username} created (${createHash('sha256').update(account.id).digest('hex').slice(0, 8)}).`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exitCode = 1;
});
