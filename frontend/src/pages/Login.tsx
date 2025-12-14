import { useState } from "react";
import toast from "react-hot-toast";

type LoginProps = {
  onSuccess: () => void;
};

export default function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const apiUri = import.meta.env.VITE_API_URI;


  const handleLogin = async () => {
    if (!password) {
      toast.error("パスワードを入力してください");
      return;
    }

    setLoading(true); // スピナー開始
    try {
      const res = await fetch(apiUri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action : "login",
          password : password 
        }),
      });

      const data = await res.json();

      if (data.authorized) {
        toast.success("ログイン成功！");
        onSuccess(); // ← ここで Result ページへ！
      } else {
        toast.error("パスワードが違います");
      }
    } catch (err) {
      toast.error("通信エラーが発生しました");
    } finally {
      setLoading(false); // スピナー終了
    }
  };

  // Enter キーでログイン
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-xs">
        <h1 className="text-xl font-semibold mb-4 text-center">ログイン</h1>

        <input
          type="password"
          className="w-full p-2 border rounded mb-4 disabled:bg-gray-200"
          placeholder="パスワードを入力"
          disabled={loading} // 入力不可
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full text-white py-2 rounded transition ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? (
            <div className="flex justify-center items-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            "ログイン"
          )}
        </button>
      </div>
    </div>
  );
}
