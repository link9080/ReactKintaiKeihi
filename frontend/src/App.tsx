import { useState } from "react";
import { toast } from "react-hot-toast";
import Login from "./pages/Login";
import Result from "./pages/Result";
import Loading from "./components/Loading";
import type { RakuPtn } from "./pages/Result";

const apiUri = import.meta.env.VITE_API_URI;

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [results, setResults] = useState<RakuPtn[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLoginSuccess = async () => {
    setLoading(true);

    try {
      const res = await fetch(apiUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getRakuPtn" }),
      });

      if (!res.ok) {
        throw new Error("APIエラー");
      }

      const data = await res.json();

      const ptns = Array.isArray(data.patterns) ? data.patterns : [];

      if (ptns.length === 0) {
        throw new Error("パターン取得失敗");
      }

      const rakuPtns: RakuPtn[] = ptns.map((p: RakuPtn) => ({
        id: p.id,
        label: p.label,
      }));

      setResults(rakuPtns);
      setIsLoggedIn(true);
    } catch (err) {
      console.error(err);
      toast.error("楽楽精算パターンの取得に失敗しました");
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading ? (
        <Loading />
      ) : isLoggedIn ? (
        <Result results={results} />
      ) : (
        <Login onSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
