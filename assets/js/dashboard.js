/**
 * 足迹地图 - 用户控制中心JavaScript
 * 处理控制中心的各种交互、数据加载和状态管理
 * 已适配Bootstrap 5框架
 */

// --- Global State ---
let currentUser = null;
let currentJourneys = []; // Holds the currently displayed list of user journeys
let currentPagination = { page: 1, total_pages: 1 };
let currentFilters = { search: '', sort: 'updated_at', visibility: 'all' };

// --- API Base URL ---
const API_BASE_URL = 'http://127.0.0.1:5000/api'; // Your Flask API base URL

// --- Helper Functions ---

/**
 * Make authenticated API calls
 * @param {string} endpoint - API endpoint path (e.g., '/users/stats')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object|null} body - Request body for POST/PUT
 * @returns {Promise<object>} - The JSON response data
 * @throws {Error} - If the request fails or returns an error status
 */
async function fetchApi(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: `HTTP error! Status: ${response.status}` };
            }
            // If unauthorized, redirect to login
            if (response.status === 401) {
                console.error("Authentication failed. Redirecting to login.");
                logoutUser(); // Clear local storage and redirect
            }
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        // Handle responses that might not have a body (e.g., DELETE 204)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true }; // Or an appropriate success indicator
        }

        return await response.json();

    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        showNotification(`请求失败: ${error.message}`, 'error');
        throw error; // Re-throw the error for calling function to handle if needed
    }
}

/**
 * Get current user from local storage
 */
function getCurrentUser() {
    try {
        const userJson = localStorage.getItem('footprintMapCurrentUser');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
}

/**
 * Logout user: clear storage and redirect
 */
function logoutUser() {
     localStorage.removeItem('footprintMapCurrentUser');
     localStorage.removeItem('authToken'); // Remove token too
     window.location.href = 'auth.html?mode=login'; // Redirect to login
}

/**
 * Check authentication status
 */
function checkUserAuthentication() {
    currentUser = getCurrentUser();
    if (!currentUser) {
        logoutUser(); // Redirect if no user
        return false;
    }
    updateUserInfo(currentUser);
    return true;
}

/**
 * Update user info displayed on the page
 */
function updateUserInfo(user) {
    if (!user) return;
    
    // Welcome message
    const welcomeUsername = document.getElementById('welcomeUsername');
    if (welcomeUsername) welcomeUsername.textContent = user.username || '用户';

    // User menu dropdown
    const userDropdownName = document.getElementById('userDropdownName');
    const userDropdownEmail = document.getElementById('userDropdownEmail');
    if (userDropdownName) userDropdownName.textContent = user.username || '用户名';
    if (userDropdownEmail) userDropdownEmail.textContent = user.email || '邮箱';

    // Avatar initials/image
    const userInitials = document.querySelectorAll('.user-initial');
    userInitials.forEach(initial => {
        initial.textContent = (user.username || 'U').charAt(0).toUpperCase();
    });
    
    // If user has an avatar, replace the initial with image
    if (user.avatar) {
        const avatarContainers = document.querySelectorAll('#userMenuButton, .profile-avatar-preview');
        avatarContainers.forEach(container => {
            // Clear previous content
            container.innerHTML = '';
            
            // Create image
            const img = document.createElement('img');
            img.src = user.avatar;
            img.alt = user.username || 'User Avatar';
            img.className = 'rounded-circle w-100 h-100 object-fit-cover';
            container.appendChild(img);
        });
    }

    // Profile settings form fields
    const profileUsername = document.getElementById('profileUsername');
    const profileEmail = document.getElementById('profileEmail');
    const profileBio = document.getElementById('profileBio');
    const profileLocation = document.getElementById('profileLocation');
    const profileWebsite = document.getElementById('profileWebsite');

    if (profileUsername) profileUsername.value = user.username || '';
    if (profileEmail) profileEmail.value = user.email || '';
    if (profileBio && user.bio) profileBio.value = user.bio;
    if (profileLocation && user.location) profileLocation.value = user.location;
    if (profileWebsite && user.website) profileWebsite.value = user.website;
}

// --- Data Loading Functions ---

/**
 * Load all necessary data for the dashboard
 */
async function loadDashboardData() {
    if (!currentUser) return; // Should be caught by checkAuth earlier, but safety first

    showLoadingIndicator('overview-panel'); // Show loader for the default panel
    
    try {
        // Fetch data concurrently
        const [stats, recentJourneysData, journeysData, settingsData] = await Promise.all([
            fetchApi('/users/stats').catch(err => {
                console.error('Failed to load stats:', err);
                return {}; // Return empty object to continue execution
            }),
            fetchApi(`/journeys?sort=updated_at&per_page=3`).catch(err => {
                console.error('Failed to load recent journeys:', err);
                return { journeys: [] }; // Return empty array to continue
            }),
            fetchApi(`/journeys?page=${currentPagination.page}&search=${currentFilters.search}&sort=${currentFilters.sort}&visibility=${currentFilters.visibility}`).catch(err => {
                console.error('Failed to load journeys list:', err);
                return { journeys: [] }; // Return empty array to continue
            }),
            fetchApi('/settings').catch(err => {
                console.error('Failed to load settings:', err);
                return {}; // Return empty object to continue
            })
        ]);

        // Render sections
        renderStats(stats);
        renderRecentJourneys(recentJourneysData.journeys || []);
        renderJourneyList(journeysData.journeys || []);
        updatePaginationControls(journeysData.pagination || { page: 1, total_pages: 1 });
        populateSettingsForms(settingsData);

    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        // Show error message to the user on the main panel
        document.getElementById('overview-panel').innerHTML = `
            <div class="alert alert-warning" role="alert">
                <h4 class="alert-heading">部分数据加载失败</h4>
                <p>您仍然可以使用仪表盘的其他功能</p>
            </div>
        `;
    } finally {
        // Always hide loading indicators
        hideLoadingIndicator('overview-panel');
        hideLoadingIndicator('my-journeys-panel');
        document.getElementById('loadingScreen').style.display = 'none';
    }
}

// --- Rendering Functions ---

/**
 * Render user statistics
 */
function renderStats(stats) {
    if (!stats) return;
    
    // Map of stat cards to their respective values
    const statCards = {
        '足迹地图': { value: stats.journey_count, desc: `共创建了${stats.journey_count}个足迹地图` },
        '足迹点': { value: stats.point_count, desc: `共标记了${stats.point_count}个足迹点` },
        '浏览量': { value: stats.total_views, desc: `共${stats.total_views}次地图浏览` },
        '已分享': { value: stats.shared_count, desc: `已公开分享${stats.shared_count}个地图` }
    };

    // Find all stat-value elements and update them
    document.querySelectorAll('.card .card-body h6.text-uppercase.text-muted.small').forEach(titleElement => {
        const title = titleElement.textContent.trim();
        if (statCards.hasOwnProperty(title)) {
            const card = titleElement.closest('.card-body');
            const valueElement = card.querySelector('.display-6');
            const descElement = card.querySelector('p.text-muted.mb-0');
            
            if (valueElement) valueElement.textContent = statCards[title].value;
            if (descElement) descElement.textContent = statCards[title].desc;
        }
    });
}

/**
 * Render recent journeys in the overview panel
 */
function renderRecentJourneys(journeys) {
    const container = document.getElementById('recentJourneys');
    if (!container) return;
    
    container.innerHTML = ''; // Clear previous content or loader

    if (!journeys || journeys.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="text-muted">您还没有创建任何足迹地图。</p>
            </div>
        `;
        return;
    }

    journeys.forEach(journey => {
        const cardEl = document.createElement('div');
        cardEl.className = 'col-md-6 col-lg-4';
        cardEl.innerHTML = createJourneyCardHTML(journey);
        container.appendChild(cardEl);
    });
}

/**
 * Create HTML for a journey card
 */
function createJourneyCardHTML(journey) {
    return `
        <div class="card h-100 shadow-sm card-hover">
            <div class="card-img-top position-relative" style="height: 160px; background-color: #f0f0f0;">
                <img src="${journey.cover_image || 'assets/images/default_cover.jpg'}" 
                     class="w-100 h-100 object-fit-cover" 
                     alt="${journey.title || '足迹地图'}">
            </div>
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${journey.title || '无标题'}</h5>
                <p class="card-text text-muted small mb-3">${journey.description || '无描述'}</p>
                <div class="d-flex justify-content-between mt-auto text-muted small">
                    <span>更新于 ${formatDate(journey.updated_at)}</span>
                    <span>${journey.view_count || 0} 次查看</span>
                </div>
            </div>
            <div class="card-footer bg-transparent d-flex border-top">
                <a href="journey-view.html?id=${journey.id}" class="btn btn-sm btn-link text-primary flex-grow-1 text-decoration-none">查看</a>
                <a href="journey-edit.html?id=${journey.id}" class="btn btn-sm btn-link text-secondary flex-grow-1 text-decoration-none">编辑</a>
            </div>
        </div>
    `;
}

/**
 * Render the main list of user journeys
 */
function renderJourneyList(journeys) {
    const container = document.getElementById('journeyList');
    if (!container) return;
    
    container.innerHTML = ''; // Clear previous content or loader

    if (!journeys || journeys.length === 0) {
        let message = "没有找到符合条件的足迹地图。";
        if (!currentFilters.search && currentFilters.visibility === 'all') {
             message = `您还没有创建任何足迹地图。`;
        }
        
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3">
                    <i class="bi bi-map-fill text-muted" style="font-size: 3rem;"></i>
                </div>
                <p class="text-muted">${message}</p>
                ${(!currentFilters.search && currentFilters.visibility === 'all') ? `
                    <a href="journey-edit.html?new=true" class="btn btn-primary mt-2">
                        <i class="bi bi-plus-circle me-1"></i>创建新地图
                    </a>` : ''}
            </div>
        `;
        return;
    }

    journeys.forEach(journey => {
        const journeyItem = document.createElement('div');
        journeyItem.innerHTML = createJourneyItemHTML(journey);
        journeyItem.className = 'mb-4';
        container.appendChild(journeyItem);
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-journey-btn').forEach(button => {
        button.addEventListener('click', function() {
            const journeyId = this.getAttribute('data-journey-id');
            const journeyTitle = this.closest('.card').querySelector('.card-title').textContent;
            openDeleteConfirmationModal(journeyId, journeyTitle);
        });
    });
}

/**
 * Create HTML for a journey list item
 */
function createJourneyItemHTML(journey) {
    // Determine visibility badge
    let visibilityIcon, visibilityText, visibilityClass;
    switch (journey.visibility) {
        case 'public':
            visibilityIcon = `<i class="bi bi-globe"></i>`;
            visibilityText = '公开';
            visibilityClass = 'bg-success';
            break;
        case 'private':
            visibilityIcon = `<i class="bi bi-lock"></i>`;
            visibilityText = '私密';
            visibilityClass = 'bg-danger';
            break;
        case 'unlisted':
        default:
            visibilityIcon = `<i class="bi bi-eye-slash"></i>`;
            visibilityText = '未列出';
            visibilityClass = 'bg-warning text-dark';
            break;
    }

    return `
        <div class="card shadow-sm h-100">
            <div class="card-body p-4">
                <div class="d-flex flex-column flex-md-row justify-content-between mb-3">
                    <div>
                        <h5 class="card-title mb-1">${journey.title || '无标题'}</h5>
                        <span class="badge ${visibilityClass} me-2">${visibilityIcon} ${visibilityText}</span>
                    </div>
                    <div class="mt-2 mt-md-0">
                        <div class="btn-group">
                            <a href="journey-view.html?id=${journey.id}" class="btn btn-sm btn-outline-primary">
                                <i class="bi bi-eye me-1"></i>查看
                            </a>
                            <a href="journey-edit.html?id=${journey.id}" class="btn btn-sm btn-outline-secondary">
                                <i class="bi bi-pencil me-1"></i>编辑
                            </a>
                            <button type="button" class="btn btn-sm btn-outline-danger delete-journey-btn" data-journey-id="${journey.id}">
                                <i class="bi bi-trash me-1"></i>删除
                            </button>
                        </div>
                    </div>
                </div>
                <p class="card-text text-muted mb-3">${journey.description || '无描述'}</p>
                <div class="d-flex flex-wrap gap-3 text-muted small">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-geo-alt me-1"></i>
                        <span>${journey.point_count || 0} 个足迹点</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <i class="bi bi-eye me-1"></i>
                        <span>${journey.view_count || 0} 次查看</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <i class="bi bi-calendar-check me-1"></i>
                        <span>更新于 ${formatDate(journey.updated_at)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Populate settings forms with fetched data
 */
function populateSettingsForms(settings) {
    if (!settings) return;

    // Dark mode preference
    const darkModePreference = document.getElementById('darkModePreference');
    if (darkModePreference && typeof settings.dark_mode === 'boolean') {
        darkModePreference.checked = settings.dark_mode;
        if (settings.dark_mode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Map preferences
    const defaultMapView = document.getElementById('defaultMapView');
    const animationSpeed = document.getElementById('animationSpeed');
    const popupDelay = document.getElementById('popupDelay');
    const centerLatitude = document.getElementById('centerLatitude');
    const centerLongitude = document.getElementById('centerLongitude');

    if (defaultMapView && settings.default_view) defaultMapView.value = settings.default_view;
    if (animationSpeed && settings.animation_speed) animationSpeed.value = settings.animation_speed;
    if (popupDelay && settings.popup_delay) popupDelay.value = settings.popup_delay;
    if (centerLatitude && settings.center_latitude) centerLatitude.value = settings.center_latitude;
    if (centerLongitude && settings.center_longitude) centerLongitude.value = settings.center_longitude;

    // Notification settings
    const notifyUpdates = document.querySelector('input[name="notifyUpdates"]');
    const notifyComments = document.querySelector('input[name="notifyComments"]');
    const notifySystem = document.querySelector('input[name="notifySystem"]');
    const notifyMarketing = document.querySelector('input[name="notifyMarketing"]');

    if (notifyUpdates && typeof settings.notify_updates === 'boolean') notifyUpdates.checked = settings.notify_updates;
    if (notifyComments && typeof settings.notify_comments === 'boolean') notifyComments.checked = settings.notify_comments;
    if (notifySystem && typeof settings.notify_system === 'boolean') notifySystem.checked = settings.notify_system;
    if (notifyMarketing && typeof settings.notify_marketing === 'boolean') notifyMarketing.checked = settings.notify_marketing;
}

// --- Event Handlers & UI Logic ---

/**
 * Initialize navigation panel switching
 */
function initNavigation() {
    // Select all navigation links
    const navLinks = document.querySelectorAll('.nav-link[data-target], .dropdown-item[data-target], a[data-target]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPanelId = this.getAttribute('data-target');
            if (!targetPanelId) return;

            switchToPanel(targetPanelId);
            
            // Close navbar collapse on mobile if open
            const navbarCollapse = document.getElementById('navbarNav');
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                const bsCollapse = new bootstrap.Collapse(navbarCollapse);
                bsCollapse.hide();
            }
            
            // If this is a dropdown item, close the dropdown
            const dropdown = this.closest('.dropdown-menu');
            if (dropdown) {
                const dropdownToggle = dropdown.previousElementSibling;
                if (dropdownToggle && dropdownToggle.getAttribute('data-bs-toggle') === 'dropdown') {
                    // Let Bootstrap handle dropdown closing
                }
            }
        });
    });
}

/**
 * Initialize user menu dropdown interactions
 */
function initUserMenu() {
    // Bootstrap handles dropdown toggling automatically via data-bs-toggle
    
    // Add logout event listener
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            logoutUser();
        });
    }
}

/**
 * Switch displayed dashboard panel and update active nav link
 * @param {string} targetId - The ID suffix of the panel to show (e.g., 'overview', 'my-journeys')
 */
function switchToPanel(targetId) {
    // Hide all dashboard panels
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none'; // 强制隐藏所有面板
    });

    // Deactivate all navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show the target panel
    const targetPanel = document.getElementById(`${targetId}-panel`);
    if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.style.display = 'block'; // 强制显示目标面板
        console.log(`Switched to panel: ${targetId}-panel`);
    } else {
        console.warn(`Panel with ID suffix ${targetId} not found.`);
        // Fallback to overview
        const overviewPanel = document.getElementById('overview-panel');
        if (overviewPanel) {
            overviewPanel.classList.add('active');
            overviewPanel.style.display = 'block'; // 强制显示概览面板
        }
        targetId = 'overview';
    }

    // Activate the corresponding navigation links
    const activeNavLinks = document.querySelectorAll(`.nav-link[data-target="${targetId}"]`);
    activeNavLinks.forEach(link => {
        link.classList.add('active');
    });

    // Update page title
    updatePageTitle(targetId);
}

/**
 * Update the browser's title based on the active panel
 * @param {string} panelIdSuffix - The suffix of the active panel ID
 */
function updatePageTitle(panelIdSuffix) {
    let baseTitle = '控制中心 - 足迹地图'; // Default
    switch (panelIdSuffix) {
        case 'my-journeys':
            baseTitle = '我的足迹 - 足迹地图';
            break;
        case 'shared-journeys':
             baseTitle = '共享足迹 - 足迹地图';
             break;
        case 'settings':
        case 'profile':
            baseTitle = '账户设置 - 足迹地图';
            break;
        case 'overview':
        default:
            // Use the default baseTitle
            break;
    }
    document.title = baseTitle;
}

/**
 * Initialize dark mode toggle
 */
function initDarkMode() {
    const darkModeToggleHeader = document.getElementById('darkModeToggle');
    const darkModePreferenceSwitch = document.getElementById('darkModePreference');
    
    // Function to apply theme
    const applyTheme = (isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
            darkModeToggleHeader.innerHTML = '<i class="bi bi-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            darkModeToggleHeader.innerHTML = '<i class="bi bi-moon-stars"></i>';
        }
        
        // Sync settings switch if available
        if (darkModePreferenceSwitch) {
            darkModePreferenceSwitch.checked = isDark;
        }
    };

    // Function to save theme preference
    const setTheme = (isDark) => {
        applyTheme(isDark);
        localStorage.setItem('darkMode', isDark.toString());
        
        // If user is logged in, save preference via API
        if (currentUser) {
            fetchApi('/settings', 'PUT', { dark_mode: isDark }).catch(err => {
                console.error("Failed to save dark mode preference:", err);
            });
        }
    };

    // Initialize from localStorage or system preference
    const storedPreference = localStorage.getItem('darkMode');
    let initialDarkMode = false;
    
    if (storedPreference !== null) {
        initialDarkMode = storedPreference === 'true';
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialDarkMode = true;
    }
    
    applyTheme(initialDarkMode);

    // Set up event listeners
    if (darkModeToggleHeader) {
        darkModeToggleHeader.addEventListener('click', () => {
            const isDarkModeNow = document.body.classList.contains('dark-mode');
            setTheme(!isDarkModeNow);
        });
    }

    if (darkModePreferenceSwitch) {
        darkModePreferenceSwitch.addEventListener('change', function() {
            setTheme(this.checked);
        });
    }
}

/**
 * Initialize form submissions
 */
function initFormSubmissions() {
    // Profile Form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            const formData = {
                username: document.getElementById('profileUsername').value,
                bio: document.getElementById('profileBio').value,
                location: document.getElementById('profileLocation').value,
                website: document.getElementById('profileWebsite').value
            };

            try {
                showButtonLoading(submitBtn);
                const updatedUser = await fetchApi('/users/profile', 'PUT', formData);
                
                // Update local user data
                currentUser = { ...currentUser, ...updatedUser };
                localStorage.setItem('footprintMapCurrentUser', JSON.stringify(currentUser));
                updateUserInfo(currentUser);
                
                showToast('个人资料已更新！', 'success');
            } catch (error) {
                console.error("Profile update failed:", error);
                showToast(`更新失败: ${error.message}`, 'danger');
            } finally {
                hideButtonLoading(submitBtn, '保存修改');
            }
        });
    }

    // Password Form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            const submitBtn = passwordForm.querySelector('button[type="submit"]');

            if (newPassword !== confirmPassword) {
                showToast('新密码与确认密码不匹配', 'danger');
                return;
            }
            
            if (newPassword.length < 8) {
                showToast('新密码长度必须至少为8个字符', 'danger');
                return;
            }

            try {
                showButtonLoading(submitBtn);
                await fetchApi('/users/password', 'PUT', { 
                    currentPassword, 
                    newPassword 
                });
                
                showToast('密码修改成功！', 'success');
                passwordForm.reset();
            } catch (error) {
                console.error("Password change failed:", error);
                showToast(`密码修改失败: ${error.message}`, 'danger');
            } finally {
                hideButtonLoading(submitBtn, '更新密码');
            }
        });
    }

    // Preferences Form
    const preferencesForm = document.getElementById('preferencesForm');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = preferencesForm.querySelector('button[type="submit"]');
            const settingsData = {
                default_view: document.getElementById('defaultMapView').value,
                animation_speed: parseInt(document.getElementById('animationSpeed').value, 10),
                popup_delay: parseInt(document.getElementById('popupDelay').value, 10),
                center_latitude: parseFloat(document.getElementById('centerLatitude').value),
                center_longitude: parseFloat(document.getElementById('centerLongitude').value),
                dark_mode: document.getElementById('darkModePreference').checked
            };

            try {
                showButtonLoading(submitBtn);
                const updatedSettings = await fetchApi('/settings', 'PUT', settingsData);
                populateSettingsForms(updatedSettings);
                showToast('偏好设置已保存！', 'success');
            } catch (error) {
                console.error("Preferences update failed:", error);
                showToast(`设置保存失败: ${error.message}`, 'danger');
            } finally {
                hideButtonLoading(submitBtn, '保存设置');
            }
        });
    }

    // Notifications Form
    const notificationsForm = document.getElementById('notificationsForm');
    if (notificationsForm) {
        notificationsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = notificationsForm.querySelector('button[type="submit"]');
            const formData = new FormData(notificationsForm);
            const settings = {
                notify_updates: formData.has('notifyUpdates'),
                notify_comments: formData.has('notifyComments'),
                notify_system: formData.has('notifySystem'),
                notify_marketing: formData.has('notifyMarketing')
            };

            try {
                showButtonLoading(submitBtn);
                const currentSettings = await fetchApi('/settings');
                const combinedSettings = { ...currentSettings, ...settings };
                
                // Remove non-settings fields
                delete combinedSettings.id;
                delete combinedSettings.user_id;
                delete combinedSettings.created_at;
                delete combinedSettings.updated_at;

                const updated = await fetchApi('/settings', 'PUT', combinedSettings);
                populateSettingsForms(updated);
                showToast('通知设置已保存！', 'success');
            } catch (error) {
                console.error("Notification settings update failed:", error);
                showToast(`设置保存失败: ${error.message}`, 'danger');
            } finally {
                hideButtonLoading(submitBtn, '保存设置');
            }
        });
    }
}

/**
 * Initialize search and filter inputs
 */
function initSearchAndFilters() {
    const journeySearch = document.getElementById('journeySearch');
    const journeySort = document.getElementById('journeySort');
    const journeyVisibility = document.getElementById('journeyVisibility');

    if (journeySearch) {
        journeySearch.addEventListener('input', debounce(() => {
            currentFilters.search = journeySearch.value;
            currentPagination.page = 1; // Reset to first page on search
            refreshJourneyList();
        }, 500));
    }
    
    if (journeySort) {
        journeySort.addEventListener('change', () => {
            currentFilters.sort = journeySort.value;
            currentPagination.page = 1;
            refreshJourneyList();
        });
    }
    
    if (journeyVisibility) {
        journeyVisibility.addEventListener('change', () => {
            currentFilters.visibility = journeyVisibility.value;
            currentPagination.page = 1;
            refreshJourneyList();
        });
    }

    // Shared journeys filters
    const sharedJourneySearch = document.getElementById('sharedJourneySearch');
    const sharedJourneySort = document.getElementById('sharedJourneySort');
    const sharedJourneyCategory = document.getElementById('sharedJourneyCategory');

    if (sharedJourneySearch) {
        sharedJourneySearch.addEventListener('input', debounce(() => {
            // Implement shared journey search
            console.log("Shared journey search:", sharedJourneySearch.value);
            // loadSharedJourneyList();
        }, 500));
    }

    if (sharedJourneySort || sharedJourneyCategory) {
        [sharedJourneySort, sharedJourneyCategory].forEach(select => {
            if (select) {
                select.addEventListener('change', () => {
                    // Implement shared journey filtering
                    console.log("Shared journey filter changed");
                    // loadSharedJourneyList();
                });
            }
        });
    }
}

/**
 * Refresh the journey list based on current filters and page
 */
async function refreshJourneyList() {
    const container = document.getElementById('journeyList');
    showLoadingIndicator('my-journeys-panel', container);
    
    try {
        const endpoint = `/journeys?page=${currentPagination.page}&search=${encodeURIComponent(currentFilters.search)}&sort=${currentFilters.sort}&visibility=${currentFilters.visibility}`;
        const data = await fetchApi(endpoint);
        
        renderJourneyList(data.journeys);
        updatePaginationControls(data.pagination);
    } catch (error) {
        console.error("Failed to refresh journey list:", error);
        
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">加载失败</h4>
                    <p>无法加载足迹列表: ${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoadingIndicator('my-journeys-panel');
    }
}

/**
 * Update pagination controls
 */
function updatePaginationControls(paginationData) {
    currentPagination = paginationData;

    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const paginationContainer = document.getElementById('journeyPagination');

    if (!paginationContainer) return;

    if (!paginationData || paginationData.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    if (currentPageSpan) currentPageSpan.textContent = paginationData.page;
    if (totalPagesSpan) totalPagesSpan.textContent = paginationData.total_pages;

    if (prevPageBtn) {
        prevPageBtn.disabled = paginationData.page <= 1;
        prevPageBtn.classList.toggle('disabled', paginationData.page <= 1);
    }

    if (nextPageBtn) {
        nextPageBtn.disabled = paginationData.page >= paginationData.total_pages;
        nextPageBtn.classList.toggle('disabled', paginationData.page >= paginationData.total_pages);
    }
}

/**
 * Initialize pagination button clicks
 */
function initPagination() {
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPagination.page > 1) {
                currentPagination.page--;
                refreshJourneyList();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPagination.page < currentPagination.total_pages) {
                currentPagination.page++;
                refreshJourneyList();
            }
        });
    }
}

/**
 * Initialize delete confirmation modal
 */
function initDeleteConfirmation() {
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    if (!confirmDeleteModal) return;
    
    // Use Bootstrap's Modal API
    const modal = new bootstrap.Modal(confirmDeleteModal);
    
    // Get references to buttons
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            const action = this.getAttribute('data-action');
            const journeyId = this.getAttribute('data-journey-id');

            if (action === 'delete-journey' && journeyId) {
                await handleDeleteJourney(journeyId);
            } else if (action === 'delete-account') {
                console.log("Account deletion requested - implement if needed");
            }
            modal.hide();
        });
    }
    
    // Delete account button
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function() {
            openDeleteConfirmationModal(null, null, true);
        });
    }
}

/**
 * Open the delete confirmation modal
 * @param {string} journeyId - ID of the journey to delete
 * @param {string} journeyTitle - Title of the journey for the message
 * @param {boolean} isAccount - If true, this is an account deletion confirmation
 */
function openDeleteConfirmationModal(journeyId = null, journeyTitle = null, isAccount = false) {
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deleteConfirmText = document.getElementById('deleteConfirmText');
    const modalTitle = confirmDeleteModal?.querySelector('.modal-title');

    if (!confirmDeleteModal || !confirmDeleteBtn || !deleteConfirmText) return;

    // Set modal content based on what's being deleted
    if (isAccount) {
        if (modalTitle) modalTitle.textContent = '删除账户';
        deleteConfirmText.textContent = `您确定要删除您的账户吗？所有数据将被永久删除，此操作无法撤销。`;
        confirmDeleteBtn.setAttribute('data-action', 'delete-account');
        confirmDeleteBtn.removeAttribute('data-journey-id');
    } else {
        if (modalTitle) modalTitle.textContent = '确认删除';
        deleteConfirmText.textContent = `您确定要删除足迹地图 "${journeyTitle}" 吗？此操作无法撤销。`;
        confirmDeleteBtn.setAttribute('data-action', 'delete-journey');
        confirmDeleteBtn.setAttribute('data-journey-id', journeyId);
    }

    // Use Bootstrap's Modal API to show the modal
    const modal = new bootstrap.Modal(confirmDeleteModal);
    modal.show();
}

/**
 * Handle the actual deletion of a journey via API call
 * @param {string} journeyId - ID of the journey to delete
 */
async function handleDeleteJourney(journeyId) {
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    try {
        if (confirmDeleteBtn) showButtonLoading(confirmDeleteBtn, '删除中...');
        await fetchApi(`/journeys/${journeyId}`, 'DELETE');
        showToast('足迹地图已删除！', 'success');
        refreshJourneyList();
    } catch (error) {
        console.error(`Failed to delete journey ${journeyId}:`, error);
        showToast(`删除失败: ${error.message}`, 'danger');
    } finally {
        if (confirmDeleteBtn) hideButtonLoading(confirmDeleteBtn, '确认删除');
    }
}

// --- UI Utility Functions ---

/**
 * Format date string
 */
function formatDate(dateString) {
    if (!dateString) return '未知日期';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'numeric', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * Show loading state on a button
 * @param {HTMLButtonElement} button - The button element
 * @param {string} loadingText - Text to show while loading
 */
function showButtonLoading(button, loadingText = '处理中...') {
    if (!button) return;
    
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        ${loadingText}
    `;
}

/**
 * Hide loading state on a button
 * @param {HTMLButtonElement} button - The button element
 * @param {string} defaultText - Default text if original can't be restored
 */
function hideButtonLoading(button, defaultText = 'Submit') {
    if (!button) return;
    
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || defaultText;
}

/**
 * Show a toast notification
 * @param {string} message - The message to show
 * @param {string} type - One of: success, danger, warning, info
 */
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '1050';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toastId = 'toast-' + Date.now();
    const toastEl = document.createElement('div');
    toastEl.id = toastId;
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    // Toast content
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toastEl);
    
    // Init and show toast
    const toast = new bootstrap.Toast(toastEl, {
        delay: 3000
    });
    toast.show();
    
    // Remove from DOM after hiding
    toastEl.addEventListener('hidden.bs.toast', function() {
        toastEl.remove();
    });
}

/**
 * Show loading indicator
 * @param {string} panelId - ID of the panel containing the loader
 * @param {HTMLElement} container - Optional specific container within the panel
 */
function showLoadingIndicator(panelId, container = null) {
    let targetContainer = container;
    
    if (!targetContainer) {
        const panel = document.getElementById(panelId);
        targetContainer = panel;
    }

    if (targetContainer) {
        // Check if loader already exists
        if (!targetContainer.querySelector('.loading-overlay')) {
            const loaderHTML = `
                <div class="loading-overlay position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-75 d-flex align-items-center justify-content-center dark-mode-bg-dark">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            targetContainer.style.position = 'relative';
            targetContainer.insertAdjacentHTML('beforeend', loaderHTML);
        }
    } else {
        // Fallback to global loader
        document.getElementById('loadingScreen').style.display = 'flex';
    }
}

/**
 * Hide loading indicator
 * @param {string} panelId - ID of the panel containing the loader
 */
function hideLoadingIndicator(panelId) {
    const panel = document.getElementById(panelId);
    
    if (panel) {
        const loaderOverlay = panel.querySelector('.loading-overlay');
        if (loaderOverlay) {
            loaderOverlay.remove();
        }
    }
    
    // Hide global loader
    document.getElementById('loadingScreen').style.display = 'none';
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
	// 首先，确保只有概览面板显示
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });
    
    const overviewPanel = document.getElementById('overview-panel');
    if (overviewPanel) {
        overviewPanel.classList.add('active');
        overviewPanel.style.display = 'block';
    }
    try {
        // Initial Auth Check
        if (!checkUserAuthentication()) {
            return; // Stop further execution if not logged in
        }

        // Initialize UI components
        initNavigation();
        initUserMenu();
        initDarkMode();
        initFormSubmissions();
        initDeleteConfirmation();
        initSearchAndFilters();
        initPagination();

        // Load initial dashboard data from API
        loadDashboardData();
    } catch (error) {
        console.error('Error during initialization:', error);
        // Show error message
        alert('初始化失败，请刷新页面重试：' + error.message);
    } finally {
        // Always hide loading screen regardless of any errors
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        }, 500); // Add slight delay to ensure DOM is ready
    }
});