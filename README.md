# 勤怠・経費 自動登録システム

楽楽精算・recoru への勤怠／経費入力を **自動化** する Web アプリです。  
フロントエンド（React）からリクエストを送信し、  
AWS 上で **非同期（SQS + Lambda + Selenium）** に処理を行います。

---

## ✨ 特徴

- ブラウザ操作（Selenium）による自動入力
- スマホ・PC 両対応（非同期処理）
- 処理状況をポーリングで取得
- DynamoDB による一時結果保存（TTL 1日）

---

## 🏗 システム構成

```text
[ Browser (React) ]
        |
        | submitRows
        v
[ Lambda API ]
        |
        | SendMessage
        v
[ SQS Queue ]
        |
        | trigger
        v
[ Lambda Worker (Selenium) ]
        |
        | PutItem
        v
[ DynamoDB ]
        ^
        | pollResults
[ Lambda API ]
```

### 主な技術スタック

- フロントエンド
  - React (Vite)
  - TypeScript
  - react-hot-toast

- バックエンド
  - AWS Lambda (Python 3.11)
  - Amazon SQS
  - Amazon DynamoDB（TTL 1日）
  - Selenium + Headless Chrome（Lambda Layer）

---

## 処理フロー
1. フロントでログインパスワードを入力
2. フロントで勤怠データを入力し「送信」
3. API Lambda が `requestId` を即時返却
4. フロントは 3秒ごとに `pollResults` を呼び出し
5. Worker Lambda が SQS 経由で Selenium 処理を実行
6. 結果を DynamoDB に保存
7. 完了後、フロントに結果を表示

---

## ディレクトリ構成（例）
```text
.
├── frontend/
│ ├── src/
│ └── README.md
├── lambda/
│ ├── api/
│ │ └── lambda_function.py
│ ├── worker/
│ │ └── regist_kintai_keihi.py
│ └── layers/
│ └── selenium-chrome-layer.zip
└── README.md
```

---

## 環境変数

### フロントエンド（.env）

```env
VITE_API_URI=https://xxxxxxxx.lambda-url.ap-northeast-1.on.aws/
```
Lambda（API / Worker 共通）
```
RESULT_TABLE_NAME : DynamoDB テーブル名

（必要に応じて）ログイン情報は config.ini に定義
```

### DynamoDB 設定
```
パーティションキー: requestId (string)

TTL 属性: ttl

TTL 有効期限: 現在時刻 + 1日
```

### SQS 設定
```
Standard Queue

Worker Lambda をトリガーとして設定

IAM ロールに以下権限が必要
sqs:SendMessage
sqs:ReceiveMessage
sqs:DeleteMessage
sqs:GetQueueAttributes
```