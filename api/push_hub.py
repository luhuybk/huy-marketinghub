#!/usr/bin/env python3
# Gửi số liệu quảng cáo Shopee (history.csv + campaigns.csv) sang Marketing Hub.
#
# Tác vụ "Báo cáo quảng cáo Shopee" tải bản mới nhất của file này mỗi lần chạy:
#   curl -fsS "<Hub>/api/ingest.php?script=1" -o push_hub.py && python3 push_hub.py
#
# Lần đầu chạy, script tự sinh token vào hub_token.txt và in TOKEN_MOI — tác vụ
# phải lưu file đó lại (project_write), không thì mỗi lần chạy lại thành một
# thiết bị mới phải xin phép lại. Chủ bấm "Cho phép" trong Marketing Hub →
# Cài đặt một lần là xong.
#
# Mã thoát: 0 xong · 2 đang chờ chủ cho phép · 3 lỗi mạng · 1 lỗi khác.
import csv, io, json, os, secrets, sys, urllib.request, urllib.error
from datetime import date, timedelta

HUB = "__HUB_INGEST__"
DAYS = 3
for i, a in enumerate(sys.argv):
    if a == "--days" and i + 1 < len(sys.argv):
        DAYS = int(sys.argv[i + 1])
FULL = "--full" in sys.argv
LABEL = "Tác vụ Báo cáo quảng cáo Shopee"


def doc(ten):
    with open(ten, encoding="utf-8-sig") as f:
        return f.read()


def gui(hist_csv, camp_csv, tok):
    body = json.dumps({"token": tok, "label": LABEL, "history_csv": hist_csv,
                       "campaigns_csv": camp_csv}).encode("utf-8")
    rq = urllib.request.Request(HUB, data=body, method="POST", headers={
        "Content-Type": "application/json", "User-Agent": "MarketingHub-push/1"})
    try:
        with urllib.request.urlopen(rq, timeout=180) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"ok": False, "error": "HTTP %d" % e.code}


def loc(rows, head, giu):
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(head)
    for r in rows:
        if giu(r):
            w.writerow([r.get(h, "") for h in head])
    return out.getvalue()


def main():
    tok_file = "hub_token.txt"
    if os.path.exists(tok_file) and len(doc(tok_file).strip()) >= 32:
        tok = doc(tok_file).strip()
    else:
        tok = secrets.token_hex(24)
        with open(tok_file, "w") as f:
            f.write(tok)
        print("TOKEN_MOI: đã tạo hub_token.txt — lưu file này vào project")

    camp = doc("campaigns.csv")
    rd = csv.DictReader(io.StringIO(doc("history.csv")))
    head, rows = rd.fieldnames, list(rd)
    if not rows:
        print("history.csv trống — không có gì để gửi")
        return 1
    cuoi = max(r["date"] for r in rows)
    tu = (date.fromisoformat(cuoi) - timedelta(days=DAYS - 1)).isoformat()

    def mot_lan(giu, nhan):
        try:
            code, d = gui(loc(rows, head, giu), camp, tok)
        except Exception as e:
            print("LOI_MANG: không gọi được Marketing Hub (%s)" % e)
            sys.exit(3)
        if code == 403 and d.get("pending"):
            print("CHO_CHO_PHEP: " + d.get("error", ""))
            sys.exit(2)
        if not d.get("ok"):
            print("LOI: " + str(d.get("error", d)))
            sys.exit(1)
        print("Hub nhận %s: %d dòng · %s · tháng %s · %d bản ghi tháng, %d bản ghi ngày" % (
            nhan, d.get("rows", 0), ", ".join(d.get("shops", [])),
            ", ".join(d.get("months", [])) or "—", d.get("adcamps", 0), d.get("addays", 0)))
        return d

    if FULL:
        d = {"need_full": True}
    else:
        d = mot_lan(lambda r: r["date"] >= tu, "%d ngày gần nhất" % DAYS)
    if d.get("need_full"):
        # Lần đầu: gửi cả lịch sử, chia theo tháng cho gói nhỏ
        for ym in sorted({r["date"][:7] for r in rows}):
            mot_lan(lambda r, ym=ym: r["date"].startswith(ym), "lịch sử tháng " + ym)
    return 0


if __name__ == "__main__":
    sys.exit(main())
