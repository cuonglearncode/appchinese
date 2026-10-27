#!/usr/bin/env bash
# Tự động chuyển vào thư mục dự án và khởi chạy ứng dụng ở chế độ dev
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
npm run dev
