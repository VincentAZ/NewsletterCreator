import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

loadLocalEnv();

const scriptPath = resolve("scripts", "ensure-supabase-schema.sql");
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || buildSupabaseDatabaseUrl();
const schemaSql = existsSync(scriptPath) ? readFileSync(scriptPath, "utf8") : "";

if (!existsSync(scriptPath)) {
  console.error(`Schema file not found: ${scriptPath}`);
  process.exit(1);
}

if (!databaseUrl) {
  console.error("Missing database connection settings.");
  console.error("Add one of these to .env, then rerun:");
  console.error("  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres");
  console.error("  DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres");
  console.error("");
  console.error("Or, if SUPABASE_URL is already set, add:");
  console.error("  SUPABASE_DB_PASSWORD=<your database password>");
  console.error("");
  console.error("  npm run db:ensure-schema");
  console.error("");
  console.error("SQL to apply:");
  console.error(schemaSql);
  process.exit(1);
}

if (commandExists("psql")) {
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", scriptPath], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

console.log("psql was not found. Falling back to Supabase CLI via npx.");
for (const statement of splitSqlStatements(schemaSql)) {
  const result = runSupabaseQuery(databaseUrl, statement);

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const reloadResult = runSupabaseQuery(databaseUrl, "notify pgrst, 'reload schema'");

if (reloadResult.error) {
  console.error(reloadResult.error.message);
  process.exit(1);
}

process.exit(reloadResult.status ?? 1);

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, args, { stdio: "ignore", shell: process.platform !== "win32" });
  return result.status === 0;
}

function runSupabaseQuery(dbUrl, statement) {
  return spawnSync(
    `npx supabase db query --db-url ${shellQuote(dbUrl)} ${shellQuote(statement)}`,
    {
      stdio: "inherit",
      shell: true,
    },
  );
}

function shellQuote(value) {
  if (process.platform === "win32") {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function splitSqlStatements(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function buildSupabaseDatabaseUrl() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const password = process.env.SUPABASE_DB_PASSWORD || "";
  if (!supabaseUrl || !password) {
    return "";
  }

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    if (!projectRef) {
      return "";
    }
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  } catch {
    return "";
  }
}

function loadLocalEnv() {
  for (const envPath of findCandidateEnvFiles()) {
    if (!existsSync(envPath)) {
      continue;
    }

    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [name, ...valueParts] = trimmed.split("=");
      const key = name.trim();
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function findCandidateEnvFiles() {
  const paths = [];
  let current = process.cwd();

  for (let depth = 0; depth < 5; depth += 1) {
    paths.push(join(current, ".env.local"));
    paths.push(join(current, ".env"));
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return paths;
}
