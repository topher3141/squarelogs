export const SESSION_COOKIE = "squarelogs_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function textBuffer(value: string): ArrayBuffer {
  const bytes = encoder.encode(value);

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function signingKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    textBuffer(password),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  password: string
): Promise<string> {
  const payload = JSON.stringify({
    role: "admin",
    exp:
      Math.floor(Date.now() / 1000) +
      SESSION_TTL_SECONDS,
  });

  const payloadEncoded = base64UrlEncode(
    new Uint8Array(textBuffer(payload))
  );

  const key = await signingKey(password);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textBuffer(payloadEncoded)
  );

  return `${payloadEncoded}.${base64UrlEncode(
    new Uint8Array(signature)
  )}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string | undefined
): Promise<boolean> {
  if (!token || !password) {
    return false;
  }

  const [payloadEncoded, signatureEncoded] =
    token.split(".");

  if (!payloadEncoded || !signatureEncoded) {
    return false;
  }

  try {
    const key = await signingKey(password);

    const validSignature =
      await crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlDecode(signatureEncoded),
        textBuffer(payloadEncoded)
      );

    if (!validSignature) {
      return false;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(
        base64UrlDecode(payloadEncoded)
      )
    ) as {
      role?: string;
      exp?: number;
    };

    return (
      payload.role === "admin" &&
      typeof payload.exp === "number" &&
      payload.exp >
        Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function passwordMatches(
  supplied: string,
  expected: string
): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest(
      "SHA-256",
      textBuffer(supplied)
    ),
    crypto.subtle.digest(
      "SHA-256",
      textBuffer(expected)
    ),
  ]);

  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);

  if (av.length !== bv.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < av.length; i++) {
    diff |= av[i] ^ bv[i];
  }

  return diff === 0;
}
