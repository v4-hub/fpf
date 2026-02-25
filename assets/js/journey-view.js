/**
 * 足迹地图 - 3D足迹查看页面JavaScript
 * 基于ArcGIS API 4.x提供3D和2D视图的足迹地图展示
 */


// --- Initial page load logic (outside initializeMap) ---
document.addEventListener('DOMContentLoaded', function() {
    // Check user login status and update header UI
    checkUserAuthentication(); // Assumes this function updates header links

    // Initialize dark mode based on preference
    initDarkMode(); // Assumes this function sets initial theme

    // Get journey ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const journeyId = urlParams.get('id');

    if (!journeyId) {
        showError('错误：URL中缺少足迹ID (id=...)', true);
        disableControls(); // Disable controls if no ID
        return;
    }

    // Load the journey data, which will then call initializeMap
    loadJourneyData(journeyId);

    // Initial setup for settings panel sliders (if elements exist)
    // setupSettingsPanel(); // Moved inside initializeMap after view is ready

});

/**
 * 检查用户登录状态
 */
function checkUserAuthentication() {
    const currentUser = getCurrentUser();
    
    if (currentUser) {
        // 用户已登录，显示控制台链接，隐藏登录链接
        document.getElementById('dashboardLink').classList.remove('hidden');
        document.getElementById('loginLink').classList.add('hidden');
    } else {
        // 用户未登录，隐藏控制台链接，显示登录链接
        document.getElementById('dashboardLink').classList.add('hidden');
        document.getElementById('loginLink').classList.remove('hidden');
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
            if (window.appState && window.appState.activeView) {
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
 * 加载足迹数据
 * @param {string} journeyId - 足迹ID
 */
async function loadJourneyData(journeyId) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    showLoadingIndicator(loadingIndicator, '加载足迹数据...');

    try {
        // Try fetching from the API first
        // Include token if user is logged in, backend checks permissions
        const endpoint = `/journeys/${journeyId}`;
        const token = localStorage.getItem('authToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, { // Assuming API_BASE_URL is defined globally or pass it
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
             if(response.status === 404) throw new Error('足迹未找到 (404)');
             if(response.status === 403) throw new Error('无权访问此足迹 (403)');
             let errorText = response.statusText;
             try {
                  const errorJson = await response.json();
                  errorText = errorJson.error || errorText;
             } catch(e) { /* ignore json parsing error */ }
             throw new Error(`加载足迹失败: ${errorText} (${response.status})`);
        }

        const journeyData = await response.json();

        if (!journeyData || !journeyData.points) {
             throw new Error('从API获取的足迹数据无效或缺少点数据');
        }

        console.log("API Data Loaded:", journeyData);
        updateJourneyMetadata(journeyData);
        initializeMap(journeyData); // Pass the loaded data with points

    } catch (error) {
        console.error('加载足迹数据错误:', error);
        // Fallback to local test data *only if* API fails network-wise or returns specific errors maybe
        // But for now, just show the error clearly. The original JSON error means the URL was likely wrong or server misconfigured.
        showError(`加载失败: ${error.message}. 请检查网络连接和足迹ID。`, true); // Make error permanent
        hideLoadingIndicator(loadingIndicator); // Hide loader on error
        // loadLocalTestData(journeyId); // Optionally uncomment to force local data on ANY fetch error
    }
}


/**
 * 更新足迹元数据 (Keep existing function)
 */
function updateJourneyMetadata(journeyData) {
    // ... (same as before) ...
    document.title = `${journeyData.title || '足迹地图'} - 足迹地图`;
    document.getElementById('journeyTitle').textContent = journeyData.title || '无标题';
    document.getElementById('journeyAuthor').textContent = journeyData.username || '未知用户';
    document.getElementById('journeyCreatedAt').textContent = formatDate(journeyData.created_at);
    document.getElementById('journeyViewCount').textContent = journeyData.view_count || 0;
    document.getElementById('journeyPointCount').textContent = journeyData.points?.length || 0;
}

/**
 * 格式化日期
 * @param {string} dateString - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateString) {
    if (!dateString) return '未知日期';
    
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * 加载本地测试数据
 * @param {string} journeyId - 足迹ID
 */
function loadLocalTestData(journeyId) {
    // 如果API获取失败，使用本地测试数据
    console.log('使用本地测试数据...');
    
    const testJourneyData = {
        id: journeyId || '1',
        title: '饶宗颐先生生平足迹',
        username: '赵刚',
        created_at: '2023-06-15',
        updated_at: '2023-06-15',
        view_count: 560,
        description: '记录了饶宗颐先生的重要人生历程和学术足迹',
        csvUrl: 'rao.csv',
        points: []
    };
    
    updateJourneyMetadata(testJourneyData);
    initializeMap(testJourneyData);
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 * @param {boolean} isPermenant - 是否为永久错误
 */
function showError(message, isPermenant = false) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    loadingIndicator.textContent = message;
    loadingIndicator.className = 'error-indicator';
    
    if (!isPermenant) {
        setTimeout(() => {
            loadingIndicator.style.display = 'none';
        }, 5000);
    }
    
    console.error(message);
}

/**
 * 显示加载指示器 (Helper)
 */
function showLoadingIndicator(element, text = '加载中...') {
    if (element) {
        element.style.display = 'block';
        element.textContent = text;
        element.className = 'loading-indicator'; // Reset class
    }
}

/**
 * 隐藏加载指示器 (Helper)
 */
function hideLoadingIndicator(element) {
    if (element) {
        element.style.display = 'none';
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


// --- Add API_BASE_URL ---
// Make sure this matches where your Flask API is running
const API_BASE_URL = '/api';

/**
 * 初始化地图
 * @param {Object} journeyData - 足迹数据
 */
function initializeMap(journeyData) {
    // Ensure points data is present
    if (!journeyData || !journeyData.points) {
        showError("地图初始化失败：缺少足迹点数据。", true);
        hideLoadingIndicator(document.getElementById('loadingIndicator'));
        disableControls(); // Disable map controls if no data
        return;
    }

    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/views/SceneView",
        "esri/layers/GraphicsLayer",
        "esri/Basemap",
        "esri/Graphic",
        "esri/geometry/geometryEngine", // Keep for geodesic lines if needed
        "esri/geometry/Polyline",
        "esri/geometry/Point",
        "esri/PopupTemplate" // Import PopupTemplate
    ], function (
        Map, MapView, SceneView, GraphicsLayer, Basemap, Graphic,
        geometryEngine, Polyline, Point, PopupTemplate // Add PopupTemplate here
    ) {
        // --- Core Variables ---
        let map;
        let pointsLayer; // Changed from csvLayer
        let animationLayer;
        let connectionsLayer;
        let sortedPointsData = []; // Will hold the points data from journeyData
        let pointGraphics = []; // To store the created graphics
        let currentIndex = 0;
        let isPlaying = false;
        let playTimeout = null;
        let currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        let isAnimating = false;
        let isSettingCenter = false;
        let centerPointClickHandle = null;
        let customCenterPoint = null;

        // Default center (use journey's first point or fallback)
        const firstValidPoint = journeyData.points.find(p => p.latitude && p.longitude);
        const DEFAULT_CENTER_LON = firstValidPoint ? parseFloat(firstValidPoint.longitude) : 113.2644;
        const DEFAULT_CENTER_LAT = firstValidPoint ? parseFloat(firstValidPoint.latitude) : 23.1291;

        // --- Settings (keep defaults or load from user settings if needed) ---
        let PRE_ANIM_ZOOM_DURATION = 600;
        let ANIMATION_DURATION = 1500;
        let POPUP_DELAY = 5000; // Default 5 seconds
        let MAX_ARC_HEIGHT = 50000; // Default 50km

        window.appState = {
            mapView: null,
            sceneView: null,
            activeView: null,
            container: "viewDiv"
        };

        // --- DOM Elements ---
        const loadingIndicator = document.getElementById('loadingIndicator');
        const controlsDiv = document.getElementById('controls');
        // ... (get other buttons and panels as before) ...
        const prevBtn = document.getElementById('prevBtn');
        const playBtn = document.getElementById('playBtn');
        const nextBtn = document.getElementById('nextBtn');
        const resetBtn = document.getElementById('resetBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const globalBtn = document.getElementById('globalBtn');
        const allBtn = document.getElementById('allBtn');
        const themeLink = document.getElementById('esri-theme-css');
        const settingsPanel = document.getElementById('settingsPanel');
        const themeSubBtn = document.getElementById('themeSubBtn');
        const setCenterBtn = document.getElementById('setCenterBtn');
        const centerPointFeedback = document.getElementById('centerPointFeedback');
        const speedSlider = document.getElementById('speedSlider');
        const speedValueSpan = document.getElementById('speedValue');
        const popupSlider = document.getElementById('popupSlider');
        const popupValueSpan = document.getElementById('popupValue');
        const altitudeSlider = document.getElementById('altitudeSlider');
        const altitudeValueSpan = document.getElementById('altitudeValue');
        const showListBtn = document.getElementById('showListBtn');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const footprintsListPanel = document.getElementById('footprintsListPanel');
        const footprintsListUl = document.getElementById('footprintsList');
        const closeListBtn = document.getElementById('closeListBtn');


        // --- Popup Template for Graphics ---
        const pointPopupTemplate = new PopupTemplate({
            title: "{location} ({time})", // Use attributes from the graphic
            content: [{
                type: "fields",
                fieldInfos: [
                    { fieldName: "exact_date", label: "日期" },
                    { fieldName: "content", label: "事件" }
                    // Add more fields if they exist in your point attributes
                ]
            }]
        });


        // --- Initialization Function ---
        async function initialize() {
            disableControls();
            showLoadingIndicator(loadingIndicator, '初始化地图...');

            map = new Map({
                basemap: currentTheme === 'dark' ? "dark-gray-vector" : "satellite", // Or use topographic, streets-vector etc.
                ground: "world-elevation"
            });

            // Use GraphicsLayer for points from JSON
            pointsLayer = new GraphicsLayer({
                title: "足迹点",
                elevationInfo: { mode: "on-the-ground" } // Or relative-to-ground if Z matters
            });

            animationLayer = new GraphicsLayer({ listMode: "hide", title: "动画层", elevationInfo: { mode: "relative-to-ground" } });
            connectionsLayer = new GraphicsLayer({ listMode: "hide", title: "连接线层" });

            map.addMany([pointsLayer, connectionsLayer, animationLayer]);

            // Process points data (sorting, creating graphics)
            processPointsData(journeyData.points); // New function call

            const commonViewParams = {
                map: map,
                popup: {
                    dockEnabled: false,
                    visibleElements: { collapseButton: false },
                    highlightEnabled: true
                }
            };

            window.appState.sceneView = new SceneView({
                ...commonViewParams,
                container: window.appState.container
            });
            window.appState.activeView = window.appState.sceneView;
            window.appState.mapView = new MapView({
                ...commonViewParams,
                container: null
            });

            attachClickListeners(window.appState.mapView);
            attachClickListeners(window.appState.sceneView);

            showLoadingIndicator(loadingIndicator, '渲染地图...');

            // Wait for the view to be ready
            await window.appState.activeView.when();

            // Zoom to points after view is ready
            zoomToAllPoints();

            // Setup UI elements
            setupSettingsPanel(); // Setup sliders etc.
            populateFootprintsList(); // Populate the side list
            enableControls(); // Enable buttons now that data is ready
            hideLoadingIndicator(loadingIndicator);
            controlsDiv.style.display = 'flex';
            console.log("Map Initialized Successfully");
        }

        /**
         * Process points array from JSON: sort and create graphics
         * @param {Array} points - Array of point objects from journeyData
         */
        function processPointsData(points) {
            if (!points || points.length === 0) {
                console.warn("No points found in journey data.");
                sortedPointsData = [];
                pointGraphics = [];
                return;
            }

            // 1. Sort points (using order_index primarily, fallback to date if needed)
            sortedPointsData = points.sort((a, b) => {
                 // Prefer order_index if it exists and is valid
                 const orderA = typeof a.order_index === 'number' ? a.order_index : Infinity;
                 const orderB = typeof b.order_index === 'number' ? b.order_index : Infinity;

                 if (orderA !== Infinity || orderB !== Infinity) {
                     return orderA - orderB;
                 }

                 // Fallback to date if order_index is missing/invalid
                const dateA = a.exact_date ? new Date(a.exact_date.replace(/\//g, '-')) : null; // Handle YYYY/MM/DD
                const dateB = b.exact_date ? new Date(b.exact_date.replace(/\//g, '-')) : null;

                if (!dateA && !dateB) return 0;
                if (!dateA) return 1; // Put points without dates at the end
                if (!dateB) return -1;

                return dateA - dateB;
            });

            console.log("Sorted Points Data:", sortedPointsData);

            // 2. Create Graphics
            pointGraphics = []; // Reset graphics array
            pointsLayer.removeAll(); // Clear existing graphics

            sortedPointsData.forEach((point, index) => {
                // Validate essential data
                if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
                    console.warn(`Skipping point ${index} due to invalid coordinates:`, point);
                    return;
                }

                const pointGeometry = new Point({
                    longitude: point.longitude,
                    latitude: point.latitude
                    // Add Z value if available: point.altitude
                });

                // Define symbol (can be customized based on point type, etc.)
                const markerSymbol = {
                    type: "simple-marker",
                    style: "circle",
                    color: [255, 100, 0, 0.8], // Orange
                    size: 8,
                    outline: {
                        color: [255, 255, 255, 0.7],
                        width: 1
                    }
                };

                // Store all relevant point data as attributes
                const attributes = {
                    ...point, // Copy all properties from the point object
                    originalIndex: index // Keep track of the sorted order index
                };

                const graphic = new Graphic({
                    geometry: pointGeometry,
                    symbol: markerSymbol,
                    attributes: attributes,
                    popupTemplate: pointPopupTemplate // Assign the popup template
                });

                pointGraphics.push(graphic); // Store graphic
            });

            // Add graphics to the layer
            pointsLayer.addMany(pointGraphics);
            console.log(`Created ${pointGraphics.length} graphics.`);
        }

        /**
         * Zoom the map to fit all loaded points
         */
        function zoomToAllPoints() {
            if (pointGraphics.length > 0 && window.appState.activeView) {
                console.log("Zooming to all points...");
                window.appState.activeView.goTo(pointGraphics, { duration: 1000 })
                    .catch(handleGoToError);
            } else if (window.appState.activeView) {
                 console.log("No points to zoom to, going to default center.");
                 window.appState.activeView.goTo({
                     center: [DEFAULT_CENTER_LON, DEFAULT_CENTER_LAT],
                     zoom: 5 // Adjust default zoom as needed
                 }).catch(handleGoToError);
            }
        }

        // --- Map Interaction and Animation (largely the same, but uses `pointGraphics` and `sortedPointsData`) ---

        /**
         * Attach click listeners to views (Keep existing function)
         */
        function attachClickListeners(targetView) {
            targetView.on("click", handleViewClick);
        }

        /**
         * Handle view click (Keep existing function, ensures popup opens for graphics)
         */
        function handleViewClick(event) {
            if (isSettingCenter || isAnimating || !window.appState.activeView) return;

             // Use hitTest to specifically check for clicks on our pointsLayer graphics
             window.appState.activeView.hitTest(event).then(function (response) {
                 const results = response.results;
                 const hitPointGraphic = results.find(result => result.graphic && result.graphic.layer === pointsLayer);

                 if (hitPointGraphic) {
                     // Clicked on a point graphic, let the default popup handle it
                     console.log("Clicked on point graphic:", hitPointGraphic.graphic.attributes.location);
                     // Potentially highlight the corresponding list item
                     highlightListItem(hitPointGraphic.graphic.attributes.originalIndex);
                 } else {
                      // Clicked outside a point graphic
                      const popupElement = window.appState.activeView.popup?.container;
                      const settingsPanelHit = settingsPanel.contains(event.target);
                      const listPanelHit = footprintsListPanel.contains(event.target);
                      const controlsHit = controlsDiv.contains(event.target); // Check controls too

                      // Close popup and panels if click is outside relevant areas
                      if (!popupElement?.contains(event.target) && !settingsPanelHit && !listPanelHit && !controlsHit) {
                           window.appState.activeView.closePopup();
                           settingsPanel.style.display = 'none';
                           // footprintsListPanel.style.display = 'none'; // Decide if clicking map closes list
                      }
                 }
             }).catch(err => {
                 if (err.name !== "AbortError") {
                     console.warn("hitTest error:", err);
                 }
             });
        }

        /**
         * Populate the footprints list panel
         */
        function populateFootprintsList() {
            if (!footprintsListUl || sortedPointsData.length === 0) return;
            footprintsListUl.innerHTML = ''; // Clear list

            sortedPointsData.forEach((point, index) => {
                // Check if point has minimal data to display
                if (!point.location && !point.time) return;

                const li = document.createElement('li');
                li.className = 'footprint-list-item'; // Add class for styling
                const time = point.time || "未知时间";
                const location = point.location || "未知地点";

                li.innerHTML = `
                    <span class="time">${time}</span> - <span class="location">${location}</span>
                `;
                li.dataset.index = index; // Use the sorted index

                li.addEventListener('click', () => {
                    if (isAnimating || isSettingCenter) return;
                    const clickedIndex = parseInt(li.dataset.index, 10);
                    if (!isNaN(clickedIndex)) {
                        stopPlayback();
                        //footprintsListPanel.style.display = 'none'; // Optionally close list on click
                        goToPoint(clickedIndex, currentIndex); // Use goToPoint with index
                        highlightListItem(clickedIndex); // Highlight clicked item
                    }
                });
                footprintsListUl.appendChild(li);
            });
        }

        /**
         * Highlight a specific list item
         */
         function highlightListItem(index) {
             if (!footprintsListUl) return;
             // Remove highlight from all items
             footprintsListUl.querySelectorAll('li').forEach(item => {
                 item.classList.remove('active');
             });
             // Add highlight to the target item
             const targetItem = footprintsListUl.querySelector(`li[data-index="${index}"]`);
             if (targetItem) {
                 targetItem.classList.add('active');
                 // Scroll item into view if needed
                 targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
             }
         }


        /**
         * Animate arc between two points (Revised to use point graphics)
         * @param {Graphic} startGraphic - Starting point graphic
         * @param {Graphic} endGraphic - Ending point graphic
         * @param {number} duration - Animation duration
         */
        function animateArc(startGraphic, endGraphic, duration = ANIMATION_DURATION) {
            return new Promise(async (resolve) => {
                if (!startGraphic || !endGraphic || !startGraphic.geometry || !endGraphic.geometry ||
                    isAnimating || window.appState.activeView.type !== '3d') {
                    resolve();
                    return;
                }

                isAnimating = true;
                animationLayer.removeAll();
                hideAllConnections(); // Hide static connections during animation

                const startPoint = startGraphic.geometry; // Geometry from Graphic
                const endPoint = endGraphic.geometry;   // Geometry from Graphic

                // --- Rest of the animateArc logic (geodesicDensify, elevatedPath, symbols, animation loop) remains largely the same ---
                // Ensure you are using startPoint and endPoint correctly
                let groundPathLine;
                try {
                    groundPathLine = geometryEngine.geodesicDensify(
                        new Polyline({
                            paths: [[[startPoint.longitude, startPoint.latitude], [endPoint.longitude, endPoint.latitude]]],
                            spatialReference: startPoint.spatialReference
                        }),
                        50000, // Densify every 50km
                        "meters"
                    );
                } catch (e) {
                     console.warn("Geodesic densify failed, using straight line:", e);
                     groundPathLine = new Polyline({
                            paths: [[[startPoint.longitude, startPoint.latitude], [endPoint.longitude, endPoint.latitude]]],
                            spatialReference: startPoint.spatialReference
                     });
                }

                 if (!groundPathLine || !groundPathLine.paths || groundPathLine.paths.length === 0 || groundPathLine.paths[0].length < 2) {
                    console.warn("Could not create ground path for animation.");
                    isAnimating = false;
                    resolve();
                    return;
                }

                const groundPathPoints = groundPathLine.paths[0];
                const totalSteps = groundPathPoints.length - 1;
                if (totalSteps <= 0) {
                     console.warn("Not enough steps for animation.");
                     isAnimating = false;
                     resolve();
                     return;
                }

                 const elevatedPathCoords = groundPathPoints.map((coords, index) => [
                    coords[0],
                    coords[1],
                    MAX_ARC_HEIGHT * Math.sin(Math.PI * (index / totalSteps)) // Calculate Z based on progress
                ]);

                const elevatedPathLine = new Polyline({
                    paths: [elevatedPathCoords],
                    hasZ: true,
                    spatialReference: startPoint.spatialReference
                });

                 // Symbols for animation
                const pulseSymbol = { type: "simple-marker", style: "circle", color: [255, 255, 0, 0.8], size: 10, outline: { color: [255, 255, 255, 0.5], width: 1 } };
                const arcSymbol = { type: "simple-line", color: [255, 255, 0, 0.6], width: 2 };

                // Graphics for animation
                const pulseGraphic = new Graphic({
                    geometry: new Point({ longitude: elevatedPathCoords[0][0], latitude: elevatedPathCoords[0][1], z: elevatedPathCoords[0][2], spatialReference: startPoint.spatialReference }),
                    symbol: pulseSymbol
                });
                const arcGraphic = new Graphic({
                    geometry: new Polyline({ paths: [[elevatedPathCoords[0]]], hasZ: true, spatialReference: startPoint.spatialReference }),
                    symbol: arcSymbol
                });

                animationLayer.addMany([arcGraphic, pulseGraphic]);

                 // Animation loop
                let startTime = null;
                let animationFrameId;
                function animationStep(timestamp) {
                     if (!isAnimating) { // Check if animation was stopped
                          cancelAnimationFrame(animationFrameId);
                          resolve(); // Resolve the promise if stopped externally
                          return;
                     }
                    if (startTime === null) startTime = timestamp;
                    const elapsed = timestamp - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const currentStep = Math.floor(progress * totalSteps);

                    if (currentStep >= elevatedPathCoords.length) return; // Prevent out-of-bounds

                    // Update pulse position
                    pulseGraphic.geometry = new Point({
                        longitude: elevatedPathCoords[currentStep][0],
                        latitude: elevatedPathCoords[currentStep][1],
                        z: elevatedPathCoords[currentStep][2],
                        spatialReference: startPoint.spatialReference
                    });

                    // Update arc geometry
                    arcGraphic.geometry = new Polyline({
                        paths: [elevatedPathCoords.slice(0, currentStep + 1)],
                        hasZ: true,
                        spatialReference: startPoint.spatialReference
                    });

                    // Optional pulsing effect
                    const pulseSizeFactor = 1 + Math.sin(elapsed / 200) * 0.3;
                    const clonedSymbol = pulseGraphic.symbol.clone();
                    clonedSymbol.size = 10 * pulseSizeFactor;
                    pulseGraphic.symbol = clonedSymbol;

                    if (progress < 1) {
                        animationFrameId = requestAnimationFrame(animationStep);
                    } else {
                        // Animation finished
                        pulseGraphic.geometry = new Point({ // Snap pulse to the final ground point
                            longitude: endPoint.longitude, latitude: endPoint.latitude, z: 0,
                            spatialReference: startPoint.spatialReference
                        });
                        arcGraphic.geometry = elevatedPathLine; // Show complete arc
                        isAnimating = false;
                        resolve(); // Resolve the promise on completion
                    }
                }
                animationFrameId = requestAnimationFrame(animationStep);
            });
        }


        /**
         * Handle goTo errors (Keep existing function)
         */
        function handleGoToError(error) {
            if (error.name !== "AbortError") {
                console.error("Navigation/animation GoTo Error:", error);
                isAnimating = false;
                endSetCenterPointMode(); // Reset modes on error
                // Maybe show a user notification
                showNotification("地图导航时出错", "error");
            } else {
                 console.log("Navigation/animation aborted."); // Normal if user interacted quickly
            }
        }

        /**
         * Navigate to a specific point index (Revised to use graphics array)
         * @param {number} index - Target index in the `pointGraphics` array
         * @param {number} previousIndex - Index of the previously active point
         */
        async function goToPoint(index, previousIndex = -1) {
             if (index < 0 || index >= pointGraphics.length || !window.appState.activeView ||
                isAnimating || isSettingCenter) {
                return;
            }

            let animStartIndex = previousIndex;
             // If previousIndex is invalid, use the current actual index for animation start
             if (animStartIndex < 0 || animStartIndex >= pointGraphics.length) {
                animStartIndex = currentIndex;
            }

            const is3D = window.appState.activeView.type === '3d';
            const targetGraphic = pointGraphics[index];
            const startGraphic = (animStartIndex !== index && animStartIndex >= 0 && animStartIndex < pointGraphics.length)
                                  ? pointGraphics[animStartIndex]
                                  : null; // Start graphic for animation, if applicable
             const shouldAnimate = startGraphic && is3D; // Animate only in 3D and if moving between points

            currentIndex = index; // Update the current index *before* async operations
            highlightListItem(currentIndex); // Highlight list item immediately

            window.appState.activeView.closePopup();
            animationLayer.removeAll(); // Clear previous animations immediately
            hideAllConnections();

            try {
                // 1. Optional: Zoom to encompass start and end points before animation
                if (startGraphic && targetGraphic && startGraphic !== targetGraphic) {
                     console.log(`Zooming from ${startGraphic.attributes.location} to ${targetGraphic.attributes.location}`);
                    await window.appState.activeView.goTo({
                        target: [startGraphic, targetGraphic]
                    }, { duration: PRE_ANIM_ZOOM_DURATION });
                } else if (targetGraphic) {
                     // If no animation start point, just zoom to target quickly before potential animation
                     await window.appState.activeView.goTo({ target: targetGraphic.geometry, zoom: is3D ? 12 : 16}, {duration: 300 });
                }


                // 2. Perform animation if conditions met
                if (shouldAnimate) {
                     console.log(`Animating arc from index ${animStartIndex} to ${index}`);
                    await animateArc(startGraphic, targetGraphic);
                }

                // 3. Final navigation to the target point and open popup
                const targetOptions = {
                    target: targetGraphic.geometry,
                    zoom: is3D ? 10 : 16 // Adjust zoom level as needed
                };
                if (is3D) {
                    targetOptions.tilt = 45; // Set tilt for 3D view
                }

                 console.log(`Final goTo for index ${index}`);
                 await window.appState.activeView.goTo(targetOptions, { duration: shouldAnimate ? 500 : 0 }); // Faster final zoom after animation

                // 4. Open Popup
                window.appState.activeView.openPopup({
                    features: [targetGraphic], // Pass the graphic itself
                    location: targetGraphic.geometry // Use geometry as location
                });

            } catch (error) {
                handleGoToError(error);
            } finally {
                 isAnimating = false; // Ensure animating flag is reset
            }
        }


        // --- Playback Logic (largely the same, uses goToPoint) ---

        function stopPlayback() {
            if (isPlaying) {
                clearTimeout(playTimeout);
                playTimeout = null;
                isPlaying = false;
                isAnimating = false; // Also stop any ongoing animation step
                 animationLayer.removeAll(); // Clean up animation graphics
                playBtn.textContent = "播放";
                playBtn.disabled = isSettingCenter; // Re-enable if not setting center
                console.log("Playback stopped.");
            }
        }

        function startPlayback() {
            if (isPlaying || pointGraphics.length === 0 || !window.appState.activeView || isAnimating || isSettingCenter) return;
            isPlaying = true;
            playBtn.textContent = "暂停";
            playBtn.disabled = false; // Ensure it's enabled
            console.log("Playback started.");
            scheduleNextPlaybackStep();
        }

        function scheduleNextPlaybackStep() {
            if (!isPlaying) return; // Stop if playback was cancelled

             // If an animation is somehow still running, wait
             if (isAnimating) {
                  console.log("Waiting for animation to finish before next step...");
                  playTimeout = setTimeout(scheduleNextPlaybackStep, 200); // Check again shortly
                  return;
             }

            const previousPlaybackIndex = currentIndex;
            let nextPlaybackIndex = currentIndex + 1;
            if (nextPlaybackIndex >= pointGraphics.length) {
                nextPlaybackIndex = 0; // Loop back to the start
            }

            console.log(`Scheduling step: ${previousPlaybackIndex} -> ${nextPlaybackIndex}`);
            goToPoint(nextPlaybackIndex, previousPlaybackIndex).then(() => {
                // Schedule the *next* step only after goToPoint resolves
                if (isPlaying) { // Double-check if still playing after async operation
                     console.log(`Step ${nextPlaybackIndex} complete. Scheduling next after ${POPUP_DELAY}ms`);
                    playTimeout = setTimeout(scheduleNextPlaybackStep, POPUP_DELAY);
                }
            }).catch(error => {
                // Don't stop playback automatically on error, let user decide
                 console.error("Error during playback step:", error);
                 // Maybe stop playback on error?
                 // stopPlayback();
                 // showNotification("播放时出错", "error");
            });
        }

        // --- Connection Lines (Keep existing functions) ---
        function showAllConnections() {
             if (!window.appState.activeView || pointGraphics.length < 2) return;
             connectionsLayer.removeAll();
             console.log("Drawing all connection lines");

            const connectionSymbol = {
                type: "simple-line",
                // Use a different color than animation, maybe more subtle
                color: [0, 191, 255, 0.5], // Deep sky blue, semi-transparent
                width: 1.5
            };

            const graphics = [];
            for (let i = 0; i < pointGraphics.length - 1; i++) {
                const start = pointGraphics[i].geometry;
                const end = pointGraphics[i+1].geometry;
                if (start && end && start.type === 'point' && end.type === 'point') {
                     try {
                         // Use geodesic lines for accuracy over long distances
                         const line = geometryEngine.geodesicDensify(
                            new Polyline({
                                paths: [[[start.longitude, start.latitude], [end.longitude, end.latitude]]],
                                spatialReference: start.spatialReference
                            }),
                            100000, // Densify every 100km
                            "meters"
                         );
                         if (line) {
                             graphics.push(new Graphic({ geometry: line, symbol: connectionSymbol }));
                         }
                     } catch(lineError) {
                         console.warn(`Could not create connection line between points ${i} and ${i+1}:`, lineError);
                     }
                }
            }
            connectionsLayer.addMany(graphics);
            connectionsLayer.visible = true;
        }

        function hideAllConnections() {
             if (connectionsLayer) connectionsLayer.visible = false;
        }

        // --- View Switching (Keep existing logic) ---
        function switchView() {
             if (isSettingCenter || isAnimating) return;
             stopPlayback();
             hideAllConnections();

            const is3D = window.appState.activeView.type === "3d";
            const activeViewpoint = window.appState.activeView.viewpoint.clone();

            window.appState.activeView.closePopup();
            window.appState.activeView.container = null; // Detach from DOM

            if (is3D) { // Switch to 2D
                window.appState.mapView.viewpoint = activeViewpoint;
                window.appState.mapView.container = window.appState.container; // Attach MapView
                window.appState.activeView = window.appState.mapView;
                allBtn.textContent = "3D 地球";
                 zoomToAllPoints(); // Zoom to fit points in 2D
            } else { // Switch to 3D
                window.appState.sceneView.viewpoint = activeViewpoint;
                window.appState.sceneView.container = window.appState.container; // Attach SceneView
                window.appState.activeView = window.appState.sceneView;
                allBtn.textContent = "2D 地图";
                 // No automatic zoom on switch TO 3D, keep current viewpoint
            }
            // Re-attach UI elements if they were view-specific (Locate/Search typically handle this)
             console.log("Switched view to:", window.appState.activeView.type);
        }


        // --- Theme Switching (Keep existing logic) ---
        function switchMapTheme(newTheme) {
             // ... (same as before) ...
             currentTheme = newTheme;
             const lightCSS = 'https://js.arcgis.com/4.29/esri/themes/light/main.css';
             const darkCSS = 'https://js.arcgis.com/4.29/esri/themes/dark/main.css';

             map.basemap = Basemap.fromId(newTheme === 'dark' ? "dark-gray-vector" : "satellite");
             themeLink.href = (newTheme === 'dark' ? darkCSS : lightCSS);

             // Update point symbol colors based on theme
             const newSymbol = {
                 type: "simple-marker",
                 style: "circle",
                 size: 8,
                 color: newTheme === 'dark' ? [255, 150, 50, 0.9] : [255, 100, 0, 0.8], // Dark: brighter orange, Light: standard orange
                 outline: {
                     color: newTheme === 'dark' ? [50, 50, 50, 0.7] : [255, 255, 255, 0.7], // Dark: darker outline, Light: white outline
                     width: 1
                 }
             };
             // Apply new symbol to all graphics in pointsLayer
             pointsLayer.graphics.forEach(graphic => {
                 graphic.symbol = newSymbol;
             });
             // If using a FeatureLayer with a renderer, update the renderer instead
             // if (pointsLayer && pointsLayer.renderer) {
             //     let renderer = pointsLayer.renderer.clone();
             //     renderer.symbol = newSymbol;
             //     pointsLayer.renderer = renderer;
             // }

             console.log("Map theme switched to:", newTheme);
        }

        // --- Settings Panel (Keep existing logic, ensure sliders exist) ---
         function setupSettingsPanel() {
             // Ensure elements exist before adding listeners
             if (!speedSlider || !popupSlider || !altitudeSlider || !speedValueSpan || !popupValueSpan || !altitudeValueSpan) {
                 console.warn("Settings panel elements not found. Skipping setup.");
                 return;
             }

             // Initial display setup
             speedValueSpan.textContent = speedSlider.value;
             popupValueSpan.textContent = popupSlider.value;
             altitudeValueSpan.textContent = altitudeSlider.value;

             const mapSpeedToDuration = (speed) => Math.max(500, 3500 - (speed * 300));
             ANIMATION_DURATION = mapSpeedToDuration(parseInt(speedSlider.value, 10));
             POPUP_DELAY = parseInt(popupSlider.value, 10) * 1000;
             MAX_ARC_HEIGHT = parseInt(altitudeSlider.value, 10) * 1000;

             // Event listeners
             speedSlider.addEventListener('input', () => {
                 const speed = parseInt(speedSlider.value, 10);
                 speedValueSpan.textContent = speed;
                 ANIMATION_DURATION = mapSpeedToDuration(speed);
                 console.log("Animation duration set to:", ANIMATION_DURATION);
             });

             popupSlider.addEventListener('input', () => {
                 const seconds = parseInt(popupSlider.value, 10);
                 popupValueSpan.textContent = seconds;
                 POPUP_DELAY = seconds * 1000;
                 console.log("Popup delay set to:", POPUP_DELAY);
             });

             altitudeSlider.addEventListener('input', () => {
                 const altitudeKm = parseInt(altitudeSlider.value, 10);
                 altitudeValueSpan.textContent = altitudeKm;
                 MAX_ARC_HEIGHT = altitudeKm * 1000;
                 console.log("Max arc height set to:", MAX_ARC_HEIGHT);
             });
         }

        // --- Center Point Setting (Keep existing logic) ---
        async function startSetCenterPointMode() {
             // ... (same as before) ...
             if (isSettingCenter || isAnimating) return;

             if (window.appState.activeView.type !== '3d') {
                console.log("Switching to 3D view to set center point...");
                switchView();
                await new Promise(resolve => setTimeout(resolve, 150)); // Give time for switch
                if (window.appState.activeView.type !== '3d') {
                    console.error("Failed to switch to 3D view.");
                    return;
                }
             }

             console.log("Starting center point selection mode.");
             isSettingCenter = true;
             if(centerPointFeedback) centerPointFeedback.style.display = 'block';
             if(window.appState.activeView) window.appState.activeView.container.style.cursor = 'crosshair';
             if(settingsPanel) settingsPanel.style.display = 'none'; // Hide settings panel

             if (centerPointClickHandle) centerPointClickHandle.remove(); // Remove old listener
             centerPointClickHandle = window.appState.sceneView.on('click', handleCenterPointSet);
        }

        function handleCenterPointSet(event) {
             // ... (same as before) ...
            if (!isSettingCenter || !event.mapPoint || event.mapPoint.type !== "point") return;

            customCenterPoint = event.mapPoint.clone();
            console.log(`New center point set: Lon=${customCenterPoint.longitude.toFixed(4)}, Lat=${customCenterPoint.latitude.toFixed(4)}`);

            if(centerPointFeedback) {
                centerPointFeedback.innerText = `Center updated! (${customCenterPoint.longitude.toFixed(2)}, ${customCenterPoint.latitude.toFixed(2)})`;
                centerPointFeedback.style.color = 'green';
                setTimeout(() => {
                    centerPointFeedback.innerText = 'Please click on the 3D map to set a new center point...';
                    centerPointFeedback.style.color = ''; // Reset color
                    centerPointFeedback.style.display = 'none';
                }, 2500);
            }
            showNotification("地图中心点已更新", "success");
            endSetCenterPointMode();
        }

        function endSetCenterPointMode() {
             // ... (same as before) ...
             if (!isSettingCenter) return;
             console.log("Ending center point selection mode.");
             isSettingCenter = false;
             if(window.appState.activeView) window.appState.activeView.container.style.cursor = 'default';
             if(centerPointFeedback) centerPointFeedback.style.display = 'none';
             if (centerPointClickHandle) {
                centerPointClickHandle.remove();
                centerPointClickHandle = null;
             }
             // Re-enable buttons that might have been disabled
             enableControls();
        }

        // --- Event Listeners Setup ---
         function setupEventListeners() {
             // Main controls
             prevBtn?.addEventListener('click', () => { if (!isAnimating && !isSettingCenter) { stopPlayback(); goToPoint(currentIndex > 0 ? currentIndex - 1 : pointGraphics.length - 1, currentIndex); } });
             playBtn?.addEventListener('click', () => { if (!isAnimating && !isSettingCenter) { isPlaying ? stopPlayback() : startPlayback(); } });
             nextBtn?.addEventListener('click', () => { if (!isAnimating && !isSettingCenter) { stopPlayback(); goToPoint(currentIndex < pointGraphics.length - 1 ? currentIndex + 1 : 0, currentIndex); } });
             resetBtn?.addEventListener('click', () => { if (!isAnimating && !isSettingCenter) { stopPlayback(); goToPoint(0, currentIndex); } });
             globalBtn?.addEventListener('click', async () => {
                 if (isAnimating || isSettingCenter) return;
                 stopPlayback();
                 window.appState.activeView?.closePopup();
                 hideAllConnections();
                 if (window.appState.activeView.type !== "3d") {
                     switchView(); await new Promise(r => setTimeout(r, 100));
                 }
                 if(window.appState.activeView.type === "3d") {
                     const center = customCenterPoint ? [customCenterPoint.longitude, customCenterPoint.latitude] : [DEFAULT_CENTER_LON, DEFAULT_CENTER_LAT];
                     try {
                         await window.appState.activeView.goTo({ position: [center[0], center[1] - 10, 35000000], tilt: 0, heading: 0 }, { duration: 1500 });
                         showAllConnections();
                     } catch(error) { handleGoToError(error); }
                 }
             });
             allBtn?.addEventListener('click', () => { if (!isAnimating && !isSettingCenter) switchView();showAllConnections(); });

             // Settings Panel
             settingsBtn?.addEventListener('click', () => { if (isSettingCenter) endSetCenterPointMode(); settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';});
             closeSettingsBtn?.addEventListener('click', () => { settingsPanel.style.display = 'none'; if (isSettingCenter) endSetCenterPointMode(); });
             themeSubBtn?.addEventListener('click', () => {
                 const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                 switchMapTheme(newTheme);
                 if (document.getElementById('darkModeToggle')) document.getElementById('darkModeToggle').click(); // Sync header toggle if exists
             });
             setCenterBtn?.addEventListener('click', startSetCenterPointMode);
             showListBtn?.addEventListener('click', () => { if (isSettingCenter) endSetCenterPointMode(); footprintsListPanel.style.display = 'block'; settingsPanel.style.display = 'none'; });

             // List Panel
             closeListBtn?.addEventListener('click', () => { footprintsListPanel.style.display = 'none'; });

             // Ensure controls are disabled/enabled correctly based on state
             // This might need refinement based on how isAnimating/isSettingCenter are managed
         }

        // Disable/Enable controls (modified slightly)
        function disableControls(keepBasics = false) {
             [prevBtn, playBtn, nextBtn, resetBtn, globalBtn, allBtn, settingsBtn].forEach(btn => {
                 if(btn) btn.disabled = true;
             });
             console.log("Controls disabled");
        }
        function enableControls() {
             // Enable based on whether points exist
             const hasPoints = pointGraphics.length > 0;
             [prevBtn, playBtn, nextBtn, resetBtn].forEach(btn => { if(btn) btn.disabled = !hasPoints || isSettingCenter || isAnimating; });
             [globalBtn, allBtn, settingsBtn].forEach(btn => { if(btn) btn.disabled = isSettingCenter || isAnimating; }); // Global/view/settings depend only on modes
             console.log("Controls enabled state updated.");
        }


        // --- Start Initialization ---
        initialize(); // Call the main initialization function
        setupEventListeners(); // Setup button listeners after elements are known

    }); // End of require block
}


