# ⚡ TinyURL Production System (System Design - Chương 8)

Dự án mô phỏng hoàn chỉnh kiến trúc hệ thống rút gọn đường dẫn quy mô lớn (URL Shortener) dựa trên tài liệu **System Design Interview - Chương 8**, tích hợp giao diện giám sát trực quan theo thời gian thực (Real-time Architecture Dashboard).

---

## 1. Kiến trúc & Thông số thiết kế cốt lõi

* **Ước tính quy mô (Back-of-the-envelope estimation):**
  * **Tốc độ ghi (Write):** 100 triệu URL/ngày (~1.160 URL/giây).
  * **Tốc độ đọc (Read):** Tỷ lệ Đọc/Ghi là **10:1** (~11.600 yêu cầu/giây).
  * **Độ dài chuỗi rút gọn:** **7 ký tự** sử dụng bộ ký tự Base 62 (`0-9`, `a-z`, `A-Z`), cung cấp không gian lưu trữ lên tới $62^7 \approx 3,5 \text{ nghìn tỷ}$ URL (đáp ứng đủ 365 tỷ URL trong 10 năm).
* **Thuật toán sinh mã không xung đột:** Sử dụng bộ sinh khóa chính duy nhất (**Unique ID Generator**) kết hợp chuyển đổi sang hệ cơ số 62 (**Base 62 Conversion**), đồng thời tự động tái sử dụng mã cũ nếu đường dẫn gốc đã tồn tại (Idempotency).
* **Tối ưu hiệu năng đọc:** Tích hợp tầng **Memory Cache (RAM)** giúp truy xuất đường dẫn phổ biến với độ trễ dưới `1ms`, giảm tải tối đa cho **Relational Database**.
* **Cơ chế điều hướng kép:** Hỗ trợ kiểm thử trực tiếp cả **HTTP 301 Redirect** (tối ưu băng thông nhờ bộ nhớ đệm trình duyệt) và **HTTP 302 Redirect** (phục vụ thống kê, đếm lượt nhấp chuột).
* **Bảo vệ chống lạm dụng (Rate Limiter):** Giới hạn tối đa **5 yêu cầu tạo link / phút / IP**, tự động chặn spam với mã lỗi **HTTP 429 (`Too Many Requests`)**.

---

## 2. Cấu trúc thư mục dự án

```text
url-shortener-demo/
├── public/
│   └── index.html           # Giao diện Dashboard nền tối, sơ đồ kiến trúc động & tạo mã QR
├── src/
│   ├── config/
│   │   └── db.js            # Mô phỏng Relational Database (bảng url) & Unique ID Generator
│   ├── controllers/
│   │   └── urlController.js # Xử lý nghiệp vụ API, Rate Limiter, Cache Hit/Miss & Trace Logs
│   ├── routes/
│   │   └── urlRoutes.js     # Định tuyến RESTful API (/api/v1/data/shorten & /:shortUrl)
│   ├── utils/
│   │   ├── base62.js        # Thuật toán chuyển đổi ID sang chuỗi Base 62
│   │   └── cache.js         # Mô phỏng tầng Memory Cache trên RAM
│   └── server.js            # Khởi chạy máy chủ Express
├── .env                     # Cấu hình biến môi trường (PORT, BASE_URL)
├── database.json            # Tệp lưu trữ dữ liệu bền vững (tự động sinh khi chạy)
├── package.json             # Khai báo thư viện phụ thuộc (express, dotenv)
└── README.md                # Tài liệu hướng dẫn cài đặt và lộ trình demo
```

---

## 3. Hướng dẫn cài đặt & Khởi chạy hệ thống

### Bước 1: Cài đặt thư viện
Mở Terminal tại thư mục gốc `url-shortener-demo` và chạy lệnh:
```bash
npm install
```

### Bước 2: Làm sạch dữ liệu nháp (Tùy chọn trước khi báo cáo)
Nếu muốn bảng Database trống trơn, sạch sẽ trước khi trình diễn, hãy xóa tệp `database.json` ở thư mục gốc (hệ thống sẽ tự động tạo lại tệp mới khi khởi động).

### Bước 3: Khởi chạy máy chủ Backend (Terminal 1)
Chạy lệnh sau để khởi động máy chủ nội bộ tại cổng `3000`:
```bash
node src/server.js
```
> **Dấu hiệu thành công:** Terminal hiển thị dòng thông báo `🚀 Server URL Shortener đang chạy tại: http://localhost:3000`.

### Bước 4: Đưa hệ thống lên Internet công khai (Terminal 2)
Giữ nguyên Terminal 1 đang chạy, mở thêm một cửa sổ **Terminal thứ hai** (bấm dấu `+` trong VS Code) và chọn **1 trong 2 phương án** dưới đây tùy theo cấu hình tường lửa (Firewall) của mạng hiện tại:

#### Phương án A: Sử dụng Cloudflare Tunnel (Khuyên dùng - Truy cập trực tiếp, không trang trung gian)
Áp dụng cho các môi trường mạng thông thoáng (mở cổng kết nối mặc định). Lệnh dưới đây ép giao thức chạy qua **IPv4** và **HTTP/2** để đảm bảo tính ổn định định tuyến:
```bash
npx cloudflared tunnel --url http://localhost:3000 --protocol http2 --edge-ip-version 4
```
* Đợi khoảng 5–10 giây, sao chép đường dẫn có đuôi **`.trycloudflare.com`** hiển thị trong khung và mở trên trình duyệt.
* **Ưu điểm:** Không giới hạn thời gian phiên làm việc, quét mã QR trên thiết bị di động sẽ điều hướng thẳng vào giao diện hệ thống ngay lập tức.

#### Phương án B: Sử dụng Pinggy Tunnel (Dự phòng khi tường lửa chặn cổng 7844)
Trong trường hợp hạ tầng mạng nội bộ (Enterprise/Campus Firewall) chặn cổng `7844` của Cloudflare (gây lỗi `i/o timeout` hoặc `critical failures`), chuyển sang sử dụng **Pinggy** để định tuyến qua cổng HTTPS tiêu chuẩn **443**:
```bash
ssh -t -p 443 -o ServerAliveInterval=30 -R0:localhost:3000 -o StrictHostKeyChecking=no free@ap.a.pinggy.io
```
*(Nếu Terminal yêu cầu nhập `password:`, chỉ cần nhấn thẳng phím **Enter**).*
* Sao chép đường dẫn có đuôi **`.free.pinggy.net`** hiển thị trên Terminal và mở trên trình duyệt.
* **Lưu ý:** Ở lần truy cập đầu tiên trên mỗi thiết bị, chọn **`Enter site`** tại màn hình xác nhận của Pinggy để tiếp tục. Phiên kết nối miễn phí có thời hạn **60 phút**.

---

## 4. Lộ trình Demo trực tiếp trên giao diện (Web UI)

1. **Giới thiệu tổng quan & Ước tính quy mô (Bước 1 - Chương 8):**
   * Chỉ vào 4 thẻ KPI trên cùng để trình bày bài toán lưu lượng (tỷ lệ Đọc/Ghi **10:1**, sức chứa **3,5 nghìn tỷ** URL với độ dài **7 ký tự Base 62**).
2. **Demo luồng Ghi & Quét QR thực tế (Bước 2 & 3):**
   * Nhập một đường dẫn thật bất kỳ (ví dụ `https://youtube.com` hoặc `https://vnexpress.net`) và bấm **Rút gọn ngay**.
   * Quan sát sơ đồ kiến trúc phát sáng qua từng tầng: `Client -> Rate Limiter -> ID Gen + Base 62 -> Memory Cache -> Relational DB`.
   * Dùng camera điện thoại thật quét **mã QR Code** ở góc phải màn hình để chứng minh khả năng điều hướng thực tế qua Internet.
3. **Demo tối ưu hiệu năng đọc: Cache Hit vs Cache Miss (Bước 3):**
   * Bấm nút **Test Redirect 302 ↗** và quan sát khung **Live System Trace Logs** báo xanh `Cache HIT` với tốc độ truy xuất dưới `1ms` từ RAM.
   * Bấm nút **Xóa Cache (Test Miss)**, sau đó mở lại đường link để chứng minh hệ thống tự động kích hoạt `Cache MISS -> DB`, lấy dữ liệu từ đĩa cứng và đồng bộ ngược lại lên RAM.
4. **So sánh chuyển hướng HTTP 301 và HTTP 302:**
   * Bấm nút **302** nhiều lần để thấy bộ đếm **Clicks** trên server tăng liên tục (phục vụ phân tích dữ liệu).
   * Bấm nút **301** hai lần liên tiếp để giải thích cơ chế trình duyệt tự lưu bộ nhớ đệm, giúp giảm tải cho máy chủ ở các lần truy cập sau.
5. **Demo cơ chế bảo vệ chống Spam (Bước 4 - Wrap up):**
   * Bấm nút **🛡️ Test Rate Limiter (Spam 6 lần)** ở góc trên cùng bên phải.
   * Hệ thống sẽ cho phép 5 yêu cầu đầu thành công và chặn đứng yêu cầu thứ 6 với cảnh báo đỏ **HTTP 429 (`Rate Limit Exceeded!`)**, chứng minh khả năng bảo vệ tài nguyên hệ thống trước tấn công spam.

---

## 5. Hướng dẫn kiểm thử API qua dòng lệnh (cURL)

Ngoài giao diện trực quan, bạn có thể kiểm tra trực tiếp mã phản hồi HTTP Header (`301`, `302`, `429`) bằng Terminal (sử dụng cú pháp **Windows CMD**):

### 5.1. Tạo đường dẫn rút gọn (`POST /api/v1/data/shorten`)
```cmd
curl.exe -X POST http://localhost:3000/api/v1/data/shorten -H "Content-Type: application/json" -d "{\"longUrl\": \"https://vnexpress.net\"}"
```
* **Kết quả mẫu trả về:**
  ```json
  {
    "message": "URL đã tồn tại trong hệ thống (Tái sử dụng mã cũ)",
    "data": { "id": 1000000000002, "shortURL": "hBxM5A6", "longURL": "https://vnexpress.net", "clicks": 0 },
    "fullShortUrl": "http://localhost:3000/hBxM5A6",
    "latency": "3.44"
  }
  ```

### 5.2. Kiểm tra mã trạng thái điều hướng `HTTP 302` (`GET /:shortUrl`)
*(Thay `hBxM5A6` bằng mã 7 ký tự nhận được ở bước 5.1)*
```cmd
curl.exe -I http://localhost:3000/hBxM5A6
```
* **Kết quả kỳ vọng:** Trả về Header **`HTTP/1.1 302 Found`** kèm dòng **`Location: https://vnexpress.net`** (cho phép server thống kê mọi lượt truy cập).
* *(Tùy chọn kiểm tra `HTTP 301`)*: Gọi `curl.exe -I "http://localhost:3000/hBxM5A6?type=301"` (hoặc bấm nút **301** trên giao diện) để kiểm chứng trạng thái **`HTTP/1.1 301 Moved Permanently`** giúp trình duyệt tự lưu cache điều hướng.

### 5.3. Giả lập tấn công Spam kích hoạt `HTTP 429` (Rate Limiter)
Gửi liên tiếp 6 yêu cầu tạo link trong cùng 1 phút (vượt ngưỡng 5 yêu cầu/phút/IP):
```cmd
for /L %i in (1,1,6) do @curl.exe -s -o nul -w "Lan %i: HTTP %{http_code}\n" -X POST http://localhost:3000/api/v1/data/shorten -H "Content-Type: application/json" -d "{\"longUrl\": \"https://vnexpress.net\"}"
```
* **Kết quả thực tế:**
  ```text
  Lan 1: HTTP 200
  Lan 2: HTTP 200
  Lan 3: HTTP 200
  Lan 4: HTTP 200
  Lan 5: HTTP 200
  Lan 6: HTTP 429
  ```