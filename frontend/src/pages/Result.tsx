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
  msgs?: string[];
};

export type RakuPtn = {
  id: string;
  label: string;
};

type ResultProps = {
  results: RakuPtn[];
};

type ApiResult = {
  id: string;
  msgs: string[];
};

const apiUri = import.meta.env.VITE_API_URI;
const POLLING_INTERVAL_MS = import.meta.env.VITE_POOL_MINUTUS * 1000; // 秒ごとに結果を問い合わせる
const MAX_POLLING_ATTEMPTS = import.meta.env.VITE_MAX_ATTEMPTS; // 最大試行回数 (3秒 * 60回 = 180秒 = 10分まで待機)


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

  // --- 行追加（1行目の内容をコピー） ---
  const handleAddRow = () => {
    setRows((prev) => {
      // 1行目のデータを取得
      const firstRow = prev[0];

      // 新しい行のオブジェクトを作成
      const newRow: WorkRow = {
        ...firstRow,             // 1行目の内容をすべてコピー
        id: crypto.randomUUID(), // IDだけは新しく発番
        msgs: undefined,         // エラー・成功メッセージはクリア
        // 日付だけは空に
        date: "",
      };

      return [...prev, newRow];
    });
  };

  const handleChange = (id: string, field: keyof WorkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: value, changed: true } : r
      )
    );
  };


  /// 必須項目キー一覧（単体で値が入っていないといけないもの）
  const requiredKeys: (keyof WorkRow)[] = [
    "date",
  ];

  // バリデーション用関数
  const isFilled = (row: WorkRow) => {
    // 1. 基本的な必須チェック（date など）
    const hasRequired = requiredKeys.every((key) => {
      const v = row[key];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });

    // 2. start と end の入力状態を確認
    const s = String(row.start || "").trim();
    const e = String(row.end || "").trim();

    const hasStart = s !== "";
    const hasEnd = e !== "";

    // 「どちらか一方が入力されている」状態を特定
    const isAnyTimeFilled = hasStart || hasEnd;

    // 開始終了どちらも入力されていない場合、楽楽精算のみの入力のためチェック終了
    if (!isAnyTimeFilled) return true

    // 「両方入力されているか」を確認（片方だけならNG）
    const isTimePairComplete = hasStart && hasEnd;

    // 3. 最終判定
    // 時刻が1つでも入っているなら、ペアが揃っていることが必須
    // かつ、そもそも時刻が全く入っていない行は送信対象外とする
    return hasRequired && isAnyTimeFilled && isTimePairComplete;
  };
  // --- 送信処理---
  const applyApiResults = (apiResults: ApiResult[]) => {
    setRows(prev =>
      prev.map(row => {
        const hit = apiResults.find(r => r.id === row.id);
        return hit ? { ...row, msgs: hit.msgs } : row;
      })
    );
  };

  // --- ポーリング処理のヘルパー関数 ---
  const startPolling = (requestId: string): Promise<ApiResult[]> => {
    let attempts = 0;

    // toast.promise を使用した Promise ラッパー
    const pollingPromise = new Promise<ApiResult[]>((resolve, reject) => {
      const intervalId = setInterval(async () => {
        attempts++;

        try {
          // Lambda (3) への問い合わせ：apiUriに action: "pollResults" を送信
          const res = await fetch(apiUri, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // ★ ここで action: "pollResults" と jobId を送信 ★
            body: JSON.stringify({ action: "pollResults", requestId: requestId }),
          });

          const data = await res.json();

          if (data.status === 'COMPLETED') {
            clearInterval(intervalId);
            resolve(data.results);
            return;
          }

          if (data.status === "FAILED") {
            clearInterval(intervalId);
            reject(new Error(data.errorMessage ?? "処理失敗"));
            return;
          }

          // ... (FAILED, タイムアウトのチェック) ...
          if (attempts >= MAX_POLLING_ATTEMPTS) {
            clearInterval(intervalId);
            reject(new Error("タイムアウトしました"));
            return;
          }

        } catch (error) {
          clearInterval(intervalId);
          reject(new Error("例外エラー"));
          return;
        }
      }, POLLING_INTERVAL_MS);
    });

    return toast.promise(
      pollingPromise,
      {
        loading: `処理を実行中です (requestId: ${requestId})`,
        success: 'すべての処理が正常に完了しました！',
        error: (err) => `処理失敗: ${err.message}`, // reject された際のエラーメッセージを表示
      }
    );
  };

  const handleSubmit = async () => {
    const changedRows = rows.filter(isFilled);

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


      if (!res.ok) {
        throw new Error(`HTTPエラー: ${res.status}`);
      }

      const reqData = await res.json();
      const requestId = reqData.requestId;

      if (!requestId) {
        toast.error("サーバーからJob IDが返されませんでした。");
        return;
      }

      toast.success(`処理を受け付けました (requestId ${requestId})。結果待ちを開始します...`);

      // 2. Job ID を使って結果のポーリングを開始
      const finalApiResults = await startPolling(requestId);

      // 3. 結果をUIに反映
      applyApiResults(finalApiResults);

      toast.success("すべての処理が完了し、結果を反映しました。");

      toast("送信が完了しました");
    } catch {
      toast("送信中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 p-2 md:p-6 flex justify-center items-start">
      <Toaster />
      <div className="bg-white shadow-md rounded p-4 md:p-6 w-full max-w-5xl">
        <h1 className="text-xl md:text-2xl font-bold mb-6">勤怠データ編集</h1>

        <button
          onClick={handleAddRow}
          className="mb-4 w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded font-bold"
        >
          ＋ 行を追加
        </button>

        {/* テーブルタグに block md:table を指定してスマホではテーブルを解除 */}
        <div className="w-full">
          <table className="w-full border-collapse md:border text-sm block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-gray-200 text-left">
                <th className="border p-2">日付</th>
                <th className="border p-2">開始</th>
                <th className="border p-2">終了</th>
                <th className="border p-2">休憩開始</th>
                <th className="border p-2">パターン1</th>
                <th className="border p-2">パターン2</th>
                <th className="border p-2">結果</th>
              </tr>
            </thead>

            <tbody className="block md:table-row-group">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="block md:table-row border rounded-lg mb-4 p-4 bg-gray-50 md:bg-white md:border-b md:mb-0 relative shadow-sm md:shadow-none"
                >
                  {/* 各セルにラベルを付けてスマホで見やすくする */}
                  <td className="block md:table-cell p-1 md:p-2">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">日付</span>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => handleChange(row.id, "date", e.target.value)}
                      className="w-full border p-2 rounded md:p-1"
                    />
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0">

                    <span className="md:hidden font-bold text-gray-600 block mb-1">開始</span>
                    <input
                      type="time"
                      value={row.start}
                      onChange={(e) => handleChange(row.id, "start", e.target.value)}
                      className="w-full border p-2 rounded md:p-1"
                    />
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">終了</span>
                    <input
                      type="time"
                      value={row.end}
                      onChange={(e) => handleChange(row.id, "end", e.target.value)}
                      className="w-full border p-2 rounded md:p-1"
                    />
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">休憩開始</span>
                    <input
                      type="time"
                      value={row.breakStart}
                      onChange={(e) => handleChange(row.id, "breakStart", e.target.value)}
                      className="w-full border p-2 rounded md:p-1"
                    />
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">パターン1</span>
                    <select
                      value={row.rakuPattern}
                      onChange={(e) => handleChange(row.id, "rakuPattern", e.target.value)}
                      className="w-full border p-2 rounded md:p-1 bg-white"
                    >
                      {results.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">パターン2</span>
                    <select
                      value={row.rakuPattern2}
                      onChange={(e) => handleChange(row.id, "rakuPattern2", e.target.value)}
                      className="w-full border p-2 rounded md:p-1 bg-white"
                    >
                      {results.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </td>

                  <td className="block md:table-cell p-1 md:p-2 mt-2 md:mt-0 border-t md:border-none pt-2 md:pt-0">
                    <span className="md:hidden font-bold text-gray-600 block mb-1">実行結果</span>
                    {row.msgs && row.msgs.length > 0 ? (
                      <div className={`text-sm ${row.msgs.some(m => m.includes("成功")) ? "text-green-600" : "text-red-600"}`}>
                        {row.msgs.map((m, i) => <div key={i}>{m}</div>)}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? "送信中..." : "勤怠データを送信"}
          </button>
        </div>
      </div>
    </div>
  );
}
