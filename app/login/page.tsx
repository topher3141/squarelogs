"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => null);

        setError(
          data?.error ||
            "Invalid username or password."
        );

        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError(
        "Unable to sign in right now."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand">
          DEALS &amp; STEALS
        </div>

        <h1>
          Receipt &amp; Video Search
        </h1>

        <p className="loginSubtitle">
          Admin access only
        </p>

        <form
          onSubmit={handleSubmit}
          className="loginForm"
        >
          <label>
            <span>Username</span>

            <input
              autoComplete="username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              required
            />
          </label>

          <label>
            <span>Password</span>

            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
              autoFocus
            />
          </label>

          {error && (
            <div className="loginError">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Signing in…"
              : "Sign In"}
          </button>
        </form>

        <div className="loginSecurity">
          Secure access to Square receipt data
          and UniFi Protect footage.
        </div>
      </section>
    </main>
  );
}
