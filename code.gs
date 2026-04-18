// code.gs
// === CẤU HÌNH CHUNG ===
// Tên các sheet trong Google Spreadsheet
const TASK_SHEET_NAME = 'Nhiệm vụ';
const PROJECT_SHEET_NAME = 'Dự án/Nhiệm vụ';
const STAFF_SHEET_NAME = 'Người dùng';
const NOTIFICATION_SHEET_NAME = 'Thông báo';
const TASK_NOTIFICATION_SHEET_NAME = 'Hàng Đợi TG';

// === "Nhiệm vụ" ===
const TASK_ID_COLUMN_NAME = 'Mã nhiệm vụ';
const TASK_PROJECT_ID_COLUMN_NAME = 'Mã dự án';
const TASK_NAME_COLUMN_NAME = 'Tên nhiệm vụ';
const TASK_DESC_COLUMN_NAME = 'Mô tả nhiệm vụ';
const TASK_ASSIGNEE_COLUMN_NAME = 'Người thực hiện';
const TASK_STATUS_COLUMN_NAME = 'Trạng thái';
const TASK_PRIORITY_COLUMN_NAME = 'Ưu tiên';
const TASK_START_DATE_COLUMN_NAME = 'Ngày bắt đầu';
const TASK_DUE_DATE_COLUMN_NAME = 'Hạn chót';
const TASK_COMPLETION_COLUMN_NAME = 'Tiến độ (%)';
const TASK_REPORT_DATE_COLUMN_NAME = 'Ngày hoàn thành';
const TASK_TARGET_COLUMN_NAME = 'Mục tiêu';
const TASK_RESULT_LINKS_COLUMN_NAME = 'Link kết quả';
const TASK_OUTPUT_COLUMN_NAME = 'Kết quả đầu ra';
const TASK_NOTES_COLUMN_NAME = 'Ghi chú';
const TASK_CREATED_BY_COLUMN_NAME = 'Người tạo';
const TASK_COMMENTS_COLUMN_NAME = 'Bình luận';

// === Cột sheet "Dự án" ===
const PROJECT_ID_COLUMN_NAME = 'Mã dự án';
const PROJECT_NAME_COLUMN_NAME = 'Tên dự án';
const PROJECT_DESC_COLUMN_NAME = 'Mô tả dự án';
const PROJECT_MANAGER_COLUMN_NAME = 'Quản lý dự án';
const PROJECT_START_DATE_COLUMN_NAME = 'Ngày bắt đầu';
const PROJECT_END_DATE_COLUMN_NAME = 'Ngày kết thúc';
const PROJECT_STATUS_COLUMN_NAME = 'Trạng thái dự án';
const PROJECT_TASKS_JSON_COLUMN_NAME = 'Nhiệm vụ JSON';
const PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME = 'Nhật ký JSON';
const PROJECT_PARTICIPANTS_COLUMN_NAME = 'Người tham gia';

// === Cột sheet "Người dùng" ===
const STAFF_ID_COLUMN_NAME = 'Mã NV';
const STAFF_NAME_COLUMN_NAME = 'Họ tên';
const STAFF_EMAIL_COLUMN_NAME = 'Email';
const STAFF_POSITION_COLUMN_NAME = 'Chức vụ';
const STAFF_ROLE_COLUMN_NAME = 'Phân quyền';
const STAFF_PASSWORD_COLUMN_NAME = 'Mật khẩu';
const STAFF_PHONE_COLUMN_NAME = 'Điện thoại';
const STAFF_BIRTHDAY_COLUMN_NAME = 'Ngày sinh';
const STAFF_DEPARTMENT_COLUMN_NAME = 'Phòng ban';
const STAFF_BIO_COLUMN_NAME = 'Giới thiệu';
const STAFF_AVATAR_COLUMN_NAME = 'Avatar';
// === Coin economy columns (added to staff sheet) ===
const STAFF_COIN_COLUMN_NAME          = 'Coin';
const STAFF_BOOST_EXPIRES_COLUMN_NAME = 'BoostExpires';
const STAFF_STREAK_FREEZE_COLUMN_NAME = 'StreakFreeze';
const STAFF_LAST_DAILY_COLUMN_NAME    = 'LastDailyReward';
const STAFF_LAST_STREAK_COLUMN_NAME   = 'LastStreakReward';
const STAFF_LAST_LEVEL_COLUMN_NAME    = 'LastRewardedLevel';
const COIN_LOG_SHEET_NAME             = 'CoinLog';

// === Cột sheet "Nhật ký hoạt động" ===
const LOG_TIMESTAMP_COLUMN_NAME = 'Thời gian';
const LOG_ACTION_COLUMN_NAME = 'Hành động';
const LOG_USER_COLUMN_NAME = 'Người thực hiện';
const LOG_DETAILS_COLUMN_NAME = 'Chi tiết';

// === Cột sheet "Chat" ===
const CHAT_SHEET_NAME = 'Chat';
const CHAT_ID_COLUMN_NAME = 'Mã chat';
const CHAT_DATE_COLUMN_NAME = 'Ngày';
const CHAT_JSON_COLUMN_NAME = 'Chat JSON';

// === Sheet "Subtasks" ===
const SUBTASK_SHEET_NAME = 'Subtasks';
const SUBTASK_HEADERS = ['Mã subtask','Mã nhiệm vụ cha','Tên subtask','Người thực hiện','Trạng thái','Ngày tạo','Ngày hoàn thành','Người tạo'];

// === Sheet "Comments" ===
const COMMENT_SHEET_NAME = 'Comments';
const COMMENT_HEADERS = ['Mã comment','Loại','Mã đối tượng','Người bình luận','Nội dung','Thời gian','Mã comment cha'];

// ==================================
// == HÀM CHÍNH (GIAO TIẾP VỚI FRONTEND) ==
// ==================================

/**
 * Phục vụ giao diện HTML khi truy cập URL ứng dụng web.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Quản Lý Dự Án')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl(
      'https://static.vecteezy.com/system/resources/thumbnails/046/680/406/small/3d-report-icon-report-symbol-3d-free-png.png'
    );
}

/**
 * Include files for HTML template
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Load initial data using Sheets API v4 (faster batch read)
 */
function getInitialDataFast() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetId = ss.getId();

    // Batch get tất cả sheets cùng lúc
    const ranges = [
      `'${PROJECT_SHEET_NAME}'!A:I`, // Projects với tất cả columns
      `'${STAFF_SHEET_NAME}'!A:K`, // Staff (core columns up to Avatar)
    ];

    const response = Sheets.Spreadsheets.Values.batchGet(spreadsheetId, {
      ranges: ranges,
      majorDimension: 'ROWS',
    });

    // Parse projects
    const projectValues = response.valueRanges[0].values || [];
    const projects = parseSheetData(projectValues);

    // Parse staff
    const staffValues = response.valueRanges[1].values || [];
    const staff = parseSheetData(staffValues);

    // Tasks vẫn cần logic đặc biệt để parse JSON
    const tasks = getTasks();

    // Get other data
    const chartData = getTaskStatusChartData(tasks);
    const summaryStats = getSummaryStats(projects, tasks);
    const recentActivities = getRecentActivities();

    return {
      projects: projects,
      tasks: tasks,
      staff: staff,
      chartData: chartData,
      recentActivities: recentActivities,
      summaryStats: summaryStats,
    };
  } catch (e) {
    console.error('Error in getInitialDataFast:', e);
    // Fallback to old method
    return getInitialData();
  }
}

/**
 * Convert 2D array from Sheets API to object array
 */
function parseSheetData(values) {
  if (!values || values.length < 2) return [];

  const headers = values[0];
  const dataRows = values.slice(1);

  return dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header && index < row.length) {
        let cellValue = row[index];

        // Convert date strings to Date objects if needed
        if (typeof cellValue === 'string' && cellValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          cellValue = new Date(cellValue + 'T00:00:00');
        }

        obj[header] = cellValue !== undefined ? cellValue : '';
      }
    });
    return obj;
  });
}

/**
 * Authenticate user with email and password
 */
function authenticateUser(email, password) {
  try {
    if (!email || !password) {
      return { success: false, error: 'Email và mật khẩu là bắt buộc' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);

    if (!staffSheet) {
      return { success: false, error: 'Không tìm thấy dữ liệu nhân viên' };
    }

    const headers = getHeaders(staffSheet);
    const emailColIndex = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);
    const passwordColIndex = headers.indexOf(STAFF_PASSWORD_COLUMN_NAME);
    const roleColIndex = headers.indexOf(STAFF_ROLE_COLUMN_NAME);
    const nameColIndex = headers.indexOf(STAFF_NAME_COLUMN_NAME);
    const idColIndex = headers.indexOf(STAFF_ID_COLUMN_NAME);

    if (emailColIndex === -1 || passwordColIndex === -1 || roleColIndex === -1) {
      return { success: false, error: 'Cấu trúc dữ liệu nhân viên không đúng' };
    }

    const lastRow = staffSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Không có dữ liệu nhân viên' };
    }

    // Get all staff data
    const range = staffSheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = range.getValues();

    // Find user by email
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const userEmail = String(row[emailColIndex] || '')
        .trim()
        .toLowerCase();
      const userPassword = String(row[passwordColIndex] || '').trim();

      if (userEmail === email.toLowerCase() && userPassword === password) {
        const userData = {
          id: row[idColIndex] || '',
          name: row[nameColIndex] || '',
          email: row[emailColIndex] || '',
          role: row[roleColIndex] || 'Nhân viên',
          position: row[headers.indexOf(STAFF_POSITION_COLUMN_NAME)] || '',
          phone: row[headers.indexOf(STAFF_PHONE_COLUMN_NAME)] || '',
          birthday: row[headers.indexOf(STAFF_BIRTHDAY_COLUMN_NAME)] ? Utilities.formatDate(new Date(row[headers.indexOf(STAFF_BIRTHDAY_COLUMN_NAME)]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
          department: row[headers.indexOf(STAFF_DEPARTMENT_COLUMN_NAME)] || '',
          bio: row[headers.indexOf(STAFF_BIO_COLUMN_NAME)] || '',
          avatar: row[headers.indexOf(STAFF_AVATAR_COLUMN_NAME)] || '',
          coin: Number(row[headers.indexOf(STAFF_COIN_COLUMN_NAME)]) || 0,
          boostExpires: row[headers.indexOf(STAFF_BOOST_EXPIRES_COLUMN_NAME)] ? String(row[headers.indexOf(STAFF_BOOST_EXPIRES_COLUMN_NAME)]) : '',
          streakFreezeCount: Number(row[headers.indexOf(STAFF_STREAK_FREEZE_COLUMN_NAME)]) || 0,
        };

        // Store session
        storeUserSession(userData);

        return {
          success: true,
          user: userData,
          message: 'Đăng nhập thành công',
        };
      }
    }

    return { success: false, error: 'Email hoặc mật khẩu không đúng' };
  } catch (e) {
    console.error('Authentication error:', e);
    return { success: false, error: 'Lỗi hệ thống khi đăng nhập: ' + e.message };
  }
}

/**
 * Store user session in PropertiesService
 */

function storeUserSession(userData) {
  try {
    const sessionData = {
      ...userData,
      loginTime: new Date().toISOString(),
      sessionId: Utilities.getUuid(),
    };

    // THAY ĐỔI: Sử dụng email làm key để phân biệt session từng user
    const sessionKey = `user_session_${userData.email}`;
    PropertiesService.getScriptProperties().setProperty(sessionKey, JSON.stringify(sessionData));

    // Lưu thêm current session key để logout
    const currentUserKey = `current_user_${Session.getTemporaryActiveUserKey()}`;
    PropertiesService.getScriptProperties().setProperty(currentUserKey, userData.email);
  } catch (e) {
    console.error('Error storing session:', e);
  }
}

/**
 * Get current user session
 */
function getCurrentUser() {
  try {
    // Lấy email của user hiện tại từ session key
    const currentUserKey = `current_user_${Session.getTemporaryActiveUserKey()}`;
    const userEmail = PropertiesService.getScriptProperties().getProperty(currentUserKey);

    if (!userEmail) {
      return null;
    }

    const sessionKey = `user_session_${userEmail}`;
    const sessionString = PropertiesService.getScriptProperties().getProperty(sessionKey);

    if (!sessionString) {
      return null;
    }

    const sessionData = JSON.parse(sessionString);

    // Check if session is still valid (24 hours)
    const loginTime = new Date(sessionData.loginTime);
    const now = new Date();
    const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (now - loginTime > sessionDuration) {
      // Session expired
      logout();
      return null;
    }

    return sessionData;
  } catch (e) {
    console.error('Error getting current user:', e);
    return null;
  }
}

/**
 * Logout user
 */
function logout() {
  try {
    // Lấy email của user hiện tại
    const currentUserKey = `current_user_${Session.getTemporaryActiveUserKey()}`;
    const userEmail = PropertiesService.getScriptProperties().getProperty(currentUserKey);

    if (userEmail) {
      // Xóa session của user này
      const sessionKey = `user_session_${userEmail}`;
      PropertiesService.getScriptProperties().deleteProperty(sessionKey);
    }

    // Xóa current user key
    PropertiesService.getScriptProperties().deleteProperty(currentUserKey);

    return { success: true, message: 'Đăng xuất thành công' };
  } catch (e) {
    console.error('Error during logout:', e);
    return { success: false, error: 'Lỗi khi đăng xuất' };
  }
}

/**
 * Check if user is admin
 */
function isAdmin(user) {
  if (!user) return false;
  return String(user.role || '')
    .toLowerCase()
    .includes('admin');
}

/**
 * Check if user is manager
 */
function isManager(user) {
  if (!user) return false;
  return String(user.role || '')
    .toLowerCase()
    .includes('quản lý');
}

/**
 * Check if user is team leader (Trưởng nhóm)
 */
function isTeamLeader(user) {
  if (!user) return false;
  return String(user.role || '')
    .toLowerCase()
    .includes('trưởng nhóm');
}

/**
 * Get filtered data based on user role
 */
function getDataForUser() {
  try {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return {
        success: false,
        error: 'Chưa đăng nhập',
        requireLogin: true,
      };
    }

    // Get all data
    let projects = getProjects();
    let tasks = getTasks();
    const staff = getStaffList();
    let recentActivities = getRecentActivities();

    // Filter data based on role
    if (!isAdmin(currentUser)) {
      if (isManager(currentUser) || isTeamLeader(currentUser)) {
        // === Quản lý / Trưởng nhóm: chỉ xem dự án từ mình xuống ===
        const managedProjectIds = projects
          .filter((project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name)
          .map((project) => project[PROJECT_ID_COLUMN_NAME]);

        tasks = tasks.filter((task) => {
          if (task[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name) return true;
          if (managedProjectIds.includes(task[TASK_PROJECT_ID_COLUMN_NAME])) return true;
          return false;
        });

        const userTaskProjectIds = tasks
          .map((task) => task[TASK_PROJECT_ID_COLUMN_NAME])
          .filter((id) => id);

        projects = projects.filter((project) => {
          if (project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) return true;
          // Kiểm tra người tham gia dự án
          const participants = String(project[PROJECT_PARTICIPANTS_COLUMN_NAME] || '')
            .split(',').map((s) => s.trim()).filter(Boolean);
          if (participants.includes(currentUser.id) || participants.includes(currentUser.name)) return true;
          if (userTaskProjectIds.includes(project[PROJECT_ID_COLUMN_NAME])) return true;
          return false;
        });
      } else {
        // === Nhân viên: xem dự án mình tham gia, có nhiệm vụ, hoặc đã tạo task ===
        // Case-insensitive name match to handle data entry inconsistencies
        const myName = (currentUser.name || '').trim().toLowerCase();
        tasks = tasks.filter((task) => {
          const assignee = String(task[TASK_ASSIGNEE_COLUMN_NAME] || '').trim().toLowerCase();
          const creator  = String(task[TASK_CREATED_BY_COLUMN_NAME] || '').trim().toLowerCase();
          return assignee === myName || creator === myName;
        });

        // Also include tasks from participant-projects that are assigned TO this user
        // (handles case where task was assigned using different casing)
        const participantProjectIds = projects
          .filter((project) => {
            const participants = String(project[PROJECT_PARTICIPANTS_COLUMN_NAME] || '')
              .split(',').map((s) => s.trim()).filter(Boolean);
            return participants.some(p => p.toLowerCase() === myName)
              || (project[PROJECT_MANAGER_COLUMN_NAME] || '').trim().toLowerCase() === myName;
          })
          .map((p) => p[PROJECT_ID_COLUMN_NAME]);

        if (participantProjectIds.length > 0 && tasks.length === 0) {
          // Fallback: if no tasks matched by name, show tasks in participant projects where they're assigned
          const allTasksAgain = getTasks();
          const fallback = allTasksAgain.filter((task) => {
            const assignee = String(task[TASK_ASSIGNEE_COLUMN_NAME] || '').trim().toLowerCase();
            return assignee === myName && participantProjectIds.includes(task[TASK_PROJECT_ID_COLUMN_NAME]);
          });
          if (fallback.length > 0) tasks = fallback;
        }

        const userTaskProjectIds = new Set(
          tasks.map((task) => task[TASK_PROJECT_ID_COLUMN_NAME]).filter((id) => id)
        );

        projects = projects.filter((project) => {
          if (userTaskProjectIds.has(project[PROJECT_ID_COLUMN_NAME])) return true;
          // Kiểm tra danh sách người tham gia
          const participants = String(project[PROJECT_PARTICIPANTS_COLUMN_NAME] || '')
            .split(',').map((s) => s.trim()).filter(Boolean);
          return participants.includes(currentUser.id) || participants.includes(currentUser.name)
            || participants.some(p => p.toLowerCase() === myName);
        });
      }

      recentActivities = recentActivities.filter((activity) => {
        const activityUser = String(activity[LOG_USER_COLUMN_NAME] || '').trim();

        // Chỉ hiển thị hoạt động do user hiện tại thực hiện
        return activityUser === currentUser.email || activityUser === currentUser.name;
      });
    }

    // Get other data
    const chartData = getTaskStatusChartData(tasks);
    const summaryStats = getSummaryStats(projects, tasks);
    let filteredStaff = staff;
    if (!isAdmin(currentUser)) {
      if (isManager(currentUser)) {
        // Quản lý có thể thấy tất cả nhân viên trừ admin
        filteredStaff = staff.filter((s) => {
          const role = String(s[STAFF_ROLE_COLUMN_NAME] || '').toLowerCase();
          return !role.includes('admin');
        });
      } else {
        // Nhân viên thường và Trưởng nhóm: thấy tất cả nhân viên trừ admin
        // (cần thiết để tạo và giao nhiệm vụ cho nhau)
        filteredStaff = staff.filter((s) => {
          const role = String(s[STAFF_ROLE_COLUMN_NAME] || '').toLowerCase();
          return !role.includes('admin');
        });
      }
    }

    return {
      success: true,
      user: currentUser,
      projects: projects,
      tasks: tasks,
      staff: isAdmin(currentUser) ? staff : filteredStaff,
      chartData: chartData,
      recentActivities: recentActivities,
      summaryStats: summaryStats,
    };
  } catch (e) {
    console.error('Error getting data for user:', e);
    return {
      success: false,
      error: 'Lỗi khi tải dữ liệu: ' + e.message,
    };
  }
}

// === UPDATED CRUD FUNCTIONS WITH PERMISSION CHECKS ===

/**
 * Updated addProject with permission check
 */
function addProjectWithAuth(projectData) {
  const permissionCheck = checkUserPermission('create', 'project');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return addProject(projectData);
}

/**
 * Updated updateProject with permission check
 */
function updateProjectWithAuth(projectId, projectData) {
  // LẤY DỮ LIỆU DỰ ÁN GỐC TRƯỚC KHI KIỂM TRA QUYỀN
  const projects = getProjects();
  const originalProject = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === projectId);

  if (!originalProject) {
    return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };
  }

  // Kiểm tra quyền dựa trên dự án gốc
  const permissionCheck = checkUserPermission('update', 'project', originalProject);
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return updateProject(projectId, projectData);
}

/**
 * Updated deleteProject with permission check
 */
function deleteProjectWithAuth(projectId) {
  // LẤY DỮ LIỆU DỰ ÁN GỐC TRƯỚC KHI KIỂM TRA QUYỀN
  const projects = getProjects();
  const originalProject = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === projectId);

  if (!originalProject) {
    return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };
  }

  const permissionCheck = checkUserPermission('delete', 'project', originalProject);
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return deleteProject(projectId);
}

/**
 * Updated addTask with permission check
 */
function addTaskWithAuth(taskData) {
  const permissionCheck = checkUserPermission('create', 'task');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  const result = addTask(taskData);
  if (!result.success) return result;

  // Tự động tạo các nhiệm vụ lặp lại
  const isRecurring = taskData.isRecurring === '1' || taskData.isRecurring === true;
  const interval = taskData.recurringInterval; // 'daily'|'weekly'|'monthly'
  const count = parseInt(taskData.recurringCount) || 0;

  if (isRecurring && interval && count > 0) {
    const tz = Session.getScriptTimeZone();
    const safeParse = function(d) {
      if (!d) return null;
      try { return new Date(d); } catch(e) { return null; }
    };
    const startD = safeParse(taskData.startDate);
    const dueD   = safeParse(taskData.dueDate);
    const safeCount = Math.min(count, 52);

    var stopDate = null;
    if (taskData.recurringStopDate) {
      try {
        stopDate = new Date(taskData.recurringStopDate);
        stopDate.setHours(23, 59, 59, 0);
      } catch(e) { stopDate = null; }
    }

    for (var i = 1; i <= safeCount; i++) {
      var days = interval === 'daily' ? i : interval === 'weekly' ? i * 7 : i * 30;
      var ns = startD ? new Date(startD.getTime() + days * 86400000) : null;
      var nd = dueD   ? new Date(dueD.getTime()   + days * 86400000) : null;

      // Stop if the copy's start date exceeds the stop date
      if (stopDate) {
        var checkDate = ns || nd;
        if (checkDate && checkDate > stopDate) break;
      }

      var copyData = JSON.parse(JSON.stringify(taskData)); // deep copy
      copyData.name = taskData.name + ' (' + (i + 1) + '/' + (safeCount + 1) + ')';
      copyData.startDate = ns ? Utilities.formatDate(ns, tz, 'yyyy-MM-dd') : '';
      copyData.dueDate   = nd ? Utilities.formatDate(nd, tz, 'yyyy-MM-dd') : '';
      copyData.isRecurring  = false;
      copyData.recurringCount = 0;
      copyData.status = 'Chưa bắt đầu';
      copyData.completion = 0;
      copyData.reportDate = '';
      addTask(copyData);
    }
  }

  return result;
}

/**
 * Updated updateTask with permission check
 */
function updateTaskWithAuth(taskId, taskData) {
  // Get original task data for permission check
  const tasks = getTasks();
  const originalTask = tasks.find((task) => task[TASK_ID_COLUMN_NAME] === taskId);

  const permissionCheck = checkUserPermission('update', 'task', originalTask);
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return updateTask(taskId, taskData);
}

/**
 * Updated deleteTask with permission check
 */
function deleteTaskWithAuth(taskId) {
  // Get original task data for permission check
  const tasks = getTasks();
  const originalTask = tasks.find((task) => task[TASK_ID_COLUMN_NAME] === taskId);

  const permissionCheck = checkUserPermission('delete', 'task', originalTask);
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return deleteTask(taskId);
}

/**
 * Updated staff functions with permission checks
 */
function addStaffWithAuth(staffData) {
  const permissionCheck = checkUserPermission('create', 'staff');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return addStaff(staffData);
}

function updateStaffWithAuth(staffId, staffData) {
  const permissionCheck = checkUserPermission('update', 'staff');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return updateStaff(staffId, staffData);
}

function deleteStaffWithAuth(staffId) {
  const permissionCheck = checkUserPermission('delete', 'staff');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return deleteStaff(staffId);
}

/**
 * Updated getInitialData to check authentication
 */
function getInitialDataWithAuth() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      requireLogin: true,
      message: 'Vui lòng đăng nhập để tiếp tục',
    };
  }

  // ← SỬA: Dùng getInitialDataFast thay vì getDataForUser cho lần đầu
  try {
    const data = getInitialDataFast();

    let projects = data.projects || [];
    let tasks = data.tasks || [];
    const staff = data.staff || [];
    let recentActivities = data.recentActivities || [];

    // Filter data based on role (giữ nguyên logic filter)
    if (!isAdmin(currentUser)) {
      if (isManager(currentUser)) {
        const managerProjectIds = projects
          .filter((project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name)
          .map((project) => project[PROJECT_ID_COLUMN_NAME]);

        tasks = tasks.filter((task) => {
          if (task[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name) {
            return true;
          }
          if (managerProjectIds.includes(task[TASK_PROJECT_ID_COLUMN_NAME])) {
            return true;
          }
          return false;
        });

        const managerTaskProjectIds = tasks
          .map((task) => task[TASK_PROJECT_ID_COLUMN_NAME])
          .filter((id) => id);

        projects = projects.filter((project) => {
          if (project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) {
            return true;
          }
          if (managerTaskProjectIds.includes(project[PROJECT_ID_COLUMN_NAME])) {
            return true;
          }
          return false;
        });
      } else {
        tasks = tasks.filter((task) => {
          const assignee = String(task[TASK_ASSIGNEE_COLUMN_NAME] || '').trim();
          if (assignee === currentUser.name) {
            return true;
          }
          const projectId = task[TASK_PROJECT_ID_COLUMN_NAME];
          const project = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === projectId);
          return project && project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name;
        });

        const userTaskProjectIds = new Set(
          tasks.map((task) => task[TASK_PROJECT_ID_COLUMN_NAME]).filter((id) => id)
        );

        const userManagedProjects = projects.filter(
          (project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name
        );

        userManagedProjects.forEach((project) => {
          userTaskProjectIds.add(project[PROJECT_ID_COLUMN_NAME]);
        });

        projects = projects.filter((project) => {
          const projectId = project[PROJECT_ID_COLUMN_NAME];
          return userTaskProjectIds.has(projectId);
        });
      }

      recentActivities = recentActivities.filter((activity) => {
        const activityUser = String(activity[LOG_USER_COLUMN_NAME] || '').trim();
        return activityUser === currentUser.email || activityUser === currentUser.name;
      });
    }

    let filteredStaff = staff;
    if (!isAdmin(currentUser)) {
      if (isManager(currentUser)) {
        filteredStaff = staff.filter((s) => {
          const role = String(s[STAFF_ROLE_COLUMN_NAME] || '').toLowerCase();
          return !role.includes('admin');
        });
      } else {
        const userManagedProjects = projects.filter(
          (project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name
        );

        if (userManagedProjects.length > 0) {
          filteredStaff = staff.filter((s) => {
            const role = String(s[STAFF_ROLE_COLUMN_NAME] || '').toLowerCase();
            return !role.includes('admin');
          });
        } else {
          const currentUserStaff = staff.find(
            (s) => s[STAFF_NAME_COLUMN_NAME] === currentUser.name
          );
          filteredStaff = currentUserStaff ? [currentUserStaff] : [];
        }
      }
    }

    return {
      success: true,
      user: currentUser,
      projects: projects,
      tasks: tasks,
      staff: filteredStaff,
      chartData: data.chartData,
      recentActivities: recentActivities,
      summaryStats: data.summaryStats,
      commentCounts: getCommentStats(),
    };
  } catch (e) {
    console.error('Error in fast load:', e);
    // Fallback to old method
    return getDataForUser();
  }
}

/**
 * Check user permissions for operations
 */
function checkUserPermission(action, resourceType, resourceData = null) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Chưa đăng nhập' };
  }

  // Admin can do everything
  if (isAdmin(currentUser)) {
    return { success: true };
  }

  // Manager permissions
  if (isManager(currentUser)) {
    switch (resourceType) {
      case 'project':
        // Managers can manage projects
        return { success: true };

      case 'task':
        // Managers can manage tasks
        return { success: true };

      case 'staff':
        // Only admin can manage staff
        return { success: false, error: 'Chỉ admin mới có thể quản lý nhân viên' };

      case 'notification':
        return { success: false, error: 'Chỉ admin mới có thể quản lý thông báo' };
    }
  }

  // Regular user permissions
  switch (resourceType) {
    case 'project':
      // THAY ĐỔI: Kiểm tra xem người dùng có phải là người phụ trách dự án không
      if (resourceData) {
        // Đối với update/delete, kiểm tra nếu người dùng là người phụ trách
        if (resourceData[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) {
          return { success: true };
        }
      } else if (action === 'create') {
        // Nhân viên không thể tạo dự án mới
        return { success: false, error: 'Chỉ admin và quản lý mới có thể tạo dự án mới' };
      } else {
        // Để lấy thông tin dự án khi update/delete
        const projects = getProjects();
        const project = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === resourceData);
        if (project && project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) {
          return { success: true };
        }
      }
      return { success: false, error: 'Bạn chỉ có thể quản lý dự án do bạn phụ trách' };

    case 'task':
      if (action === 'create') {
        // Mọi người dùng đã đăng nhập đều có thể tạo nhiệm vụ
        return { success: true };
      }
      if (action === 'update' || action === 'delete') {
        // Check if user is project manager for this task
        if (resourceData) {
          const projectId = resourceData[TASK_PROJECT_ID_COLUMN_NAME];
          const projects = getProjects();
          const project = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === projectId);

          if (project && project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) {
            return { success: true }; // Project manager can edit/delete all tasks
          }
        }

        // Users can only update their own tasks or tasks they created
        if (resourceData && (
          resourceData[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name ||
          resourceData[TASK_CREATED_BY_COLUMN_NAME] === currentUser.name
        )) {
          return { success: true };
        }
        return {
          success: false,
          error: 'Bạn chỉ có thể chỉnh sửa nhiệm vụ của mình hoặc nhiệm vụ trong dự án bạn quản lý',
        };
      }
      break;

    case 'staff':
      // Only admin can manage staff
      return { success: false, error: 'Chỉ admin mới có thể quản lý nhân viên' };

    case 'notification':
      return { success: false, error: 'Chỉ admin mới có thể quản lý thông báo' };
  }

  return { success: false, error: 'Không có quyền thực hiện hành động này' };
}

/**
 * Lấy tất cả dữ liệu cần thiết cho lần tải trang đầu tiên.
 */
function getInitialData() {
  try {
    // Lấy dữ liệu song song
    const projects = getProjects();
    const tasks = getTasks();
    const staff = getStaffList();

    // Xử lý dữ liệu phụ thuộc
    const chartData = getTaskStatusChartData(tasks);
    const recentActivities = getRecentActivities();
    const summaryStats = getSummaryStats(projects, tasks);

    return {
      projects: projects,
      tasks: tasks,
      staff: staff,
      chartData: chartData,
      recentActivities: recentActivities,
      summaryStats: summaryStats,
    };
  } catch (e) {
    console.error('Error in getInitialData:', e);
    return { error: 'Không thể tải dữ liệu ban đầu. Chi tiết: ' + e.message };
  }
}

// ==================================
// == QUẢN LÝ DỰ ÁN (PROJECTS) ==
// ==================================

function addProject(projectData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    // Kiểm tra quyền hạn của người dùng về quản lý dự án
    const currentUser = getCurrentUser();
    if (!isAdmin(currentUser) && isManager(currentUser)) {
      // Nếu người dùng là Quản lý, bắt buộc phải chọn chính họ làm quản lý dự án
      projectData.manager = currentUser.name;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = getOrCreateSheet(ss, PROJECT_SHEET_NAME, [
      PROJECT_ID_COLUMN_NAME,
      PROJECT_NAME_COLUMN_NAME,
      PROJECT_DESC_COLUMN_NAME,
      PROJECT_MANAGER_COLUMN_NAME,
      PROJECT_PARTICIPANTS_COLUMN_NAME,
      PROJECT_START_DATE_COLUMN_NAME,
      PROJECT_END_DATE_COLUMN_NAME,
      PROJECT_STATUS_COLUMN_NAME,
      PROJECT_TASKS_JSON_COLUMN_NAME,
      PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME,
    ]);

    const headers = getHeaders(projectSheet);

    // Đảm bảo cột Người tham gia tồn tại (cho sheet cũ chưa có cột này)
    if (!headers.includes(PROJECT_PARTICIPANTS_COLUMN_NAME)) {
      const newColIndex = headers.length + 1;
      projectSheet.getRange(1, newColIndex).setValue(PROJECT_PARTICIPANTS_COLUMN_NAME);
      headers.push(PROJECT_PARTICIPANTS_COLUMN_NAME);
    }

    // Validate dữ liệu đầu vào
    if (!projectData || !projectData.name || String(projectData.name).trim() === '') {
      return { success: false, error: 'Tên dự án là bắt buộc.' };
    }

    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    const lastId = getLastId(projectSheet, idColIndex, 'DA');
    const newProjectId = generateNextId(lastId, 'DA');

    const newRow = Array(headers.length).fill('');

    // Điền dữ liệu
    newRow[idColIndex] = newProjectId;
    newRow[headers.indexOf(PROJECT_NAME_COLUMN_NAME)] = String(projectData.name).trim();
    newRow[headers.indexOf(PROJECT_DESC_COLUMN_NAME)] = projectData.description
      ? String(projectData.description).trim()
      : '';
    newRow[headers.indexOf(PROJECT_MANAGER_COLUMN_NAME)] = projectData.manager
      ? String(projectData.manager).trim()
      : '';
    newRow[headers.indexOf(PROJECT_START_DATE_COLUMN_NAME)] = parseDate(projectData.startDate);
    newRow[headers.indexOf(PROJECT_END_DATE_COLUMN_NAME)] = parseDate(projectData.endDate);
    newRow[headers.indexOf(PROJECT_STATUS_COLUMN_NAME)] = projectData.status || 'Chưa bắt đầu';
    const participantsIdx = headers.indexOf(PROJECT_PARTICIPANTS_COLUMN_NAME);
    if (participantsIdx !== -1) {
      newRow[participantsIdx] = projectData.participants ? String(projectData.participants).trim() : '';
    }

    projectSheet.appendRow(newRow);
    SpreadsheetApp.flush();

    logActivity(
      'Thêm dự án',
      `Tên: ${projectData.name}, Quản lý: ${projectData.manager || 'N/A'}, ID: ${newProjectId}`
    );

    return { success: true, projectId: newProjectId };
  } catch (e) {
    console.error(`Error adding project:`, e);
    return { success: false, error: `Lỗi khi thêm dự án: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function updateProject(projectId, projectData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    if (idColIndex === -1) throw new Error(`Không tìm thấy cột "${PROJECT_ID_COLUMN_NAME}".`);

    // Validate đầu vào
    if (!projectId) return { success: false, error: 'ID dự án không được cung cấp.' };
    if (!projectData || !projectData.name || String(projectData.name).trim() === '') {
      return { success: false, error: 'Tên dự án là bắt buộc.' };
    }

    // Đảm bảo cột 'Người tham gia' tồn tại trong sheet
    if (!headers.includes(PROJECT_PARTICIPANTS_COLUMN_NAME)) {
      const newColIndex = headers.length + 1;
      projectSheet.getRange(1, newColIndex).setValue(PROJECT_PARTICIPANTS_COLUMN_NAME);
      headers.push(PROJECT_PARTICIPANTS_COLUMN_NAME);
    }

    const rowInfo = findRowById(projectSheet, idColIndex + 1, projectId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };

    const rowNumber = rowInfo.rowNumber;
    const range = projectSheet.getRange(rowNumber, 1, 1, headers.length);
    const values = range.getValues()[0];
    // Extend values array if new column was just added
    while (values.length < headers.length) values.push('');

    let changesDetected = false;

    // Cập nhật các trường
    const updates = [
      [headers.indexOf(PROJECT_NAME_COLUMN_NAME), projectData.name],
      [headers.indexOf(PROJECT_DESC_COLUMN_NAME), projectData.description],
      [headers.indexOf(PROJECT_MANAGER_COLUMN_NAME), projectData.manager],
      [headers.indexOf(PROJECT_START_DATE_COLUMN_NAME), parseDate(projectData.startDate)],
      [headers.indexOf(PROJECT_END_DATE_COLUMN_NAME), parseDate(projectData.endDate)],
      [headers.indexOf(PROJECT_STATUS_COLUMN_NAME), projectData.status],
      [headers.indexOf(PROJECT_PARTICIPANTS_COLUMN_NAME), projectData.participants !== undefined ? String(projectData.participants || '').trim() : undefined],
    ];

    updates.forEach(([index, newValue]) => {
      if (index !== -1 && newValue !== undefined) {
        const formattedValue =
          newValue instanceof Date || newValue === null ? newValue : String(newValue).trim();
        if (values[index] !== formattedValue) {
          values[index] = formattedValue;
          changesDetected = true;
        }
      }
    });

    if (changesDetected) {
      range.setValues([values]);
      SpreadsheetApp.flush();
      logActivity('Cập nhật dự án', `ID: ${projectId}, Tên: ${projectData.name}`);
    }

    return { success: true, updated: changesDetected };
  } catch (e) {
    console.error(`Error updating project ${projectId}:`, e);
    return { success: false, error: `Lỗi khi cập nhật dự án: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function deleteProject(projectId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    if (idColIndex === -1) throw new Error(`Không tìm thấy cột "${PROJECT_ID_COLUMN_NAME}".`);

    if (!projectId) return { success: false, error: 'ID dự án không được cung cấp.' };

    const rowInfo = findRowById(projectSheet, idColIndex + 1, projectId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };

    const rowNumber = rowInfo.rowNumber;
    const nameColIndex = headers.indexOf(PROJECT_NAME_COLUMN_NAME);
    const projectName =
      nameColIndex !== -1
        ? projectSheet.getRange(rowNumber, nameColIndex + 1).getValue()
        : projectId;

    projectSheet.deleteRow(rowNumber);
    logActivity('Xóa dự án', `ID: ${projectId}, Tên: ${projectName}`);

    return { success: true };
  } catch (e) {
    console.error(`Error deleting project ${projectId}:`, e);
    return { success: false, error: `Lỗi khi xóa dự án: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function getProjects() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!sheet) {
      return [];
    }
    return sheetDataToObjectArray(sheet);
  } catch (e) {
    console.error('Error getting projects:', e);
    return [];
  }
}

// ==================================
// == QUẢN LÝ NHIỆM VỤ (TASKS) ==
// ==================================

function addTask(taskData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);

    if (jsonColIndex === -1)
      throw new Error(`Không tìm thấy cột "${PROJECT_TASKS_JSON_COLUMN_NAME}".`);

    // Validate dữ liệu đầu vào
    if (!taskData || !taskData.name || String(taskData.name).trim() === '') {
      return { success: false, error: 'Tên nhiệm vụ là bắt buộc.' };
    }
    if (!taskData.projectId || String(taskData.projectId).trim() === '') {
      return { success: false, error: 'Nhiệm vụ phải thuộc về một dự án.' };
    }

    // Tìm project row
    const projectRowInfo = findRowById(projectSheet, projectIdColIndex + 1, taskData.projectId);
    if (!projectRowInfo) {
      return { success: false, error: `Mã dự án "${taskData.projectId}" không tồn tại.` };
    }

    // Lấy tasks JSON hiện tại
    const jsonCell = projectSheet.getRange(projectRowInfo.rowNumber, jsonColIndex + 1);
    let currentTasks = [];
    try {
      const jsonStr = jsonCell.getValue();
      if (jsonStr && typeof jsonStr === 'string') {
        currentTasks = JSON.parse(jsonStr);
      }
    } catch (e) {
      currentTasks = [];
    }

    const projectTasks = currentTasks || [];
    const nextTaskIndex = projectTasks.length;
    const newTaskId = generateTaskIdForProject(taskData.projectId, nextTaskIndex);

    // Tạo task mới
    const newTask = {};
    newTask[TASK_ID_COLUMN_NAME] = newTaskId;
    newTask[TASK_NAME_COLUMN_NAME] = String(taskData.name).trim();
    newTask[TASK_DESC_COLUMN_NAME] = taskData.description
      ? String(taskData.description).trim()
      : '';
    newTask[TASK_ASSIGNEE_COLUMN_NAME] = taskData.assignee ? String(taskData.assignee).trim() : '';
    newTask[TASK_STATUS_COLUMN_NAME] = taskData.status || 'Chưa bắt đầu';
    newTask[TASK_PRIORITY_COLUMN_NAME] = taskData.priority || 'Trung bình';
    newTask[TASK_START_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.startDate));
    newTask[TASK_DUE_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.dueDate));

    let completion = 0;
    if (
      taskData.completion !== undefined &&
      taskData.completion !== null &&
      taskData.completion !== ''
    ) {
      const parsedCompletion = parseInt(taskData.completion, 10);
      if (!isNaN(parsedCompletion)) {
        completion = Math.max(0, Math.min(100, parsedCompletion));
      }
    }
    newTask[TASK_COMPLETION_COLUMN_NAME] = completion;
    newTask[TASK_REPORT_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.reportDate));
    newTask[TASK_TARGET_COLUMN_NAME] = taskData.target ? String(taskData.target).trim() : '';
    newTask[TASK_RESULT_LINKS_COLUMN_NAME] = taskData.resultLinks
      ? String(taskData.resultLinks).trim()
      : '';
    newTask[TASK_OUTPUT_COLUMN_NAME] = taskData.output ? String(taskData.output).trim() : '';
    newTask[TASK_NOTES_COLUMN_NAME] = taskData.notes ? String(taskData.notes).trim() : '';
    // Lưu người tạo nhiệm vụ
    const creator = getCurrentUser();
    newTask[TASK_CREATED_BY_COLUMN_NAME] = taskData.createdBy
      ? String(taskData.createdBy).trim()
      : (creator ? (creator.name || '') : '');
    newTask['Số người phụ thuộc'] = parseInt(taskData.dependentCount || 0) || 0;

    // Thêm vào danh sách
    currentTasks.push(newTask);

    // Lưu lại JSON
    jsonCell.setValue(formatJSONCompact(currentTasks));
    SpreadsheetApp.flush();

    logActivity(
      'Thêm nhiệm vụ',
      `Tên: ${taskData.name}, Giao cho: ${taskData.assignee || 'N/A'}, ID: ${newTaskId}`,
      taskData.projectId
    );

    // Ghi hàng chờ thông báo Telegram
    try {
      const projectNameColIdx = headers.indexOf(PROJECT_NAME_COLUMN_NAME);
      const projectName = projectNameColIdx !== -1
        ? projectSheet.getRange(projectRowInfo.rowNumber, projectNameColIdx + 1).getValue()
        : taskData.projectId;
      queueTaskNotification(newTaskId, taskData.name, taskData.assignee, projectName, 'created', newTask[TASK_CREATED_BY_COLUMN_NAME]);
    } catch (e) { /* không ảnh hưởng đến kết quả chính */ }

    return { success: true, taskId: newTaskId };
  } catch (e) {
    console.error(`Error adding task:`, e);
    return { success: false, error: `Lỗi khi thêm nhiệm vụ: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function updateTask(taskId, taskData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);

    if (jsonColIndex === -1)
      throw new Error(`Không tìm thấy cột "${PROJECT_TASKS_JSON_COLUMN_NAME}".`);

    // Validate
    if (!taskId) return { success: false, error: 'ID nhiệm vụ không được cung cấp.' };
    if (!taskData || !taskData.name || String(taskData.name).trim() === '') {
      return { success: false, error: 'Tên nhiệm vụ là bắt buộc.' };
    }
    if (!taskData.projectId || String(taskData.projectId).trim() === '') {
      return { success: false, error: 'Nhiệm vụ phải thuộc về một dự án.' };
    }

    // Tìm task cũ
    const lastRow = projectSheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Không tìm thấy nhiệm vụ.' };

    let oldProjectRow = null;
    let oldProjectId = null;
    let foundTaskIndex = -1;
    let oldTasks = [];

    for (let row = 2; row <= lastRow; row++) {
      const currentProjectId = projectSheet.getRange(row, projectIdColIndex + 1).getValue();
      const jsonCell = projectSheet.getRange(row, jsonColIndex + 1);
      try {
        const jsonStr = jsonCell.getValue();
        if (jsonStr && typeof jsonStr === 'string') {
          const tasks = JSON.parse(jsonStr);
          const taskIndex = tasks.findIndex((task) => task[TASK_ID_COLUMN_NAME] === taskId);
          if (taskIndex !== -1) {
            oldProjectRow = row;
            oldProjectId = currentProjectId;
            foundTaskIndex = taskIndex;
            oldTasks = tasks;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!oldProjectRow) {
      return { success: false, error: `Không tìm thấy nhiệm vụ ID: ${taskId}` };
    }

    // ← THÊM ĐOẠN NÀY: Kiểm tra nếu chuyển dự án
    if (oldProjectId !== taskData.projectId) {
      // Xóa khỏi dự án cũ
      oldTasks.splice(foundTaskIndex, 1);
      projectSheet.getRange(oldProjectRow, jsonColIndex + 1).setValue(formatJSONCompact(oldTasks));

      // Tìm dự án mới
      const newProjectRow = findRowById(projectSheet, projectIdColIndex + 1, taskData.projectId);
      if (!newProjectRow) {
        return { success: false, error: `Không tìm thấy dự án mới ID: ${taskData.projectId}` };
      }

      // Lấy tasks của dự án mới
      const newJsonCell = projectSheet.getRange(newProjectRow.rowNumber, jsonColIndex + 1);
      let newTasks = [];
      try {
        const jsonStr = newJsonCell.getValue();
        if (jsonStr && typeof jsonStr === 'string') {
          newTasks = JSON.parse(jsonStr);
        }
      } catch (e) {
        newTasks = [];
      }

      // Tạo ID mới cho task
      const newTaskId = generateTaskIdForProject(taskData.projectId, newTasks.length);

      // Tạo task mới với ID mới
      let completion = 0;
      if (
        taskData.completion !== undefined &&
        taskData.completion !== null &&
        taskData.completion !== ''
      ) {
        const parsedCompletion = parseInt(taskData.completion, 10);
        if (!isNaN(parsedCompletion)) {
          completion = Math.max(0, Math.min(100, parsedCompletion));
        }
      }

      const newTask = {};
      newTask[TASK_ID_COLUMN_NAME] = newTaskId;
      newTask[TASK_NAME_COLUMN_NAME] = String(taskData.name).trim();
      newTask[TASK_DESC_COLUMN_NAME] = taskData.description
        ? String(taskData.description).trim()
        : '';
      newTask[TASK_ASSIGNEE_COLUMN_NAME] = taskData.assignee
        ? String(taskData.assignee).trim()
        : '';
      newTask[TASK_PRIORITY_COLUMN_NAME] = taskData.priority || 'Trung bình';
      newTask[TASK_START_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.startDate));
      newTask[TASK_DUE_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.dueDate));
      newTask[TASK_STATUS_COLUMN_NAME] = taskData.status || 'Chưa bắt đầu';
      newTask[TASK_COMPLETION_COLUMN_NAME] = completion;
      newTask[TASK_REPORT_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.reportDate));
      newTask[TASK_TARGET_COLUMN_NAME] = taskData.target ? String(taskData.target).trim() : '';
      newTask[TASK_RESULT_LINKS_COLUMN_NAME] = taskData.resultLinks
        ? String(taskData.resultLinks).trim()
        : '';
      newTask[TASK_OUTPUT_COLUMN_NAME] = taskData.output ? String(taskData.output).trim() : '';
      newTask[TASK_NOTES_COLUMN_NAME] = taskData.notes ? String(taskData.notes).trim() : '';

      // Thêm vào dự án mới
      newTasks.push(newTask);
      newJsonCell.setValue(formatJSONCompact(newTasks));
      SpreadsheetApp.flush();

      logActivity(
        'Chuyển nhiệm vụ',
        `ID: ${taskId} → ${newTaskId}, Tên: ${taskData.name}, Từ ${oldProjectId} sang ${taskData.projectId}`,
        taskData.projectId
      );

      return { success: true, updated: true, newTaskId: newTaskId };
    }
    // ← KẾT THÚC ĐOẠN THÊM MỚI

    // Cập nhật trong cùng dự án (code cũ)
    let completion = 0;
    if (
      taskData.completion !== undefined &&
      taskData.completion !== null &&
      taskData.completion !== ''
    ) {
      const parsedCompletion = parseInt(taskData.completion, 10);
      if (!isNaN(parsedCompletion)) {
        completion = Math.max(0, Math.min(100, parsedCompletion));
      }
    }

    const updatedTask = oldTasks[foundTaskIndex];
    const previousAssignee = (updatedTask[TASK_ASSIGNEE_COLUMN_NAME] || '').trim(); // Lưu lại người cũ
    const previousStatus  = (updatedTask[TASK_STATUS_COLUMN_NAME]   || '').trim(); // Lưu lại trạng thái cũ
    updatedTask[TASK_NAME_COLUMN_NAME] = String(taskData.name).trim();
    updatedTask[TASK_DESC_COLUMN_NAME] = taskData.description
      ? String(taskData.description).trim()
      : '';
    updatedTask[TASK_ASSIGNEE_COLUMN_NAME] = taskData.assignee
      ? String(taskData.assignee).trim()
      : '';
    updatedTask[TASK_PRIORITY_COLUMN_NAME] = taskData.priority || 'Trung bình';
    updatedTask[TASK_START_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.startDate));
    updatedTask[TASK_DUE_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.dueDate));
    updatedTask[TASK_STATUS_COLUMN_NAME] = taskData.status || 'Chưa bắt đầu';
    updatedTask[TASK_COMPLETION_COLUMN_NAME] = completion;
    updatedTask[TASK_REPORT_DATE_COLUMN_NAME] = formatSheetDate(parseDate(taskData.reportDate));
    updatedTask[TASK_TARGET_COLUMN_NAME] = taskData.target ? String(taskData.target).trim() : '';
    updatedTask[TASK_RESULT_LINKS_COLUMN_NAME] = taskData.resultLinks
      ? String(taskData.resultLinks).trim()
      : '';
    updatedTask[TASK_OUTPUT_COLUMN_NAME] = taskData.output ? String(taskData.output).trim() : '';
    updatedTask[TASK_NOTES_COLUMN_NAME] = taskData.notes ? String(taskData.notes).trim() : '';
    updatedTask['Số người phụ thuộc'] = parseInt(taskData.dependentCount || updatedTask['Số người phụ thuộc'] || 0) || 0;

    projectSheet.getRange(oldProjectRow, jsonColIndex + 1).setValue(formatJSONCompact(oldTasks));
    SpreadsheetApp.flush();

    logActivity('Cập nhật nhiệm vụ', `ID: ${taskId}, Tên: ${taskData.name}`, taskData.projectId);

    // Ghi hàng chờ thông báo Telegram nếu có thay đổi người thực hiện
    try {
      const newAssignee = (taskData.assignee || '').trim();
      if (newAssignee && newAssignee !== previousAssignee) {
        const projectNameColIdx2 = headers.indexOf(PROJECT_NAME_COLUMN_NAME);
        const projectNameVal = projectNameColIdx2 !== -1
          ? projectSheet.getRange(oldProjectRow, projectNameColIdx2 + 1).getValue()
          : taskData.projectId;
        const currentUser2 = getCurrentUser();
        queueTaskNotification(taskId, taskData.name, newAssignee, projectNameVal, 'assigned', currentUser2 ? currentUser2.name : '');
      }
    } catch (e) { /* không ảnh hưởng đến kết quả chính */ }

    // Thông báo khi nhiệm vụ được đánh dấu Hoàn thành
    try {
      const newSt = (taskData.status || '').toLowerCase();
      if (newSt.includes('hoàn thành') && !previousStatus.toLowerCase().includes('hoàn thành')) {
        const assigneeToNotify = (taskData.assignee || previousAssignee || '').trim();
        if (assigneeToNotify) {
          const projectNameColIdx3 = headers.indexOf(PROJECT_NAME_COLUMN_NAME);
          const projectNameVal3 = projectNameColIdx3 !== -1
            ? projectSheet.getRange(oldProjectRow, projectNameColIdx3 + 1).getValue()
            : taskData.projectId;
          const currentUser3 = getCurrentUser();
          queueTaskNotification(taskId, taskData.name, assigneeToNotify, projectNameVal3, 'completed', currentUser3 ? currentUser3.name : '');
        }
      }
    } catch (e) { /* không ảnh hưởng đến kết quả chính */ }

    return { success: true, updated: true };
  } catch (e) {
    console.error(`Error updating task ${taskId}:`, e);
    return { success: false, error: `Lỗi khi cập nhật nhiệm vụ: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function deleteTask(taskId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);

    if (jsonColIndex === -1)
      throw new Error(`Không tìm thấy cột "${PROJECT_TASKS_JSON_COLUMN_NAME}".`);
    if (!taskId) return { success: false, error: 'ID nhiệm vụ không được cung cấp.' };

    // Tìm và xóa task
    const lastRow = projectSheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Không tìm thấy nhiệm vụ.' };

    for (let row = 2; row <= lastRow; row++) {
      const jsonCell = projectSheet.getRange(row, jsonColIndex + 1);
      try {
        const jsonStr = jsonCell.getValue();
        if (jsonStr && typeof jsonStr === 'string') {
          let tasks = JSON.parse(jsonStr);
          const taskIndex = tasks.findIndex((task) => task[TASK_ID_COLUMN_NAME] === taskId);
          if (taskIndex !== -1) {
            const originalTask = tasks[taskIndex]; // THÊM DÒNG NÀY
            const taskName = originalTask[TASK_NAME_COLUMN_NAME] || taskId;
            tasks.splice(taskIndex, 1);
            jsonCell.setValue(formatJSONCompact(tasks));
            SpreadsheetApp.flush();

            logActivity(
              'Xóa nhiệm vụ',
              `ID: ${taskId}, Tên: ${taskName}`,
              originalTask[TASK_PROJECT_ID_COLUMN_NAME]
            );
            return { success: true };
          }
        }
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: `Không tìm thấy nhiệm vụ ID: ${taskId}` };
  } catch (e) {
    console.error(`Error deleting task ${taskId}:`, e);
    return { success: false, error: `Lỗi khi xóa nhiệm vụ: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function addTaskComment(taskId, commentText) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    if (!taskId) return { success: false, error: 'Thiếu ID nhiệm vụ.' };
    commentText = String(commentText || '').trim();
    if (!commentText) return { success: false, error: 'Nội dung bình luận không được trống.' };

    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập.' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error('Không tìm thấy sheet dự án.');

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    if (jsonColIndex === -1) throw new Error('Không tìm thấy cột nhiệm vụ JSON.');

    const lastRow = projectSheet.getLastRow();
    for (let row = 2; row <= lastRow; row++) {
      const jsonCell = projectSheet.getRange(row, jsonColIndex + 1);
      try {
        const jsonStr = jsonCell.getValue();
        if (!jsonStr || typeof jsonStr !== 'string') continue;
        const tasks = JSON.parse(jsonStr);
        const taskIndex = tasks.findIndex((t) => t[TASK_ID_COLUMN_NAME] === taskId);
        if (taskIndex === -1) continue;

        const newComment = {
          id: 'c' + new Date().getTime(),
          user: user.name,
          time: new Date().toISOString(),
          text: commentText,
        };

        let existing = tasks[taskIndex][TASK_COMMENTS_COLUMN_NAME];
        let comments = [];
        try { comments = existing ? JSON.parse(existing) : []; } catch (e) { comments = []; }
        comments.push(newComment);
        tasks[taskIndex][TASK_COMMENTS_COLUMN_NAME] = JSON.stringify(comments);

        jsonCell.setValue(formatJSONCompact(tasks));
        SpreadsheetApp.flush();
        return { success: true, comment: newComment };
      } catch (e) {
        continue;
      }
    }
    return { success: false, error: 'Không tìm thấy nhiệm vụ.' };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Ghi hàng chờ thông báo Telegram khi nhiệm vụ được tạo / phân công
 */
function queueTaskNotification(taskId, taskName, assignee, projectName, type, createdBy) {
  try {
    if (!assignee || !assignee.trim()) return; // không có người nhận thì bỏ qua
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(TASK_NOTIFICATION_SHEET_NAME);
    if (!sheet) {
      // Tạo sheet nếu chưa có
      sheet = ss.insertSheet(TASK_NOTIFICATION_SHEET_NAME);
      sheet.appendRow(['Task ID', 'Tên nhiệm vụ', 'Người nhận', 'Tên dự án', 'Người tạo', 'Loại', 'Thời gian', 'Đã gửi']);
    }
    sheet.appendRow([
      taskId || '',
      taskName || '',
      assignee.trim(),
      projectName || '',
      createdBy || '',
      type || 'created',
      new Date().toISOString(),
      'FALSE'
    ]);
  } catch (e) {
    console.error('queueTaskNotification error:', e);
  }
}

function formatJSONCompact(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return JSON.stringify(data);
  }

  const formattedItems = data.map((item) => JSON.stringify(item));
  return '[\n' + formattedItems.join(',\n') + '\n]';
}

function getTasks() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) {
      return [];
    }

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME); // THÊM DÒNG NÀY

    if (jsonColIndex === -1) {
      return [];
    }

    const lastRow = projectSheet.getLastRow();
    if (lastRow < 2) return [];

    let allTasks = [];
    const range = projectSheet.getRange(2, jsonColIndex + 1, lastRow - 1, 1);
    const jsonValues = range.getValues();

    jsonValues.forEach((row, index) => {
      const jsonStr = row[0];
      if (jsonStr && typeof jsonStr === 'string') {
        const tasks = JSON.parse(jsonStr);
        if (Array.isArray(tasks)) {
          // Lấy project ID từ cột A
          const projectId = projectSheet.getRange(index + 2, projectIdColIndex + 1).getValue();

          // Gán project ID cho tất cả tasks
          const tasksWithProjectId = tasks.map((task) => ({
            ...task,
            [TASK_PROJECT_ID_COLUMN_NAME]: projectId,
          }));

          allTasks = allTasks.concat(tasksWithProjectId);
        }
      }
    });

    return allTasks;
  } catch (e) {
    console.error('Error getting tasks:', e);
    return [];
  }
}

// ==================================
// == QUẢN LÝ NHÂN VIÊN (STAFF) ==
// ==================================

function addStaff(staffData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = getOrCreateSheet(ss, STAFF_SHEET_NAME, [
      STAFF_ID_COLUMN_NAME,
      STAFF_NAME_COLUMN_NAME,
      STAFF_EMAIL_COLUMN_NAME,
      STAFF_POSITION_COLUMN_NAME,
      STAFF_ROLE_COLUMN_NAME,
      STAFF_PASSWORD_COLUMN_NAME, // Thêm 2 dòng này
    ]);

    const headers = getHeaders(staffSheet);

    // Validate required fields
    if (!staffData || !staffData.name || String(staffData.name).trim() === '') {
      return { success: false, error: 'Tên nhân viên là bắt buộc.' };
    }

    const idColIndex = headers.indexOf(STAFF_ID_COLUMN_NAME);
    const lastId = getLastId(staffSheet, idColIndex, 'NV');
    const newStaffId = generateNextId(lastId, 'NV', 3);

    const newRow = Array(headers.length).fill('');

    // Điền dữ liệu
    newRow[idColIndex] = newStaffId;
    newRow[headers.indexOf(STAFF_NAME_COLUMN_NAME)] = String(staffData.name).trim();
    newRow[headers.indexOf(STAFF_EMAIL_COLUMN_NAME)] = staffData.email
      ? String(staffData.email).trim()
      : '';
    newRow[headers.indexOf(STAFF_POSITION_COLUMN_NAME)] = staffData.position
      ? String(staffData.position).trim()
      : '';
    newRow[headers.indexOf(STAFF_ROLE_COLUMN_NAME)] = staffData.role || 'Nhân viên';
    newRow[headers.indexOf(STAFF_PASSWORD_COLUMN_NAME)] = staffData.password || '';
    const deptIdx = headers.indexOf(STAFF_DEPARTMENT_COLUMN_NAME);
    if (deptIdx !== -1) newRow[deptIdx] = staffData.department ? String(staffData.department).trim() : '';

    staffSheet.appendRow(newRow);
    SpreadsheetApp.flush();

    return { success: true, staffId: newStaffId };
  } catch (e) {
    console.error(`Error adding staff:`, e);
    return { success: false, error: `Lỗi khi thêm nhân viên: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function updateStaff(staffId, staffData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) throw new Error(`Không tìm thấy sheet "${STAFF_SHEET_NAME}".`);

    const headers = getHeaders(staffSheet);
    const idColIndex = headers.indexOf(STAFF_ID_COLUMN_NAME);
    if (idColIndex === -1) throw new Error(`Không tìm thấy cột "${STAFF_ID_COLUMN_NAME}".`);

    // Validate đầu vào
    if (!staffId) return { success: false, error: 'ID nhân viên không được cung cấp.' };
    if (!staffData || !staffData.name || String(staffData.name).trim() === '') {
      return { success: false, error: 'Tên nhân viên là bắt buộc.' };
    }

    const rowInfo = findRowById(staffSheet, idColIndex + 1, staffId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy nhân viên ID: ${staffId}` };

    const rowNumber = rowInfo.rowNumber;
    const range = staffSheet.getRange(rowNumber, 1, 1, headers.length);
    const values = range.getValues()[0];

    let changesDetected = false;

    // Cập nhật các trường
    const updates = [
      [headers.indexOf(STAFF_NAME_COLUMN_NAME), staffData.name],
      [headers.indexOf(STAFF_EMAIL_COLUMN_NAME), staffData.email],
      [headers.indexOf(STAFF_POSITION_COLUMN_NAME), staffData.position],
      [headers.indexOf(STAFF_ROLE_COLUMN_NAME), staffData.role],
      [headers.indexOf(STAFF_PASSWORD_COLUMN_NAME), staffData.password],
      [headers.indexOf(STAFF_DEPARTMENT_COLUMN_NAME), staffData.department],
    ];

    updates.forEach(([index, newValue]) => {
      if (index !== -1 && newValue !== undefined) {
        const formattedValue = newValue ? String(newValue).trim() : '';
        if (String(values[index]).trim() !== formattedValue) {
          values[index] = formattedValue;
          changesDetected = true;
        }
      }
    });

    if (changesDetected) {
      range.setValues([values]);
      SpreadsheetApp.flush();
    }

    return { success: true, updated: changesDetected };
  } catch (e) {
    console.error(`Error updating staff ${staffId}:`, e);
    return { success: false, error: `Lỗi khi cập nhật nhân viên: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function deleteStaff(staffId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) throw new Error(`Không tìm thấy sheet "${STAFF_SHEET_NAME}".`);

    const headers = getHeaders(staffSheet);
    const idColIndex = headers.indexOf(STAFF_ID_COLUMN_NAME);
    if (idColIndex === -1) throw new Error(`Không tìm thấy cột "${STAFF_ID_COLUMN_NAME}".`);

    if (!staffId) return { success: false, error: 'ID nhân viên không được cung cấp.' };

    const rowInfo = findRowById(staffSheet, idColIndex + 1, staffId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy nhân viên ID: ${staffId}` };

    const rowNumber = rowInfo.rowNumber;
    const nameColIndex = headers.indexOf(STAFF_NAME_COLUMN_NAME);
    const staffName =
      nameColIndex !== -1 ? staffSheet.getRange(rowNumber, nameColIndex + 1).getValue() : staffId;

    staffSheet.deleteRow(rowNumber);

    return { success: true };
  } catch (e) {
    console.error(`Error deleting staff ${staffId}:`, e);
    return { success: false, error: `Lỗi khi xóa nhân viên: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function getStaffList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!sheet) {
      const newSheet = getOrCreateSheet(ss, STAFF_SHEET_NAME, [
        STAFF_ID_COLUMN_NAME,
        STAFF_NAME_COLUMN_NAME,
        STAFF_EMAIL_COLUMN_NAME,
        STAFF_POSITION_COLUMN_NAME,
      ]);
      return [];
    }
    return sheetDataToObjectArray(sheet);
  } catch (e) {
    console.error('Error getting staff list:', e);
    return [];
  }
}

// ==================================
// == COIN ECONOMY ==
// ==================================

/**
 * Get or create the CoinLog sheet with headers.
 */
function getCoinLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(COIN_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COIN_LOG_SHEET_NAME);
    sheet.appendRow(['Time', 'User', 'Amount', 'Type', 'Source', 'BalanceAfter']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Get staff row index and headers for a given staff name.
 * Returns { sheet, headers, rowIndex, row } or null.
 */
function _getStaffRow(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!sheet) return null;
  const headers = getHeaders(sheet);
  const nameIdx = headers.indexOf(STAFF_NAME_COLUMN_NAME);
  if (nameIdx === -1) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][nameIdx] || '').trim() === String(name || '').trim()) {
      return { sheet, headers, rowIndex: i + 2, row: values[i] };
    }
  }
  return null;
}

/**
 * Ensure all coin-related columns exist in the staff sheet header row.
 * Adds missing columns at the end.
 */
function _ensureCoinColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
  if (!sheet) return;
  const coinCols = [
    STAFF_COIN_COLUMN_NAME, STAFF_BOOST_EXPIRES_COLUMN_NAME,
    STAFF_STREAK_FREEZE_COLUMN_NAME, STAFF_LAST_DAILY_COLUMN_NAME,
    STAFF_LAST_STREAK_COLUMN_NAME, STAFF_LAST_LEVEL_COLUMN_NAME,
    'DailyGold', 'DailyGoldDate',
  ];
  const headers = getHeaders(sheet);
  let changed = false;
  coinCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      headers.push(col);
      sheet.getRange(1, headers.length).setValue(col);
      changed = true;
    }
  });
}

/**
 * Append a row to CoinLog.
 */
function _logCoin(name, amount, type, source, balanceAfter) {
  try {
    const logSheet = getCoinLogSheet();
    logSheet.appendRow([
      new Date(),
      name,
      amount,
      type,
      source || '',
      balanceAfter,
    ]);
  } catch(e) { console.error('CoinLog error:', e); }
}

/**
 * SERVER-SIDE reward logic — source of truth.
 * Called by client after any significant action.
 * stats: { level, streak, completedAll, completedToday, badgeMilestones:{id:lv,...} }
 * Returns: { coin, gained, boostActive, streakFreezeCount, reasons:[] }
 */
function rewardCoin(staffName, stats) {
  try {
    _ensureCoinColumns();
    const sr = _getStaffRow(staffName);
    if (!sr) return { success: false, error: 'Không tìm thấy nhân viên' };

    const { sheet, headers, rowIndex, row } = sr;
    const get = function(colName) {
      const idx = headers.indexOf(colName);
      return idx !== -1 ? row[idx] : '';
    };
    const set = function(colName, val) {
      const idx = headers.indexOf(colName);
      if (idx !== -1) sheet.getRange(rowIndex, idx + 1).setValue(val);
    };

    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    let coin        = Number(get(STAFF_COIN_COLUMN_NAME)) || 0;
    const lastDaily = String(get(STAFF_LAST_DAILY_COLUMN_NAME) || '').slice(0, 10);
    const lastStreak= Number(get(STAFF_LAST_STREAK_COLUMN_NAME)) || 0;
    const lastLevel = Number(get(STAFF_LAST_LEVEL_COLUMN_NAME)) || 0;

    const gained  = [];
    let   total   = 0;

    // Daily XGOLD cap
    const DAILY_GOLD_CAP = 200;
    const dailyGoldDate  = String(get('DailyGoldDate') || '').slice(0, 10);
    let   dailyGoldEarned = (dailyGoldDate === todayStr) ? (Number(get('DailyGold')) || 0) : 0;

    // ── 1. Level-up reward ────────────────────────────────────────
    const newLevel = Number(stats.level) || 0;
    if (newLevel > lastLevel && newLevel > 0) {
      let reward = 0;
      if (newLevel <= 3)  reward = 20;
      else if (newLevel <= 5)  reward = 50;
      else if (newLevel <= 7)  reward = 100;
      else                     reward = 200;
      total += reward;
      gained.push({ type: 'LEVEL_UP', amount: reward, reason: 'Lên Level ' + newLevel });
      _logCoin(staffName, reward, 'LEVEL_UP', 'level_' + newLevel, coin + total);
      set(STAFF_LAST_LEVEL_COLUMN_NAME, newLevel);
    }

    // ── 2. Daily medal reward (anti-dup: once per calendar day) ──
    if (lastDaily !== todayStr) {
      const completed = Number(stats.completedToday) || 0;
      let reward = 0;
      if (completed >= 8)      reward = 40;
      else if (completed >= 5) reward = 20;
      else if (completed >= 3) reward = 10;
      if (reward > 0) {
        total += reward;
        gained.push({ type: 'DAILY_MEDAL', amount: reward, reason: 'Hoàn thành ' + completed + ' việc hôm nay' });
        _logCoin(staffName, reward, 'DAILY_MEDAL', 'daily_' + todayStr, coin + total);
        set(STAFF_LAST_DAILY_COLUMN_NAME, todayStr);
      }
    }

    // ── 3. Streak milestone reward (only when crossing new milestone) ─
    const streak = Number(stats.streak) || 0;
    const STREAK_MILESTONES = [3, 7, 14, 30];
    let highestMilestone = 0;
    STREAK_MILESTONES.forEach(function(m) { if (streak >= m) highestMilestone = m; });
    if (highestMilestone > lastStreak) {
      let reward = 0;
      if (highestMilestone >= 30)      reward = 150;
      else if (highestMilestone >= 14) reward = 70;
      else if (highestMilestone >= 7)  reward = 30;
      else if (highestMilestone >= 3)  reward = 10;
      if (reward > 0) {
        total += reward;
        gained.push({ type: 'STREAK', amount: reward, reason: 'Chuỗi ' + highestMilestone + ' ngày!' });
        _logCoin(staffName, reward, 'STREAK', 'streak_' + highestMilestone, coin + total);
        set(STAFF_LAST_STREAK_COLUMN_NAME, highestMilestone);
      }
    }

    // ── 4. Badge milestone rewards ────────────────────────────────
    const BADGE_COIN = { 1: 20, 2: 40, 3: 80, 4: 150, 5: 300 };
    const badgeMilestones = stats.badgeMilestones || {};
    // We read previous badge milestones from a compact stored string or skip if not provided
    // Simple approach: client sends delta (newly reached milestones only)
    const newBadges = stats.newBadges || []; // [{id, level}]
    newBadges.forEach(function(b) {
      const reward = BADGE_COIN[b.level] || 0;
      if (reward > 0) {
        total += reward;
        gained.push({ type: 'BADGE', amount: reward, reason: b.name + ' Lv.' + b.level });
        _logCoin(staffName, reward, 'BADGE', b.id + '_lv' + b.level, coin + total);
      }
    });

    // ── Write final balance ───────────────────────────────────────
    // Enforce daily XGOLD cap
    const remaining = Math.max(0, DAILY_GOLD_CAP - dailyGoldEarned);
    total = Math.min(total, remaining);
    if (total > 0) {
      dailyGoldEarned += total;
      set('DailyGold', dailyGoldEarned);
      set('DailyGoldDate', todayStr);
      coin += total;
      set(STAFF_COIN_COLUMN_NAME, coin);
    }

    const boostExpires = String(get(STAFF_BOOST_EXPIRES_COLUMN_NAME) || '');
    const boostActive  = boostExpires && new Date(boostExpires) > new Date();
    const streakFreezeCount = Number(get(STAFF_STREAK_FREEZE_COLUMN_NAME)) || 0;

    return {
      success:          true,
      coin:             coin,
      gained:           gained,
      totalGained:      total,
      boostActive:      !!boostActive,
      boostExpires:     boostExpires,
      streakFreezeCount: streakFreezeCount,
    };
  } catch(e) {
    console.error('rewardCoin error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Spend coin — validate balance, deduct, log.
 * type: 'XP_BOOST' | 'STREAK_FREEZE' | other
 * Returns: { success, coin } or { success:false, error }
 */
function spendCoin(staffName, amount, type) {
  try {
    _ensureCoinColumns();
    const sr = _getStaffRow(staffName);
    if (!sr) return { success: false, error: 'Không tìm thấy nhân viên' };
    const { sheet, headers, rowIndex, row } = sr;
    const coinIdx = headers.indexOf(STAFF_COIN_COLUMN_NAME);
    if (coinIdx === -1) return { success: false, error: 'Cột Coin chưa tồn tại' };
    let coin = Number(row[coinIdx]) || 0;
    if (coin < amount) return { success: false, error: 'Không đủ coin (có ' + coin + ', cần ' + amount + ')' };
    coin -= amount;
    sheet.getRange(rowIndex, coinIdx + 1).setValue(coin);
    _logCoin(staffName, -amount, type, 'spend_' + type, coin);
    return { success: true, coin: coin };
  } catch(e) {
    console.error('spendCoin error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Activate XP Boost (50 coin → x2 XP for 24h).
 */
function activateBoost(staffName) {
  const result = spendCoin(staffName, 50, 'XP_BOOST');
  if (!result.success) return result;
  const sr = _getStaffRow(staffName);
  if (!sr) return { success: false, error: 'Không tìm thấy nhân viên' };
  const { sheet, headers, rowIndex } = sr;
  const boostIdx = headers.indexOf(STAFF_BOOST_EXPIRES_COLUMN_NAME);
  if (boostIdx !== -1) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    sheet.getRange(rowIndex, boostIdx + 1).setValue(expires.toISOString());
    result.boostExpires = expires.toISOString();
  }
  return result;
}

/**
 * Activate Streak Freeze (30 coin → +1 freeze charge).
 */
function activateStreakFreeze(staffName) {
  const result = spendCoin(staffName, 30, 'STREAK_FREEZE');
  if (!result.success) return result;
  const sr = _getStaffRow(staffName);
  if (!sr) return { success: false, error: 'Không tìm thấy nhân viên' };
  const { sheet, headers, rowIndex, row } = sr;
  const freezeIdx = headers.indexOf(STAFF_STREAK_FREEZE_COLUMN_NAME);
  if (freezeIdx !== -1) {
    const newCount = (Number(row[freezeIdx]) || 0) + 1;
    sheet.getRange(rowIndex, freezeIdx + 1).setValue(newCount);
    result.streakFreezeCount = newCount;
  }
  return result;
}

// ==================================
// == BIỂU ĐỒ & THỐNG KÊ ==
// ==================================

function getTaskStatusChartData(tasks) {
  try {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return { labels: [], data: [], message: 'Không có dữ liệu nhiệm vụ để tạo biểu đồ.' };
    }

    const statusCounts = {};
    const statusHeader = TASK_STATUS_COLUMN_NAME;

    tasks.forEach((task) => {
      if (typeof task === 'object' && task !== null && task.hasOwnProperty(statusHeader)) {
        const status = String(task[statusHeader] || 'Không xác định').trim();
        if (status) {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      }
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);

    if (labels.length === 0) {
      return { labels: [], data: [], message: 'Không có trạng thái nhiệm vụ nào được tìm thấy.' };
    }

    return { labels: labels, data: data };
  } catch (e) {
    console.error('Error getting chart data:', e);
    return { labels: [], data: [], error: `Lỗi khi lấy dữ liệu biểu đồ: ${e.message}` };
  }
}

function getSummaryStats(projects, tasks) {
  try {
    const totalProjects = projects && Array.isArray(projects) ? projects.length : 0;
    let completedTasks = 0;
    let ongoingTasks = 0;
    let overdueTasks = 0;
    const totalTasks = tasks && Array.isArray(tasks) ? tasks.length : 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (tasks && Array.isArray(tasks)) {
      const statusHeader = TASK_STATUS_COLUMN_NAME;
      const dueDateHeader = TASK_DUE_DATE_COLUMN_NAME;

      tasks.forEach((task) => {
        if (typeof task !== 'object' || task === null || !task.hasOwnProperty(statusHeader)) {
          return;
        }

        const status = String(task[statusHeader] || '')
          .trim()
          .toLowerCase();
        const dueDateString = task[dueDateHeader];

        // Đếm trạng thái
        if (status.includes('hoàn thành')) {
          completedTasks++;
        } else if (status.includes('đang')) {
          ongoingTasks++;
        }

        // Kiểm tra quá hạn
        if (!status.includes('hoàn thành') && dueDateString) {
          const dueDate = parseDate(dueDateString);
          if (dueDate && dueDate < today) {
            overdueTasks++;
          }
        }
      });
    }

    return {
      totalProjects: totalProjects,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      ongoingTasks: ongoingTasks,
      overdueTasks: overdueTasks,
    };
  } catch (e) {
    console.error('Error calculating summary stats:', e);
    return { error: `Lỗi khi tính toán thống kê: ${e.message}` };
  }
}

// ==================================
// == NHẬT KÝ & THÔNG BÁO ==
// ==================================

function getRecentActivities() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) {
      return [];
    }

    const headers = getHeaders(projectSheet);
    const logJsonColIndex = headers.indexOf(PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME);
    if (logJsonColIndex === -1) {
      return [];
    }

    const lastRow = projectSheet.getLastRow();
    if (lastRow < 2) return [];

    let allActivities = [];

    // Lặp qua từng dự án để lấy activities
    for (let row = 2; row <= lastRow; row++) {
      const logJsonCell = projectSheet.getRange(row, logJsonColIndex + 1);
      const jsonStr = logJsonCell.getValue();

      if (jsonStr && typeof jsonStr === 'string' && jsonStr.trim() !== '') {
        try {
          const logs = JSON.parse(jsonStr);
          if (Array.isArray(logs) && logs.length > 0) {
            // Đảm bảo mỗi log có đủ thông tin cần thiết
            const validLogs = logs.filter(
              (log) =>
                log &&
                typeof log === 'object' &&
                log[LOG_TIMESTAMP_COLUMN_NAME] &&
                log[LOG_ACTION_COLUMN_NAME]
            );
            allActivities = allActivities.concat(validLogs);
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (allActivities.length === 0) {
      return [];
    }

    // Sắp xếp theo thời gian (mới nhất trước)
    allActivities.sort((a, b) => {
      const dateA = new Date(a[LOG_TIMESTAMP_COLUMN_NAME]);
      const dateB = new Date(b[LOG_TIMESTAMP_COLUMN_NAME]);
      return dateB - dateA;
    });

    // Giới hạn số lượng trả về (22 activities gần nhất)
    const result = allActivities.slice(0, 22);

    return result;
  } catch (e) {
    console.error('Error getting recent activities:', e);
    return [];
  }
}

// ==================================
// == HÀM HỖ TRỢ (HELPERS) ==
// ==================================

function getOrCreateSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);

      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f8f9fa');
    }
  }
  return sheet;
}

function sheetDataToObjectArray(sheet) {
  if (!sheet) {
    return [];
  }

  try {
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length < 2) return [];

    const headers = values[0].map((header) => (header ? String(header).trim() : ''));
    const dataRows = values
      .slice(1)
      .filter((row) => row.some((cell) => cell !== null && cell !== ''));
    if (dataRows.length === 0) return [];

    const objectArray = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header && index < row.length) {
          let cellValue = row[index];
          // Định dạng ngày tháng thành YYYY-MM-DD
          if (cellValue instanceof Date) {
            obj[header] = formatSheetDate(cellValue);
          } else {
            obj[header] = cellValue;
          }
        }
      });
      return obj;
    });

    return objectArray;
  } catch (e) {
    console.error(`Error in sheetDataToObjectArray for sheet "${sheet.getName()}":`, e);
    return [];
  }
}

function logActivity(action, details, projectId = null) {
  try {
    // Nếu không có projectId, cố gắng extract từ details
    if (!projectId) {
      const matches = details.match(/(?:ID:|Dự án:|Thuộc dự án:)\s*([A-Z0-9]+)/i);
      if (matches) {
        projectId = matches[1];
      } else {
        return;
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) return;

    const headers = getHeaders(projectSheet);
    const logJsonColIndex = headers.indexOf(PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME);
    const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);

    if (logJsonColIndex === -1 || projectIdColIndex === -1) {
      return;
    }

    // Tìm project row
    const projectRowInfo = findRowById(projectSheet, projectIdColIndex + 1, projectId);
    if (!projectRowInfo) {
      return;
    }

    // Lấy log JSON hiện tại
    const logJsonCell = projectSheet.getRange(projectRowInfo.rowNumber, logJsonColIndex + 1);
    let currentLogs = [];
    try {
      const jsonStr = logJsonCell.getValue();
      if (jsonStr && typeof jsonStr === 'string' && jsonStr.trim() !== '') {
        currentLogs = JSON.parse(jsonStr);
      }
    } catch (e) {
      currentLogs = [];
    }

    // Đảm bảo currentLogs là mảng
    if (!Array.isArray(currentLogs)) {
      currentLogs = [];
    }

    const timestamp = new Date();
    let user = 'Unknown User';

    // Lấy thông tin user
    const currentUser = getCurrentUser();
    if (currentUser) {
      user = currentUser.email || currentUser.name || 'Unknown User';
    }

    // Tạo log entry với đúng format
    const logEntry = {
      [LOG_TIMESTAMP_COLUMN_NAME]: timestamp.toISOString(),
      [LOG_ACTION_COLUMN_NAME]: action,
      [LOG_USER_COLUMN_NAME]: user,
      [LOG_DETAILS_COLUMN_NAME]: details,
    };

    // Thêm vào đầu danh sách (mới nhất trước)
    currentLogs.unshift(logEntry);

    // Giới hạn số lượng logs (giữ 22 logs gần nhất cho mỗi dự án)
    if (currentLogs.length > 22) {
      currentLogs = currentLogs.slice(0, 22);
    }

    // Lưu lại JSON
    logJsonCell.setValue(formatJSONCompact(currentLogs));
  } catch (e) {
    console.error('Error logging activity:', e);
  }
}

function getHeaders(sheet) {
  if (!sheet) return [];
  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    return headerRange.getValues()[0].map((header) => (header ? String(header).trim() : ''));
  } catch (e) {
    console.error(`Error getting headers for sheet "${sheet.getName()}":`, e);
    return [];
  }
}

function getLastId(sheet, idColIndex, prefix) {
  if (!sheet || idColIndex < 0) return null;
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const idRange = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1);
    const idValues = idRange.getDisplayValues().flat();
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    let maxNumericPart = 0;

    idValues.forEach((id) => {
      if (typeof id === 'string' && id.trim() !== '') {
        const match = id.trim().match(regex);
        if (match) {
          const numericPart = parseInt(match[1], 10);
          if (!isNaN(numericPart) && numericPart >= maxNumericPart) {
            maxNumericPart = numericPart;
          }
        }
      }
    });

    if (maxNumericPart > 0) {
      const minLength = 3;
      const numericString = String(maxNumericPart).padStart(minLength, '0');
      return `${prefix}${numericString}`;
    } else {
      return null;
    }
  } catch (e) {
    console.error(`Error getting last ID for prefix ${prefix} in column ${idColIndex + 1}:`, e);
    return null;
  }
}

function generateNextId(lastId, prefix, minLength = 3) {
  let nextNumericPart = 1;
  if (lastId) {
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    const match = String(lastId).match(regex);
    if (match) {
      const currentNumericPart = parseInt(match[1], 10);
      if (!isNaN(currentNumericPart)) {
        nextNumericPart = currentNumericPart + 1;
      }
    }
  }
  const numericString = String(nextNumericPart).padStart(minLength, '0');
  return `${prefix}${numericString}`;
}

function checkProjectExists(projectId) {
  if (!projectId) return false;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) return false;

    const headers = getHeaders(projectSheet);
    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    if (idColIndex === -1 || projectSheet.getLastRow() < 2) return false;

    const idRange = projectSheet.getRange(2, idColIndex + 1, projectSheet.getLastRow() - 1, 1);
    const idValues = idRange.getDisplayValues();
    const existingIds = new Set(idValues.flat().map((id) => String(id).trim()));
    return existingIds.has(String(projectId).trim());
  } catch (e) {
    console.error(`Error checking project existence for ID ${projectId}:`, e);
    return false;
  }
}

function findRowById(sheet, idColumnNumber, id) {
  if (!sheet || sheet.getLastRow() < 2 || idColumnNumber < 1) return null;
  try {
    const idToFind = String(id).trim().toLowerCase();
    const idValues = sheet
      .getRange(2, idColumnNumber, sheet.getLastRow() - 1, 1)
      .getDisplayValues();

    for (let i = 0; i < idValues.length; i++) {
      const currentValue = String(idValues[i][0]).trim().toLowerCase();
      if (currentValue === idToFind) {
        return { rowNumber: i + 2 };
      }
    }
    return null;
  } catch (e) {
    console.error(
      `Error finding row by ID ${id} in column ${idColumnNumber} of sheet "${sheet.getName()}":`,
      e
    );
    return null;
  }
}

function formatSheetDate(dateValue) {
  if (!dateValue) return '';
  try {
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) {
      return '';
    }

    const timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(date, timeZone, 'yyyy-MM-dd');
  } catch (e) {
    console.error('Error formatting date:', dateValue, '-', e);
    return '';
  }
}

function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (!isNaN(dateInput.getTime())) {
      const validDate = new Date(
        dateInput.getFullYear(),
        dateInput.getMonth(),
        dateInput.getDate()
      );
      return validDate;
    } else {
      return null;
    }
  }
  if (typeof dateInput === 'string') {
    const dateString = dateInput.trim();
    if (dateString === '') return null;
    try {
      // Thử ISO 8601 YYYY-MM-DD
      let date = new Date(dateString + 'T00:00:00');
      if (!isNaN(date.getTime())) return date;

      // Thử DD/MM/YYYY hoặc DD-MM-YYYY
      const partsDMY = dateString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (partsDMY) {
        date = new Date(
          parseInt(partsDMY[3], 10),
          parseInt(partsDMY[2], 10) - 1,
          parseInt(partsDMY[1], 10)
        );
        if (!isNaN(date.getTime()) && date.getDate() === parseInt(partsDMY[1], 10)) return date;
      }

      return null;
    } catch (e) {
      console.error("Error parsing date string '" + dateString + "':", e);
      return null;
    }
  }
  return null;
}

// ==================================
// == TỰ ĐỘNG & TRIGGER ==
// ==================================

function checkAndNotifyOverdueTasks() {
  const tasks = getTasks();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdueCount = 0;
  const statusHeader = TASK_STATUS_COLUMN_NAME;
  const dueDateHeader = TASK_DUE_DATE_COLUMN_NAME;

  tasks.forEach((task) => {
    if (typeof task !== 'object' || task === null || !task.hasOwnProperty(statusHeader)) return;
    const status = (task[statusHeader] || '').toLowerCase();
    const dueDateString = task[dueDateHeader];
    if (!status.includes('hoàn thành') && dueDateString) {
      try {
        const dueDate = parseDate(dueDateString);
        if (dueDate && dueDate < today) {
          overdueCount++;
          createOverdueNotificationIfNeeded(task);
        }
      } catch (dateError) {
        const taskId = task[TASK_ID_COLUMN_NAME] || 'Không rõ ID';
      }
    }
  });
}

// ==================================
// == THIẾT LẬP TRIGGER (CHẠY 1 LẦN TỪ EDITOR) ==
// ==================================

function setupDailyTrigger() {
  const triggerFunctionName = 'checkAndNotifyOverdueTasks';
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  // Xóa trigger cũ
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === triggerFunctionName) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  try {
    ScriptApp.newTrigger(triggerFunctionName)
      .timeBased()
      .atHour(1)
      .everyDays(1)
      .inTimezone(Session.getScriptTimeZone())
      .create();

    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert(
        `Đã tạo trigger kiểm tra nhiệm vụ quá hạn hàng ngày thành công!`
      );
    }
  } catch (e) {
    console.error(`Error creating trigger for ${triggerFunctionName}:`, e);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert(
        `Không thể tạo trigger tự động. Lỗi: ${e.message}. Vui lòng kiểm tra quyền hoặc thử lại sau.`
      );
    }
  }
}

function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  if (triggers.length === 0) {
    return;
  }

  triggers.forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
    deletedCount++;
  });

  if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
    SpreadsheetApp.getUi().alert(`Đã xóa ${deletedCount} trigger(s).`);
  }
}

/**
 * Copy project and all its tasks
 */
function copyProjectWithAuth(projectId, newProjectName) {
  const permissionCheck = checkUserPermission('create', 'project');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return copyProject(projectId, newProjectName);
}

function copyProject(projectId, newProjectName) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    // Find original project
    const headers = getHeaders(projectSheet);
    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    const tasksJsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    const activityJsonColIndex = headers.indexOf(PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME);

    if (idColIndex === -1) throw new Error(`Không tìm thấy cột "${PROJECT_ID_COLUMN_NAME}".`);

    const rowInfo = findRowById(projectSheet, idColIndex + 1, projectId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };

    const range = projectSheet.getRange(rowInfo.rowNumber, 1, 1, headers.length);
    const originalData = range.getValues()[0];

    // Generate new project ID
    const lastId = getLastId(projectSheet, idColIndex, 'DA');
    const newProjectId = generateNextId(lastId, 'DA');

    // Create new project data
    const newRow = [...originalData];
    newRow[idColIndex] = newProjectId;
    newRow[headers.indexOf(PROJECT_NAME_COLUMN_NAME)] = newProjectName;

    // XỬ LÝ JSON NHIỆM VỤ
    if (tasksJsonColIndex !== -1 && originalData[tasksJsonColIndex]) {
      try {
        const originalTasksJson = originalData[tasksJsonColIndex];
        if (originalTasksJson && typeof originalTasksJson === 'string') {
          const originalTasks = JSON.parse(originalTasksJson);
          if (Array.isArray(originalTasks) && originalTasks.length > 0) {
            // Tạo tasks mới với ID format mới và project ID mới
            const newTasks = originalTasks.map((task, index) => {
              const newTask = { ...task };

              // Đổi ID nhiệm vụ theo format "mã dự án-xx"
              const taskNumber = String(index + 1).padStart(2, '0');
              newTask[TASK_ID_COLUMN_NAME] = `${newProjectId}-${taskNumber}`;

              // Đổi ID dự án
              newTask[TASK_PROJECT_ID_COLUMN_NAME] = newProjectId;

              // Reset một số trường cho bản sao
              newTask[TASK_COMPLETION_COLUMN_NAME] = 0;
              newTask[TASK_STATUS_COLUMN_NAME] = 'Chưa bắt đầu';
              newTask[TASK_REPORT_DATE_COLUMN_NAME] = '';

              return newTask;
            });

            // Lưu tasks mới vào JSON
            newRow[tasksJsonColIndex] = formatJSONCompact(newTasks);
          }
        }
      } catch (e) {
        newRow[tasksJsonColIndex] = '';
      }
    }

    // ĐỂ TRỐNG CỘT NHẬT KÝ JSON
    if (activityJsonColIndex !== -1) {
      newRow[activityJsonColIndex] = '';
    }

    // Add new project
    projectSheet.appendRow(newRow);
    SpreadsheetApp.flush();

    logActivity(
      'Tạo bản sao dự án',
      `ID gốc: ${projectId}, ID mới: ${newProjectId}, Tên: ${newProjectName}`,
      newProjectId
    );

    return { success: true, projectId: newProjectId, message: `Đã tạo bản sao dự án thành công!` };
  } catch (e) {
    console.error(`Error copying project ${projectId}:`, e);
    return { success: false, error: `Lỗi khi tạo bản sao dự án: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function generateTaskIdForProject(projectId, taskIndex) {
  const taskNumber = String(taskIndex + 1).padStart(2, '0');
  return `${projectId}-${taskNumber}`;
}

/**
 * Copy task
 */
function copyTaskWithAuth(taskId, newTaskName) {
  const permissionCheck = checkUserPermission('create', 'task');
  if (!permissionCheck.success) {
    return permissionCheck;
  }

  return copyTask(taskId, newTaskName);
}

function copyTask(taskId, newTaskName) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) throw new Error(`Không tìm thấy sheet "${PROJECT_SHEET_NAME}".`);

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);

    if (jsonColIndex === -1)
      throw new Error(`Không tìm thấy cột "${PROJECT_TASKS_JSON_COLUMN_NAME}".`);

    // Tìm task gốc trong JSON
    const lastRow = projectSheet.getLastRow();
    if (lastRow < 2) throw new Error('Không có dự án nào.');

    let originalTask = null;
    let targetProjectRow = null;
    let targetTasks = [];
    let targetProjectId = null; // ← THÊM DÒNG NÀY

    for (let row = 2; row <= lastRow; row++) {
      const jsonCell = projectSheet.getRange(row, jsonColIndex + 1);
      try {
        const jsonStr = jsonCell.getValue();
        if (jsonStr && typeof jsonStr === 'string') {
          const tasks = JSON.parse(jsonStr);
          const foundTask = tasks.find((task) => task[TASK_ID_COLUMN_NAME] === taskId);
          if (foundTask) {
            originalTask = foundTask;
            targetProjectRow = row;
            targetTasks = tasks;
            // ← THÊM 2 DÒNG NÀY
            const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
            targetProjectId = projectSheet.getRange(row, projectIdColIndex + 1).getValue();
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!originalTask) {
      return { success: false, error: `Không tìm thấy nhiệm vụ ID: ${taskId}` };
    }

    // Tạo ID mới cho task
    const nextTaskIndex = targetTasks.length;
    const newTaskId = generateTaskIdForProject(targetProjectId, nextTaskIndex);

    // Tạo bản sao task
    const newTask = { ...originalTask };
    newTask[TASK_ID_COLUMN_NAME] = newTaskId;
    newTask[TASK_NAME_COLUMN_NAME] = newTaskName;

    // Reset một số trường cho bản sao
    newTask[TASK_COMPLETION_COLUMN_NAME] = 0;
    newTask[TASK_STATUS_COLUMN_NAME] = 'Chưa bắt đầu';
    newTask[TASK_REPORT_DATE_COLUMN_NAME] = '';

    // Thêm vào danh sách tasks
    targetTasks.push(newTask);

    // Lưu lại JSON
    const jsonCell = projectSheet.getRange(targetProjectRow, jsonColIndex + 1);
    jsonCell.setValue(formatJSONCompact(targetTasks));
    SpreadsheetApp.flush();

    logActivity(
      'Tạo bản sao nhiệm vụ',
      `ID gốc: ${taskId}, ID mới: ${newTaskId}, Tên: ${newTaskName}`,
      originalTask[TASK_PROJECT_ID_COLUMN_NAME]
    );

    return { success: true, taskId: newTaskId, message: `Đã tạo bản sao nhiệm vụ thành công!` };
  } catch (e) {
    console.error(`Error copying task ${taskId}:`, e);
    return { success: false, error: `Lỗi khi tạo bản sao nhiệm vụ: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

function getChatMessages() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const chatSheet = ss.getSheetByName(CHAT_SHEET_NAME);

    if (!chatSheet || chatSheet.getLastRow() < 2) {
      return []; // ← Return sớm nếu không có data
    }

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 3);
    fourDaysAgo.setHours(0, 0, 0, 0);

    const headers = getHeaders(chatSheet);
    const dateColIndex = headers.indexOf(CHAT_DATE_COLUMN_NAME);
    const jsonColIndex = headers.indexOf(CHAT_JSON_COLUMN_NAME);

    const lastRow = chatSheet.getLastRow();

    // ← ĐỌC TẤT CẢ 1 LẦN thay vì loop
    const dataRange = chatSheet.getRange(2, 1, lastRow - 1, headers.length);
    const allData = dataRange.getValues();

    let allMessages = [];

    allData.forEach((row) => {
      const dateValue = row[dateColIndex];
      const chatDate = new Date(dateValue);

      if (chatDate >= fourDaysAgo) {
        const jsonStr = row[jsonColIndex];
        if (jsonStr && typeof jsonStr === 'string') {
          try {
            const messages = JSON.parse(jsonStr);
            if (Array.isArray(messages)) {
              const messagesWithDate = messages.map((msg) => ({
                ...msg,
                chatDate: chatDate.toDateString(),
              }));
              allMessages = allMessages.concat(messagesWithDate);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });

    // Sắp xếp và lấy 50 messages gần nhất (giảm từ 100)
    allMessages.sort(
      (a, b) => new Date(a.chatDate + ' ' + a.timestamp) - new Date(b.chatDate + ' ' + b.timestamp)
    );
    return allMessages.slice(-50);
  } catch (e) {
    console.error('Error getting chat messages:', e);
    return [];
  }
}

function sendChatMessage(message) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000); // ← Giảm timeout từ 10000 xuống 5000

    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Chưa đăng nhập' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const chatSheet = getOrCreateSheet(ss, CHAT_SHEET_NAME, [
      CHAT_ID_COLUMN_NAME,
      CHAT_DATE_COLUMN_NAME,
      CHAT_JSON_COLUMN_NAME,
    ]);

    const today = new Date().toDateString();
    const headers = getHeaders(chatSheet);
    const idColIndex = headers.indexOf(CHAT_ID_COLUMN_NAME);
    const dateColIndex = headers.indexOf(CHAT_DATE_COLUMN_NAME);
    const jsonColIndex = headers.indexOf(CHAT_JSON_COLUMN_NAME);

    const lastRow = chatSheet.getLastRow();
    let todayRow = null;
    let currentMessages = [];

    // ← CHỈ ĐỌC 1 LẦN thay vì loop
    if (lastRow >= 2) {
      const lastDateValue = chatSheet.getRange(lastRow, dateColIndex + 1).getValue();
      if (new Date(lastDateValue).toDateString() === today) {
        todayRow = lastRow;
        const jsonStr = chatSheet.getRange(lastRow, jsonColIndex + 1).getValue();
        if (jsonStr && typeof jsonStr === 'string') {
          currentMessages = JSON.parse(jsonStr);
        }
      }
    }

    // Tạo message
    const nextId = String(currentMessages.length + 1).padStart(3, '0');
    const now = new Date();
    const timeOnly =
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const newMessage = {
      id: nextId,
      user: currentUser.name,
      message: message,
      timestamp: timeOnly,
      avatar: currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    };

    currentMessages.push(newMessage);
    if (currentMessages.length > 100) {
      currentMessages = currentMessages.slice(-100);
    }

    if (todayRow) {
      chatSheet.getRange(todayRow, jsonColIndex + 1).setValue(formatChatJSON(currentMessages));
    } else {
      const lastId = getLastId(chatSheet, idColIndex, 'CH');
      const newChatId = generateNextId(lastId, 'CH', 4);
      const newRow = Array(headers.length).fill('');
      newRow[idColIndex] = newChatId;
      newRow[dateColIndex] = new Date();
      newRow[jsonColIndex] = formatChatJSON(currentMessages);
      chatSheet.appendRow(newRow);
    }

    SpreadsheetApp.flush();
    return { success: true, message: newMessage };
  } catch (e) {
    console.error('Error sending chat message:', e);
    return { success: false, error: 'Lỗi khi gửi tin nhắn: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

// Thêm hàm này ở cuối file code.gs:
function formatChatJSON(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return JSON.stringify(messages);
  }

  const formattedMessages = messages.map((msg) => JSON.stringify(msg));
  return '[\n' + formattedMessages.join(',\n') + '\n]';
}

// Thêm hàm này vào cuối file code.gs:
function changePassword(newPassword, confirmPassword) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Chưa đăng nhập' };
    }

    if (!newPassword || !confirmPassword) {
      return { success: false, error: 'Vui lòng nhập đầy đủ thông tin' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'Mật khẩu xác nhận không khớp' };
    }

    if (newPassword.length < 3) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 3 ký tự' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) {
      return { success: false, error: 'Không tìm thấy dữ liệu nhân viên' };
    }

    const headers = getHeaders(staffSheet);
    const emailColIndex = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);
    const passwordColIndex = headers.indexOf(STAFF_PASSWORD_COLUMN_NAME);

    const lastRow = staffSheet.getLastRow();
    for (let row = 2; row <= lastRow; row++) {
      const userEmail = staffSheet.getRange(row, emailColIndex + 1).getValue();
      if (userEmail === currentUser.email) {
        staffSheet.getRange(row, passwordColIndex + 1).setValue(newPassword);
        SpreadsheetApp.flush();
        return { success: true, message: 'Đổi mật khẩu thành công' };
      }
    }

    return { success: false, error: 'Không tìm thấy tài khoản' };
  } catch (e) {
    console.error('Error changing password:', e);
    return { success: false, error: 'Lỗi hệ thống: ' + e.message };
  }
}

// Hàm sắp xếp lại thứ tự nhiệm vụ trong dự án
function reorderTasks(projectId, orderedTaskIds) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);

    const headers = getHeaders(projectSheet);
    const idColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);

    // Tìm dòng dự án
    const rowInfo = findRowById(projectSheet, idColIndex + 1, projectId);
    if (!rowInfo) return { success: false, error: 'Không tìm thấy dự án' };

    const jsonCell = projectSheet.getRange(rowInfo.rowNumber, jsonColIndex + 1);
    const jsonStr = jsonCell.getValue();
    let currentTasks = [];
    try {
      if (jsonStr) currentTasks = JSON.parse(jsonStr);
    } catch (e) {
      return { success: false, error: 'Lỗi dữ liệu JSON' };
    }

    if (!Array.isArray(currentTasks) || currentTasks.length === 0) return { success: true };

    // Sắp xếp lại mảng tasks theo thứ tự của orderedTaskIds
    // Tạo map để tra cứu nhanh
    const taskMap = new Map(currentTasks.map((t) => [t[TASK_ID_COLUMN_NAME], t]));

    const newTasks = [];
    // Thêm các task theo thứ tự mới
    orderedTaskIds.forEach((id) => {
      if (taskMap.has(id)) {
        newTasks.push(taskMap.get(id));
        taskMap.delete(id); // Xóa để kiểm tra task còn sót
      }
    });

    // Thêm các task còn sót lại (nếu có lỗi logic frontend) để không mất dữ liệu
    for (const [id, task] of taskMap) {
      newTasks.push(task);
    }

    // Lưu lại
    jsonCell.setValue(formatJSONCompact(newTasks));
    SpreadsheetApp.flush();

    return { success: true };
  } catch (e) {
    console.error('Error reordering tasks:', e);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update profile info for current user
 */
function updateProfile(profileData) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!sheet) return { success: false, error: 'Không tìm thấy sheet nhân viên' };

    const headers = getHeaders(sheet);
    const emailIdx = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);
    if (emailIdx === -1) return { success: false, error: 'Cột Email không tồn tại' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Không có dữ liệu' };

    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    let targetRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][emailIdx] || '').trim().toLowerCase() === currentUser.email.toLowerCase()) {
        targetRowIndex = i + 2; // 1-based + header row
        break;
      }
    }

    if (targetRowIndex === -1) return { success: false, error: 'Không tìm thấy nhân viên' };

    // Map of profile fields to column names
    const fieldMap = {
      name: STAFF_NAME_COLUMN_NAME,
      position: STAFF_POSITION_COLUMN_NAME,
      phone: STAFF_PHONE_COLUMN_NAME,
      birthday: STAFF_BIRTHDAY_COLUMN_NAME,
      department: STAFF_DEPARTMENT_COLUMN_NAME,
      bio: STAFF_BIO_COLUMN_NAME
    };

    // Update each field
    Object.keys(fieldMap).forEach(function(field) {
      if (profileData[field] !== undefined) {
        const colIdx = headers.indexOf(fieldMap[field]);
        if (colIdx === -1) {
          // Auto-create column
          const newColIdx = headers.length;
          sheet.getRange(1, newColIdx + 1).setValue(fieldMap[field]);
          sheet.getRange(targetRowIndex, newColIdx + 1).setValue(profileData[field]);
        } else {
          sheet.getRange(targetRowIndex, colIdx + 1).setValue(profileData[field]);
        }
      }
    });

    SpreadsheetApp.flush();

    // Update session
    Object.keys(profileData).forEach(function(field) {
      if (profileData[field] !== undefined) currentUser[field] = profileData[field];
    });
    storeUserSession(currentUser);

    return { success: true, message: 'Cập nhật hồ sơ thành công' };
  } catch (e) {
    console.error('updateProfile error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Upload avatar: receive base64 data, save to Drive, return URL
 */
function uploadAvatar(base64Data, mimeType) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    // Decode base64 to blob
    const decoded = Utilities.base64Decode(base64Data.replace(/^data:[^;]+;base64,/, ''));
    const blob = Utilities.newBlob(decoded, mimeType || 'image/jpeg', 'avatar_' + currentUser.id + '.jpg');

    // Save to Drive folder "QLDA_Avatars"
    let folder;
    const folders = DriveApp.getFoldersByName('QLDA_Avatars');
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('QLDA_Avatars');
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // Delete old avatar if exists
    const existing = folder.getFilesByName('avatar_' + currentUser.id + '.jpg');
    while (existing.hasNext()) existing.next().setTrashed(true);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const avatarUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300';

    // Save to sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (sheet) {
      const headers = getHeaders(sheet);
      const emailIdx = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);
      let avatarColIdx = headers.indexOf(STAFF_AVATAR_COLUMN_NAME);

      if (avatarColIdx === -1) {
        // Create column
        avatarColIdx = headers.length;
        sheet.getRange(1, avatarColIdx + 1).setValue(STAFF_AVATAR_COLUMN_NAME);
      }

      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const data = sheet.getRange(2, emailIdx + 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < data.length; i++) {
          if (String(data[i][0] || '').trim().toLowerCase() === currentUser.email.toLowerCase()) {
            sheet.getRange(i + 2, avatarColIdx + 1).setValue(avatarUrl);
            break;
          }
        }
      }
      SpreadsheetApp.flush();
    }

    // Update session
    currentUser.avatar = avatarUrl;
    storeUserSession(currentUser);

    return { success: true, avatarUrl: avatarUrl };
  } catch (e) {
    console.error('uploadAvatar error:', e);
    return { success: false, error: e.message };
  }
}

// ============================================================
// == SUBTASKS & COMMENTS — Data Layer
// ============================================================

function _getOrCreateSubtaskSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SUBTASK_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SUBTASK_SHEET_NAME);
    sh.getRange(1, 1, 1, SUBTASK_HEADERS.length).setValues([SUBTASK_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _getOrCreateCommentSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(COMMENT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(COMMENT_SHEET_NAME);
    sh.getRange(1, 1, 1, COMMENT_HEADERS.length).setValues([COMMENT_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Returns comment counts per user: { 'Tên': { total: N, today: M } }
 * Used to award Comment XP on the client side.
 */
function getCommentStats() {
  try {
    var sh = _getOrCreateCommentSheet();
    if (sh.getLastRow() < 2) return {};
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, COMMENT_HEADERS.length).getValues();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var counts = {};
    rows.forEach(function(r) {
      var author = String(r[3] || '').trim(); // col 4: Người bình luận
      if (!author) return;
      var rawTime = r[5]; // col 6: Thời gian
      var dateStr = rawTime instanceof Date
        ? Utilities.formatDate(rawTime, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(rawTime || '').slice(0, 10);
      if (!counts[author]) counts[author] = { total: 0, today: 0 };
      counts[author].total++;
      if (dateStr === today) counts[author].today++;
    });
    return counts;
  } catch(e) {
    console.error('getCommentStats error:', e);
    return {};
  }
}

function _parseSheetRows(sh) {
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    rows.push(obj);
  }
  return rows;
}

// ---- Subtask CRUD ----

function getSubtasks(taskId) {
  var sh = _getOrCreateSubtaskSheet();
  var rows = _parseSheetRows(sh);
  return { success: true, subtasks: rows.filter(function(r) { return r['Mã nhiệm vụ cha'] === taskId; }) };
}

function addSubtask(subtaskData) {
  try {
    var user = getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    var sh = _getOrCreateSubtaskSheet();
    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    var lastRow = sh.getLastRow();
    var id = 'ST-' + (lastRow < 1 ? '001' : ('000' + lastRow).slice(-3));
    sh.appendRow([
      id,
      subtaskData.taskId || '',
      subtaskData.name || '',
      subtaskData.assignee || '',
      subtaskData.status || 'Chưa bắt đầu',
      now,
      '',
      user.name || ''
    ]);
    return { success: true, subtaskId: id };
  } catch(e) { return { success: false, error: e.message }; }
}

function updateSubtask(subtaskId, updateData) {
  try {
    var sh = _getOrCreateSubtaskSheet();
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === subtaskId) {
        var row = i + 1;
        if (updateData.name    !== undefined) sh.getRange(row, 3).setValue(updateData.name);
        if (updateData.assignee !== undefined) sh.getRange(row, 4).setValue(updateData.assignee);
        if (updateData.status  !== undefined) {
          sh.getRange(row, 5).setValue(updateData.status);
          if (updateData.status.toLowerCase().includes('hoàn thành')) {
            var tz = Session.getScriptTimeZone();
            sh.getRange(row, 7).setValue(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'));
          }
        }
        return { success: true };
      }
    }
    return { success: false, error: 'Không tìm thấy subtask' };
  } catch(e) { return { success: false, error: e.message }; }
}

function deleteSubtask(subtaskId) {
  try {
    var sh = _getOrCreateSubtaskSheet();
    var data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === subtaskId) { sh.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, error: 'Không tìm thấy subtask' };
  } catch(e) { return { success: false, error: e.message }; }
}

// ---- Comment CRUD ----

function getComments(type, objectId) {
  var sh = _getOrCreateCommentSheet();
  var rows = _parseSheetRows(sh);
  return { success: true, comments: rows.filter(function(r) {
    return r['Loại'] === type && r['Mã đối tượng'] === objectId;
  })};
}

function addComment(commentData) {
  try {
    var user = getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    var sh = _getOrCreateCommentSheet();
    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    var lastRow = sh.getLastRow();
    var id = 'CM-' + Utilities.formatDate(new Date(), tz, 'yyyyMMddHHmmss') + '-' + (lastRow || 0);
    sh.appendRow([
      id,
      commentData.type || 'task',
      commentData.objectId || '',
      user.name || '',
      commentData.content || '',
      now,
      commentData.parentId || ''
    ]);
    return { success: true, commentId: id };
  } catch(e) { return { success: false, error: e.message }; }
}

function deleteComment(commentId) {
  try {
    var user = getCurrentUser();
    if (!user) return { success: false, error: 'Chưa đăng nhập' };
    var sh = _getOrCreateCommentSheet();
    var data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === commentId) {
        // Only comment author or admin can delete
        if (data[i][3] !== user.name && !isAdmin(user)) {
          return { success: false, error: 'Không có quyền xóa bình luận này' };
        }
        sh.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Không tìm thấy comment' };
  } catch(e) { return { success: false, error: e.message }; }
}

