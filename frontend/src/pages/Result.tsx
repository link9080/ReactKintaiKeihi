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
  changed: boolean;
};

type ResultProps = {
  results: WorkRow[];
};

export default function Result({ results }: ResultProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WorkRow[]>(results);

  const handleChange = (id: string, field: keyof WorkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: value, changed: field === "date" ? r.changed : true }
          : r
      )
    );
  };

  const handleSubmit = async () => {
    const changedRows = rows.filter((r) => r.changed);

    if (changedRows.length === 0) {
      toast("変更された行がありません");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_LAMBDA_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changedRows),
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

        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="border p-2 w-12">変更</th>
              <th className="border p-2">日付</th>
              <th className="border p-2">開始</th>
              <th className="border p-2">終了</th>
              <th className="border p-2">休憩開始</th>
              <th className="border p-2">楽楽精算パターン</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border p-2 text-center">
                  <input type="checkbox" checked={row.changed} readOnly />
                </td>
                <td className="border p-2">
                  <input
                    type="text"
                    value={row.date}
                    readOnly
                    className="w-full bg-gray-200 text-gray-600 cursor-not-allowed border p-1"
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
                    {row.rakuPatternCombo.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
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
