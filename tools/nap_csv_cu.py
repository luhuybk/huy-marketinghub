#!/usr/bin/env python3
# Đổi các file CSV quảng cáo Shopee xuất THEO NGÀY (mỗi file một ngày, đúng
# loại "Báo cáo Dịch vụ Hiển thị Shopee") thành history.csv + campaigns.csv
# theo định dạng của tác vụ tự động, để gửi vào Hub bằng push_hub.py.
#
# Dùng khi muốn nạp lịch sử CŨ HƠN thứ tác vụ kéo được:
#   python3 tools/nap_csv_cu.py "<thư mục chứa csv>" ... --out <thư mục ra>
#   cd <thư mục ra>
#   curl -fsS "<Hub>/api/ingest.php?script=1" -o push_hub.py
#   python3 push_hub.py --full --label "Nạp lịch sử từ máy Mac"
# Lần đầu chạy push_hub sẽ báo chờ — vào Cài đặt bấm Cho phép rồi chạy lại.
#
# File CSV không có mã chiến dịch, nên mã được dựng từ (mã sản phẩm, tên): cùng
# khoá với adcampKey() của app, Hub cộng gộp đúng chiến dịch dù số đến từ file
# cũ hay từ tác vụ. Hub chỉ ghi tổng tháng khi có ĐỦ từng ngày của tháng.
import csv, glob, hashlib, os, re, sys


def so(v):
    s = re.sub(r"[₫đ%\s]|vnd", "", str(v or ""), flags=re.I).replace(",", "").strip()
    try:
        return float(s) if s and s != "-" else 0.0
    except ValueError:
        return 0.0


def ngay(dmy):
    d, m, y = re.findall(r"\d+", dmy)[:3]
    return "%s-%02d-%02d" % (y, int(m), int(d))


def doc(f):
    rows = list(csv.reader(open(f, encoding="utf-8-sig")))
    meta = {r[0].strip(): r[1].strip() for r in rows[:12] if len(r) >= 2}
    g = re.findall(r"\d{2}/\d{2}/\d{4}", meta.get("Khoảng thời gian", ""))
    if len(g) < 2 or g[0] != g[1]:
        return None, None, []          # chỉ nhận file đúng một ngày
    hi = next((i for i, r in enumerate(rows) if "Tên Dịch vụ Hiển thị" in r), None)
    if hi is None:
        return None, None, []
    h = rows[hi]
    out = []
    for r in rows[hi + 1:]:
        if len(r) < len(h) - 2 or not r[h.index("Tên Dịch vụ Hiển thị")].strip():
            continue
        x = dict(zip(h, r))
        out.append(x)
    return meta.get("Tên gian hàng", ""), ngay(g[0]), out


def main():
    args = sys.argv[1:]
    ra = args[args.index("--out") + 1] if "--out" in args else "."
    vao = [a for i, a in enumerate(args) if a != "--out" and (i == 0 or args[i - 1] != "--out")]
    files = sorted({f for d in vao for f in glob.glob(os.path.join(d, "**", "*.csv"), recursive=True)})
    hist, camps, bo = [], {}, 0
    for f in files:
        shop, d, rows = doc(f)
        if not shop:
            bo += 1
            continue
        for x in rows:
            ten = x["Tên Dịch vụ Hiển thị"].strip()
            sku = x.get("Mã sản phẩm", "").strip()
            sku = "" if sku == "-" else sku
            cid = "csv" + hashlib.sha1(("%s|%s|%s" % (shop, sku, ten)).encode()).hexdigest()[:12]
            st = x.get("Trạng thái", "")
            camps[(shop, cid)] = [shop, cid, ten, x.get("Phương thức đấu thầu", ""),
                                  "ongoing" if st == "Đang diễn ra" else "paused" if st == "Tạm dừng" else "ended",
                                  "", 1 if "Tùy chỉnh ROAS" in x.get("Phương thức đấu thầu", "") else 0, sku, "", d]
            ban = int(so(x.get("Sản phẩm đã bán")))
            hist.append([shop, d, cid, round(so(x.get("Chi phí"))), round(so(x.get("Doanh số"))),
                         int(so(x.get("Lượt chuyển đổi"))), int(so(x.get("Lượt chuyển đổi"))), ban,
                         int(so(x.get("Số lượt xem"))), int(so(x.get("Số lượt click"))), 0])
    os.makedirs(ra, exist_ok=True)
    with open(os.path.join(ra, "history.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["shop", "date", "campaign_id", "cost", "gmv", "orders", "conv", "sold", "impr", "clicks", "atc"])
        w.writerows(sorted(hist, key=lambda r: (r[0], r[1])))
    with open(os.path.join(ra, "campaigns.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["shop", "campaign_id", "title", "type", "state", "budget", "roas_target", "item_id", "start_time", "last_seen"])
        w.writerows(camps.values())
    ds = sorted({(r[0], r[1]) for r in hist})
    theo = {}
    for s, d in ds:
        theo.setdefault(s, []).append(d)
    for s, l in theo.items():
        print("%s: %d ngày (%s → %s)" % (s, len(l), l[0], l[-1]))
    print("%d dòng · %d chiến dịch · bỏ qua %d file không phải file một ngày" % (len(hist), len(camps), bo))


if __name__ == "__main__":
    main()
