import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "@/lib/backend";

export default function Login() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError("Login failed. Check username/password and backend status.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl bg-card border-glass p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Machine Guardian AI</h1>
          <p className="text-[12px] text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        <div>
          <label className="text-[12px] text-muted-foreground">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full mt-1 h-10 px-3 rounded-lg bg-surface-elevated border border-border"
            required
          />
        </div>

        <div>
          <label className="text-[12px] text-muted-foreground">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 h-10 px-3 rounded-lg bg-surface-elevated border border-border"
            required
          />
        </div>

        {error && <p className="text-[12px] text-status-critical">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
