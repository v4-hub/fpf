/**
 * 足迹地图 - 足迹编辑页面JavaScript
 * 提供足迹编辑功能，包括基本信息编辑和足迹点增删改
 */

// 全局变量
let currentUser = null;
let journeyData = null;
let pointsData = [];
let isNewJourney = true;
let currentEditingPoint = null;
let isLocationPickingMode = false;
let isDirty = false;
let mapView = null;
let sceneView = null;
let activeView = null;
let graphicsLayer = null;
let selectedGraphic = null;
let confirmCallback = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查用户登录状态并处理UI
    checkUserAuthentication();
    
    // 初始化深色模式
    initDarkMode();
    
    // 初始化地图
    initializeMap();
    
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const journeyId = urlParams.get('id');
    
    if (journeyId) {
        // 编辑现有足迹
        isNewJourney = false;
        loadJourneyData(journeyId);
    } else {
        // 创建新足迹
        isNewJourney = true;
        initializeNewJourney();
    }
    
    // 添加事件监听器
    attachEventListeners();
    
    // 设置窗口关闭前提示
    window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
            // 显示确认对话框
            const confirmationMessage = '您有未保存的更改，确定要离开吗？';
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        }
    });
});

/**
 * 检查用户登录状态
 */
function checkUserAuthentication() {
    currentUser = getCurrentUser();
    
    if (currentUser) {
        // 用户已登录，显示控制台链接，隐藏登录链接
        document.getElementById('dashboardLink').classList.remove('hidden');
        document.getElementById('loginLink').classList.add('hidden');
    } else {
        // 用户未登录，隐藏控制台链接，显示登录链接
        document.getElementById('dashboardLink').classList.add('hidden');
        document.getElementById('loginLink').classList.remove('hidden');
        
        // 显示未授权对话框
        showUnauthorizedDialog();
    }
}

/**
 * 从localStorage获取当前用户信息
 * @returns {Object|null} 用户信息对象或null
 */
function getCurrentUser() {
    try {
        const userJson = localStorage.getItem('footprintMapCurrentUser');
        if (!userJson) return null;
        return JSON.parse(userJson);
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
}

/**
 * 初始化深色模式
 */
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            document.documentElement.classList.toggle('dark');
            document.body.classList.toggle('dark-theme');
            document.body.classList.toggle('light-theme');
            const currentMode = document.documentElement.classList.contains('dark');
            localStorage.setItem('darkMode', currentMode);
            
            // 如果地图已加载，更新地图主题
            if (activeView) {
                switchMapTheme(currentMode ? 'dark' : 'light');
            }
        });
        
        // 初始化主题
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
    }
}

/**
 * 初始化ArcGIS地图
 */
function initializeMap() {
    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/views/SceneView",
        "esri/layers/GraphicsLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/geometry/Polyline",
        "esri/widgets/Locate",
        "esri/widgets/Search",
        "esri/core/watchUtils"
    ], function(
        Map, MapView, SceneView, GraphicsLayer, Graphic, Point, Polyline, 
        Locate, Search, watchUtils
    ) {
        // 显示加载指示器
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = 'block';
        loadingIndicator.textContent = '初始化地图...';
        
        // 初始化地图
        const map = new Map({
            basemap: "streets",
            ground: "world-elevation"
        });
        
        // 初始化图层
        graphicsLayer = new GraphicsLayer({
            title: "足迹点图层"
        });
        map.add(graphicsLayer);
        
        // 初始化视图
        const container = "viewDiv";
        
        sceneView = new SceneView({
            container: container,
            map: map,
            zoom: 3,
            center: [108.9402, 34.3416] // 中国中心点
        });
        
        mapView = new MapView({
            container: null,
            map: map,
            zoom: 3,
            center: [108.9402, 34.3416]
        });
        
        // 设置活动视图为3D
        activeView = sceneView;
        
        // 添加定位小部件
        const locateWidget = new Locate({
            view: activeView,
            useHeadingEnabled: false,
            goToLocationEnabled: true
        });
        activeView.ui.add(locateWidget, "top-left");
        
        // 添加搜索小部件
        const searchWidget = new Search({
            view: activeView,
            locationEnabled: true,
            enableButtonMode: true,
            popupEnabled: true
        });
        activeView.ui.add(searchWidget, "top-right");
        
        // 监听视图点击
        activeView.on("click", function(event) {
            if (isLocationPickingMode) {
                // 在选择位置模式下，创建点
                handleLocationPick(event.mapPoint);
            } else if (document.getElementById('selectLocationBtn').classList.contains('active-tool')) {
                // 在选择模式下，检查是否点击了图形
                activeView.hitTest(event).then(function(response) {
                    if (response.results.length > 0) {
                        response.results.some(function(result) {
                            if (result.graphic && result.graphic.layer === graphicsLayer) {
                                // 如果点击了图形，设置为选中
                                selectedGraphic = result.graphic;
                                // 打开编辑对话框
                                openPointDialog('edit', selectedGraphic.attributes);
                                return true;
                            }
                        });
                    }
                });
            }
        });
        
        // 视图加载完成后
        activeView.when(function() {
            loadingIndicator.style.display = 'none';
            console.log("地图加载完成");
        });
        
        // 当地图类型改变时
        document.getElementById('modeToggleBtn').addEventListener('click', function() {
            // 切换视图类型
            if (activeView === mapView) {
                switchView(sceneView, mapView);
            } else {
                switchView(mapView, sceneView);
            }
        });
        
        // 切换地图视图
        function switchView(newView, oldView) {
            if (newView === oldView) return;
            
            // 获取当前视图的视点
            const viewpoint = oldView.viewpoint.clone();
            
            // 隐藏旧视图
            oldView.container = null;
            
            // 显示新视图
            newView.container = container;
            newView.viewpoint = viewpoint;
            
            // 更新活动视图
            activeView = newView;
            
            // 更新UI组件
            if (locateWidget) {
                locateWidget.view = activeView;
            }
            if (searchWidget) {
                searchWidget.view = activeView;
            }
            
            console.log("视图已切换到:", activeView === sceneView ? "3D" : "2D");
        }
    });
}

/**
 * 切换地图主题
 * @param {string} theme - 'dark' 或 'light'
 */
function switchMapTheme(theme) {
    // 更新CSS主题链接
    const themeLink = document.getElementById('esri-theme-css');
    themeLink.href = theme === 'dark' ? 
        'https://js.arcgis.com/4.29/esri/themes/dark/main.css' : 
        'https://js.arcgis.com/4.29/esri/themes/light/main.css';
    
    console.log("地图主题已切换为:", theme);
}

/**
 * 加载足迹数据
 * @param {string} journeyId - 足迹ID
 */
function loadJourneyData(journeyId) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    loadingIndicator.textContent = '加载足迹数据...';
    
    // 从服务器获取足迹数据
    fetch(`api/journeys/${journeyId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('足迹数据加载失败');
        }
        return response.json();
    })
    .then(data => {
        // 保存足迹数据
        journeyData = data;
        
        // 检查授权
        if (currentUser && journeyData.user_id !== currentUser.id) {
            // 如果当前用户不是足迹所有者，显示未授权对话框
            showUnauthorizedDialog();
            return;
        }
        
        // 填充表单数据
        populateJourneyForm(journeyData);
        
        // 获取足迹点数据
        if (journeyData.points && journeyData.points.length > 0) {
            pointsData = journeyData.points;
            // 绘制足迹点
            drawPointsOnMap();
            // 填充足迹点列表
            updatePointsList();
        }
        
        loadingIndicator.style.display = 'none';
    })
    .catch(error => {
        console.error('加载足迹数据错误:', error);
        showLoadingError('足迹数据加载失败：' + error.message);
        
        // 如果API调用失败，初始化为新足迹
        initializeNewJourney();
    });
}

/**
 * 初始化新足迹
 */
function initializeNewJourney() {
    // 初始化空数据
    journeyData = {
        title: '',
        description: '',
        user_id: currentUser ? currentUser.id : null,
        username: currentUser ? currentUser.username : '未知用户',
        created_at: new Date().toISOString(),
        points: []
    };
    
    pointsData = [];
    
    document.getElementById('loadingIndicator').style.display = 'none';
    updatePointsList();
}

/**
 * 填充足迹表单
 * @param {Object} data - 足迹数据
 */
function populateJourneyForm(data) {
    document.getElementById('journeyTitle').value = data.title || '';
    document.getElementById('journeyDescription').value = data.description || '';
}

/**
 * 在地图上绘制足迹点
 */
function drawPointsOnMap() {
    if (!graphicsLayer || !pointsData || pointsData.length === 0) return;
    
    // 清除现有图形
    graphicsLayer.removeAll();
    
    require(["esri/Graphic", "esri/geometry/Point"], function(Graphic, Point) {
        // 创建并添加点图形
        pointsData.forEach((point, index) => {
            // 跳过没有坐标的点
            if (!point.latitude || !point.longitude) return;
            
            // 创建点几何
            const pointGeometry = new Point({
                longitude: parseFloat(point.longitude),
                latitude: parseFloat(point.latitude)
            });
            
            // 创建符号
            const markerSymbol = {
                type: "simple-marker",
                color: [255, 100, 0, 0.8],
                size: 12,
                outline: {
                    color: [255, 255, 255, 0.7],
                    width: 1
                }
            };
            
            // 创建图形
            const pointGraphic = new Graphic({
                geometry: pointGeometry,
                symbol: markerSymbol,
                attributes: {
                    id: point.id || index,
                    name: point.location || `点 ${index + 1}`,
                    time: point.time || '',
                    date: point.date || '',
                    content: point.content || '',
                    latitude: point.latitude,
                    longitude: point.longitude,
                    index: index // 保存索引以便于引用
                }
            });
            
            // 添加到图层
            graphicsLayer.add(pointGraphic);
        });
        
        // 如果有坐标点，缩放到所有点
        if (graphicsLayer.graphics.length > 0 && activeView) {
            activeView.goTo(graphicsLayer.graphics.toArray());
        }
    });
}

/**
 * 更新足迹点列表
 */
function updatePointsList() {
    const pointsList = document.getElementById('pointsList');
    const emptyPlaceholder = document.querySelector('.empty-list-placeholder');
    
    // 清空列表
    pointsList.innerHTML = '';
    
    if (!pointsData || pointsData.length === 0) {
        // 显示空列表占位符
        if (emptyPlaceholder) {
            emptyPlaceholder.style.display = 'block';
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-list-placeholder';
            placeholder.textContent = '暂无足迹点，请点击"添加足迹点"按钮';
            pointsList.appendChild(placeholder);
        }
        return;
    }
    
    // 隐藏空列表占位符
    if (emptyPlaceholder) {
        emptyPlaceholder.style.display = 'none';
    }
    
    // 添加足迹点列表项
    pointsData.forEach((point, index) => {
        const pointItem = document.createElement('div');
        pointItem.className = 'point-item';
        pointItem.dataset.index = index;
        
        // 创建拖动手柄
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" />
            </svg>
        `;
        
        // 创建内容
        const content = document.createElement('div');
        content.className = 'point-content';
        content.innerHTML = `
            <div class="point-title">${point.location || `点 ${index + 1}`}</div>
            <div class="point-time">${point.time || '未设置时间'}</div>
        `;
        
        // 创建操作按钮
        const actions = document.createElement('div');
        actions.className = 'point-actions';
        
        // 编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'point-edit-btn';
        editButton.title = '编辑';
        editButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
        `;
        editButton.addEventListener('click', () => {
            openPointDialog('edit', pointsData[index]);
        });
        
        // 删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'point-delete-btn';
        deleteButton.title = '删除';
        deleteButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
        `;
        deleteButton.addEventListener('click', () => {
            showConfirmDialog(
                '删除足迹点',
                `确定要删除足迹点"${point.location || `点 ${index + 1}`}"吗？`,
                () => deletePoint(index)
            );
        });
        
        // 显示定位按钮
        const locateButton = document.createElement('button');
        locateButton.className = 'point-locate-btn';
        locateButton.title = '在地图上定位';
        locateButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
        `;
        locateButton.addEventListener('click', () => {
            panToPoint(point);
        });
        
        // 添加按钮到操作容器
        actions.appendChild(locateButton);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        
        // 添加元素到列表项
        pointItem.appendChild(dragHandle);
        pointItem.appendChild(content);
        pointItem.appendChild(actions);
        
        // 点击列表项定位到地图上的点
        content.addEventListener('click', () => {
            panToPoint(point);
        });
        
        // 添加到列表
        pointsList.appendChild(pointItem);
    });
    
    // 初始化拖拽排序
    initDragAndDrop();
}

/**
 * 初始化拖拽排序功能
 */
function initDragAndDrop() {
    const pointsList = document.getElementById('pointsList');
    const items = pointsList.querySelectorAll('.point-item');
    
    items.forEach(item => {
        const dragHandle = item.querySelector('.drag-handle');
        
        dragHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            
            // 当前拖动项的索引
            const itemIndex = parseInt(item.dataset.index);
            
            // 复制当前项用于拖动显示
            const clone = item.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.zIndex = '1000';
            clone.style.opacity = '0.8';
            clone.style.width = item.offsetWidth + 'px';
            document.body.appendChild(clone);
            
            // 设置初始位置
            let offsetX = e.clientX - item.getBoundingClientRect().left;
            let offsetY = e.clientY - item.getBoundingClientRect().top;
            clone.style.left = (e.pageX - offsetX) + 'px';
            clone.style.top = (e.pageY - offsetY) + 'px';
            
            // 高亮当前项
            item.style.opacity = '0.5';
            
            // 拖动过程
            function moveItem(e) {
                clone.style.left = (e.pageX - offsetX) + 'px';
                clone.style.top = (e.pageY - offsetY) + 'px';
                
                // 检测与其他项的位置关系
                items.forEach(otherItem => {
                    const otherIndex = parseInt(otherItem.dataset.index);
                    if (otherItem !== item) {
                        const rect = otherItem.getBoundingClientRect();
                        
                        // 检查鼠标是否在另一个项上
                        if (e.clientY > rect.top && e.clientY < rect.bottom) {
                            // 交换位置
                            if (itemIndex < otherIndex) {
                                pointsList.insertBefore(item, otherItem.nextSibling);
                            } else {
                                pointsList.insertBefore(item, otherItem);
                            }
                            
                            // 更新数据顺序
                            reorderPoints(itemIndex, otherIndex);
                            
                            // 更新项索引
                            updateItemIndices();
                        }
                    }
                });
            }
            
            // 拖动结束
            function releaseItem() {
                document.removeEventListener('mousemove', moveItem);
                document.removeEventListener('mouseup', releaseItem);
                
                // 删除克隆
                document.body.removeChild(clone);
                
                // 恢复原项样式
                item.style.opacity = '1';
                
                // 重新绘制点
                drawPointsOnMap();
                
                // 标记为已修改
                setDirty(true);
            }
            
            document.addEventListener('mousemove', moveItem);
            document.addEventListener('mouseup', releaseItem);
        });
    });
}

/**
 * 更新项索引
 */
function updateItemIndices() {
    const items = document.querySelectorAll('.point-item');
    items.forEach((item, index) => {
        item.dataset.index = index;
    });
}

/**
 * 重新排序点
 * @param {number} fromIndex - 原始索引
 * @param {number} toIndex - 目标索引
 */
function reorderPoints(fromIndex, toIndex) {
    // 获取要移动的项
    const item = pointsData[fromIndex];
    
    // 删除原始位置的项
    pointsData.splice(fromIndex, 1);
    
    // 在新位置插入
    pointsData.splice(toIndex, 0, item);
}

/**
 * 在地图上定位到点
 * @param {Object} point - 足迹点数据
 */
function panToPoint(point) {
    if (!activeView || !point.latitude || !point.longitude) return;
    
    require(["esri/geometry/Point"], function(Point) {
        const pointGeometry = new Point({
            longitude: parseFloat(point.longitude),
            latitude: parseFloat(point.latitude)
        });
        
        activeView.goTo({
            target: pointGeometry,
            zoom: activeView.type === '3d' ? 12 : 15
        }, {
            duration: 1000
        });
    });
}

/**
 * 打开足迹点编辑对话框
 * @param {string} mode - 'add' 或 'edit'
 * @param {Object} point - 编辑时的点数据
 */
function openPointDialog(mode, point = null) {
    const dialog = document.getElementById('pointEditDialog');
    const dialogTitle = document.getElementById('dialogTitle');
    const deleteBtn = document.getElementById('deletePointBtn');
    
    // 设置对话框模式和标题
    if (mode === 'add') {
        dialogTitle.textContent = '添加足迹点';
        deleteBtn.classList.add('hidden');
        // 初始化表单
        document.getElementById('pointName').value = '';
        document.getElementById('pointTime').value = '';
        document.getElementById('pointDate').value = '';
        document.getElementById('pointContent').value = '';
        document.getElementById('pointLatitude').value = '';
        document.getElementById('pointLongitude').value = '';
        
        currentEditingPoint = null;
    } else {
        dialogTitle.textContent = '编辑足迹点';
        deleteBtn.classList.remove('hidden');
        
        // 填充表单
        document.getElementById('pointName').value = point.location || '';
        document.getElementById('pointTime').value = point.time || '';
        document.getElementById('pointDate').value = point.date || '';
        document.getElementById('pointContent').value = point.content || '';
        document.getElementById('pointLatitude').value = point.latitude || '';
        document.getElementById('pointLongitude').value = point.longitude || '';
        
        currentEditingPoint = point;
    }
    
    // 显示对话框
    dialog.classList.remove('hidden');
}

/**
 * 添加新足迹点
 */
function addPoint() {
    // 获取表单数据
    const name = document.getElementById('pointName').value;
    const time = document.getElementById('pointTime').value;
    const date = document.getElementById('pointDate').value;
    const content = document.getElementById('pointContent').value;
    const latitude = document.getElementById('pointLatitude').value;
    const longitude = document.getElementById('pointLongitude').value;
    
    // 简单验证
    if (!name) {
        showNotification('请输入地点名称', 'error');
        return false;
    }
    
    if (!latitude || !longitude) {
        showNotification('请输入坐标或在地图上选择位置', 'error');
        return false;
    }
    
    // 创建新点
    const newPoint = {
        location: name,
        time: time,
        date: date,
        content: content,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
    };
    
    // 添加到数据
    pointsData.push(newPoint);
    
    // 更新UI
    updatePointsList();
    drawPointsOnMap();
    
    // 关闭对话框
    closePointDialog();
    
    // 设置为已修改
    setDirty(true);
    
    showNotification('足迹点已添加', 'success');
    return true;
}

/**
 * 更新足迹点
 */
function updatePoint() {
    if (!currentEditingPoint) return false;
    
    // 获取表单数据
    const name = document.getElementById('pointName').value;
    const time = document.getElementById('pointTime').value;
    const date = document.getElementById('pointDate').value;
    const content = document.getElementById('pointContent').value;
    const latitude = document.getElementById('pointLatitude').value;
    const longitude = document.getElementById('pointLongitude').value;
    
    // 简单验证
    if (!name) {
        showNotification('请输入地点名称', 'error');
        return false;
    }
    
    if (!latitude || !longitude) {
        showNotification('请输入坐标或在地图上选择位置', 'error');
        return false;
    }
    
    // 查找点的索引
    let pointIndex = -1;
    if (typeof currentEditingPoint.index === 'number') {
        pointIndex = currentEditingPoint.index;
    } else {
        pointIndex = pointsData.findIndex(p => 
            p.id === currentEditingPoint.id || 
            (p.location === currentEditingPoint.location && 
             p.latitude === currentEditingPoint.latitude && 
             p.longitude === currentEditingPoint.longitude)
        );
    }
    
    if (pointIndex === -1) {
        console.error('找不到要编辑的足迹点');
        return false;
    }
    
    // 更新数据
    pointsData[pointIndex] = {
        ...pointsData[pointIndex],
        location: name,
        time: time,
        date: date,
        content: content,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
    };
    
    // 更新UI
    updatePointsList();
    drawPointsOnMap();
    
    // 关闭对话框
    closePointDialog();
    
    // 设置为已修改
    setDirty(true);
    
    showNotification('足迹点已更新', 'success');
    return true;
}

/**
 * 删除足迹点
 * @param {number} index - 点的索引
 */
function deletePoint(index) {
    // 删除数据
    pointsData.splice(index, 1);
    
    // 更新UI
    updatePointsList();
    drawPointsOnMap();
    
    // 设置为已修改
    setDirty(true);
    
    showNotification('足迹点已删除', 'success');
}

/**
 * 关闭足迹点对话框
 */
function closePointDialog() {
    document.getElementById('pointEditDialog').classList.add('hidden');
    currentEditingPoint = null;
    isLocationPickingMode = false;
}

/**
 * 保存足迹
 */
function saveJourney() {
    // 检查登录状态
    if (!currentUser) {
        showUnauthorizedDialog();
        return;
    }
    
    // 获取表单数据
    const title = document.getElementById('journeyTitle').value;
    const description = document.getElementById('journeyDescription').value;
    
    // 简单验证
    if (!title) {
        showNotification('请输入足迹标题', 'error');
        return;
    }
    
    // 准备保存数据
    const saveData = {
        ...journeyData,
        title: title,
        description: description,
        user_id: currentUser.id,
        points: pointsData
    };
    
    // 显示加载指示器
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    loadingIndicator.textContent = isNewJourney ? '创建足迹...' : '保存足迹...';
    
    // 确定请求方法和URL
    const method = isNewJourney ? 'POST' : 'PUT';
    const url = isNewJourney ? 'api/journeys' : `api/journeys/${journeyData.id}`;
    
    // 发送请求
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(isNewJourney ? '创建足迹失败' : '保存足迹失败');
        }
        return response.json();
    })
    .then(data => {
        // 更新数据
        journeyData = data;
        if (data.points) {
            pointsData = data.points;
        }
        
        // 更新UI
        updatePointsList();
        drawPointsOnMap();
        
        // 不再是新足迹
        isNewJourney = false;
        
        // 重置脏标记
        setDirty(false);
        
        loadingIndicator.style.display = 'none';
        
        showNotification(isNewJourney ? '足迹创建成功' : '足迹保存成功', 'success');
        
        // 如果是新创建的足迹，更新URL
        if (data.id && !window.location.search.includes('id=')) {
            const newUrl = window.location.pathname + '?id=' + data.id;
            window.history.pushState({}, '', newUrl);
        }
    })
    .catch(error => {
        console.error('保存足迹错误:', error);
        loadingIndicator.style.display = 'none';
        showNotification('保存失败: ' + error.message, 'error');
    });
}

/**
 * 处理位置选择
 * @param {Object} mapPoint - 地图上的点
 */
function handleLocationPick(mapPoint) {
    if (!mapPoint) return;
    
    // 更新坐标输入框
    document.getElementById('pointLatitude').value = mapPoint.latitude.toFixed(6);
    document.getElementById('pointLongitude').value = mapPoint.longitude.toFixed(6);
    
    // 关闭位置选择模式
    isLocationPickingMode = false;
    
    // 高亮显示坐标输入
    const latitudeInput = document.getElementById('pointLatitude');
    const longitudeInput = document.getElementById('pointLongitude');
    
    latitudeInput.classList.add('highlight');
    longitudeInput.classList.add('highlight');
    
    setTimeout(() => {
        latitudeInput.classList.remove('highlight');
        longitudeInput.classList.remove('highlight');
    }, 1500);
    
    showNotification('位置已更新', 'success');
}

/**
 * 设置脏标记（未保存状态）
 * @param {boolean} value - 是否有未保存的更改
 */
function setDirty(value) {
    isDirty = value;
    
    // 可以在这里更新UI提示未保存状态
    const saveButton = document.getElementById('saveJourneyBtn');
    if (saveButton) {
        if (isDirty) {
            saveButton.classList.add('dirty');
        } else {
            saveButton.classList.remove('dirty');
        }
    }
}

/**
 * 显示通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型 ('success', 'error', 'warning', 'info')
 */
function showNotification(message, type = 'info') {
    // 创建或获取通知容器
    let notificationContainer = document.getElementById('notificationContainer');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        notificationContainer.style.display = 'flex';
        notificationContainer.style.flexDirection = 'column';
        notificationContainer.style.gap = '10px';
        document.body.appendChild(notificationContainer);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '6px';
    notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    notification.style.maxWidth = '300px';
    notification.style.transition = 'all 0.3s ease';
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    // 根据类型设置样式
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10B981';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#EF4444';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.backgroundColor = '#F59E0B';
            notification.style.color = 'white';
            break;
        default:
            notification.style.backgroundColor = '#3B82F6';
            notification.style.color = 'white';
    }
    
    notification.textContent = message;
    
    // 添加到容器
    notificationContainer.appendChild(notification);
    
    // 触发动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    
    // 设置自动消失
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        // 移除元素
        setTimeout(() => {
            notificationContainer.removeChild(notification);
        }, 300);
    }, 4000);
}

/**
 * 显示未授权对话框
 */
function showUnauthorizedDialog() {
    document.getElementById('unauthorizedDialog').classList.remove('hidden');
}

/**
 * 显示确认对话框
 * @param {string} title - 对话框标题
 * @param {string} message - 确认消息
 * @param {Function} callback - 确认后的回调函数
 */
function showConfirmDialog(title, message, callback) {
    const dialog = document.getElementById('confirmDialog');
    const titleElement = document.getElementById('confirmTitle');
    const messageElement = document.getElementById('confirmMessage');
    
    // 设置内容
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    // 保存回调
    confirmCallback = callback;
    
    // 显示对话框
    dialog.classList.remove('hidden');
}

/**
 * 显示加载错误
 * @param {string} message - 错误消息
 */
function showLoadingError(message) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.innerHTML = `<div class="error-message">${message}</div>`;
    loadingIndicator.classList.add('error');
    
    setTimeout(() => {
        loadingIndicator.style.display = 'none';
        loadingIndicator.innerHTML = '正在加载...';
        loadingIndicator.classList.remove('error');
    }, 5000);
}

/**
 * 附加事件监听器
 */
function attachEventListeners() {
    // 添加足迹点按钮
    document.getElementById('addPointBtn').addEventListener('click', () => {
        openPointDialog('add');
    });
    
    // 保存足迹按钮
    document.getElementById('saveJourneyBtn').addEventListener('click', saveJourney);
    
    // 取消编辑按钮
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        // 如果有未保存的更改，显示确认对话框
        if (isDirty) {
            showConfirmDialog(
                '取消编辑',
                '您有未保存的更改，确定要取消吗？',
                () => {
                    window.location.href = 'dashboard.html';
                }
            );
        } else {
            window.location.href = 'dashboard.html';
        }
    });
    
    // 收起/展开编辑面板
    document.getElementById('toggleEditPanel').addEventListener('click', () => {
        const editPanel = document.getElementById('editPanel');
        editPanel.classList.toggle('collapsed');
    });
    
    // 地图工具栏
    document.getElementById('addLocationBtn').addEventListener('click', function() {
        toggleMapTool(this, 'addLocationBtn');
    });
    
    document.getElementById('selectLocationBtn').addEventListener('click', function() {
        toggleMapTool(this, 'selectLocationBtn');
    });
    
    document.getElementById('resetViewBtn').addEventListener('click', () => {
        // 重置地图视图
        if (activeView && graphicsLayer) {
            if (graphicsLayer.graphics.length > 0) {
                activeView.goTo(graphicsLayer.graphics.toArray());
            } else {
                // 默认中国中心点
                activeView.goTo({
                    center: [108.9402, 34.3416],
                    zoom: 3
                });
            }
        }
    });
    
    // 保存点按钮
    document.getElementById('savePointBtn').addEventListener('click', () => {
        if (currentEditingPoint) {
            updatePoint();
        } else {
            addPoint();
        }
    });
    
    // 删除点按钮
    document.getElementById('deletePointBtn').addEventListener('click', () => {
        if (currentEditingPoint) {
            // 查找点的索引
            let pointIndex = -1;
            if (typeof currentEditingPoint.index === 'number') {
                pointIndex = currentEditingPoint.index;
            } else {
                pointIndex = pointsData.findIndex(p => 
                    p.id === currentEditingPoint.id || 
                    (p.location === currentEditingPoint.location && 
                     p.latitude === currentEditingPoint.latitude && 
                     p.longitude === currentEditingPoint.longitude)
                );
            }
            
            if (pointIndex !== -1) {
                showConfirmDialog(
                    '删除足迹点',
                    `确定要删除足迹点"${currentEditingPoint.location || `点 ${pointIndex + 1}`}"吗？`,
                    () => {
                        deletePoint(pointIndex);
                        closePointDialog();
                    }
                );
            }
        }
    });
    
    // 地图选择位置按钮
    document.getElementById('mapPickLocationBtn').addEventListener('click', () => {
        isLocationPickingMode = true;
        document.getElementById('pointEditDialog').classList.add('hidden');
        
        // 激活添加位置工具
        toggleMapTool(document.getElementById('addLocationBtn'), 'addLocationBtn');
        
        showNotification('请在地图上点击选择位置', 'info');
    });
    
    // 关闭对话框按钮
    document.getElementById('closeDialogBtn').addEventListener('click', closePointDialog);
    document.getElementById('cancelDialogBtn').addEventListener('click', closePointDialog);
    
    // 关闭未授权对话框按钮
    document.querySelectorAll('.close-unauthorized-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('unauthorizedDialog').classList.add('hidden');
            window.location.href = 'dashboard.html';
        });
    });
    
    // 确认对话框按钮
    document.getElementById('confirmYesBtn').addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
        document.getElementById('confirmDialog').classList.add('hidden');
    });
    
    document.getElementById('confirmNoBtn').addEventListener('click', () => {
        confirmCallback = null;
        document.getElementById('confirmDialog').classList.add('hidden');
    });
    
    document.querySelector('.close-confirm-btn').addEventListener('click', () => {
        confirmCallback = null;
        document.getElementById('confirmDialog').classList.add('hidden');
    });
    
    // 表单字段变化监听
    ['journeyTitle', 'journeyDescription'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            setDirty(true);
        });
    });
}

/**
 * 切换地图工具
 * @param {HTMLElement} button - 按钮元素
 * @param {string} toolId - 工具ID
 */
function toggleMapTool(button, toolId) {
    // 取消所有活动工具
    document.querySelectorAll('#mapTools button').forEach(btn => {
        btn.classList.remove('active-tool');
    });
    
    // 激活当前工具
    button.classList.add('active-tool');
    
    if (toolId === 'addLocationBtn') {
        // 设置为添加位置模式
        isLocationPickingMode = true;
        
        // 修改鼠标光标
        if (activeView) {
            activeView.container.style.cursor = 'crosshair';
        }
    } else {
        // 取消位置选择模式
        isLocationPickingMode = false;
        
        // 恢复默认光标
        if (activeView) {
            activeView.container.style.cursor = 'default';
        }
    }
}