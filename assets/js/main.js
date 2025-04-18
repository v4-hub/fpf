/**
 * 足迹地图网站 - 主要JavaScript文件
 * 负责处理整个网站的交互逻辑
 */

// 全局变量
let currentJourneyOffset = 0;
const journeysPerPage = 3;

/**
 * 格式化日期
 * @param {string} dateString - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * 在本地存储中获取用户信息
 * @returns {Object|null} 用户信息或null
 */
function getCurrentUser() {
    const userJson = localStorage.getItem('footprintMapCurrentUser');
    if (!userJson) return null;
    
    try {
        return JSON.parse(userJson);
    } catch (e) {
        console.error('解析用户数据失败:', e);
        return null;
    }
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
function isUserLoggedIn() {
    return getCurrentUser() !== null;
}

/**
 * 创建通知提示
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型: 'info', 'success', 'error', 'warning'
 * @param {number} duration - 通知显示时长(毫秒)
 */
function createNotification(message, type = 'info', duration = 3000) {
    // 检查是否已有通知容器
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'px-4 py-3 rounded-lg shadow-md transform transition-all duration-300 translate-x-full';
    
    // 设置通知类型样式
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            notification.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-500', 'text-white');
            break;
        default:
            notification.classList.add('bg-indigo-500', 'text-white');
    }
    
    // 设置通知内容
    notification.textContent = message;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 触发动画
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 10);
    
    // 设置自动消失
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            container.removeChild(notification);
        }, 300);
    }, duration);
}

/**
 * 处理页面加载事件
 */
document.addEventListener('DOMContentLoaded', function() {
    // 初始化AOS动画库
    AOS.init({
        once: true,
        duration: 800,
        easing: 'ease-in-out'
    });
    
    // 初始化各种功能
    initDarkMode();
    initMobileMenu();
    initCoffeeModal();
    initJourneyDetailModal();
    
    // 加载足迹地图数据
    loadFeaturedJourneys();
    
    // 加载更多足迹按钮事件
    const loadMoreBtn = document.getElementById('loadMoreJourneys');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreJourneys);
    }
    
    // 留言表单事件
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);
    }
});

/**
 * 初始化黑暗模式
 */
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (!darkModeToggle) return;
    
    const html = document.documentElement;
    
    // 检查用户偏好
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark');
    }
    
    // 监听模式变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
    });
    
    // 手动切换
    darkModeToggle.addEventListener('click', () => {
        html.classList.toggle('dark');
    });
}

/**
 * 初始化移动端菜单
 */
function initMobileMenu() {
    const mobileMenuButton = document.querySelector('.sm\\:hidden');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if(mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            const isHidden = mobileMenu.style.display === 'none' || mobileMenu.style.display === '';
            mobileMenu.style.display = isHidden ? 'block' : 'none';
        });
    }
}

/**
 * 初始化咖啡杯模态框
 */
function initCoffeeModal() {
    const coffeeBtn = document.getElementById('coffeeBtn');
    const coffeeModal = document.getElementById('coffeeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    if (!coffeeBtn || !coffeeModal || !closeModalBtn) return;
    
    coffeeBtn.addEventListener('click', () => {
        coffeeModal.classList.remove('hidden');
    });
    
    closeModalBtn.addEventListener('click', () => {
        coffeeModal.classList.add('hidden');
    });
    
    // 点击模态框外部关闭
    coffeeModal.addEventListener('click', (e) => {
        if (e.target === coffeeModal) {
            coffeeModal.classList.add('hidden');
        }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !coffeeModal.classList.contains('hidden')) {
            coffeeModal.classList.add('hidden');
        }
    });
}

/**
 * 初始化足迹详情模态框
 */
function initJourneyDetailModal() {
    const modal = document.getElementById('journeyDetailModal');
    const closeBtn = document.getElementById('closeJourneyDetailBtn');
    
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * 加载精选足迹地图
 * @param {boolean} isLoadMore - 是否是加载更多操作
 */
function loadFeaturedJourneys(isLoadMore = false) {
    const journeyCards = document.getElementById('journeyCards');
    const journeyCardLoader = document.getElementById('journeyCardLoader');
    
    if (!journeyCards || !journeyCardLoader) return;
    
    if (!isLoadMore) {
        // 首次加载时，清空卡片容器（除了加载提示）
        while (journeyCards.firstChild && journeyCards.firstChild !== journeyCardLoader) {
            journeyCards.removeChild(journeyCards.firstChild);
        }
        // 确保loader可见
        journeyCardLoader.classList.remove('hidden');
        
        // 重置偏移量
        currentJourneyOffset = 0;
    }
    
    // 从JSON文件获取数据
    fetch('data/featured-journeys.json')
        .then(response => response.json())
        .then(allData => {
            // 隐藏加载提示
            journeyCardLoader.classList.add('hidden');
            
            // 应用分页逻辑
            const start = currentJourneyOffset;
            const end = currentJourneyOffset + journeysPerPage;
            const data = allData.slice(start, end);
            
            if (data.length === 0) {
                // 没有更多数据
                const loadMoreBtn = document.getElementById('loadMoreJourneys');
                if (loadMoreBtn) {
                    loadMoreBtn.textContent = "没有更多足迹";
                    loadMoreBtn.disabled = true;
                }
                return;
            }
            
            // 渲染足迹卡片
            data.forEach(journey => {
                const card = createJourneyCard(journey);
                // 将加载提示前的卡片插入
                journeyCards.insertBefore(card, journeyCardLoader);
            });
            
            // 更新偏移量
            currentJourneyOffset += data.length;
            
            // 如果没有更多数据，禁用加载更多按钮
            if (currentJourneyOffset >= allData.length) {
                const loadMoreBtn = document.getElementById('loadMoreJourneys');
                if (loadMoreBtn) {
                    loadMoreBtn.textContent = "没有更多足迹";
                    loadMoreBtn.disabled = true;
                }
            }
        })
        .catch(error => {
            console.error('加载足迹数据失败:', error);
            journeyCardLoader.classList.add('hidden');
            
            // 显示错误信息
            const errorMsg = document.createElement('div');
            errorMsg.className = "col-span-3 text-center py-10 text-red-500";
            errorMsg.textContent = "加载数据失败，请稍后重试";
            journeyCards.appendChild(errorMsg);
        });
}

/**
 * 创建足迹卡片
 * @param {Object} journey - 足迹数据
 * @returns {HTMLElement} 卡片元素
 */
function createJourneyCard(journey) {
    const card = document.createElement('div');
    card.className = "bg-white dark:bg-gray-700 rounded-lg shadow-lg overflow-hidden map-card";
    card.setAttribute('data-aos', 'fade-up');
    
    // 设置封面背景（使用示例图片）
    let backgroundImage = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=60';
    
    // 根据足迹的第一个点生成描述
    let pointDescription = "";
    if (journey.first_point) {
        pointDescription = `${journey.first_point.time} · ${journey.first_point.location}`;
    }
    
    // 卡片HTML
    card.innerHTML = `
        <div class="h-48 bg-gray-300 dark:bg-gray-600 relative" style="background-image: url('${backgroundImage}'); background-size: cover; background-position: center;">
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                <div class="p-4 w-full">
                    <h3 class="text-white font-bold text-xl">${journey.title}</h3>
                    <p class="text-white/80 text-sm">${pointDescription}</p>
                </div>
            </div>
        </div>
        <div class="p-6">
            <p class="text-gray-600 dark:text-gray-300 mb-4">${journey.description}</p>
            <div class="flex items-center">
                <div class="rounded-full h-10 w-10 bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <span class="text-gray-600 dark:text-gray-300 font-bold">${journey.username.charAt(0).toUpperCase()}</span>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">${journey.username}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">浏览次数: ${journey.view_count}</p>
                </div>
            </div>
            <div class="mt-4 text-center">
                <button class="view-journey-btn text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center justify-center" data-journey-id="${journey.id}">
                    查看足迹
                    <svg xmlns="http://www.w3.org/2000/svg" class="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // 添加查看足迹点击事件
    const viewBtn = card.querySelector('.view-journey-btn');
    viewBtn.addEventListener('click', function() {
        const journeyId = this.getAttribute('data-journey-id');
        showJourneyDetail(journeyId);
    });
    
    return card;
}

/**
 * 加载更多足迹
 */
function loadMoreJourneys() {
    loadFeaturedJourneys(true);
}

/**
 * 显示足迹详情
 * @param {string} journeyId - 足迹ID
 */
function showJourneyDetail(journeyId) {
    // 显示模态框
    const modal = document.getElementById('journeyDetailModal');
    const contentDiv = document.getElementById('journeyDetailContent');
    const titleElement = document.getElementById('journeyDetailTitle');
    const viewFullBtn = document.getElementById('viewFullJourneyBtn');
    
    if (!modal || !contentDiv || !titleElement || !viewFullBtn) return;
    
    // 重置内容
    contentDiv.innerHTML = `
        <div class="loader mx-auto"></div>
        <p class="text-center my-4 text-gray-500 dark:text-gray-400">加载中...</p>
    `;
    
    // 显示模态框
    modal.classList.remove('hidden');
    
    // 从JSON文件获取足迹详情
    fetch('data/journey-details.json')
        .then(response => response.json())
        .then(allJourneys => {
            // 查找对应ID的足迹
            const journey = allJourneys[journeyId];
            
            if (!journey) {
                throw new Error('未找到足迹数据');
            }
            
            // 更新标题
            titleElement.textContent = journey.title;
            
            // 构建足迹点时间线
            let timelineHTML = `
                <div class="mb-6">
                    <p class="text-gray-600 dark:text-gray-300">${journey.description}</p>
                    <div class="flex items-center mt-3">
                        <div class="rounded-full h-8 w-8 bg-gray-300 dark:bg-gray-600 flex items-center justify-center mr-2">
                            <span class="text-gray-600 dark:text-gray-300 font-bold">${journey.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <span class="text-gray-700 dark:text-gray-300">${journey.username}</span>
                    </div>
                </div>
                <div class="space-y-6 mt-6">
            `;
            
            // 最多显示5个足迹点
            const displayPoints = journey.points.slice(0, 5);
            
            displayPoints.forEach((point, index) => {
                timelineHTML += `
                    <div class="relative pl-8 pb-1">
                        <div class="absolute left-0 top-0 rounded-full bg-indigo-500 w-4 h-4 mt-1"></div>
                        ${index < displayPoints.length - 1 ? '<div class="absolute left-2 top-4 bottom-0 w-0.5 bg-indigo-200 dark:bg-indigo-900"></div>' : ''}
                        <div>
                            <h4 class="text-lg font-medium text-gray-900 dark:text-white">${point.location}</h4>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${point.time}</p>
                            <p class="mt-2 text-gray-600 dark:text-gray-300">${point.content}</p>
                        </div>
                    </div>
                `;
            });
            
            // 如果足迹点超过5个，显示查看更多提示
            if (journey.points.length > 5) {
                timelineHTML += `
                    <div class="text-center pt-4">
                        <p class="text-indigo-600 dark:text-indigo-400">以上仅显示前5个足迹点，共${journey.points.length}个足迹点</p>
                    </div>
                `;
            }
            
            timelineHTML += '</div>';
            
            // 更新内容
            contentDiv.innerHTML = timelineHTML;
            
            // 更新查看完整足迹按钮链接
            viewFullBtn.href = `journey-view.html?id=${journeyId}`;
        })
        .catch(error => {
            console.error('获取足迹详情失败:', error);
            contentDiv.innerHTML = `
                <div class="text-center py-10">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-red-500">加载失败，请稍后重试</p>
                </div>
            `;
        });
}

/**
 * 处理留言表单提交
 * @param {Event} e - 表单提交事件
 */
function handleContactFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitMessageBtn');
    const statusDiv = document.getElementById('messageStatus');
    
    if (!submitBtn || !statusDiv) return;
    
    // 获取表单数据
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <div class="loader mr-2" style="width: 16px; height: 16px; border-width: 2px;"></div>
        提交中...
    `;
    
    // 模拟API请求
    setTimeout(() => {
        // 在实际环境中，这里应该调用API
        console.log('留言数据:', { name, email, message });
        
        // 成功提示
        statusDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
        statusDiv.classList.add('bg-green-100', 'text-green-700');
        statusDiv.textContent = '留言发送成功！我们会尽快回复您。';
        
        // 重置表单
        document.getElementById('contactForm').reset();
        
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '发送留言';
        
        // 5秒后隐藏状态信息
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }, 1500);
}

// 导出全局可访问的函数
window.FootprintMap = {
    formatDate,
    getCurrentUser,
    isUserLoggedIn,
    createNotification,
    loadFeaturedJourneys,
    loadMoreJourneys,
    showJourneyDetail
};