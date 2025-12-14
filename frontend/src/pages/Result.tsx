import { useState } from "react";
import { toast, Toaster } from "react-hot-toast";

export type WorkRow = {
  id: string;
  date: string;
  start: string;
  end: string;
  breakStart: string;
  rakuPattern: string;
  rakuPatternCombo: string[];
  rakuPattern2: string;
  rakuPatternCombo2: string[];
};

export type RakuPtn = {
  id: string;
  label: string;
};

type ResultProps = {
  results: RakuPtn[];
};

const apiUri = import.meta.env.VITE_API_URI;

export default function Result({ results }: ResultProps) {
  const [loading, setLoading] = useState(false);

  // 最初の1行を作成
  const [rows, setRows] = useState<WorkRow[]>([
    {
      id: crypto.randomUUID(),
      date: "",
      start: "",
      end: "",
      breakStart: "",
      rakuPattern: results.length > 0 ? results[0].id : "",
      rakuPatternCombo: results.map((p) => p.id),  // ← RakuPtn の id を入れる
      rakuPattern2: results.length > 0 ? results[0].id : "",
      rakuPatternCombo2: results.map((p) => p.id),  // ← RakuPtn の id を入れる
    },
  ]);

  // --- 行追加 ---
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: "",
        start: "",
        end: "",
        breakStart: "",
        rakuPattern: results.length > 0 ? results[0].id : "",
        rakuPatternCombo: results.map((p) => p.id),
        rakuPattern2: results.length > 0 ? results[0].id : "",
        rakuPatternCombo2: results.map((p) => p.id),
      },
    ]);
  };

  const handleChange = (id: string, field: keyof WorkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: value, changed: true } : r
      )
    );
  };
  // 必須項目キー一覧
  const requiredKeys: (keyof WorkRow)[] = [
    "date",
    "start",
    "end",
    "breakStart",
    "rakuPattern",
    "rakuPattern2",
  ];

  // 空チェック用関数
  const isFilled = (row: WorkRow) =>
    requiredKeys.every((key) => {
      const v = row[key];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });

  // --- 送信処理（既存のまま） ---
  const handleSubmit = async () => {
    // 変更されていて、かつ必須項目が全部入っている行だけ
    const changedRows = rows
      .filter(isFilled);

    if (changedRows.length === 0) {
      toast("変更された行がありません");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submitRows", rows: changedRows }),
      });

      const data = await res.json();
      console.log(data);

      toast("送信が完了しました");
    } catch (e) {
      toast("送信中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex justify-center items-start">
      <Toaster />
      <div className="bg-white shadow-md rounded p-6 w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">勤怠データ編集</h1>

        <button
          onClick={handleAddRow}
          className="mb-4 px-3 py-1 bg-green-600 text-white rounded"
        >
          ＋ 行を追加
        </button>

        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="border p-2">日付</th>
              <th className="border p-2">開始</th>
              <th className="border p-2">終了</th>
              <th className="border p-2">休憩開始</th>
              <th className="border p-2">楽楽精算パターン</th>
              <th className="border p-2">楽楽精算パターン2</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border p-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => handleChange(row.id, "date", e.target.value)}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="time"
                    value={row.start}
                    onChange={(e) => handleChange(row.id, "start", e.target.value)}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="time"
                    value={row.end}
                    onChange={(e) => handleChange(row.id, "end", e.target.value)}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="time"
                    value={row.breakStart}
                    onChange={(e) => handleChange(row.id, "breakStart", e.target.value)}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <select
                    value={row.rakuPattern}
                    onChange={(e) =>
                      handleChange(row.id, "rakuPattern", e.target.value)
                    }
                    className="w-full border p-1"
                  >
                    {results.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border p-2">
                  <select
                    value={row.rakuPattern2}
                    onChange={(e) =>
                      handleChange(row.id, "rakuPattern2", e.target.value)
                    }
                    className="w-full border p-1"
                  >
                    {results.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "送信中..." : "送信"}
          </button>
        </div>
      </div>
    </div>
  );
}
