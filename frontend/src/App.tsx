import { useState } from "react";
import Login from "./pages/Login";
import Result from "./pages/Result";
import Loading from "./components/Loading"; // ← 追加
import type { RakuPtn } from "./pages/Result";

const apiUri = import.meta.env.VITE_API_URI;

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [results, setResults] = useState<RakuPtn[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLoginSuccess = async () => {
    setLoading(true);

    const res = await fetch(apiUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getRakuPtn" }),
    });

    const data = await res.json();

    const ptns = Array.isArray(data.patterns) ? data.patterns : [];

    const rakuPtns: RakuPtn[] = ptns.map((p: RakuPtn) => ({
      id: p.id,
      label: p.label,
    }));

    setResults(rakuPtns);

    setLoading(false);
    setIsLoggedIn(true);
  };

  return (
    <>
      {loading ? (
        <Loading /> // ← スピナーを表示
      ) : isLoggedIn ? (
        <Result results={results} />
      ) : (
        <Login onSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
