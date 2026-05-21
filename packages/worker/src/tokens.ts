export const PAT_PREFIX = "st_pat_";

export async function generateToken(): Promise<{
  plaintext: string;
  hash: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const plaintext = PAT_PREFIX + base64urlEncode(bytes);
  const hash = await sha256Hex(plaintext);
  return { plaintext, hash };
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
