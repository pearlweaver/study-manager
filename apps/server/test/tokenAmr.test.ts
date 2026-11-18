import { exportJWK, generateKeyPair, createLocalJWKSet, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tokenAuthenticator } from "../src/auth/identity.ts";
import { world } from "./support.ts";

let w: Awaited<ReturnType<typeof world>>;
const issuer = "https://study.test/auth/v1";
let sign: (claims: Record<string, unknown>, subject: string) => Promise<string>;
let identify: ReturnType<typeof tokenAuthenticator>["identify"];

beforeAll(async () => {
  w = await world();
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "RS256", use: "sig" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  identify = tokenAuthenticator({ db: w.db, keys, issuer }).identify;
  sign = (claims, subject) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(subject)
      .setIssuer(issuer)
      .sign(privateKey);
});
afterAll(() => w.close());

describe("sign-in methods from a token", () => {
  it("reads string amr entries as methods", async () => {
    const user = await w.user("Alex");
    const identity = await identify(`Bearer ${await sign({ amr: ["passkey"], aal: "aal1" }, user)}`);
    expect(identity?.methods).toEqual(["passkey"]);
  });

  it("does not treat a timestamp-less amr as a 1970 sign-in", async () => {
    const user = await w.user("Lena");
    const identity = await identify(`Bearer ${await sign({ amr: ["password", "otp"], aal: "aal1" }, user)}`);
    expect(identity?.authenticatedAt).toBeNull();
  });
});
