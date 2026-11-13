/* Small admin commands, run inside the API container:
     node dist/cli.js create-admin <username>   creates the first admin (password from TT_ADMIN_PASSWORD, or asked for)
     node dist/cli.js migrate                    applies database migrations and stops */
import readline from 'node:readline';
import { hashPassword, passwordProblem } from './auth';
import { readConfig } from './config';
import { connect, migrate } from './db';
import { Username } from './schemas';

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WritableStream };
  out._writeToOutput = (s: string) => { if (s.includes(question)) out.output.write(s); };   /* do not echo the password */
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write('\n');
  return answer;
}

const [command, name] = process.argv.slice(2);
const db = connect(readConfig().databaseUrl);
try {
  await migrate(db);
  if (command === 'migrate') console.log('Database is up to date.');
  else if (command === 'create-admin') {
    const u = Username.safeParse(name);
    if (!u.success) throw new Error('Give a username: 2 to 40 lowercase letters, digits, dots, dashes, or underscores.');
    const password = process.env.TT_ADMIN_PASSWORD || (await ask('Password for ' + u.data + ': '));
    const why = passwordProblem(password);
    if (why) throw new Error(why);
    const r = await db.query("insert into users (username, role, password_hash) values ($1, 'admin', $2) on conflict (username) do nothing returning id", [u.data, await hashPassword(password)]);
    if (!r.rows[0]) throw new Error('That username already exists.');
    await db.query("insert into audit_log (user_id, action) values ($1, 'admin_created_from_command_line')", [r.rows[0].id]);
    console.log('Created admin "' + u.data + '".');
  } else throw new Error('Commands: create-admin <username>, migrate');
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await db.end();
}
