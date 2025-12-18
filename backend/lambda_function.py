import json
import time
import configparser
import requests
import os
import boto3
import uuid
from datetime import datetime, timedelta
from headless_chrome import create_driver
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.common.keys import Keys
from TemplateInput import TemplateInput
import logging

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(filename)s:%(lineno)d - %(message)s"
)
logger = logging.getLogger()
logger.setLevel(logging.INFO)
RESULT_TABLE_NAME = os.environ["TABLE"]
QUEUE_URL = os.environ["QUEUE_URL"]

# DynamoDB リソースを初期化 (グローバルに実行すると高速化されます)
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client("sqs")
table = dynamodb.Table(RESULT_TABLE_NAME)
WAIT_TIME = 2

# Lambdaのデフォルトログハンドラーは既に設定されているので、
# 追加設定が不要なケースが多いが、フォーマット指定を追加する場合は以下
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(filename)s:%(lineno)d - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# 設定ファイル読み込み
config = configparser.ConfigParser()
config.read('config.ini')

def format_to_yyyymmdd(date_str: str) -> str:
    return datetime.strptime(date_str, "%Y/%m/%d").strftime("%Y%m%d")

def enqueue_job(request_id, rows):
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps({
            "requestId": request_id,
            "rows": rows
        })
    )
def login_raku(driver, wait):
    driver.get(config['DEFAULT']['raku_url'])  # rakuurlの部分
    time.sleep(WAIT_TIME)
    logger.info(f"url:{driver.current_url}title:{driver.title}")
    # 企業IDを入力
    kigyo_element = wait.until(EC.presence_of_element_located((By.NAME, "loginId")))
    kigyo_element.send_keys(config['DEFAULT']['raku_login_id'])

    pass_element = wait.until(EC.presence_of_element_located((By.NAME, "password")))
    pass_element.send_keys(config['DEFAULT']['raku_password'])
    pass_element.send_keys(Keys.ENTER)

    time.sleep(WAIT_TIME)  # ページ遷移待ちなど適宜調整
    logger.info("ログイン成功")

    frame = wait.until(EC.presence_of_element_located((By.NAME, "main")))
    driver.switch_to.frame(frame)

def get_input_rakuraku_patterns(driver:webdriver, wait:WebDriverWait, input:TemplateInput = None):
    try:
        # 「交通費精算」が作成されていないか確認
        try:
            # 先に「交通費精算」があるかチェック
            koutuhi = driver.find_elements(By.CSS_SELECTOR, "span[title='交通費精算']")
            if koutuhi:  # 見つかった場合
                raise TimeoutException("交通費精算が存在しない為 badge 処理をスキップ")
            # ui-c-badge または szb-badge を探す
            badges = wait.until(
                EC.presence_of_all_elements_located(
                    (By.CSS_SELECTOR, ".ui-c-badge, .szb-badge")
                )
            )
            # 最初の要素を判定
            first_badge = badges[0]
            badge_class = first_badge.get_attribute("class")

            if "ui-c-badge" in badge_class:
                logger.info("ui-c-badge を取得しました")
            elif "szb-badge" in badge_class:
                logger.info("szb-badge を取得しました")
            else:
                logger.info(f"想定外のbadgeを取得: {badge_class}")
            first_badge.click()
            
        except TimeoutException:
            # 「ui-c-badge」が見つからなかった場合は「交通費精算」のリンクをクリック
            logger.info("badgeが見つからなかったため、交通費精算をクリックします")
            newpage = wait.until(EC.presence_of_all_elements_located((By.LINK_TEXT, "交通費精算")))[0]
            newpage.click()

        time.sleep(WAIT_TIME)

        # ウィンドウ切り替え
        driver.switch_to.window(driver.window_handles[-1])
        logger.info(f"楽楽清算-一時保存-{driver.current_url}")

        # 修正画面へ移動
        if "initializeView" not in driver.current_url:
            try:
                # ①「修正」リンクを探す
                links = driver.find_elements(By.LINK_TEXT, "修正")
                if links:
                    logger.info("『修正』リンクをクリックします")
                    links[0].click()

                else:
                    # ② .w_denpyo_l を探す
                    try:
                        logger.info("『修正』リンクが無いので .w_denpyo_l をクリックします")
                        target = WebDriverWait(driver, WAIT_TIME).until(
                            EC.element_to_be_clickable((By.CLASS_NAME, "w_denpyo_l"))
                        )
                        target.click()

                    except TimeoutException:
                        # ③ 絶対パスで指定された要素をクリック
                        logger.info("『修正』『.w_denpyo_l』が無いため XPath の要素をクリックします")
                        target = WebDriverWait(driver, WAIT_TIME).until(
                            EC.element_to_be_clickable(
                                (By.XPATH, "/html/body/form/div[1]/div[2]/div/div/table/tbody/tr[2]/td[2]/a")
                            )
                        )
                        target.click()

                time.sleep(WAIT_TIME)
                driver.switch_to.window(driver.window_handles[-1])

            except Exception as e:
                logger.error(f"修正画面への遷移に失敗しました: {e}")
                return "『修正』も『.w_denpyo_l』も見つかりませんでした"
                # 必要ならここで raise するか return で中断

        else:
            logger.info("すでに通勤費画面です")

        logger.info("楽楽清算-通勤費画面")
        # 明細ウィンドウのハンドルを取得（最後のウィンドウ）
        meisai_window = wait.until(
            lambda drv: drv.window_handles[-1]
        )
        # 既存日付の取得
        try:
            daylists = wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "labelColorDefault")))
        except TimeoutException:
            daylists = []
        
        created_days = [d.text for d in daylists]

        # マイパターンボタンをクリック
        meisai_insert_buttons = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".meisai-insert-button")))
        # ボタンの情報を出力
        logger.info(f"取得したmeisai-insert-buttonの数:{len(meisai_insert_buttons)}")
        target_found = False

        for idx, btn in enumerate(meisai_insert_buttons):
            logger.info(f"[{idx}] text: {btn.text}, tag: {btn.tag_name}, class: {btn.get_attribute('class')}")
            if "マイパターン" in btn.text:
                logger.info(f"→ マイパターンボタンをクリックします: index {idx}")
                btn.click()
                target_found = True
                break

        if not target_found:
            logger.info("マイパターンボタンが見つかりませんでした。")

        time.sleep(WAIT_TIME)
        driver.switch_to.window(driver.window_handles[-1])
        logger.info(f"ウィンドウ数: {len(driver.window_handles)}")
        logger.info(f"現在のURL: {driver.current_url}")
        logger.info(f"タイトル: {driver.title}")


        # チェックボックス情報を取得
        trs = wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "d_hover")))
        raku_ptns = []

        for tr in trs:
            ptn = {}
            checkbox = tr.find_element(By.NAME, "kakutei")
            ptn['id'] = checkbox.get_attribute("value")
            tds = tr.find_elements(By.TAG_NAME, "td")
            if len(tds) > 1:
                ptn['label'] = tds[1].text
            raku_ptns.append(ptn)
        
    except TimeoutException as te:
        logger.info(te)
        raise
    except NoSuchElementException as ne:
        logger.info(ne)
        raise
    except Exception as e:
        logger.info(e)
        raise
    return raku_ptns

def initChrome():
    driver = None  # ← 先に初期化
    try:
        driver = create_driver()
        wait = WebDriverWait(driver, 20)

        return driver, wait
    except Exception as e:
        logger.exception("Chromeの初期化に失敗しました。")
        raise


def lambda_handler(event, context):
    try:
        logger.info("受信イベント: %s", json.dumps(event))

        # JSONボディを取得
        body = json.loads(event.get("body", "{}"))
        action = body.get("action")

        # --- CORS ---
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }

        # OPTIONS (プリフライト)
        method = event.get("requestContext", {}).get("http", {}).get("method")
        if method == "OPTIONS":
            return {"statusCode": 200, "headers": headers, "body": ""}

        # ===========================
        # Action: login
        # ===========================
        if action == "login":
            password = body.get("password")
            ok = password == config['DEFAULT']["reco_password"]
            logger.info(f"ログイン{ok}")

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({"login": ok})
            }

        # ===========================
        # Action: getRakuPtn
        # ===========================
        elif action == "getRakuPtn":
            driver, wait = initChrome()
            login_raku(driver, wait)
            ptns = get_input_rakuraku_patterns(driver, wait)
            driver.quit()

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({"patterns": ptns})
            }

        # ===========================
        # Action: submitRows
        # ===========================
        elif action == "submitRows":
            rows = body.get("rows", [])
            if not rows:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "rows is empty"})
                }

            request_id = str(uuid.uuid4())

            # ここでは「処理予約」だけする
            table.put_item(
                Item={
                    "requestId": request_id,
                    "status": "PROCESSING",
                    "createdAt": int(time.time())
                }
            )
            enqueue_job(request_id, rows)

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "requestId": request_id
                })
            }
            
        elif action == "pollResults":
            # ========== 結果ポーリング ==========
            requestId = body.get('requestId')
            
            if not requestId:
                return {
                    'statusCode': 400, 
                    "headers": headers,
                    'body': json.dumps({'error': 'requestId is required'})
                }
                
            # 1. DynamoDBから結果を検索
            response = table.get_item(
                Key={'requestId': requestId}  # プライマリキーで検索
            )
            item = response.get('Item')
            
            if not item:
                # 2. 結果がまだ存在しない場合 (SQSで処理待ち、または処理中)
                # クライアントには 'PROCESSING' ステータスを返して待機させる
                return {
                    'statusCode': 200,
                    "headers": headers,
                    'body': json.dumps({'status': 'PROCESSING'})
                }
            
            # 3. 結果が存在する場合、ステータスをチェック
            status = item.get('status')
            
            if status == 'COMPLETED':
                # 処理成功
                return {
                    'statusCode': 200,
                    "headers": headers,
                    'body': json.dumps({
                        'status': 'COMPLETED',
                        'results': item.get('results', []) # Seleniumで得た結果リスト
                    })
                }
            
            elif status == 'FAILED':
                # 処理失敗（Lambda (2) が DynamoDB に記録したエラー情報）
                return {
                    'statusCode': 200,
                    "headers": headers,
                    'body': json.dumps({
                        'status': 'FAILED',
                        # クライアントのトーストに表示するためのエラーメッセージ
                        'errorMessage': item.get('error', 'サーバー側で予期せぬエラーが発生しました。') 
                    })
                }
            
            else:
                # 処理中 ('PROCESSING' またはその他の未完了ステータス)
                return {
                    'statusCode': 200,
                    "headers": headers,
                    'body': json.dumps({'status': status})
                }
        # ===========================
        # 不明な action
        # ===========================
        else:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "unknown action"})
            }

    except Exception as e:
        logger.exception("lambda_handler error")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }


if __name__ == "__main__":
    mock_event = {
        "body": json.dumps({
            "events": [
                
            ]
        })
    }

    response = lambda_handler(mock_event, {})
    print(response)