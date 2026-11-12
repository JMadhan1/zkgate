// BlindPay prover helper, called by the API as a child process.
//
// Reads ONE JSON object from stdin, writes ONE JSON object to stdout:
//   {"mode":"commit", "limit","salt","memberTag","period"}       -> {"commitment"}
//   {"mode":"prove",  "limit","salt","commitment","memberTag","period",
//                     "amount","spentBefore","requestHash"}       -> {"proof","publicSignals"}
//   {"mode":"verify", "proof","publicSignals"}                    -> {"valid"}
// All numbers are decimal strings. No arguments, no shell: the API passes
// data only through stdin.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.BLINDPAY_CIRCUIT_DIR || path.join(HERE, "build");
const DEC = /^[0-9]{1,78}$/;

function need(obj, keys) {
  for (const k of keys) {
    if (typeof obj[k] !== "string" || !DEC.test(obj[k])) throw new Error(`bad field: ${k}`);
  }
}

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  if (input.mode === "commit") {
    need(input, ["limit", "salt", "memberTag", "period"]);
    const p = await buildPoseidon();
    const h = p([input.limit, input.salt, input.memberTag, input.period].map(BigInt));
    return { commitment: p.F.toObject(h).toString() };
  }
  if (input.mode === "prove") {
    const keys = ["limit", "salt", "commitment", "memberTag", "period", "amount", "spentBefore", "requestHash"];
    need(input, keys);
    const witness = Object.fromEntries(keys.map((k) => [k, input[k]]));
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witness, path.join(DIR, "policyCheck.wasm"), path.join(DIR, "policyCheck.zkey"));
    return { proof, publicSignals };
  }
  if (input.mode === "verify") {
    const vk = JSON.parse(fs.readFileSync(path.join(DIR, "verification_key.json"), "utf8"));
    return { valid: await snarkjs.groth16.verify(vk, input.publicSignals, input.proof) };
  }
  throw new Error("unknown mode");
}

main()
  .then((out) => { process.stdout.write(JSON.stringify(out)); process.exit(0); })
  .catch((err) => { process.stderr.write(String(err && err.message ? err.message : err).slice(0, 200)); process.exit(1); });
