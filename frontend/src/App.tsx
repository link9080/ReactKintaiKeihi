import { useState } from "react";
import Login from "./pages/Login";
import Result from "./pages/Result";
import type { WorkRow } from "./pages/Result";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [results, setResults] = useState<WorkRow[]>([]);

  // ログイン成功時に Result ページを表示
  const handleLoginSuccess = async () => {
    setIsLoggedIn(true);

    // ここで indexstart の Lambda API を叩いてデータ取得しても OK
    // 今回は仮データをセット
    const mockData: WorkRow[] = [
      {
        id: "1",
        date: "2025-12-07",
        start: "09:00",
        end: "18:00",
        breakStart: "12:00",
        rakuPattern: "A",
        rakuPatternCombo: ["A", "B", "C"],
        changed: false,
      },
      {
        id: "2",
        date: "2025-12-08",
        start: "09:30",
        end: "18:30",
        breakStart: "12:30",
        rakuPattern: "B",
        rakuPatternCombo: ["A", "B", "C"],
        changed: false,
      },
    ];
    setResults(mockData);
  };

  return (
    <>
      {isLoggedIn ? (
        <Result results={results} />
      ) : (
        <Login onSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
