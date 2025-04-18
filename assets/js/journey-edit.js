// assets/js/journey-edit.js

// --- Global State & Constants ---
const API_BASE_URL = 'http://127.0.0.1:5000/api';
let currentUser = null;
let journeyData = null; // Holds full journey details { id, title, ..., points: [] }
let pointsData = []; // Working array for points being edited
let isNewJourney = true;
let currentEditingPointIndex = -1; // Index in pointsData array, -1 for new point
let isDirty = false; // Track unsaved changes
let isMapReady = false;
let isPickingLocation = false; // Flag for map click behavior
let activeMapTool = 'select'; // 'select' or 'add'

// ArcGIS Objects (initialized later) - 修改变量名以避免与内置对象冲突
let EsriMap, EsriMapView, EsriSceneView, EsriGraphicsLayer, EsriBasemap, EsriGraphic;
let EsriPoint, EsriSearch, EsriLocate, EsriPopupTemplate;
let map = null;
let mapView = null;
let sceneView = null;
let activeView = null;
let pointsLayer = null; // GraphicsLayer for points
let tempGraphicsLayer = null; // For temporary graphics like location pick preview
let selectedGraphic = null; // The graphic currently selected on map for editing
let locateWidget = null;
let searchWidget = null;
let mapClickHandler = null; // Handle for map click listener
let pointGraphics = []; // Array to store all point graphics

// DOM Element References
let domElements = {};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Loaded. Initializing journey edit...");
	// 强制隐藏所有对话框 - 添加这段代码
    document.querySelectorAll('.dialog-overlay').forEach(dialog => {
        dialog.classList.add('hidden');
        dialog.style.display = 'none';
    });
    
    cacheDomElements();

    if (!checkUserAuthentication()) {
        showUnauthorizedDialog();
        disableEditing(); // Disable form elements if not logged in
        return; // Stop further initialization
    }

    initDarkMode();
    initializeMap()
        .then(() => {
            console.log("Map initialization complete.");
            isMapReady = true;
            setupEventListeners(); // Attach listeners AFTER map is ready
            loadInitialData(); // Load journey data or setup new
            enableControls(); // Enable buttons now map is ready
        })
        .catch(error => {
            console.error("Map Initialization failed:", error);
            showNotification("地图初始化失败: " + error.message, "error");
            disableEditing(); // Disable editing if map fails
        });

    // Warn before leaving if changes are unsaved
    window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
            const confirmationMessage = '您有未保存的更改，确定要离开吗？';
            e.returnValue = confirmationMessage; // Standard for most browsers
            return confirmationMessage; // For older browsers
        }
    });
});

function cacheDomElements() {
    domElements = {
        loadingIndicator: document.getElementById('loadingIndicator'),
        editPanel: document.getElementById('editPanel'),
        journeyTitle: document.getElementById('journeyTitle'),
        journeyDescription: document.getElementById('journeyDescription'),
        pointsList: document.getElementById('pointsList'),
        addPointBtn: document.getElementById('addPointBtn'),
        saveJourneyBtn: document.getElementById('saveJourneyBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        toggleEditPanelBtn: document.getElementById('toggleEditPanel'),
        viewDiv: document.getElementById('viewDiv'),
        mapTools: document.getElementById('mapTools'),
        modeToggleBtn: document.getElementById('modeToggleBtn'),
        addLocationBtn: document.getElementById('addLocationBtn'),
        selectLocationBtn: document.getElementById('selectLocationBtn'),
        resetViewBtn: document.getElementById('resetViewBtn'),
        // Dialogs & Contents
        pointEditDialog: document.getElementById('pointEditDialog'),
        dialogTitle: document.getElementById('dialogTitle'),
        pointName: document.getElementById('pointName'),
        pointTime: document.getElementById('pointTime'),
        pointDate: document.getElementById('pointDate'),
        pointContent: document.getElementById('pointContent'),
        pointLatitude: document.getElementById('pointLatitude'),
        pointLongitude: document.getElementById('pointLongitude'),
        savePointBtn: document.getElementById('savePointBtn'),
        deletePointBtn: document.getElementById('deletePointBtn'),
        mapPickLocationBtn: document.getElementById('mapPickLocationBtn'),
        cancelDialogBtn: document.getElementById('cancelDialogBtn'),
        closeDialogBtn: document.getElementById('closeDialogBtn'),
        unauthorizedDialog: document.getElementById('unauthorizedDialog'),
        confirmDialog: document.getElementById('confirmDialog'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        confirmYesBtn: document.getElementById('confirmYesBtn'),
        confirmNoBtn: document.getElementById('confirmNoBtn'),
        // Header elements
        dashboardLink: document.getElementById('dashboardLink'),
        loginLink: document.getElementById('loginLink'),
        darkModeToggle: document.getElementById('darkModeToggle')
    };
}

// --- Authentication & Authorization ---

function checkUserAuthentication() {
    currentUser = getCurrentUser();
    console.log("Current user:", currentUser); // 添加调试日志
    
    if (currentUser) {
        updateHeaderUI();
        // 强制设置认证成功
        return true;
    } else {
        // 检查您是否想要临时允许未登录用户编辑
        // 为测试目的，可以取消下面的注释并返回 true
        // console.log("允许未认证编辑 (仅测试用)");
        // updateHeaderUI();
        // return true;
        
        return false;
    }
}

function updateHeaderUI() {
    if (currentUser) {
        domElements.dashboardLink?.classList.remove('hidden');
        domElements.loginLink?.classList.add('hidden');
    } else {
        domElements.dashboardLink?.classList.add('hidden');
        domElements.loginLink?.classList.remove('hidden');
    }
}


function disableEditing() {
    console.warn("Disabling editing features.");
    if (domElements.journeyTitle) domElements.journeyTitle.disabled = true;
    if (domElements.journeyDescription) domElements.journeyDescription.disabled = true;
    if (domElements.addPointBtn) domElements.addPointBtn.disabled = true;
    if (domElements.saveJourneyBtn) domElements.saveJourneyBtn.disabled = true;
    if (domElements.pointsList) {
        domElements.pointsList.classList.add('disabled');
        domElements.pointsList.querySelectorAll('button').forEach(btn => btn.disabled = true);
    }
}

function enableControls() {
    if (!isMapReady || !currentUser) return;
    console.log("Enabling controls...");
    if (domElements.journeyTitle) domElements.journeyTitle.disabled = false;
    if (domElements.journeyDescription) domElements.journeyDescription.disabled = false;
    if (domElements.addPointBtn) domElements.addPointBtn.disabled = false;
    if (domElements.saveJourneyBtn) domElements.saveJourneyBtn.disabled = false;
    if (domElements.modeToggleBtn) domElements.modeToggleBtn.disabled = false;
    if (domElements.addLocationBtn) domElements.addLocationBtn.disabled = false;
    if (domElements.selectLocationBtn) domElements.selectLocationBtn.disabled = false;
    if (domElements.resetViewBtn) domElements.resetViewBtn.disabled = false;
}

// --- Dark Mode ---
function initDarkMode() {
    const darkModeToggle = domElements.darkModeToggle;
    const htmlElement = document.documentElement;
    let isDark = localStorage.getItem('darkMode') === 'true';

    const applyTheme = (dark) => {
        htmlElement.classList.toggle('dark', dark);
        document.body.classList.toggle('dark-theme', dark);
        document.body.classList.toggle('light-theme', !dark);
        if (map) switchMapThemeVisuals(dark ? 'dark' : 'light');
    };

    applyTheme(isDark);

    darkModeToggle?.addEventListener('click', () => {
        isDark = !htmlElement.classList.contains('dark');
        applyTheme(isDark);
        localStorage.setItem('darkMode', isDark.toString());
    });
}

function switchMapThemeVisuals(theme) {
    const themeLink = document.getElementById('esri-theme-css');
    const lightCSS = 'https://js.arcgis.com/4.29/esri/themes/light/main.css';
    const darkCSS = 'https://js.arcgis.com/4.29/esri/themes/dark/main.css';
    
    if (themeLink) {
        themeLink.href = (theme === 'dark' ? darkCSS : lightCSS);
    }
    
    if (map && EsriBasemap) {
        map.basemap = EsriBasemap.fromId(theme === 'dark' ? "dark-gray-vector" : "streets-navigation-vector");
    }
    
    // Update point symbol colors based on theme
    const newSymbol = {
        type: "simple-marker",
        style: "circle",
        size: 8,
        color: theme === 'dark' ? [255, 150, 50, 0.9] : [255, 100, 0, 0.8],
        outline: {
            color: theme === 'dark' ? [50, 50, 50, 0.7] : [255, 255, 255, 0.7],
            width: 1
        }
    };
    
    // Apply new symbol to all graphics in pointsLayer if it exists
    if (pointsLayer) {
        pointsLayer.graphics.forEach(graphic => {
            graphic.symbol = newSymbol;
        });
    }
    
    console.log("Map visuals updated for theme:", theme);
}

// --- Data Loading and Initialization ---

async function loadInitialData() {
    console.log("Loading initial data...");
    const urlParams = new URLSearchParams(window.location.search);
    const journeyId = urlParams.get('id');
    console.log("Journey ID from URL:", journeyId);

    if (journeyId) {
        isNewJourney = false;
        await loadJourneyData(journeyId);
    } else {
        isNewJourney = true;
        initializeNewJourney();
    }
    setDirty(false);
    enableControls();
}

async function loadJourneyData(journeyId) {
    showLoadingIndicator("加载足迹数据...");
    try {
        // Use the API endpoint to fetch journey data
        const data = await fetchApi(`/journeys/${journeyId}`);

        // Authorization Check
        if (data.user_id !== currentUser.id) {
            console.error("Authorization Failed: User does not own this journey.");
            showUnauthorizedDialog();
            disableEditing();
            throw new Error("无权编辑此足迹");
        }

        journeyData = data;
        pointsData = data.points ? [...data.points] : [];

        // Populate Form
        if (domElements.journeyTitle) domElements.journeyTitle.value = journeyData.title || '';
        if (domElements.journeyDescription) domElements.journeyDescription.value = journeyData.description || '';

        // Update UI
        updatePointsList();
        drawPointsOnMap();
        zoomToAllPoints();

    } catch (error) {
        console.error("加载足迹数据错误:", error);
        showNotification(`加载失败: ${error.message}`, "error");
        disableEditing();
    } finally {
        hideLoadingIndicator();
    }
}

function initializeNewJourney() {
    console.log("Initializing new journey...");
    isNewJourney = true;
    journeyData = {
        id: null,
        title: '',
        description: '',
        visibility: 'private',
        user_id: currentUser.id,
        points: []
    };
    pointsData = [];

    if (domElements.journeyTitle) domElements.journeyTitle.value = '';
    if (domElements.journeyDescription) domElements.journeyDescription.value = '';

    updatePointsList();
    drawPointsOnMap();
    enableControls();
    hideLoadingIndicator();
}

// --- Map Initialization ---
async function initializeMap() {
	console.log("Initializing Map with viewDiv:", domElements.viewDiv);
	if (!domElements.viewDiv) {
        console.error("viewDiv element not found!");
        // 可能需要显示一个错误通知
        return Promise.reject(new Error("viewDiv element not found"));
    }
    showLoadingIndicator("初始化地图...");

    return new Promise((resolve, reject) => {
        require([
            "esri/Map", "esri/views/MapView", "esri/views/SceneView",
            "esri/layers/GraphicsLayer", "esri/Basemap", "esri/Graphic",
            "esri/geometry/Point", "esri/widgets/Search", "esri/widgets/Locate",
            "esri/PopupTemplate", "esri/config"
        ], function (
            MapApi, MapViewApi, SceneViewApi, GraphicsLayerApi, BasemapApi, GraphicApi,
            PointApi, SearchApi, LocateApi, PopupTemplateApi, esriConfig
        ) {
            // 使用不同的变量名赋值，避免与内置对象冲突
            EsriMap = MapApi; 
            EsriMapView = MapViewApi; 
            EsriSceneView = SceneViewApi;
            EsriGraphicsLayer = GraphicsLayerApi; 
            EsriBasemap = BasemapApi; 
            EsriGraphic = GraphicApi;
            EsriPoint = PointApi; 
            EsriSearch = SearchApi; 
            EsriLocate = LocateApi;
            EsriPopupTemplate = PopupTemplateApi;

            try {
                map = new EsriMap({
                    basemap: document.documentElement.classList.contains('dark') ? "dark-gray-vector" : "streets-navigation-vector",
                    ground: "world-elevation"
                });

                pointsLayer = new EsriGraphicsLayer({ title: "足迹点" });
                tempGraphicsLayer = new EsriGraphicsLayer({ title: "临时点", listMode: "hide" });

                map.addMany([pointsLayer, tempGraphicsLayer]);

                const commonViewParams = {
                    map: map,
                    popup: {
                        autoOpenEnabled: false,
                        dockEnabled: true,
                        dockOptions: { buttonEnabled: false, breakpoint: false },
                        visibleElements: { featureNavigation: false }
                    },
                    constraints: { snapToZoom: false }
                };

                mapView = new EsriMapView({ ...commonViewParams, container: domElements.viewDiv.id });
                sceneView = new EsriSceneView({ ...commonViewParams, container: null });
                activeView = mapView;

                locateWidget = new EsriLocate({ view: activeView });
                activeView.ui.add(locateWidget, "top-left");
                searchWidget = new EsriSearch({ view: activeView });
                activeView.ui.add(searchWidget, "top-right");

                attachMapClickHandler();

                activeView.when(() => {
                    console.log("Initial view ready.");
                    hideLoadingIndicator();
                    resolve();
                }, (error) => {
                    console.error("Error when view ready:", error);
                    reject(error);
                });

            } catch(error) {
                console.error("Error during map setup:", error);
                reject(error);
            }
        });
    });
}


function attachMapClickHandler() {
    if (!activeView) return;
    if (mapClickHandler) mapClickHandler.remove();

    mapClickHandler = activeView.on("click", handleMapClick);
    console.log("Map click handler attached.");
}

// --- Map Interaction & Point Handling ---
// 需要更新所有使用旧变量名的地方
function handleMapClick(event) {
    if (!isMapReady || !activeView) return;
    console.log(`Map clicked. Mode: ${activeMapTool}, Picking Location: ${isPickingLocation}`);

    if (isPickingLocation) {
        console.log("Processing location pick");
        const mapPoint = event.mapPoint;
        const lat = mapPoint.latitude.toFixed(6);
        const lon = mapPoint.longitude.toFixed(6);
        
        // 重新打开对话框，并填充之前保存的数据
        if (window.tempPointData) {
            const data = window.tempPointData;
            // 更新坐标
            data.latitude = parseFloat(lat);
            data.longitude = parseFloat(lon);
            
            // 重新打开对话框
            if (window.isEditingPoint) {
                // 编辑现有点
                openPointDialog('edit', data, currentEditingPointIndex);
            } else {
                // 添加新点
                openPointDialog('add', data);
            }
        } else {
            // 如果没有临时数据，只使用坐标
            const newPointData = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon)
            };
            openPointDialog('add', newPointData);
        }
        
        // 添加临时标记显示位置
        addTemporaryMapMarker(mapPoint);
        
        // 重置状态
        isPickingLocation = false;
        if (activeView?.container) activeView.container.style.cursor = 'default';
        
        // 清除临时数据
        window.tempPointData = null;
        window.isEditingPoint = false;
        
        return; // 重要：阻止继续执行后面的代码
    } else if (activeMapTool === 'add') {
        console.log("Adding new point via map click...");
        handleLocationPick(event.mapPoint, true);
    } else if (activeMapTool === 'select') {
        activeView.hitTest(event).then(response => {
            const clickedGraphic = response.results.find(r => r.graphic && r.graphic.layer === pointsLayer);
            if (clickedGraphic) {
                console.log("Clicked on existing point graphic:", clickedGraphic.graphic.attributes.location);
                selectedGraphic = clickedGraphic.graphic;
                highlightMapGraphic(selectedGraphic);
                const pointIndex = findPointIndexByGraphic(selectedGraphic);
                if (pointIndex !== -1) {
                    openPointDialog('edit', pointsData[pointIndex], pointIndex);
                    highlightListItem(pointIndex);
                } else {
                    console.error("Could not find matching point data for clicked graphic.");
                }
            } else {
                console.log("Clicked on empty map area.");
                clearMapSelection();
            }
        }).catch(err => {
            if (err.name !== "AbortError") console.error("HitTest failed:", err);
        });
    }
}

// 添加辅助函数来确保数值
function safeParseFloat(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

function handleLocationPick(mapPoint, openDialogNow = false) {
    if (!mapPoint) return;

    const lat = mapPoint.latitude.toFixed(6);
    const lon = mapPoint.longitude.toFixed(6);
    console.log(`Location picked: Lat=${lat}, Lon=${lon}`);

    if (domElements.pointEditDialog && !domElements.pointEditDialog.classList.contains('hidden')) {
        if (domElements.pointLatitude) domElements.pointLatitude.value = lat;
        if (domElements.pointLongitude) domElements.pointLongitude.value = lon;
        showNotification('坐标已更新', 'success');
        isPickingLocation = false;
        if (activeView?.container) activeView.container.style.cursor = 'default';
        clearTemporaryGraphics();
    } else if (openDialogNow) {
        clearTemporaryGraphics();
        addTemporaryMapMarker(mapPoint);
        openPointDialog('add');
        setTimeout(() => {
            if (domElements.pointLatitude) domElements.pointLatitude.value = lat;
            if (domElements.pointLongitude) domElements.pointLongitude.value = lon;
        }, 50);
    } else {
        console.warn("handleLocationPick called but dialog is not open.");
        isPickingLocation = false;
        if (activeView?.container) activeView.container.style.cursor = 'default';
    }
	// 添加临时标记
    addTemporaryMapMarker(mapPoint);
}

function addTemporaryMapMarker(pointGeometry) {
    clearTemporaryGraphics();
    if (!pointGeometry || !tempGraphicsLayer) return;

    const tempSymbol = {
        type: "simple-marker",
        style: "x",
        color: [0, 0, 255, 0.8],
        size: 12,
        outline: { color: [255, 255, 255, 0.7], width: 1.5 }
    };
    // 修复这一行：使用 EsriGraphic 代替 Graphic
    const tempGraphic = new EsriGraphic({ geometry: pointGeometry, symbol: tempSymbol });
    tempGraphicsLayer.add(tempGraphic);
}

function clearTemporaryGraphics() {
    if (tempGraphicsLayer) tempGraphicsLayer.removeAll();
}

function clearMapSelection() {
    selectedGraphic = null;
    highlightMapGraphic(null);
}

function highlightMapGraphic(graphicToHighlight) {
    if (!pointsLayer) return;

    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const defaultSymbol = {
        type: "simple-marker", style: "circle", size: 8,
        color: currentTheme === 'dark' ? [255, 150, 50, 0.9] : [255, 100, 0, 0.8],
        outline: { color: currentTheme === 'dark' ? [50, 50, 50, 0.7] : [255, 255, 255, 0.7], width: 1 }
    };
    const highlightSymbol = {
        type: "simple-marker", style: "circle", size: 12,
        color: [0, 255, 255, 0.9],
        outline: { color: [0, 0, 0, 0.8], width: 2 }
    };

    pointsLayer.graphics.forEach(graphic => {
        if (graphic === graphicToHighlight) {
            graphic.symbol = highlightSymbol;
        } else {
            graphic.symbol = defaultSymbol;
        }
    });
}

function findPointIndexByGraphic(graphic) {
    if (!graphic || !graphic.attributes) return -1;
    
    if (graphic.attributes.id) {
        return pointsData.findIndex(p => p.id === graphic.attributes.id);
    }
    
    return pointsData.findIndex(p =>
        p.latitude === graphic.attributes.latitude &&
        p.longitude === graphic.attributes.longitude &&
        p.location === graphic.attributes.location
    );
}

function drawPointsOnMap() {
    if (!isMapReady || !pointsLayer) return;
    console.log("Drawing points on map...");
    pointsLayer.removeAll();
    pointGraphics = [];

    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const markerSymbol = {
        type: "simple-marker", style: "circle", size: 8,
        color: currentTheme === 'dark' ? [255, 150, 50, 0.9] : [255, 100, 0, 0.8],
        outline: { color: currentTheme === 'dark' ? [50, 50, 50, 0.7] : [255, 255, 255, 0.7], width: 1 }
    };
    
    const pointPopupTemplate = new EsriPopupTemplate({
        title: "{location} ({time})",
        content: [{ type: "fields", fieldInfos: [
            { fieldName: "exact_date", label: "日期" },
            { fieldName: "content", label: "事件" }
        ]}]
    });

    pointsData.forEach((point, index) => {
        if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
            console.warn(`Skipping point ${index} with invalid coords:`, point);
            return;
        }
        const pointGeometry = new EsriPoint({ longitude: point.longitude, latitude: point.latitude });
        const attributes = { ...point, originalIndex: index };
		const graphic = new EsriGraphic({ 
			geometry: pointGeometry, 
			symbol: markerSymbol, 
			attributes, 
			popupTemplate: pointPopupTemplate // 确保这里使用pointPopupTemplate变量
		});
        pointGraphics.push(graphic);
    });

    pointsLayer.addMany(pointGraphics);
    console.log(`Drew ${pointGraphics.length} points.`);
}

function zoomToAllPoints() {
    if (pointGraphics.length > 0 && activeView && activeView.ready) {
        console.log("Zooming to all points...");
        activeView.goTo(pointGraphics, { duration: 800 }).catch(handleGoToError);
    } else if (activeView && activeView.ready) {
        activeView.goTo({ center: [105, 35], zoom: 3 }).catch(handleGoToError);
    }
}

function panToPoint(point) {
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') return;
    if (!activeView || !activeView.ready) return;

    console.log(`Panning to: ${point.location}`);
    activeView.goTo({
        center: [point.longitude, point.latitude],
        zoom: activeView.zoom < 10 ? 12 : activeView.zoom
    }, { duration: 600 }).catch(handleGoToError);

    const graphicIndex = pointsData.findIndex(p => p === point);
    if (graphicIndex !== -1 && graphicIndex < pointGraphics.length) {
        selectedGraphic = pointGraphics[graphicIndex];
        highlightMapGraphic(selectedGraphic);
    } else {
        clearMapSelection();
    }
}

// --- Point Data Management (CRUD) ---

function addPoint(newPointData) {
    pointsData.push(newPointData);
    updatePointsList();
    drawPointsOnMap();
    setDirty(true);
    showNotification('足迹点已添加', 'success');
}

function updatePoint(index, updatedPointData) {
    if (index < 0 || index >= pointsData.length) {
        console.error("Invalid index for updatePoint:", index);
        return;
    }
    
    const existingId = pointsData[index].id;
    pointsData[index] = { ...updatedPointData };
    if (existingId) pointsData[index].id = existingId;

    updatePointsList();
    drawPointsOnMap();
    setDirty(true);
    showNotification('足迹点已更新', 'success');
}

function deletePoint(index) {
    if (index < 0 || index >= pointsData.length) {
        console.error("Invalid index for deletePoint:", index);
        return;
    }
    
    const deletedPoint = pointsData.splice(index, 1);
    console.log("Deleted point:", deletedPoint);
    
    updatePointsList();
    drawPointsOnMap();
    setDirty(true);
    showNotification('足迹点已删除', 'success');
}

function reorderPoints(oldIndex, newIndex) {
    if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || 
        oldIndex >= pointsData.length || newIndex >= pointsData.length) {
        return;
    }
    
    console.log(`Reordering point from index ${oldIndex} to ${newIndex}`);
    const [item] = pointsData.splice(oldIndex, 1);
    pointsData.splice(newIndex, 0, item);

    pointsData.forEach((p, idx) => p.order_index = idx);

    setDirty(true);
    updatePointsList();
    console.log("Points reordered:", pointsData.map(p => p.location));
}

// --- Point Dialog Logic ---

// 修改 openPointDialog 函数，确保所有字段都正确填充
function openPointDialog(mode, pointData = null, index = -1) {
    if (!domElements.pointEditDialog) return;

    // 关闭其他对话框
    if (domElements.confirmDialog) {
        domElements.confirmDialog.classList.add('hidden');
        domElements.confirmDialog.style.display = 'none';
    }
    if (domElements.unauthorizedDialog) {
        domElements.unauthorizedDialog.classList.add('hidden');
        domElements.unauthorizedDialog.style.display = 'none';
    }

    currentEditingPointIndex = mode === 'edit' ? index : -1;
    const isEditMode = mode === 'edit';

    if (domElements.dialogTitle) domElements.dialogTitle.textContent = isEditMode ? '编辑足迹点' : '添加足迹点';
    if (domElements.deletePointBtn) domElements.deletePointBtn.classList.toggle('hidden', !isEditMode);

    // 添加调试日志，查看点数据
    console.log("点数据:", pointData);
    
    // 确保所有字段都正确填充，并避免空值错误
    if (domElements.pointName) domElements.pointName.value = pointData?.location || '';
    if (domElements.pointTime) domElements.pointTime.value = pointData?.time || '';
    if (domElements.pointDate) domElements.pointDate.value = pointData?.exact_date || '';
    if (domElements.pointContent) domElements.pointContent.value = pointData?.content || '';
    
    // 确保坐标正确填充，并转换为字符串
    if (domElements.pointLatitude) {
        domElements.pointLatitude.value = pointData?.latitude !== undefined ? 
            String(pointData.latitude) : '';
    }
    if (domElements.pointLongitude) {
        domElements.pointLongitude.value = pointData?.longitude !== undefined ? 
            String(pointData.longitude) : '';
    }

    // 显示对话框
    domElements.pointEditDialog.classList.remove('hidden');
    domElements.pointEditDialog.style.display = 'flex';
    clearTemporaryGraphics();
}

// 同样修改其他打开对话框的函数
function showConfirmDialog(title, message, onConfirm) {
    if (!domElements.confirmDialog || !domElements.confirmTitle || !domElements.confirmMessage) return;
    
    // 关闭其他对话框
    closePointDialog();
    closeUnauthorizedDialog();
    
    domElements.confirmTitle.textContent = title;
    domElements.confirmMessage.textContent = message;
    window.confirmCallback = onConfirm;
    domElements.confirmDialog.classList.remove('hidden');
    domElements.confirmDialog.style.display = 'flex'; // 添加这行
}

function showUnauthorizedDialog() {
    // 关闭其他对话框
    closePointDialog();
    closeConfirmDialog();
    
    if (domElements.unauthorizedDialog) {
        domElements.unauthorizedDialog.classList.remove('hidden');
        domElements.unauthorizedDialog.style.display = 'flex'; // 添加这行
    }
}

function closePointDialog() {
    if (domElements.pointEditDialog) {
        domElements.pointEditDialog.classList.add('hidden');
        domElements.pointEditDialog.style.display = 'none'; // 添加这行
    }
    currentEditingPointIndex = -1;
    isPickingLocation = false;
    if (activeView?.container) activeView.container.style.cursor = 'default';
    clearTemporaryGraphics();
    clearMapSelection();
}

// 类似地修改其他关闭对话框的函数
function closeConfirmDialog() {
    window.confirmCallback = null;
    if (domElements.confirmDialog) {
        domElements.confirmDialog.classList.add('hidden');
        domElements.confirmDialog.style.display = 'none'; // 添加这行
    }
}

function closeUnauthorizedDialog() {
    if (domElements.unauthorizedDialog) {
        domElements.unauthorizedDialog.classList.add('hidden');
        domElements.unauthorizedDialog.style.display = 'none'; // 添加这行
    }
}

function handleSavePoint() {
    // 收集表单数据
    const pointData = {
        location: domElements.pointName?.value.trim() || '',
        time: domElements.pointTime?.value.trim() || '',
        exact_date: domElements.pointDate?.value.trim() || '',
        content: domElements.pointContent?.value.trim() || '',
        latitude: safeParseFloat(domElements.pointLatitude?.value),
        longitude: safeParseFloat(domElements.pointLongitude?.value),
        order_index: currentEditingPointIndex !== -1 ? 
                     pointsData[currentEditingPointIndex]?.order_index || 
                     pointsData.length : pointsData.length
    };

    // 基本验证
    if (!pointData.location) {
        showNotification('请输入地点名称', 'error'); 
        return;
    }
    
    if (pointData.latitude === null || pointData.longitude === null) {
        showNotification('无效的坐标，请在地图上选择或手动输入', 'error'); 
        return;
    }

    // 添加调试日志
    console.log("保存的点数据:", pointData);

    // 更新或添加点
    if (currentEditingPointIndex !== -1) {
        // 保留原有ID
        const existingId = pointsData[currentEditingPointIndex]?.id;
        if (existingId) pointData.id = existingId;
        
        // 更新点
        updatePoint(currentEditingPointIndex, pointData);
    } else {
        // 添加新点
        addPoint(pointData);
    }

    closePointDialog();
    showNotification(currentEditingPointIndex !== -1 ? '足迹点已更新' : '足迹点已添加', 'success');
}


function handleDeletePointClick() {
    if (currentEditingPointIndex === -1) return;

    const pointToDelete = pointsData[currentEditingPointIndex];
    showConfirmDialog(
        '删除足迹点',
        `确定要删除足迹点"${pointToDelete.location || '此足迹点'}"吗？`,
        () => {
            deletePoint(currentEditingPointIndex);
            closePointDialog();
        }
    );
}

function handleMapPickLocationClick() {
    if (!domElements.pointEditDialog || domElements.pointEditDialog.classList.contains('hidden')) {
        console.warn("Map pick requested but dialog is not open.");
        return;
    }
    
    // 保存当前的表单数据，以便在点击地图后重新填充
    const tempData = {
        location: domElements.pointName?.value.trim() || '',
        time: domElements.pointTime?.value.trim() || '',
        exact_date: domElements.pointDate?.value.trim() || '',
        content: domElements.pointContent?.value.trim() || '',
        latitude: parseFloat(domElements.pointLatitude?.value) || null,
        longitude: parseFloat(domElements.pointLongitude?.value) || null
    };
    
    // 存储临时数据到window对象，以便在地图点击后恢复
    window.tempPointData = tempData;
    window.isEditingPoint = currentEditingPointIndex !== -1;
    
    isPickingLocation = true;
    closePointDialog();
    setActiveMapTool('add');
    if (activeView?.container) activeView.container.style.cursor = 'crosshair';
    showNotification('请在地图上点击选择位置', 'info');
}

// --- Points List & Drag/Drop ---

function updatePointsList() {
    const list = domElements.pointsList;
    if (!list) return;
    list.innerHTML = '';

    if (pointsData.length === 0) {
        list.innerHTML = '<div class="empty-list-placeholder p-4 text-center text-gray-500 dark:text-gray-400">暂无足迹点，请点击"添加足迹点"按钮或在地图上添加。</div>';
        return;
    }

    pointsData.forEach((point, index) => {
        list.appendChild(createPointListItem(point, index));
    });

    initDragAndDrop();
}

function createPointListItem(point, index) {
    const item = document.createElement('div');
    item.className = 'point-item group';
    item.draggable = true;
    item.dataset.index = index;

    const location = point.location || `点 ${index + 1}`;
    const time = point.time || '未设置时间';

    item.innerHTML = `
        <div class="drag-handle cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
        </div>
        <div class="point-content flex-grow mr-2 overflow-hidden">
            <div class="point-title font-medium truncate" title="${location}">${location}</div>
            <div class="point-time text-sm text-gray-500 dark:text-gray-400 truncate" title="${time}">${time}</div>
        </div>
        <div class="point-actions flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="point-locate-btn p-1 rounded text-blue-500 hover:bg-blue-100 dark:hover:bg-gray-600" title="在地图上定位">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>
            </button>
            <button class="point-edit-btn p-1 rounded text-green-500 hover:bg-green-100 dark:hover:bg-gray-600" title="编辑">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
            </button>
            <button class="point-delete-btn p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-gray-600" title="删除">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;

    item.querySelector('.point-locate-btn')?.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        panToPoint(pointsData[index]); 
        highlightListItem(index);
    });
    
    item.querySelector('.point-edit-btn')?.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        openPointDialog('edit', pointsData[index], index); 
        highlightListItem(index); 
        highlightMapGraphic(pointGraphics[index]); 
    });
    
    item.querySelector('.point-delete-btn')?.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        confirmDeletePoint(index); 
    });

    item.querySelector('.point-content')?.addEventListener('click', () => { 
        panToPoint(pointsData[index]); 
        highlightListItem(index); 
    });

    return item;
}

function highlightListItem(index) {
    const list = domElements.pointsList;
    if (!list) return;
    
    list.querySelectorAll('.point-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const targetItem = list.querySelector(`.point-item[data-index="${index}"]`);
    if (targetItem) {
        targetItem.classList.add('active');
    }
}

function confirmDeletePoint(index) {
    if (index < 0 || index >= pointsData.length) return;
    
    const point = pointsData[index];
    showConfirmDialog(
        '删除足迹点',
        `确定要删除足迹点 "${point.location || `点 ${index + 1}`}" 吗？`,
        () => deletePoint(index)
    );
}

function initDragAndDrop() {
    const list = domElements.pointsList;
    if (!list) return;
    
    let draggedItem = null;
    let placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';

    list.querySelectorAll('.point-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            if (draggedItem) draggedItem.classList.remove('dragging');
            draggedItem = null;
            if (placeholder.parentNode === list) list.removeChild(placeholder);
            updateOrderFromDOM();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingElement = document.querySelector('.dragging');
            if (!draggingElement || draggingElement === item) return;

            const rect = item.getBoundingClientRect();
            const offset = e.clientY - rect.top - rect.height / 2;

            if (offset < 0) {
                list.insertBefore(placeholder, item);
            } else {
                list.insertBefore(placeholder, item.nextSibling);
            }
            placeholder.style.height = draggingElement.offsetHeight + 'px';
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem !== item && placeholder.parentNode === list) {
                list.insertBefore(draggedItem, placeholder);
            }
        });
    });
}

function updateOrderFromDOM() {
    const items = domElements.pointsList.querySelectorAll('.point-item');
    const newPointsData = [];
    let orderChanged = false;

    items.forEach((item, newIndex) => {
        const oldIndex = parseInt(item.dataset.originalIndex || item.dataset.index, 10);
        if (!isNaN(oldIndex) && oldIndex < pointsData.length) {
            let pointData = pointsData.find(p => p.id ? 
                            p.id === pointsData[oldIndex]?.id : true) || 
                            pointsData[oldIndex];
                            
            if (pointData) {
                if (pointData.order_index !== newIndex) {
                    orderChanged = true;
                    pointData.order_index = newIndex;
                    console.log(`Point "${pointData.location}" new order_index: ${newIndex}`);
                }
                newPointsData.push(pointData);
            } else {
                console.warn("Could not find data for DOM item at old index:", oldIndex);
            }
        } else {
            console.warn("Invalid or missing index on DOM item during reorder.");
        }
    });

    if (orderChanged && newPointsData.length === pointsData.length) {
        console.log("Order changed, updating pointsData array.");
        pointsData = newPointsData;
        setDirty(true);
        updatePointsList();
    } else if (!orderChanged) {
        console.log("DOM order matches data order, no change needed.");
    } else {
        console.error("Reordering failed - array length mismatch.");
    }
}

// --- Saving Journey ---
// 修改 saveJourney 函数，添加更多错误处理和调试
async function saveJourney() {
    if (!currentUser) { 
        showUnauthorizedDialog(); 
        return; 
    }
    
    if (!journeyData) { 
        showNotification("无法保存：未加载足迹数据。", "error"); 
        return; 
    }

    const title = domElements.journeyTitle?.value.trim();
    const description = domElements.journeyDescription?.value.trim();

    if (!title) { 
        showNotification('请输入足迹标题', 'error'); 
        return; 
    }

    // 确保每个点都有正确的顺序索引
    pointsData.forEach((p, index) => p.order_index = index);
    
    // 构造保存的数据
    const payload = {
        title: title,
        description: description,
        visibility: journeyData.visibility || 'private',
        points: pointsData.map(p => ({
            id: p.id, // 包含ID以便更新现有点
            location: p.location,
            time: p.time,
            exact_date: p.exact_date,
            latitude: p.latitude,
            longitude: p.longitude,
            content: p.content,
            order_index: p.order_index
        }))
    };

    console.log("保存足迹数据:", payload);

    const method = isNewJourney ? 'POST' : 'PUT';
    const url = isNewJourney ? '/journeys' : `/journeys/${journeyData.id}`;

    showButtonLoading(domElements.saveJourneyBtn, '保存中...');


    try {
        const savedData = await fetchApi(url, method, payload);
        console.log("保存成功:", savedData);

        // 更新本地数据
        journeyData = savedData;
        pointsData = savedData.points ? [...savedData.points] : [];
        isNewJourney = false;

        // 更新UI
        updatePointsList();
        drawPointsOnMap();

        setDirty(false);
        showNotification('足迹已成功保存！', 'success');

        // 如果是新建的足迹，更新URL
        if (method === 'POST' && savedData.id) {
            const newUrl = window.location.pathname + `?id=${savedData.id}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
            journeyData.id = savedData.id;
        }

    } catch (error) {
        console.error("保存足迹失败:", error);
        showNotification(`保存失败: ${error.message}`, "error");
    } finally {
        hideButtonLoading(domElements.saveJourneyBtn, '保存足迹');
        enableControls();
    }
}


// --- UI State & Helpers ---

function setDirty(value) {
    isDirty = value;
    if (domElements.saveJourneyBtn) {
        domElements.saveJourneyBtn.classList.toggle('btn-warning', isDirty);
    }
    console.log("isDirty set to:", isDirty);
}

function showLoadingIndicator(text = "加载中...") {
    if (domElements.loadingIndicator) {
        domElements.loadingIndicator.textContent = text;
        domElements.loadingIndicator.style.display = 'flex';
    }
}

function hideLoadingIndicator() {
    if (domElements.loadingIndicator) {
        domElements.loadingIndicator.style.display = 'none';
    }
}

function showButtonLoading(button, loadingText = '处理中...') {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<div class="loader loader-sm mr-2"></div><span>${loadingText}</span>`;
}

function hideButtonLoading(button, defaultText = null) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = defaultText || button.dataset.originalText || 'Submit';
}

function setActiveMapTool(toolId) {
    if (!domElements.mapTools) return;
    activeMapTool = toolId;
    isPickingLocation = false;
    
    if (activeView?.container) {
        activeView.container.style.cursor = (toolId === 'add') ? 'crosshair' : 'default';
    }
    
    clearTemporaryGraphics();

    domElements.mapTools.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('active-tool');
        if (btn.id.startsWith(toolId)) {
            btn.classList.add('active-tool');
        }
    });
    
    console.log("Active map tool set to:", activeMapTool);
}

function toggleMapMode() {
    if (!mapView || !sceneView || !activeView) return;
    console.log("Toggling map view...");


    const is3D = activeView.type === '3d';
    const oldView = activeView;
    const newView = is3D ? mapView : sceneView;
    const viewpoint = oldView.viewpoint.clone();

    oldView.container = null;
    newView.container = domElements.viewDiv.id;
    newView.viewpoint = viewpoint;
    activeView = newView;

    if (locateWidget) locateWidget.view = activeView;
    if (searchWidget) searchWidget.view = activeView;

    attachMapClickHandler();

    if (domElements.modeToggleBtn) {
        domElements.modeToggleBtn.textContent = is3D ? '3D 地球' : '2D 地图';
    }

    activeView.when(() => {
        console.log("View switch complete:", activeView.type);
        enableControls();
    }, (error) => {
        console.error("Error after view switch:", error);
        enableControls();
    });
}

// --- Event Listeners Setup ---

function setupEventListeners() {
    console.log("Setting up event listeners...");
    // 确保所有对话框初始为隐藏状态
    if (domElements.pointEditDialog) domElements.pointEditDialog.classList.add('hidden');
    if (domElements.unauthorizedDialog) domElements.unauthorizedDialog.classList.add('hidden');
    if (domElements.confirmDialog) domElements.confirmDialog.classList.add('hidden');
	
	
    domElements.toggleEditPanelBtn?.addEventListener('click', () => 
        domElements.editPanel?.classList.toggle('collapsed'));

    domElements.addPointBtn?.addEventListener('click', () => { 
        openPointDialog('add'); 
        clearMapSelection(); 
    });
    
    domElements.saveJourneyBtn?.addEventListener('click', saveJourney);
    
    domElements.cancelEditBtn?.addEventListener('click', () => {
        if (isDirty) {
            showConfirmDialog('取消编辑', '您有未保存的更改，确定要取消并返回吗？', 
                () => { window.location.href = 'dashboard.html'; });
        } else {
            window.location.href = 'dashboard.html';
        }
    });

    domElements.journeyTitle?.addEventListener('input', () => setDirty(true));
    domElements.journeyDescription?.addEventListener('input', () => setDirty(true));

    domElements.modeToggleBtn?.addEventListener('click', toggleMapMode);
    domElements.addLocationBtn?.addEventListener('click', () => setActiveMapTool('add'));
    domElements.selectLocationBtn?.addEventListener('click', () => setActiveMapTool('select'));
    domElements.resetViewBtn?.addEventListener('click', () => zoomToAllPoints());

    domElements.savePointBtn?.addEventListener('click', handleSavePoint);
    domElements.deletePointBtn?.addEventListener('click', handleDeletePointClick);
    domElements.mapPickLocationBtn?.addEventListener('click', handleMapPickLocationClick);
    domElements.cancelDialogBtn?.addEventListener('click', closePointDialog);
    domElements.closeDialogBtn?.addEventListener('click', closePointDialog);

    domElements.confirmYesBtn?.addEventListener('click', () => {
        const callback = window.confirmCallback;
        if (typeof callback === 'function') callback();
        window.confirmCallback = null;
        if (domElements.confirmDialog) domElements.confirmDialog.classList.add('hidden');
    });
    
    domElements.confirmNoBtn?.addEventListener('click', () => {
        window.confirmCallback = null;
        if (domElements.confirmDialog) domElements.confirmDialog.classList.add('hidden');
    });
    
    domElements.confirmDialog?.querySelector('.close-confirm-btn')?.addEventListener('click', () => {
        window.confirmCallback = null;
        if (domElements.confirmDialog) domElements.confirmDialog.classList.add('hidden');
    });

    domElements.unauthorizedDialog?.querySelectorAll('.close-unauthorized-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            domElements.unauthorizedDialog.classList.add('hidden');
            window.location.href = 'dashboard.html';
        });
    });
    
    console.log("Event listeners attached.");
}


// --- Utility Functions ---
function getCurrentUser() {
    try {
        const userJson = localStorage.getItem('footprintMapCurrentUser');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) { 
        return null; 
    }
}

async function fetchApi(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config = { method: method, headers: headers };
    
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
            
            if (response.status === 401) { 
                console.error("Auth failed via API."); 
                logoutUser(); 
            }
            
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true };
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API call ${method} ${endpoint} failed:`, error);
        showNotification(`请求失败: ${error.message}`, 'error');
        throw error;
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `px-4 py-3 rounded-lg shadow-md transform transition-all duration-300 translate-x-full ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-indigo-500 text-white'
    }`;
    
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => notification.classList.remove('translate-x-full'), 10);
    
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function logoutUser() {
    console.log("Logging out...");
    localStorage.removeItem('footprintMapCurrentUser');
    localStorage.removeItem('authToken');
    window.location.href = 'auth.html?mode=login';
}

function handleGoToError(error) {
    if (error.name !== "AbortError") { 
        console.error("GoTo Error:", error); 
        showNotification("地图导航出错", "error"); 
    }
    
    enableControls();
}

// 添加到fetchApi函数，提供更详细的错误信息
async function fetchApi(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config = { method: method, headers: headers };
    
    if (body && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(body);
    }

    console.log(`API请求 ${method} ${endpoint}`, body);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // 如果非200状态码，尝试读取详细错误信息
        if (!response.ok) {
            let errorData;
            let errorText = '';
            
            try { 
                errorData = await response.json(); 
                errorText = errorData.error || '';
            } catch (e) { 
                errorText = `HTTP错误! 状态码: ${response.status}`; 
            }
            
            if (response.status === 401) { 
                console.error("认证失败通过API."); 
                logoutUser(); 
            }
            
            console.error("API错误:", errorText);
            throw new Error(errorText || `HTTP错误! 状态码: ${response.status}`);
        }
        
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true };
        }
        
        const responseData = await response.json();
        console.log(`API响应 ${method} ${endpoint}:`, responseData);
        return responseData;
    } catch (error) {
        console.error(`API调用 ${method} ${endpoint} 失败:`, error);
        showNotification(`请求失败: ${error.message}`, 'error');
        throw error;
    }
}