// code.gs
// === CẤU HÌNH CHUNG ===
// Tên các sheet trong Google Spreadsheet
const TASK_SHEET_NAME = 'Nhiệm vụ';
const PROJECT_SHEET_NAME = 'Dự án/Nhiệm vụ';
const STAFF_SHEET_NAME = 'Người dùng';
const NOTIFICATION_SHEET_NAME = 'Thông báo';

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

// === Cột sheet "Người dùng" ===
const STAFF_ID_COLUMN_NAME = 'Mã NV';
const STAFF_NAME_COLUMN_NAME = 'Họ tên';
const STAFF_EMAIL_COLUMN_NAME = 'Email';
const STAFF_POSITION_COLUMN_NAME = 'Chức vụ';
const STAFF_ROLE_COLUMN_NAME = 'Phân quyền';
const STAFF_PASSWORD_COLUMN_NAME = 'Mật khẩu';
const STAFF_AVATAR_COLUMN_NAME = 'Ảnh đại diện';
const STAFF_BIO_COLUMN_NAME = 'Giới thiệu';
const STAFF_PHONE_COLUMN_NAME = 'Điện thoại';

// === Cột sheet thông báo lên cấp ===
const LEVEL_UP_NOTIF_SHEET_NAME = 'Cấp Độ Mới';
const LU_STAFF_COL  = 'Mã NV';
const LU_NAME_COL   = 'Tên';
const LU_TG_COL     = 'Telegram ID';
const LU_LEVEL_COL  = 'Cấp độ mới';
const LU_EMOJI_COL  = 'Emoji';
const LU_POINTS_COL = 'Điểm';
const LU_TIME_COL   = 'Thời gian';
const LU_SENT_COL   = 'Đã gửi';

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
      `'${STAFF_SHEET_NAME}'!A:F`, // Staff
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
      if (isManager(currentUser)) {
        // === FILTER TASKS: Managers see tasks assigned to them and tasks in projects they manage ===
        const managerProjectIds = projects
          .filter((project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name)
          .map((project) => project[PROJECT_ID_COLUMN_NAME]);

        tasks = tasks.filter((task) => {
          // Tasks assigned to this manager
          if (task[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name) {
            return true;
          }

          // Tasks in projects managed by this manager
          if (managerProjectIds.includes(task[TASK_PROJECT_ID_COLUMN_NAME])) {
            return true;
          }

          return false;
        });

        // === FILTER PROJECTS: Managers see projects they manage or have tasks in ===
        const managerTaskProjectIds = tasks
          .map((task) => task[TASK_PROJECT_ID_COLUMN_NAME])
          .filter((id) => id);

        projects = projects.filter((project) => {
          // Projects managed by this manager
          if (project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name) {
            return true;
          }

          // Projects where this manager has tasks
          if (managerTaskProjectIds.includes(project[PROJECT_ID_COLUMN_NAME])) {
            return true;
          }

          return false;
        });
      } else {
        // === FILTER TASKS: Regular users see tasks assigned to them OR in projects they manage ===
        tasks = tasks.filter((task) => {
          const assignee = String(task[TASK_ASSIGNEE_COLUMN_NAME] || '').trim();
          if (assignee === currentUser.name) {
            return true;
          }

          // Check if user is project manager for this task
          const projectId = task[TASK_PROJECT_ID_COLUMN_NAME];
          const project = projects.find((p) => p[PROJECT_ID_COLUMN_NAME] === projectId);
          return project && project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name;
        });

        // === FILTER PROJECTS: Show projects that have tasks assigned to this user OR user is manager ===
        const userTaskProjectIds = new Set(
          tasks.map((task) => task[TASK_PROJECT_ID_COLUMN_NAME]).filter((id) => id)
        );

        // Include projects where user is manager
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
        // THAY ĐỔI: Kiểm tra nếu nhân viên là người phụ trách dự án
        const userManagedProjects = projects.filter(
          (project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name
        );

        if (userManagedProjects.length > 0) {
          // Nếu là người phụ trách dự án, có thể thấy tất cả nhân viên trừ admin
          filteredStaff = staff.filter((s) => {
            const role = String(s[STAFF_ROLE_COLUMN_NAME] || '').toLowerCase();
            return !role.includes('admin');
          });
        } else {
          // Người dùng thường chỉ thấy mình
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

  return addTask(taskData);
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
        // Kiểm tra nếu người dùng là người phụ trách của bất kỳ dự án nào
        const projects = getProjects();
        const userManagedProjects = projects.filter(
          (project) => project[PROJECT_MANAGER_COLUMN_NAME] === currentUser.name
        );
        if (userManagedProjects.length > 0) {
          return { success: true }; // Người phụ trách dự án có thể tạo nhiệm vụ
        }

        // User can create tasks if they have at least one task in a project
        const userTasks = getTasks().filter(
          (task) => task[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name
        );
        if (userTasks.length > 0) {
          return { success: true };
        }
        return {
          success: false,
          error: 'Bạn chỉ có thể tạo nhiệm vụ trong các dự án mà bạn đã được giao việc',
        };
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

        // Users can only update their own tasks
        if (resourceData && resourceData[TASK_ASSIGNEE_COLUMN_NAME] === currentUser.name) {
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
      PROJECT_START_DATE_COLUMN_NAME,
      PROJECT_END_DATE_COLUMN_NAME,
      PROJECT_STATUS_COLUMN_NAME,
      PROJECT_TASKS_JSON_COLUMN_NAME,
      PROJECT_ACTIVITY_LOG_JSON_COLUMN_NAME,
    ]);

    const headers = getHeaders(projectSheet);

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

    const rowInfo = findRowById(projectSheet, idColIndex + 1, projectId);
    if (!rowInfo) return { success: false, error: `Không tìm thấy dự án ID: ${projectId}` };

    const rowNumber = rowInfo.rowNumber;
    const range = projectSheet.getRange(rowNumber, 1, 1, headers.length);
    const values = range.getValues()[0];

    let changesDetected = false;

    // Cập nhật các trường
    const updates = [
      [headers.indexOf(PROJECT_NAME_COLUMN_NAME), projectData.name],
      [headers.indexOf(PROJECT_DESC_COLUMN_NAME), projectData.description],
      [headers.indexOf(PROJECT_MANAGER_COLUMN_NAME), projectData.manager],
      [headers.indexOf(PROJECT_START_DATE_COLUMN_NAME), parseDate(projectData.startDate)],
      [headers.indexOf(PROJECT_END_DATE_COLUMN_NAME), parseDate(projectData.endDate)],
      [headers.indexOf(PROJECT_STATUS_COLUMN_NAME), projectData.status],
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

    projectSheet.getRange(oldProjectRow, jsonColIndex + 1).setValue(formatJSONCompact(oldTasks));
    SpreadsheetApp.flush();

    logActivity('Cập nhật nhiệm vụ', `ID: ${taskId}, Tên: ${taskData.name}`, taskData.projectId);

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
      [headers.indexOf(STAFF_ROLE_COLUMN_NAME), staffData.role], // Thêm dòng này
      [headers.indexOf(STAFF_PASSWORD_COLUMN_NAME), staffData.password], // Thêm dòng này
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

// ==================================
// == KANBAN BOARD ==
// ==================================

/**
 * Lấy dữ liệu Kanban (tasks grouped by status, kèm tên dự án + assignee)
 */
function getKanbanData(projectFilter, assigneeFilter) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    let tasks = [];
    let projects = [];

    // Dùng getDataForUser để áp dụng phân quyền
    const data = getDataForUser();
    if (data.success) {
      tasks = data.tasks || [];
      projects = data.projects || [];
    }

    // Filter theo dự án
    if (projectFilter && projectFilter !== '') {
      tasks = tasks.filter(t => t[TASK_PROJECT_ID_COLUMN_NAME] === projectFilter);
    }

    // Filter theo người thực hiện
    if (assigneeFilter && assigneeFilter !== '') {
      tasks = tasks.filter(t => t[TASK_ASSIGNEE_COLUMN_NAME] === assigneeFilter);
    }

    // Tạo map project ID -> project name
    const projectMap = {};
    projects.forEach(p => {
      projectMap[p[PROJECT_ID_COLUMN_NAME]] = p[PROJECT_NAME_COLUMN_NAME] || p[PROJECT_ID_COLUMN_NAME];
    });

    // Gắn tên dự án vào mỗi task
    const enrichedTasks = tasks.map(t => ({
      ...t,
      _projectName: projectMap[t[TASK_PROJECT_ID_COLUMN_NAME]] || t[TASK_PROJECT_ID_COLUMN_NAME] || '',
    }));

    // Group by status
    const columns = ['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành', 'Tạm dừng'];
    const grouped = {};
    columns.forEach(col => { grouped[col] = []; });

    enrichedTasks.forEach(t => {
      const status = t[TASK_STATUS_COLUMN_NAME] || 'Chưa bắt đầu';
      if (grouped[status] !== undefined) {
        grouped[status].push(t);
      } else {
        grouped['Chưa bắt đầu'].push(t);
      }
    });

    return {
      success: true,
      columns: columns,
      grouped: grouped,
      projects: projects.map(p => ({ id: p[PROJECT_ID_COLUMN_NAME], name: p[PROJECT_NAME_COLUMN_NAME] })),
    };
  } catch (e) {
    console.error('Error in getKanbanData:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Cập nhật nhanh trạng thái task (dùng cho kéo thả Kanban)
 */
function updateTaskStatus(taskId, newStatus) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    const allowedStatuses = ['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành', 'Tạm dừng'];
    if (!allowedStatuses.includes(newStatus)) {
      return { success: false, error: 'Trạng thái không hợp lệ' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const projectSheet = ss.getSheetByName(PROJECT_SHEET_NAME);
    if (!projectSheet) return { success: false, error: 'Không tìm thấy dữ liệu' };

    const headers = getHeaders(projectSheet);
    const jsonColIndex = headers.indexOf(PROJECT_TASKS_JSON_COLUMN_NAME);
    if (jsonColIndex === -1) return { success: false, error: 'Cấu trúc dữ liệu lỗi' };

    const lastRow = projectSheet.getLastRow();
    for (let row = 2; row <= lastRow; row++) {
      const jsonCell = projectSheet.getRange(row, jsonColIndex + 1);
      const jsonStr = jsonCell.getValue();
      if (!jsonStr) continue;
      try {
        const tasks = JSON.parse(jsonStr);
        const taskIndex = tasks.findIndex(t => t[TASK_ID_COLUMN_NAME] === taskId);
        if (taskIndex === -1) continue;

        const task = tasks[taskIndex];
        const oldStatus = task[TASK_STATUS_COLUMN_NAME];

        // Permission check: chỉ admin/manager/người được giao mới kéo thả được
        if (!isAdmin(currentUser) && !isManager(currentUser)) {
          if (task[TASK_ASSIGNEE_COLUMN_NAME] !== currentUser.name) {
            const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
            const projId = projectSheet.getRange(row, projectIdColIndex + 1).getValue();
            const projects = getProjects();
            const proj = projects.find(p => p[PROJECT_ID_COLUMN_NAME] === projId);
            if (!proj || proj[PROJECT_MANAGER_COLUMN_NAME] !== currentUser.name) {
              return { success: false, error: 'Bạn không có quyền thay đổi nhiệm vụ này' };
            }
          }
        }

        task[TASK_STATUS_COLUMN_NAME] = newStatus;

        // Nếu chuyển sang Hoàn thành: set ngày hoàn thành, tiến độ 100%
        if (newStatus === 'Hoàn thành' && oldStatus !== 'Hoàn thành') {
          task[TASK_REPORT_DATE_COLUMN_NAME] = formatSheetDate(new Date());
          task[TASK_COMPLETION_COLUMN_NAME] = 100;
        }
        // Nếu chuyển từ Hoàn thành sang trạng thái khác: xóa ngày hoàn thành
        if (oldStatus === 'Hoàn thành' && newStatus !== 'Hoàn thành') {
          task[TASK_REPORT_DATE_COLUMN_NAME] = '';
          if (task[TASK_COMPLETION_COLUMN_NAME] === 100) {
            task[TASK_COMPLETION_COLUMN_NAME] = 80;
          }
        }

        tasks[taskIndex] = task;
        jsonCell.setValue(formatJSONCompact(tasks));
        SpreadsheetApp.flush();

        // Ghi log
        const projectIdColIndex = headers.indexOf(PROJECT_ID_COLUMN_NAME);
        const projId = projectSheet.getRange(row, projectIdColIndex + 1).getValue();
        logActivity('Cập nhật trạng thái', `ID: ${taskId}, ${oldStatus} → ${newStatus}`, projId);

        // Kiểm tra thành tích khi hoàn thành
        let achievements = [];
        let levelUp = null;
        if (newStatus === 'Hoàn thành' && oldStatus !== 'Hoàn thành') {
          const assigneeName = task[TASK_ASSIGNEE_COLUMN_NAME];
          const pointsBefore = getTotalPointsForStaff_(assigneeName);
          const levelBefore  = getLevelInfo(pointsBefore);

          achievements = checkAndAwardAchievements(assigneeName, taskId, task);

          const pointsAfter = getTotalPointsForStaff_(assigneeName);
          const levelAfter  = getLevelInfo(pointsAfter);

          if (levelAfter.label !== levelBefore.label) {
            levelUp = levelAfter;
            writeLevelUpNotification_(assigneeName, levelAfter, pointsAfter);
          }
        }

        return { success: true, achievements: achievements, levelUp: levelUp };
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: `Không tìm thấy nhiệm vụ ID: ${taskId}` };
  } catch (e) {
    console.error('Error in updateTaskStatus:', e);
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================================
// == HỆ THỐNG THÀNH TÍCH ==
// ==================================

const ACHIEVEMENT_SHEET_NAME = 'Thành tích';
const TELEGRAM_USERS_SHEET_NAME = 'Telegram Users';

const ACH_ID_COL = 'Mã';
const ACH_STAFF_COL = 'Mã NV';
const ACH_TYPE_COL = 'Loại';
const ACH_TITLE_COL = 'Tên thành tích';
const ACH_POINTS_COL = 'Điểm';
const ACH_DATE_COL = 'Ngày đạt';
const ACH_DESC_COL = 'Mô tả';

const TG_ID_COL = 'Telegram ID';
const TG_STAFF_COL = 'Mã NV';
const TG_NAME_COL = 'Tên hiển thị';
const TG_DATE_COL = 'Ngày đăng ký';

// ==================================
// == HỒ SƠ NGƯỜI DÙNG ==
// ==================================

/**
 * Lấy dữ liệu hồ sơ đầy đủ của người dùng hiện tại (avatar, bio, phone, level)
 */
function getUserProfileData(callerEmail) {
  try {
    // callerEmail is passed from client (more reliable than server-side session)
    let email = callerEmail;
    if (!email) {
      const currentUser = getCurrentUser();
      if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };
      email = currentUser.email;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) return { success: false, error: 'Không tìm thấy sheet nhân viên' };

    const headers = staffSheet.getRange(1, 1, 1, staffSheet.getLastColumn()).getValues()[0];
    const emailColIndex   = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);
    const idColIndex      = headers.indexOf(STAFF_ID_COLUMN_NAME);
    const avatarColIndex  = headers.indexOf(STAFF_AVATAR_COLUMN_NAME);
    const bioColIndex     = headers.indexOf(STAFF_BIO_COLUMN_NAME);
    const phoneColIndex   = headers.indexOf(STAFF_PHONE_COLUMN_NAME);

    const values = staffSheet.getRange(2, 1, Math.max(1, staffSheet.getLastRow() - 1), staffSheet.getLastColumn()).getValues();

    for (const row of values) {
      if (String(row[emailColIndex] || '').toLowerCase() !== email.toLowerCase()) continue;

      const staffId = String(row[idColIndex] || '');
      let totalPoints = 0;
      let level = getLevelInfo(0);

      const achSheet = ss.getSheetByName(ACHIEVEMENT_SHEET_NAME);
      if (achSheet && achSheet.getLastRow() >= 2) {
        const allAch = sheetDataToObjectArray(achSheet);
        totalPoints = allAch
          .filter(a => a[ACH_STAFF_COL] === staffId)
          .reduce((s, a) => s + (parseInt(a[ACH_POINTS_COL], 10) || 0), 0);
        level = getLevelInfo(totalPoints);
      }

      return {
        success: true,
        avatar:  avatarColIndex  >= 0 ? (row[avatarColIndex]  || '') : '',
        bio:     bioColIndex     >= 0 ? (row[bioColIndex]     || '') : '',
        phone:   phoneColIndex   >= 0 ? (row[phoneColIndex]   || '') : '',
        totalPoints,
        level,
      };
    }
    return { success: false, error: 'Không tìm thấy hồ sơ' };
  } catch (e) {
    console.error('Error in getUserProfileData:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Cập nhật hồ sơ người dùng hiện tại (avatar base64, bio, phone)
 */
function updateUserProfile(profileData) {
  try {
    // profileData.email is passed from client
    let email = profileData.email;
    if (!email) {
      const currentUser = getCurrentUser();
      if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };
      email = currentUser.email;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffSheet = ss.getSheetByName(STAFF_SHEET_NAME);
    if (!staffSheet) return { success: false, error: 'Không tìm thấy sheet nhân viên' };

    const headers = staffSheet.getRange(1, 1, 1, staffSheet.getLastColumn()).getValues()[0];
    const emailColIndex = headers.indexOf(STAFF_EMAIL_COLUMN_NAME);

    // Tự tạo cột nếu chưa có
    [STAFF_AVATAR_COLUMN_NAME, STAFF_BIO_COLUMN_NAME, STAFF_PHONE_COLUMN_NAME].forEach(col => {
      if (!headers.includes(col)) {
        const newColIdx = staffSheet.getLastColumn() + 1;
        staffSheet.getRange(1, newColIdx).setValue(col);
        headers.push(col);
      }
    });

    const avatarColIndex = headers.indexOf(STAFF_AVATAR_COLUMN_NAME);
    const bioColIndex    = headers.indexOf(STAFF_BIO_COLUMN_NAME);
    const phoneColIndex  = headers.indexOf(STAFF_PHONE_COLUMN_NAME);

    const values = staffSheet.getRange(2, 1, Math.max(1, staffSheet.getLastRow() - 1), headers.length).getValues();

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][emailColIndex] || '').toLowerCase() !== email.toLowerCase()) continue;

      const rowNum = i + 2;
      if (profileData.avatar !== undefined && avatarColIndex >= 0)
        staffSheet.getRange(rowNum, avatarColIndex + 1).setValue(profileData.avatar);
      if (profileData.bio !== undefined && bioColIndex >= 0)
        staffSheet.getRange(rowNum, bioColIndex + 1).setValue(profileData.bio);
      if (profileData.phone !== undefined && phoneColIndex >= 0)
        staffSheet.getRange(rowNum, phoneColIndex + 1).setValue(profileData.phone);

      SpreadsheetApp.flush();
      return { success: true };
    }
    return { success: false, error: 'Không tìm thấy người dùng' };
  } catch (e) {
    console.error('Error in updateUserProfile:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Tổng điểm của nhân viên theo tên (helper nội bộ)
 * @private
 */
function getTotalPointsForStaff_(staffName) {
  try {
    const achSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ACHIEVEMENT_SHEET_NAME);
    if (!achSheet || achSheet.getLastRow() < 2) return 0;
    const staff = getStaffList();
    const member = staff.find(s => s[STAFF_NAME_COLUMN_NAME] === staffName);
    if (!member) return 0;
    const staffId = member[STAFF_ID_COLUMN_NAME];
    return sheetDataToObjectArray(achSheet)
      .filter(a => a[ACH_STAFF_COL] === staffId)
      .reduce((s, a) => s + (parseInt(a[ACH_POINTS_COL], 10) || 0), 0);
  } catch (e) { return 0; }
}

/**
 * Ghi thông báo lên cấp để bot Telegram gửi (helper nội bộ)
 * @private
 */
function writeLevelUpNotification_(staffName, levelInfo, totalPoints) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, LEVEL_UP_NOTIF_SHEET_NAME, [
      LU_STAFF_COL, LU_NAME_COL, LU_TG_COL,
      LU_LEVEL_COL, LU_EMOJI_COL, LU_POINTS_COL, LU_TIME_COL, LU_SENT_COL,
    ]);

    // Tìm Telegram ID từ sheet Telegram Users
    let tgId = '';
    const tgSheet = ss.getSheetByName(TELEGRAM_USERS_SHEET_NAME);
    if (tgSheet && tgSheet.getLastRow() >= 2) {
      const staff = getStaffList();
      const member = staff.find(s => s[STAFF_NAME_COLUMN_NAME] === staffName);
      if (member) {
        const staffId = member[STAFF_ID_COLUMN_NAME];
        const tgData  = sheetDataToObjectArray(tgSheet);
        const tgRow   = tgData.find(r => r[TG_STAFF_COL] === staffId);
        if (tgRow) tgId = tgRow[TG_ID_COL];
      }
    }

    const staffList = getStaffList();
    const m = staffList.find(s => s[STAFF_NAME_COLUMN_NAME] === staffName);
    const staffId = m ? m[STAFF_ID_COLUMN_NAME] : '';

    sheet.appendRow([
      staffId, staffName, tgId,
      levelInfo.label, levelInfo.emoji, totalPoints,
      new Date(), 'FALSE',
    ]);
    SpreadsheetApp.flush();
  } catch (e) {
    console.error('writeLevelUpNotification_ error:', e);
  }
}

/**
 * ══════════════════════════════════════════════════════════════
 *  HỆ THỐNG THÀNH TÍCH & ĐIỂM KINH NGHIỆM (DUOLINGO-INSPIRED)
 * ══════════════════════════════════════════════════════════════
 *
 * CẤP ĐỘ (Level / League):
 *   🥉 Đồng     (Bronze)   :      0 – 199  pts
 *   🥈 Bạc      (Silver)   :    200 – 499  pts
 *   🥇 Vàng     (Gold)     :    500 – 1499 pts
 *   💎 Bạch Kim (Platinum)  :  1500 – 2999 pts
 *   🔮 Kim Cương (Diamond) :  3000 – 5999 pts
 *   👑 Huyền Thoại (Legend):   6000+       pts
 *
 * ĐIỂM NHIỆM VỤ:
 *   +10  hoàn thành 1 nhiệm vụ (được giao cho mình)
 *   +20  nhiệm vụ mình giao cho người khác → họ hoàn thành
 *   +50  hoàn thành nhiệm vụ trước hạn (Early Bird)
 *   +30  hoàn thành nhiệm vụ ưu tiên Cao
 *
 * STREAK (liên tiếp mỗi ngày ≥ 1 task):
 *   +100  streak  3 ngày
 *   +300  streak  7 ngày   (tuần lễ hoàn hảo)
 *   +700  streak  7 ngày   BONUS (tổng 1000 cho tuần)
 *   +2100 streak 21 ngày   BONUS
 *   +500  streak 30 ngày
 *   +1000 streak 60 ngày
 *
 * MILESTONE NHIỆM VỤ:
 *   +50    1 task (first blood)
 *   +100   10 tasks
 *   +300   30 tasks
 *   +500   50 tasks
 *   +1000  100 tasks
 *
 * DỰ ÁN:
 *   +500   là thành viên dự án → dự án hoàn thành
 *   +1000  là PM dự án → dự án hoàn thành
 *
 * THÀNH TÍCH ĐẶC BIỆT (badges):
 *   🏃 Siêu năng suất  : 5 tasks/ngày          +200
 *   📋 Nhà quản lý     : 10 tasks giao→hoàn thành +300
 *   🔄 Không bỏ cuộc  : hoàn thành task quá hạn  +50  (mỗi lần)
 *   ⚡ Tốc độ sét      : hoàn thành trước hạn ≥5 tasks +150
 */

// ── Level definition ──────────────────────────────────────────────────────────
function getLevelInfo(totalPoints) {
  const levels = [
    { min: 0,    max: 199,  label: 'Đồng',       emoji: '🥉', color: '#cd7f32' },
    { min: 200,  max: 499,  label: 'Bạc',        emoji: '🥈', color: '#9ca3af' },
    { min: 500,  max: 1499, label: 'Vàng',       emoji: '🥇', color: '#f59e0b' },
    { min: 1500, max: 2999, label: 'Bạch Kim',   emoji: '💎', color: '#7c3aed' },
    { min: 3000, max: 5999, label: 'Kim Cương',  emoji: '🔮', color: '#06b6d4' },
    { min: 6000, max: Infinity, label: 'Huyền Thoại', emoji: '👑', color: '#f97316' },
  ];
  const lv = levels.find(l => totalPoints >= l.min && totalPoints <= l.max) || levels[0];
  const next = levels[levels.indexOf(lv) + 1];
  const progress = next ? Math.round(((totalPoints - lv.min) / (next.min - lv.min)) * 100) : 100;
  return { ...lv, totalPoints, nextMin: next ? next.min : null, progress };
}

/**
 * Kiểm tra và trao thành tích sau khi hoàn thành task
 * @param {string} assigneeName  - Tên người thực hiện task
 * @param {string} taskId
 * @param {object} taskData      - Row object của task
 * @param {string} [assignerName] - Tên người giao task (nếu khác assigneeName)
 */
function checkAndAwardAchievements(assigneeName, taskId, taskData, assignerName) {
  try {
    if (!assigneeName) return [];

    const staff = getStaffList();
    const staffMember = staff.find(s => s[STAFF_NAME_COLUMN_NAME] === assigneeName);
    if (!staffMember) return [];
    const staffId = staffMember[STAFF_ID_COLUMN_NAME];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const achSheet = getOrCreateSheet(ss, ACHIEVEMENT_SHEET_NAME, [
      ACH_ID_COL, ACH_STAFF_COL, ACH_TYPE_COL, ACH_TITLE_COL,
      ACH_POINTS_COL, ACH_DATE_COL, ACH_DESC_COL
    ]);

    const allAch = sheetDataToObjectArray(achSheet);
    const myAch  = allAch.filter(a => a[ACH_STAFF_COL] === staffId);
    const myTypes = new Set(myAch.map(a => a[ACH_TYPE_COL]));

    const allTasksList = getTasks();
    const myCompleted = allTasksList.filter(t =>
      t[TASK_ASSIGNEE_COLUMN_NAME] === assigneeName &&
      t[TASK_STATUS_COLUMN_NAME] === 'Hoàn thành'
    );
    const completedCount = myCompleted.length;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newAchievements = [];

    // ── Helper: push achievement if not already earned ───────────────────
    function award(type, title, points, desc) {
      if (!myTypes.has(type)) newAchievements.push({ type, title, points, desc });
    }
    // Repeatable (awarded every time condition met)
    function awardRepeat(type, title, points, desc) {
      newAchievements.push({ type, title, points, desc });
    }

    // ── 1. Base points per task (+10) ────────────────────────────────────
    awardRepeat('TASK_DONE', '✅ Hoàn thành nhiệm vụ', 10, `Hoàn thành: ${taskData[TASK_NAME_COLUMN_NAME] || taskId}`);

    // ── 2. High-priority task (+30) ──────────────────────────────────────
    if ((taskData[TASK_PRIORITY_COLUMN_NAME] || '').toLowerCase().includes('cao')) {
      awardRepeat('TASK_HIGH', '🔴 Nhiệm vụ ưu tiên cao', 30, 'Hoàn thành task ưu tiên Cao!');
    }

    // ── 3. Early Bird: hoàn thành trước hạn (+50) ────────────────────────
    const dueDate = taskData[TASK_DUE_DATE_COLUMN_NAME] ? parseDate(taskData[TASK_DUE_DATE_COLUMN_NAME]) : null;
    if (dueDate && today < dueDate) {
      awardRepeat('EARLY_BIRD', '⚡ Hoàn thành trước hạn', 50, 'Hoàn thành nhiệm vụ trước deadline!');
    }

    // ── 4. Rescuer: hoàn thành task đã quá hạn (+30) ─────────────────────
    if (dueDate && today > dueDate) {
      awardRepeat('RESCUER', '🔄 Không bỏ cuộc', 30, 'Hoàn thành nhiệm vụ dù đã quá hạn!');
    }

    // ── 5. Assigner bonus (+20) – caller passes assignerName ─────────────
    if (assignerName && assignerName !== assigneeName) {
      const assignerMember = staff.find(s => s[STAFF_NAME_COLUMN_NAME] === assignerName);
      if (assignerMember) {
        const assignerId = assignerMember[STAFF_ID_COLUMN_NAME];
        // Award points directly to assigner's sheet
        const assignerAchCount = allAch.filter(a => a[ACH_STAFF_COL] === assignerId).length;
        const newId = `ACH${String(allAch.length + assignerAchCount + 1).padStart(4, '0')}`;
        achSheet.appendRow([
          newId, assignerId, 'ASSIGN_DONE',
          '📋 Nhiệm vụ được giao hoàn thành', 20,
          formatSheetDate(new Date()),
          `Task ${taskId} do ${assigneeName} hoàn thành`,
        ]);
      }
    }

    // ── 6. Milestones ────────────────────────────────────────────────────
    if (completedCount >= 1   && !myTypes.has('M_1'))    award('M_1',   '🎯 Bước đầu tiên',        50,  'Hoàn thành nhiệm vụ đầu tiên!');
    if (completedCount >= 10  && !myTypes.has('M_10'))   award('M_10',  '🏅 Chiến binh 10',        100, 'Hoàn thành 10 nhiệm vụ!');
    if (completedCount >= 30  && !myTypes.has('M_30'))   award('M_30',  '🎖️ Dũng sĩ 30',           300, 'Hoàn thành 30 nhiệm vụ!');
    if (completedCount >= 50  && !myTypes.has('M_50'))   award('M_50',  '🏆 Chiến thần 50',        500, 'Hoàn thành 50 nhiệm vụ!');
    if (completedCount >= 100 && !myTypes.has('M_100'))  award('M_100', '👑 Huyền thoại 100',      1000,'Hoàn thành 100 nhiệm vụ!');

    // ── 7. Streak ────────────────────────────────────────────────────────
    const completedDates = myCompleted
      .map(t => { const p = parseDate(t[TASK_REPORT_DATE_COLUMN_NAME]); return p ? formatSheetDate(p) : null; })
      .filter(d => d);
    const uniqueDates = [...new Set(completedDates)].sort();
    const streak = calcStreak(uniqueDates);

    if (streak >= 3  && !myTypes.has('STREAK_3'))   award('STREAK_3',  '🔥 Lửa 3 ngày',           100, '3 ngày liên tiếp có task hoàn thành!');
    if (streak >= 7  && !myTypes.has('STREAK_7'))   award('STREAK_7',  '🔥🔥 Tuần hoàn hảo',       700, '7 ngày liên tiếp – tuần lễ hoàn hảo!');
    if (streak >= 14 && !myTypes.has('STREAK_14'))  award('STREAK_14', '❄️ Chuỗi 2 tuần',          1000,'14 ngày liên tiếp!');
    if (streak >= 21 && !myTypes.has('STREAK_21'))  award('STREAK_21', '💎 Chuỗi 3 tuần',          2100,'21 ngày liên tiếp – bất khả chiến bại!');
    if (streak >= 30 && !myTypes.has('STREAK_30'))  award('STREAK_30', '🌙 Chuỗi 30 ngày',         3000,'30 ngày không gián đoạn!');
    if (streak >= 60 && !myTypes.has('STREAK_60'))  award('STREAK_60', '☀️ Chuỗi 60 ngày',         6000,'60 ngày – siêu nhân!');

    // ── 8. Daily super-productivity: 5 tasks today (+200) ────────────────
    const todayStr = formatSheetDate(today);
    const todayDone = myCompleted.filter(t => {
      const p = parseDate(t[TASK_REPORT_DATE_COLUMN_NAME]);
      return p && formatSheetDate(p) === todayStr;
    }).length;
    if (todayDone >= 5 && !myTypes.has('SUPER_DAY')) {
      award('SUPER_DAY', '🏃 Siêu năng suất', 200, '5 nhiệm vụ trong 1 ngày!');
    }

    // ── 9. Early-bird specialist: ≥5 tasks done before deadline ──────────
    const earlyCount = myAch.filter(a => a[ACH_TYPE_COL] === 'EARLY_BIRD').length
      + newAchievements.filter(a => a.type === 'EARLY_BIRD').length;
    if (earlyCount >= 5 && !myTypes.has('SPEED_DEMON')) {
      award('SPEED_DEMON', '⚡ Tốc độ sét', 150, 'Hoàn thành ≥5 nhiệm vụ trước deadline!');
    }

    // ── Save new achievements ─────────────────────────────────────────────
    const existingCount = allAch.length;
    newAchievements.forEach((ach, i) => {
      const newId = `ACH${String(existingCount + i + 1).padStart(4, '0')}`;
      achSheet.appendRow([
        newId, staffId, ach.type, ach.title,
        ach.points, formatSheetDate(new Date()), ach.desc,
      ]);
    });

    if (newAchievements.length > 0) SpreadsheetApp.flush();

    return newAchievements;
  } catch (e) {
    console.error('Error in checkAndAwardAchievements:', e);
    return [];
  }
}

/**
 * Tính streak (chuỗi ngày liên tiếp tính từ hôm nay trở về trước)
 */
function calcStreak(sortedDateStrings) {
  if (!sortedDateStrings || sortedDateStrings.length === 0) return 0;
  const today = formatSheetDate(new Date());
  let streak = 0;
  let checkDate = new Date();

  for (let i = sortedDateStrings.length - 1; i >= 0; i--) {
    const d = formatSheetDate(parseDate(sortedDateStrings[i]));
    if (d === formatSheetDate(checkDate)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (new Date(d) < checkDate) {
      break;
    }
  }
  return streak;
}

/**
 * Lấy bảng xếp hạng (top N nhân viên theo điểm)
 */
function getLeaderboard(topN) {
  try {
    topN = topN || 5;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const achSheet = ss.getSheetByName(ACHIEVEMENT_SHEET_NAME);
    if (!achSheet || achSheet.getLastRow() < 2) return { success: true, leaderboard: [] };

    const allAch = sheetDataToObjectArray(achSheet);
    const staff = getStaffList();
    const staffMap = {};
    staff.forEach(s => { staffMap[s[STAFF_ID_COLUMN_NAME]] = s[STAFF_NAME_COLUMN_NAME]; });

    // Sum điểm theo Mã NV
    const pointsMap = {};
    const countMap = {};
    allAch.forEach(a => {
      const staffId = a[ACH_STAFF_COL];
      const pts = parseInt(a[ACH_POINTS_COL], 10) || 0;
      pointsMap[staffId] = (pointsMap[staffId] || 0) + pts;
      countMap[staffId] = (countMap[staffId] || 0) + 1;
    });

    const leaderboard = Object.keys(pointsMap)
      .map(staffId => ({
        staffId: staffId,
        name: staffMap[staffId] || staffId,
        points: pointsMap[staffId],
        badges: countMap[staffId],
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, topN);

    return { success: true, leaderboard: leaderboard };
  } catch (e) {
    console.error('Error in getLeaderboard:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Lấy thành tích của nhân viên hiện tại
 */
function getMyAchievements() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

    const staff = getStaffList();
    const staffMember = staff.find(s => s[STAFF_NAME_COLUMN_NAME] === currentUser.name);
    const staffId = staffMember ? staffMember[STAFF_ID_COLUMN_NAME] : null;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const achSheet = ss.getSheetByName(ACHIEVEMENT_SHEET_NAME);
    if (!achSheet || achSheet.getLastRow() < 2) {
      return { success: true, achievements: [], totalPoints: 0, level: getLevelInfo(0) };
    }

    const allAch = sheetDataToObjectArray(achSheet);
    const myAch = staffId ? allAch.filter(a => a[ACH_STAFF_COL] === staffId) : [];
    const totalPoints = myAch.reduce((sum, a) => sum + (parseInt(a[ACH_POINTS_COL], 10) || 0), 0);

    return { success: true, achievements: myAch, totalPoints: totalPoints, level: getLevelInfo(totalPoints) };
  } catch (e) {
    console.error('Error in getMyAchievements:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Tổng kết nhiệm vụ hoàn thành trong ngày (dùng cho bot Telegram)
 * Trả về dữ liệu JSON cho từng nhân viên đã đăng ký Telegram
 */
function getDailySummaryForBot() {
  try {
    const today = formatSheetDate(new Date());
    const allTasks = getTasks();
    const allProjects = getProjects();
    const allStaff = getStaffList();

    const projectMap = {};
    allProjects.forEach(p => { projectMap[p[PROJECT_ID_COLUMN_NAME]] = p[PROJECT_NAME_COLUMN_NAME]; });

    // Lọc tasks hoàn thành trong ngày hôm nay
    const todayTasks = allTasks.filter(t =>
      t[TASK_STATUS_COLUMN_NAME] === 'Hoàn thành' &&
      t[TASK_REPORT_DATE_COLUMN_NAME] === today
    );

    // Group by assignee
    const byAssignee = {};
    todayTasks.forEach(t => {
      const assignee = t[TASK_ASSIGNEE_COLUMN_NAME] || 'Không rõ';
      if (!byAssignee[assignee]) byAssignee[assignee] = [];
      byAssignee[assignee].push({
        taskId: t[TASK_ID_COLUMN_NAME],
        taskName: t[TASK_NAME_COLUMN_NAME],
        projectName: projectMap[t[TASK_PROJECT_ID_COLUMN_NAME]] || t[TASK_PROJECT_ID_COLUMN_NAME],
        priority: t[TASK_PRIORITY_COLUMN_NAME],
      });
    });

    // Tổng team
    const teamTotal = todayTasks.length;

    // Lấy danh sách Telegram users
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tgSheet = ss.getSheetByName(TELEGRAM_USERS_SHEET_NAME);
    let telegramUsers = [];
    if (tgSheet && tgSheet.getLastRow() >= 2) {
      telegramUsers = sheetDataToObjectArray(tgSheet);
    }

    // Map Mã NV -> Telegram ID
    const staffMap = {};
    allStaff.forEach(s => { staffMap[s[STAFF_ID_COLUMN_NAME]] = s[STAFF_NAME_COLUMN_NAME]; });

    const result = telegramUsers.map(tgUser => {
      const staffName = staffMap[tgUser[TG_STAFF_COL]] || '';
      const myTasks = byAssignee[staffName] || [];
      return {
        telegramId: tgUser[TG_ID_COL],
        staffName: staffName,
        myTasks: myTasks,
        teamTotal: teamTotal,
        myTotal: myTasks.length,
      };
    });

    return { success: true, summaries: result, date: today };
  } catch (e) {
    console.error('Error in getDailySummaryForBot:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Đăng ký Telegram User (dùng từ bot qua /link command)
 */
function registerTelegramUser(telegramId, staffId, displayName) {
  try {
    if (!telegramId || !staffId) return { success: false, error: 'Thiếu thông tin' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tgSheet = getOrCreateSheet(ss, TELEGRAM_USERS_SHEET_NAME, [
      TG_ID_COL, TG_STAFF_COL, TG_NAME_COL, TG_DATE_COL
    ]);

    // Kiểm tra trùng telegramId
    const existing = sheetDataToObjectArray(tgSheet);
    const dup = existing.find(r => String(r[TG_ID_COL]) === String(telegramId));
    if (dup) {
      // Update
      const headers = getHeaders(tgSheet);
      const tgIdIdx = headers.indexOf(TG_ID_COL);
      for (let row = 2; row <= tgSheet.getLastRow(); row++) {
        if (String(tgSheet.getRange(row, tgIdIdx + 1).getValue()) === String(telegramId)) {
          tgSheet.getRange(row, headers.indexOf(TG_STAFF_COL) + 1).setValue(staffId);
          tgSheet.getRange(row, headers.indexOf(TG_NAME_COL) + 1).setValue(displayName || '');
          SpreadsheetApp.flush();
          return { success: true, message: 'Đã cập nhật liên kết Telegram' };
        }
      }
    }

    tgSheet.appendRow([String(telegramId), staffId, displayName || '', formatSheetDate(new Date())]);
    SpreadsheetApp.flush();
    return { success: true, message: 'Đăng ký Telegram thành công' };
  } catch (e) {
    console.error('Error in registerTelegramUser:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Lấy thông tin Telegram user theo telegramId
 */
function getTelegramUser(telegramId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tgSheet = ss.getSheetByName(TELEGRAM_USERS_SHEET_NAME);
    if (!tgSheet || tgSheet.getLastRow() < 2) return null;

    const users = sheetDataToObjectArray(tgSheet);
    return users.find(u => String(u[TG_ID_COL]) === String(telegramId)) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Tạo overdue notification (stub - giữ tương thích)
 */
function createOverdueNotificationIfNeeded(task) {
  // Notification logic placeholder
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
