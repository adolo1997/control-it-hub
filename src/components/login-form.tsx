"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = (await response.json().catch(() => ({
        ok: false,
        error: "La respuesta del servidor no es JSON valido.",
      }))) as LoginResponse;

      console.info("[login-form] response", {
        status: response.status,
        okHttp: response.ok,
        body: data,
      });

      if (!response.ok || data.ok !== true) {
        setError(data.error ?? "No se pudo iniciar sesion.");
        return;
      }

      const redirectTo = data.redirectTo ?? "/dashboard";
      console.info("[login-form] ok=true; router.push", { redirectTo });
      router.push(redirectTo);
    } catch (loginError) {
      console.error("[login-form] request_failed", loginError);
      setError("No se pudo conectar con el servidor de autenticacion.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {error ? <div className="error">{error}</div> : null}
      <label className="field">
        Email
        <input
          className="input"
          name="email"
          type="email"
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          value={email}
        />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
      </label>
      <button className="button" disabled={isLoading} type="submit">
        <LogIn size={18} />
        {isLoading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
