import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures"
);

export const useFixtures = () => process.env.USE_FIXTURES === "true";

export async function fixture(name) {
  return JSON.parse(await readFile(path.join(FIXTURES_DIR, `${name}.json`), "utf8"));
}
