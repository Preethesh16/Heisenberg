import { useEffect, useState } from "react";
import { copy } from "../utils/copy";

function formatElapsed(startedAt, now) {
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function RoleBanner({ stage, startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const role = copy.roleBanner[stage] ?? copy.roleBanner.debate;

  return (
    <header className="role-banner">
      <span className="role-banner__logo">{copy.appName}</span>
      <span className="role-banner__role">{role}</span>
      <span className="role-banner__timer">{startedAt ? formatElapsed(startedAt, now) : ""}</span>
    </header>
  );
}
