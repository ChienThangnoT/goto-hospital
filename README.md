# Đi Bệnh Viện Online — chơi cùng nhau

Game dùng WebSocket để người chơi trong cùng bệnh viện nhìn thấy vị trí và nhân vật của nhau. Máy chủ này phục vụ cả trang game lẫn kết nối online.

## Chạy thử trên máy

Cần Node.js 18 trở lên. Đặt `goto_hospital.html`, `server.js` và `package.json` cùng một thư mục, sau đó chạy:

```powershell
npm install
npm start
```

Mở <http://localhost:3000>. Để kiểm tra nhiều người, mở trang đó trong hai cửa sổ trình duyệt và bắt đầu game ở cả hai.

## Đưa lên mạng bằng Render

1. Tạo một GitHub repository **riêng cho game**; đừng tải toàn bộ thư mục Downloads lên. Chỉ đưa `goto_hospital.html`, `server.js`, `package.json`, `render.yaml` và `README.md` vào repository.
2. Trong Render, chọn **New → Blueprint**, kết nối repository đó và triển khai dịch vụ `di-benh-vien-online`.
3. Mở đường dẫn HTTPS mà Render cấp. Gửi cùng đường dẫn đó cho bạn bè; mỗi người tạo hoặc tiếp tục nhân vật rồi vào game.

Render có thể mất một lúc để khởi động lại dịch vụ miễn phí sau thời gian không hoạt động. Trong lúc máy chủ ngủ, người chơi chưa thể kết nối.

## Phạm vi hiện tại

Đây là một phòng công khai: mọi người chơi trên máy chủ đều chia sẻ cùng bản đồ và nhìn thấy nhau khi ở gần. Tên và diện mạo nhân vật được gửi để hiển thị; tiến trình, vật phẩm và nhiệm vụ vẫn riêng trên trình duyệt mỗi người. Chưa có tài khoản, chat, phòng riêng hay đồng bộ tiến trình. Dịch vụ công khai giới hạn 80 kết nối cùng lúc.
