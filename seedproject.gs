// ============================================================
// === SEEDPROJECT.GS — Tạo / Sửa / Xóa Dự Án Mẫu
// ============================================================
// Cách dùng:
//   1. Copy file này vào Google Apps Script Editor
//   2. Chọn hàm cần chạy → nhấn Run
//   3. Xem kết quả trong Execution Log
// ============================================================

// ---------- HELPER: Lấy tên nhân viên theo email ----------
function _getStaffNameByEmail(email) {
  if (!email) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const staffSheet = ss.getSheetByName('Người dùng');
  if (!staffSheet) return email;
  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];
  const emailIdx = headers.indexOf('Email');
  const nameIdx  = headers.indexOf('Họ tên');
  if (emailIdx === -1 || nameIdx === -1) return email;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).trim().toLowerCase() === email.toLowerCase()) {
      return String(data[i][nameIdx]).trim();
    }
  }
  Logger.log('[WARN] Không tìm thấy nhân viên với email: ' + email);
  return email; // fallback
}

// ============================================================
// === DỰ ÁN: AUTOBUSINESSSYSTEM.COM ===
// Chạy 1 lần từ GAS Editor: Run > seedAutoBusinessSystem
// ============================================================
function seedAutoBusinessSystem() {
  // --- Xác định nhân viên phụ trách ---
  const MANAGER_EMAIL   = 'ql2@gmail.com';   // PHÒNG DỰ ÁN – nhiệm vụ chính
  const ASSIGNEE_EMAIL  = 'nv1@gmail.com';   // Nhân viên PDA – nhiệm vụ phụ

  const managerName  = _getStaffNameByEmail(MANAGER_EMAIL);
  const assigneeName = _getStaffNameByEmail(ASSIGNEE_EMAIL);

  Logger.log('Quản lý: '    + managerName  + ' (' + MANAGER_EMAIL  + ')');
  Logger.log('Nhân viên: '  + assigneeName + ' (' + ASSIGNEE_EMAIL + ')');

  // --- Tạo dự án ---
  const projectResult = addProject({
    name:        'AUTOBUSINESSSYSTEM.com',
    description: 'Hệ thống kinh doanh tự động – 1 người vận hành – nhân bản x100. Xây dựng "máy tạo business" bằng AI: 5 hệ thống (Offer / Marketing / Sales / Operation / Analytics), vận hành tự động, nhân bản sang 100+ mô hình kinh doanh.',
    manager:     managerName,
    startDate:   '2026-04-17',
    endDate:     '2026-07-15',
    status:      'Đang thực hiện',
  });

  if (!projectResult.success) {
    Logger.log('❌ Tạo dự án thất bại: ' + projectResult.error);
    return;
  }
  const pid = projectResult.projectId;
  Logger.log('✅ Đã tạo dự án: ' + pid + ' — AUTOBUSINESSSYSTEM.com');

  // ============================================================
  // === DANH SÁCH NHIỆM VỤ ===
  // Nhiệm vụ chính  → assignee: managerName  (PHÒNG DỰ ÁN)
  // Nhiệm vụ phụ    → assignee: assigneeName (Nhân viên PDA)
  // ============================================================
  const tasks = [

    // ──────────────────────────────────────────────────────────
    // GIAI ĐOẠN 1: THIẾT KẾ HỆ THỐNG (17/4 – 01/5)
    // ──────────────────────────────────────────────────────────

    // [CHÍNH] Phòng Dự Án
    {
      name: '[GĐ1] Phân tích quy trình kinh doanh hiện tại',
      description: 'Điều tra & lập bản đồ toàn bộ quy trình: từ tìm kiếm khách hàng → chốt sale → vận hành → CSKH. Xác định bottleneck và điểm có thể AI hóa.',
      assignee: managerName, status: 'Đang thực hiện', priority: 'Cao',
      startDate: '2026-04-17', dueDate: '2026-04-22', completion: 20,
    },
    {
      name: '[GĐ1] Xác định công việc lặp lại & cơ hội tự động hóa',
      description: 'Liệt kê mọi tác vụ lặp lại trong 5 hệ (Offer/Marketing/Sales/Operation/Analytics). Đánh giá mức độ khả thi tự động hóa bằng AI/automation cho từng tác vụ.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-04-22', dueDate: '2026-04-25', completion: 0,
    },
    {
      name: '[GĐ1] Thiết kế kiến trúc 5 AI System',
      description: 'Vẽ sơ đồ kiến trúc chi tiết 5 hệ: (1) OFFER SYSTEM – nghiên cứu TT, phân tích nhu cầu, tạo ý tưởng; (2) MARKETING – content tự động, lên lịch, SEO; (3) SALES – landing page, email automation, chatbot; (4) OPERATION – xử lý đơn, CSKH, giao hàng; (5) ANALYTICS – báo cáo, tracking, tối ưu.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-04-25', dueDate: '2026-04-28', completion: 0,
    },
    {
      name: '[GĐ1] Thiết kế workflow tổng thể AutoBusinessSystem',
      description: 'Vẽ workflow vòng lặp kinh doanh tự động: Sản phẩm → Marketing → Bán hàng → Vận hành → Phân tích → tối ưu → lặp lại. Xác định điểm tích hợp giữa các AI Agent.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-04-28', dueDate: '2026-05-01', completion: 0,
    },

    // [CHÍNH] GĐ1 bổ sung — Phân tích mô hình kinh doanh & chuẩn hóa quy trình
    {
      name: '[GĐ1] Phân tích mô hình kinh doanh mục tiêu',
      description: 'Xác định rõ: (1) Ngành kinh doanh áp dụng đầu tiên (khóa học / dịch vụ / sản phẩm số / affiliate), (2) Khách hàng mục tiêu — persona chi tiết, (3) Hành trình khách hàng — từ nhận biết → mua → trung thành. Output: tài liệu mô hình kinh doanh 1 trang.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-04-17', dueDate: '2026-04-21', completion: 0,
    },
    {
      name: '[GĐ1] Chuẩn hóa quy trình Marketing → Sales → Delivery → CSKH',
      description: 'Vẽ flow đầy đủ 4 bước: Marketing (thu hút) → Sales (chốt) → Delivery (giao sản phẩm/dịch vụ) → CSKH (giữ chân). Đánh dấu từng bước: lặp lại hay không, AI hóa được hay không. Output: process map chuẩn.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-04-21', dueDate: '2026-04-24', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA
    {
      name: '[GĐ1-P] Thu thập & mô tả quy trình hiện tại',
      description: 'Hỗ trợ thu thập tài liệu, phỏng vấn các bên liên quan, ghi lại các quy trình đang chạy thủ công vào tài liệu chuẩn.',
      assignee: assigneeName, status: 'Đang thực hiện', priority: 'Trung bình',
      startDate: '2026-04-17', dueDate: '2026-04-20', completion: 10,
    },
    {
      name: '[GĐ1-P] Lập danh sách công việc lặp lại theo 5 hệ thống',
      description: 'Tổng hợp danh sách chi tiết các tác vụ lặp lại tương ứng với từng hệ: Offer, Marketing, Sales, Operation, Analytics. Format chuẩn để PHÒNG DỰ ÁN review.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-04-20', dueDate: '2026-04-24', completion: 0,
    },

    // ──────────────────────────────────────────────────────────
    // GIAI ĐOẠN 2: BUILD AI SYSTEM (01/5 – 01/6)
    // ──────────────────────────────────────────────────────────

    // [CHÍNH] Phòng Dự Án
    {
      name: '[GĐ2] Viết prompt chuẩn OFFER SYSTEM',
      description: 'Xây dựng bộ prompt cho AI Agent làm nhiệm vụ: nghiên cứu thị trường tự động, phân tích nhu cầu khách hàng, tạo ý tưởng sản phẩm & offer phù hợp phân khúc.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-05-01', dueDate: '2026-05-10', completion: 0,
    },
    {
      name: '[GĐ2] Viết prompt chuẩn MARKETING SYSTEM',
      description: 'Xây dựng prompt cho AI Agent: tự động tạo content (bài đăng, caption, blog), lên lịch đăng đa kênh, tối ưu SEO, quản lý social media.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-05-08', dueDate: '2026-05-18', completion: 0,
    },
    {
      name: '[GĐ2] Viết prompt chuẩn SALES & OPERATION SYSTEM',
      description: 'Prompt cho SALES: landing page copy, email sequence tự động, chatbot chốt sale. Prompt cho OPERATION: xử lý đơn hàng, kịch bản CSKH, quy trình giao hàng tự động.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-05-15', dueDate: '2026-05-25', completion: 0,
    },
    {
      name: '[GĐ2] Setup automation workflows (Make / n8n / Zapier)',
      description: 'Triển khai thực tế các automation workflow trên nền tảng Make.com / n8n / Zapier. Kết nối: CRM, email marketing, social, Telegram Bot, Google Sheets.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-05-20', dueDate: '2026-06-01', completion: 0,
    },
    {
      name: '[GĐ2] Kết nối API các dịch vụ bên ngoài',
      description: 'Tích hợp API: OpenAI / Gemini (AI), Mailchimp / ActiveCampaign (email), Meta / TikTok (social), Shopify / WooCommerce (bán hàng), Google Analytics (tracking).',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-05-22', dueDate: '2026-06-01', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA
    {
      name: '[GĐ2-P] Xây dựng template landing page chuẩn',
      description: 'Tạo 3 template landing page (khóa học, dịch vụ, affiliate) theo cấu trúc: Hook → Problem → Solution → Proof → CTA. Có thể copy-paste và tuỳ chỉnh trong <2h.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-05', dueDate: '2026-05-18', completion: 0,
    },
    {
      name: '[GĐ2-P] Xây dựng template chatbot chốt sale',
      description: 'Tạo kịch bản chatbot (flow diagram + copy) cho 3 tình huống: hỏi giá, so sánh đối thủ, phản đối chưa mua. Tích hợp được vào ManyChat / Manychat / Chatfuel.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-12', dueDate: '2026-05-22', completion: 0,
    },
    {
      name: '[GĐ2-P] Kết nối dữ liệu: CRM + Google Sheet + Email System',
      description: 'Setup pipeline dữ liệu: CRM (HubSpot/Notion) ↔ Google Sheet (tracking) ↔ Email system (Mailchimp/Brevo). Đảm bảo lead mới tự động vào CRM và nhận email welcome.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-20', dueDate: '2026-06-01', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA (cũ, giữ nguyên)
      description: 'Xây dựng 50+ template content theo từng kênh (Facebook, TikTok, Email, Blog). Phân loại theo mục đích: nhận diện thương hiệu, chốt sale, CSKH.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-01', dueDate: '2026-05-15', completion: 0,
    },
    {
      name: '[GĐ2-P] Kiểm thử & phản hồi các prompt draft',
      description: 'Chạy thử nghiệm từng prompt trên ChatGPT/Gemini, ghi nhận chất lượng output, đề xuất cải thiện cho PHÒNG DỰ ÁN.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-12', dueDate: '2026-06-01', completion: 0,
    },
    {
      name: '[GĐ2-P] Lập tài liệu setup từng automation workflow',
      description: 'Ghi lại step-by-step hướng dẫn setup từng workflow trên Make/n8n/Zapier. Tạo screenshots & mô tả để bất kỳ ai cũng triển khai được.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Thấp',
      startDate: '2026-05-20', dueDate: '2026-06-01', completion: 0,
    },

    // ──────────────────────────────────────────────────────────
    // GIAI ĐOẠN 3: TEST & VẬN HÀNH (01/6 – 15/6)
    // ──────────────────────────────────────────────────────────

    // [CHÍNH] Phòng Dự Án
    {
      name: '[GĐ3] Triển khai Marketing tự động (đăng bài & nội dung AI)',
      description: 'Kích hoạt toàn bộ automation marketing: lên lịch đăng bài đa kênh (Facebook/TikTok/Blog), AI tự tạo content theo lịch, SEO on-page tự động. Đo: số bài/tuần, lượt reach ban đầu.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-01', dueDate: '2026-06-07', completion: 0,
    },
    {
      name: '[GĐ3] Triển khai Sales System (landing page + chatbot + email funnel)',
      description: 'Go-live toàn bộ pipeline sales: landing page publish, chatbot kích hoạt, email sequence tự động gửi. Kiểm tra: opt-in rate, email open rate, chatbot response rate.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-06-03', dueDate: '2026-06-08', completion: 0,
    },
    {
      name: '[GĐ3] Triển khai Operation System (xử lý đơn hàng & CSKH tự động)',
      description: 'Vận hành: xử lý đơn hàng tự động (confirm, deliver, invoice), CSKH tự động qua chatbot/email. Mục tiêu: 80% đơn xử lý không cần can thiệp thủ công.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-05', dueDate: '2026-06-10', completion: 0,
    },
    {
      name: '[GĐ3] Theo dõi & giám sát hệ thống liên tục',
      description: 'Setup monitoring dashboard: kiểm tra lỗi automation hàng ngày, đảm bảo workflow chạy đúng, cảnh báo khi trigger thất bại. Mục tiêu: uptime ≥95%, phát hiện lỗi trong <1h.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-01', dueDate: '2026-06-15', completion: 0,
    },
    {
      name: '[GĐ3] Test toàn bộ workflow với business thực tế đầu tiên',
      description: 'Chọn 1 ngành nghề cụ thể (VD: khóa học online) → chạy thực tế toàn bộ vòng lặp 5 hệ thống. Ghi nhận mọi điểm cần chỉnh sửa.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-06-01', dueDate: '2026-06-10', completion: 0,
    },
    {
      name: '[GĐ3] Đo lường KPI hiệu quả hệ thống',
      description: 'Đo: (1) Giảm % thời gian thủ công (mục tiêu ≥70%), (2) Tăng volume content (mục tiêu 5–10x), (3) Tỷ lệ chuyển đổi so với trước. Lập báo cáo kết quả.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-05', dueDate: '2026-06-12', completion: 0,
    },
    {
      name: '[GĐ3] Tối ưu prompt & cải thiện automation sau test',
      description: 'Dựa trên kết quả thực tế: tinh chỉnh prompt, sửa lỗi automation, tối ưu trigger và điều kiện workflow. Mục tiêu: hệ thống chạy ổn định ≥95%.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-10', dueDate: '2026-06-15', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA
    {
      name: '[GĐ3-P] Ghi nhận kết quả test & lập bug report',
      description: 'Theo dõi quá trình test, ghi lại mọi lỗi, hành vi bất ngờ và điểm không tối ưu. Lập bug report chuẩn với mức độ ưu tiên.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-06-01', dueDate: '2026-06-10', completion: 0,
    },
    {
      name: '[GĐ3-P] Báo cáo đề xuất cải thiện sau test',
      description: 'Tổng hợp phản hồi thực tế, viết báo cáo đề xuất 10 cải thiện ưu tiên nhất. Trình bày cho PHÒNG DỰ ÁN để ra quyết định tối ưu.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-06-10', dueDate: '2026-06-15', completion: 0,
    },

    // ──────────────────────────────────────────────────────────
    // GIAI ĐOẠN 4: CHUẨN HÓA & NHÂN BẢN (15/6 – 15/7)
    // ──────────────────────────────────────────────────────────

    // [CHÍNH] Phòng Dự Án
    {
      name: '[GĐ4] Phân tích hiệu suất hệ thống (Conversion / Traffic / ROI)',
      description: 'Đo lường toàn diện sau giai đoạn vận hành: conversion rate từng bước funnel, traffic source, ROI marketing, chi phí/đơn hàng. Lập báo cáo điểm mạnh/yếu từng hệ để ưu tiên cải tiến.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-15', dueDate: '2026-06-22', completion: 0,
    },
    {
      name: '[GĐ4] Tối ưu hệ thống toàn diện (prompt + workflow + automation)',
      description: 'Dựa trên phân tích hiệu suất: (1) Cải tiến prompt AI yếu kém, (2) Tối ưu workflow có bottleneck, (3) Tăng % automation — giảm còn lại thủ công. Mục tiêu: cải thiện ≥30% KPI sau tối ưu.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-20', dueDate: '2026-06-28', completion: 0,
    },
    {
      name: '[GĐ4] Đóng gói hệ thống thành template hoàn chỉnh',
      description: 'Chuẩn hóa toàn bộ: prompt library, workflow templates, API configs, content templates. Đóng gói thành bộ "1-click deploy" cho 1 business mới.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-15', dueDate: '2026-06-30', completion: 0,
    },
    {
      name: '[GĐ4] Tạo checklist triển khai chuẩn',
      description: 'Soạn checklist step-by-step để triển khai 1 business mới từ template. Từ: chọn ngành → setup AI agents → kết nối automation → go live. Mục tiêu: triển khai trong ≤48h.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Cao',
      startDate: '2026-06-25', dueDate: '2026-07-05', completion: 0,
    },
    {
      name: '[GĐ4] Nhân bản thử nghiệm sang 3 ngành nghề khác',
      description: 'Áp dụng template & checklist để triển khai thực tế cho 3 ngành: (1) Khóa học online, (2) Dịch vụ freelance, (3) Affiliate marketing. Xác nhận hệ thống nhân bản được.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-07-01', dueDate: '2026-07-15', completion: 0,
    },
    {
      name: '[GĐ4] Xây dựng công thức nhân bản x100',
      description: 'Đúc kết công thức: 1 hệ thống chuẩn + 1 ngành nghề + 1 bộ content = 1 business mới. Viết playbook để scale từ 1 → 10 → 50 → 100 business.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Khẩn cấp',
      startDate: '2026-07-08', dueDate: '2026-07-15', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA
    {
      name: '[GĐ4-P] Soạn tài liệu hướng dẫn sử dụng template',
      description: 'Viết tài liệu chi tiết hướng dẫn sử dụng bộ template: mô tả từng thành phần, cách tuỳ chỉnh theo ngành, FAQ thường gặp.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-06-15', dueDate: '2026-06-30', completion: 0,
    },
    {
      name: '[GĐ4-P] Chuẩn bị nội dung demo & video nhân bản',
      description: 'Ghi lại màn hình / chuẩn bị slide trình bày quá trình nhân bản 1 business mới từ template. Sản phẩm: video demo ≤10 phút hoặc slide 20 trang.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Thấp',
      startDate: '2026-07-01', dueDate: '2026-07-12', completion: 0,
    },

    // ──────────────────────────────────────────────────────────
    // NHÓM 5: QUẢN LÝ & KIỂM SOÁT (xuyên suốt dự án)
    // ──────────────────────────────────────────────────────────

    // [CHÍNH] Phòng Dự Án
    {
      name: '[QL5] Quản lý tiến độ toàn dự án',
      description: 'Duy trì hệ QLDA: tạo & cập nhật task từng tuần, theo dõi completion %, họp review tiến độ 2 tuần/lần. Đảm bảo không có task nào bị bỏ sót quá 7 ngày.',
      assignee: managerName, status: 'Đang thực hiện', priority: 'Cao',
      startDate: '2026-04-17', dueDate: '2026-07-15', completion: 5,
    },
    {
      name: '[QL5] Đánh giá hiệu quả từng hệ AI (KPI vs thủ công)',
      description: 'Thiết lập scorecard so sánh: AI vs con người trên từng hệ (thời gian, chi phí, chất lượng output). Đánh giá định kỳ 2 tuần. Output: báo cáo AI efficiency theo từng hệ.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-06-01', dueDate: '2026-07-15', completion: 0,
    },
    {
      name: '[QL5] Tối ưu nguồn lực — giảm thủ công, tăng automation',
      description: 'Mỗi 2 tuần review: việc nào còn làm tay có thể automation? Đặt mục tiêu: giảm 70% thời gian thủ công so với baseline. Ghi log từng tác vụ đã được AI hoá thành công.',
      assignee: managerName, status: 'Chưa bắt đầu', priority: 'Trung bình',
      startDate: '2026-05-15', dueDate: '2026-07-15', completion: 0,
    },

    // [PHỤ] Nhân Viên PDA
    {
      name: '[QL5-P] Cập nhật báo cáo tiến độ hàng tuần',
      description: 'Tổng hợp báo cáo tuần: (1) Nhiệm vụ hoàn thành, (2) Đang làm, (3) Bị chặn, (4) Kế hoạch tuần tới. Gửi cho PHÒNG DỰ ÁN trước 9h sáng thứ Hai.',
      assignee: assigneeName, status: 'Đang thực hiện', priority: 'Trung bình',
      startDate: '2026-04-17', dueDate: '2026-07-15', completion: 5,
    },
    {
      name: '[QL5-P] Ghi nhận & đề xuất cải tiến quy trình vận hành',
      description: 'Trong quá trình thực thi, ghi lại mọi bottleneck, lãng phí, lỗi thường gặp. Tổng hợp thành danh sách đề xuất cải tiến hàng tháng, trình PHÒNG DỰ ÁN quyết định.',
      assignee: assigneeName, status: 'Chưa bắt đầu', priority: 'Thấp',
      startDate: '2026-05-01', dueDate: '2026-07-15', completion: 0,
    },
  ];

  // --- Thêm từng nhiệm vụ ---
  let successCount = 0;
  for (const t of tasks) {
    const r = addTask({ ...t, projectId: pid });
    if (r.success) {
      successCount++;
      Logger.log('  ✅ ' + t.name + ' [' + t.status + '] => ' + r.taskId);
    } else {
      Logger.log('  ❌ Lỗi "' + t.name + '": ' + r.error);
    }
  }

  Logger.log('');
  Logger.log('══════════════════════════════════════════════════');
  Logger.log('AUTOBUSINESSSYSTEM.com: ' + successCount + '/' + tasks.length + ' nhiệm vụ đã tạo');
  Logger.log('Project ID : ' + pid);
  Logger.log('Quản lý   : ' + managerName   + ' (' + MANAGER_EMAIL  + ')');
  Logger.log('Nhân viên : ' + assigneeName  + ' (' + ASSIGNEE_EMAIL + ')');
  Logger.log('══════════════════════════════════════════════════');
}
