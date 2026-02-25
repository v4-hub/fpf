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
    // 初始化各种功能（AOS已移除，使用CSS动画代替）
    
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
    
    // 从API获取数据
    fetch(`/api/featured-journeys?limit=${journeysPerPage}&offset=${currentJourneyOffset}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // 隐藏加载提示
            journeyCardLoader.classList.add('hidden');
            
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
            
            // 如果返回的数据少于每页数量，说明没有更多了
            if (data.length < journeysPerPage) {
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
    card.className = "rounded-xl overflow-hidden shadow-lg border border-white/10 transition-transform duration-300 hover:-translate-y-2";
    card.style.background = "rgba(20,20,28,0.7)";
    card.style.backdropFilter = "blur(10px)";
    
    // 设置封面背景（使用示例图片或上传的图片）
    let backgroundImage = journey.cover_image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=60';
    
    // 根据足迹的第一个点生成描述
    let pointDescription = "";
    if (journey.first_point) {
        pointDescription = `${journey.first_point.time || ''} · ${journey.first_point.location || ''}`;
    }
    
    // 卡片HTML
    card.innerHTML = `
        <div class="h-48 bg-gray-800 relative" style="background-image: url('${backgroundImage}'); background-size: cover; background-position: center;">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                <div class="p-4 w-full">
                    <h3 class="text-white font-bold text-xl">${journey.title}</h3>
                    <p class="text-white/70 text-sm">${pointDescription}</p>
                </div>
            </div>
        </div>
        <div class="p-6">
            <p class="text-gray-400 mb-4 text-sm leading-relaxed line-clamp-3">${journey.description || ''}</p>
            <div class="flex items-center">
                <div class="rounded-full h-10 w-10 bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                    ${journey.avatar ? `<img src="${journey.avatar}" class="w-full h-full object-cover">` : 
                    `<span class="text-indigo-300 font-bold">${(journey.username || 'U').charAt(0).toUpperCase()}</span>`}
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-white">${journey.username || 'Unknown'}</p>
                    <p class="text-xs text-gray-500">浏览: ${journey.view_count || 0}</p>
                </div>
            </div>
            <div class="mt-4 text-center">
                <a href="journey-view-3d.html?id=${journey.id}" class="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors">
                    探索3D足迹
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </a>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * 加载更多足迹
 */
function loadMoreJourneys() {
    loadFeaturedJourneys(true);
}

/**
 * 显示足迹详情 (已废弃，直接跳转到详情页)
 * @param {string} journeyId - 足迹ID
 */
function showJourneyDetail(journeyId) {
    window.location.href = `journey-view.html?id=${journeyId}`;
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
    
    // 调用API
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, message })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 成功提示
            statusDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
            statusDiv.classList.add('bg-green-100', 'text-green-700');
            statusDiv.textContent = '留言发送成功！我们会尽快回复您。';
            
            // 重置表单
            document.getElementById('contactForm').reset();
        } else {
             throw new Error(data.error || '提交失败');
        }
    })
    .catch(error => {
        console.error('留言提交失败:', error);
        statusDiv.classList.remove('hidden', 'bg-green-100', 'text-green-700');
        statusDiv.classList.add('bg-red-100', 'text-red-700');
        statusDiv.textContent = '发送失败，请稍后重试。';
    })
    .finally(() => {
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '发送留言';
        
        // 5秒后隐藏状态信息
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    });
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