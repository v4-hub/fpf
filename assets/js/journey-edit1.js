// assets/js/journey-edit.js

// --- Global State & Constants ---
const API_BASE_URL = 'http://127.0.0.1:5000/api';
let currentUser = null;
let journeyData = null;
let pointsData = []; // Working array for points being edited
let isNewJourney = true;
let currentEditingPointIndex = -1;
let isDirty = false;
let isMapReady = false;
let isPickingLocation = false;
let activeMapTool = 'select';

// ArcGIS Objects (will be assigned inside require)
let Map, MapView, SceneView, GraphicsLayer, Basemap, Graphic, Point, Search, Locate, PopupTemplate, geometryEngine, Polyline, esriConfig;
let map = null;
let mapView = null;
let sceneView = null;
let activeView = null;
let pointsLayer = null;
let tempGraphicsLayer = null;
let selectedGraphic = null;
let locateWidget = null;
let searchWidget = null;
let mapClickHandler = null;
let currentTheme = 'light'; // Track current theme

// DOM Element References
let domElements = {};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Loaded. Initializing journey edit...");
    cacheDomElements();

    if (!checkUserAuthentication()) {
        showUnauthorizedDialog();
        disableEditingUI();
        return;
    }

    initDarkMode(); // Initialize theme toggle first

    // Load data *first*, then initialize map *with* the data
    loadInitialData(); // This will call initializeMap only if data loads successfully

    // Attach general page listeners (like panel toggle, cancel button) that don't depend on map yet
    setupNonMapEventListeners();

    // Warn before leaving if changes are unsaved
    window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
            const confirmationMessage = '您有未保存的更改，确定要离开吗？';
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        }
    });
});

function cacheDomElements() {
    // ... (Keep the same cacheDomElements function as before)
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
        confirmDialogCloseBtn: document.querySelector('#confirmDialog .close-confirm-btn'),
        // Header elements
        dashboardLink: document.getElementById('dashboardLink'),
        loginLink: document.getElementById('loginLink'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        // Theme link
        themeLink: document.getElementById('esri-theme-css')
    };
    console.log("DOM Elements Cached");
}

// --- Authentication & Authorization (Keep existing functions) ---
function checkUserAuthentication() { /* ... */
     currentUser = getCurrentUserFromStorage();
     updateHeaderUI(); // Update header regardless of auth status
     if (currentUser) {
          console.log("User authenticated:", currentUser.username);
          return true;
     } else {
          console.log("User not authenticated.");
          return false; // Let calling function decide action (like show dialog)
     }
 }
function getCurrentUserFromStorage() { /* ... */
    try {
        const userJson = localStorage.getItem('footprintMapCurrentUser');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) { return null; }
}
function updateHeaderUI() { /* ... */
    const loggedIn = !!currentUser;
    domElements.dashboardLink?.classList.toggle('hidden', !loggedIn);
    domElements.loginLink?.classList.toggle('hidden', loggedIn);
}
function showUnauthorizedDialog() { /* ... */ domElements.unauthorizedDialog?.classList.remove('hidden'); }
function disableEditingUI() { /* ... */ /* Keep existing disable function */ }
function enableEditingUI() { /* ... */ /* Keep existing enable function */ }

// --- Dark Mode (Keep existing functions) ---
function initDarkMode() { /* ... */ }
function applyTheme(theme) { /* ... */ }
function setTheme(theme) { /* ... */ }
function switchMapThemeVisuals(theme) { /* ... */ }

// --- Data Loading ---

async function loadInitialData() {
    const urlParams = new URLSearchParams(window.location.search);
    const journeyId = urlParams.get('id');

    if (journeyId) {
        isNewJourney = false;
        await loadJourneyData(journeyId); // This will call initializeMap on success
    } else {
        isNewJourney = true;
        initializeNewJourney(); // This will call initializeMap with empty data
    }
    setDirty(false);
}

async function loadJourneyData(journeyId) {
    showLoadingIndicator("加载足迹数据...");
    try {
        const data = await fetchApi(`/journeys/${journeyId}`);

        if (!currentUser || data.user_id !== currentUser.id) {
            showUnauthorizedDialog();
            disableEditingUI();
            throw new Error("无权编辑此足迹");
        }

        journeyData = data;
        pointsData = data.points ? [...data.points].sort((a, b) => (a.order_index ?? Infinity) - (b.order_index ?? Infinity)) : [];

        if (domElements.journeyTitle) domElements.journeyTitle.value = journeyData.title || '';
        if (domElements.journeyDescription) domElements.journeyDescription.value = journeyData.description || '';

        // Data loaded, now initialize map
        await initializeMap(pointsData); // Pass only points needed for initial map display

        enableEditingUI(); // Enable UI after map is ready *and* data loaded

    } catch (error) {
        console.error("加载足迹数据错误:", error);
        showNotification(`加载失败: ${error.message}`, "error");
        disableEditingUI();
    } finally {
        hideLoadingIndicator();
    }
}

function initializeNewJourney() {
    console.log("Initializing new journey setup...");
    isNewJourney = true;
    journeyData = { id: null, title: '', description: '', visibility: 'private', user_id: currentUser?.id, points: [] };
    pointsData = [];

    if (domElements.journeyTitle) domElements.journeyTitle.value = '';
    if (domElements.journeyDescription) domElements.journeyDescription.value = '';

    // Initialize map with empty points
    initializeMap([]) // Call initializeMap even for new journey
        .then(() => {
             enableEditingUI(); // Enable UI after empty map is ready
        })
        .catch(err => {
            console.error("Failed to initialize map for new journey:", err);
            disableEditingUI();
        });
}

// --- Map Initialization & Logic ---

/**
 * Initializes the ArcGIS Map and Views.
 * This function now encapsulates the require block.
 * @param {Array} initialPointsData - The points array to display initially.
 */
async function initializeMap(initialPointsData = []) {
    console.log("Initializing Map...");
    showLoadingIndicator("初始化地图...");

    // Store the initial data locally for the map setup scope
    pointsData = [...initialPointsData]; // Use the passed data

    return new Promise((resolve, reject) => {
        require([
            "esri/Map", "esri/views/MapView", "esri/views/SceneView",
            "esri/layers/GraphicsLayer", "esri/Basemap", "esri/Graphic",
            "esri/geometry/Point", "esri/widgets/Search", "esri/widgets/Locate",
            "esri/PopupTemplate", "esri/config", "esri/geometry/geometryEngine", "esri/geometry/Polyline" // Add missing ones
        ], function (
            MapModule, MapViewModule, SceneViewModule, GraphicsLayerModule, BasemapModule,
            GraphicModule, PointModule, SearchModule, LocateModule, PopupTemplateModule,
            esriConfigModule, geometryEngineModule, PolylineModule // Assign modules
        ) {
            // --- Assign Modules to Global Scope ---
            Map = MapModule; MapView = MapViewModule; SceneView = SceneViewModule;
            GraphicsLayer = GraphicsLayerModule; Basemap = BasemapModule; Graphic = GraphicModule;
            Point = PointModule; Search = SearchModule; Locate = LocateModule;
            PopupTemplate = PopupTemplateModule; esriConfig = esriConfigModule;
            geometryEngine = geometryEngineModule; Polyline = PolylineModule; // Assign geometry engine

            console.log("ArcGIS modules loaded and assigned.");

            try {
                // --- Map Setup ---
                map = new Map({
                    basemap: currentTheme === 'dark' ? "dark-gray-vector" : "streets-navigation-vector",
                    ground: "world-elevation"
                });

                pointsLayer = new GraphicsLayer({ title: "足迹点", listMode:"hide" });
                tempGraphicsLayer = new GraphicsLayer({ title: "临时点", listMode: "hide"});
                map.addMany([pointsLayer, tempGraphicsLayer]);

                // --- View Setup ---
                const commonViewParams = { map: map, popup: null, constraints: { snapToZoom: false } };
                const initialCenter = pointsData.length > 0 && pointsData[0].longitude && pointsData[0].latitude
                    ? [pointsData[0].longitude, pointsData[0].latitude]
                    : [105, 35]; // Fallback center

                mapView = new MapView({ ...commonViewParams, container: domElements.viewDiv.id, center: initialCenter, zoom: 3 });
                sceneView = new SceneView({ ...commonViewParams, container: null, center: initialCenter, zoom: 3 });
                activeView = mapView; // Start 2D

                // --- Widgets ---
                locateWidget = new Locate({ view: activeView });
                activeView.ui.add(locateWidget, "top-left");
                searchWidget = new Search({ view: activeView });
                activeView.ui.add(searchWidget, "top-right");

                // --- Initial Data Draw ---
                 drawPointsOnMap(); // Draw initial points received
                 updatePointsList(); // Update list based on initial points

                // --- Attach Click Handler ---
                attachMapClickHandler();

                // --- Wait for View Ready ---
                activeView.when(() => {
                    console.log("Initial view ready.");
                    isMapReady = true;
                    hideLoadingIndicator();
                    zoomToAllPoints(); // Zoom after view ready and points drawn
                    setupMapToolListeners(); // Setup map tool listeners HERE
                    resolve(); // Resolve the main promise
                }, (error) => {
                    console.error("Error when view ready:", error);
                    hideLoadingIndicator();
                    reject(error);
                });

            } catch(error) {
                  console.error("Error during map setup:", error);
                  hideLoadingIndicator();
                  reject(error);
            }

        }); // End require
    }); // End Promise
}

function attachMapClickHandler() {
    if (!activeView) return;
    if (mapClickHandler) mapClickHandler.remove();
    mapClickHandler = activeView.on("click", handleMapClick);
    console.log("Map click handler attached.");
}

// --- Map Interaction & Point Handling (Keep existing functions, ensure they use global ArcGIS vars) ---
function handleMapClick(event) { /* ... Keep ... */ }
function handleLocationPick(mapPoint, openDialogNow = false) { /* ... Keep ... */ }
function addTemporaryMapMarker(pointGeometry) { /* ... Keep ... */ }
function clearTemporaryGraphics() { /* ... Keep ... */ }
function clearMapSelection() { /* ... Keep ... */ }
function highlightMapGraphic(graphicToHighlight) { /* ... Keep ... */ }
function findPointIndexByGraphic(graphic) { /* ... Keep ... */ }
function drawPointsOnMap() { /* ... Keep (ensure it uses global Graphic, Point etc.) ... */
     if (!isMapReady || !pointsLayer) { console.warn("drawPointsOnMap called too early."); return; }
     console.log("Drawing points on map...");
     pointsLayer.removeAll();
     pointGraphics = [];

     const markerSymbol = { /* ... define symbol ... */
        type: "simple-marker", style: "circle", size: 8,
        color: currentTheme === 'dark' ? [255, 150, 50, 0.9] : [255, 100, 0, 0.8],
        outline: { color: currentTheme === 'dark' ? [50, 50, 50, 0.7] : [255, 255, 255, 0.7], width: 1 }
    };
     // No popup needed in edit mode, handled by hitTest/dialog
     // const pointPopupTemplate = new PopupTemplate({...});

     pointsData.forEach((point, index) => {
         if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') return;
         const pointGeometry = new Point({ longitude: point.longitude, latitude: point.latitude });
         const attributes = { ...point, originalIndex: index }; // Store index
         // Create graphic using the now globally defined Graphic constructor
         const graphic = new Graphic({ geometry: pointGeometry, symbol: markerSymbol, attributes });
         pointGraphics.push(graphic);
     });
     pointsLayer.addMany(pointGraphics);
     console.log(`Drew ${pointGraphics.length} points.`);
 }
function zoomToAllPoints() { /* ... Keep ... */
     if (!activeView || !activeView.ready) return;
     if (pointGraphics.length > 0 ) {
          activeView.goTo(pointGraphics, { duration: 800, easing: "ease-in-out" }).catch(handleGoToError);
     } else {
          activeView.goTo({ center: [105, 35], zoom: 3 }, {duration: 600}).catch(handleGoToError);
     }
 }
function panToPoint(point) { /* ... Keep ... */
     if (!point || typeof point.latitude !== 'number' || !activeView || !activeView.ready) return;
     activeView.goTo({ center: [point.longitude, point.latitude], scale: 50000 }, { duration: 600 }).catch(handleGoToError);
     const graphicIndex = pointsData.findIndex(p => p === point);
     if (graphicIndex !== -1 && graphicIndex < pointGraphics.length) {
          selectedGraphic = pointGraphics[graphicIndex];
          highlightMapGraphic(selectedGraphic);
     } else { clearMapSelection(); }
 }

// --- Point Data Management (Keep existing CRUD functions: addPoint, updatePoint, deletePoint, reorderPoints) ---
function addPoint(newPointData) { /* ... Keep ... */ }
function updatePoint(index, updatedPointData) { /* ... Keep ... */ }
function deletePoint(index) { /* ... Keep ... */ }
function reorderPoints(oldIndex, newIndex) { /* ... Keep ... */ }

// --- Point Dialog Logic (Keep existing: openPointDialog, closePointDialog, handleSavePoint, handleDeletePointClick, handleMapPickLocationClick) ---
function openPointDialog(mode, pointData = null, index = -1) { /* ... Keep ... */ }
function closePointDialog() { /* ... Keep ... */ }
function handleSavePoint() { /* ... Keep ... */ }
function handleDeletePointClick() { /* ... Keep ... */ }
function handleMapPickLocationClick() { /* ... Keep ... */ }

// --- Points List & Drag/Drop (Keep existing: updatePointsList, createPointListItem, highlightListItem, confirmDeletePoint, initDragAndDrop, updateOrderFromDOM) ---
function updatePointsList() { /* ... Keep ... */ }
function createPointListItem(point, index) { /* ... Keep ... */ }
function highlightListItem(index) { /* ... Keep ... */ }
function confirmDeletePoint(index) { /* ... Keep ... */ }
function initDragAndDrop() { /* ... Keep ... */ }
function updateOrderFromDOM() { /* ... Keep ... */ }

// --- Saving Journey (Keep existing: saveJourney) ---
async function saveJourney() { /* ... Keep ... */ }

// --- UI State & Helpers (Keep existing: setDirty, showLoadingIndicator, hideLoadingIndicator, showButtonLoading, hideButtonLoading, setActiveMapTool, showConfirmDialog, fetchApi, showNotification, logoutUser, handleGoToError, debounce) ---
function setDirty(value) { /* ... Keep ... */ }
function showLoadingIndicator(text = "加载中...") { /* ... Keep ... */ }
function hideLoadingIndicator() { /* ... Keep ... */ }
function showButtonLoading(button, loadingText = '处理中...') { /* ... Keep ... */ }
function hideButtonLoading(button, defaultText = null) { /* ... Keep ... */ }
function setActiveMapTool(toolId) { /* ... Keep ... */ }
function showConfirmDialog(title, message, onConfirm) { /* ... Keep ... */ }
async function fetchApi(endpoint, method = 'GET', body = null) { /* ... Keep ... */ }
function showNotification(message, type = 'info', duration = 3000) { /* ... Keep ... */ }
function logoutUser() { /* ... Keep ... */ }
function handleGoToError(error) { /* ... Keep ... */ }
function debounce(func, wait) { /* ... Keep ... */ }

// --- View Switching ---
async function toggleMapMode() {
    if (!mapView || !sceneView || !activeView || !activeView.ready || isAnimating || isSettingCenter) return;
    console.log("Toggling map view...");
    disableEditingUI(); // Disable during switch

    const is3D = activeView.type === '3d';
    const oldView = activeView;
    const newView = is3D ? mapView : sceneView;
    const viewpoint = oldView.viewpoint?.clone();

    oldView.container = null; // Detach old
    newView.container = domElements.viewDiv.id; // Attach new
    if (viewpoint) newView.viewpoint = viewpoint;
    activeView = newView;

    // Update widgets
    if (locateWidget) locateWidget.view = activeView;
    if (searchWidget) searchWidget.view = activeView;

    attachMapClickHandler(); // Re-attach click handler

    // Update button text (use textContent for simplicity)
    if (domElements.modeToggleBtn) {
         domElements.modeToggleBtn.textContent = is3D ? '3D 地球' : '2D 地图';
    }

    try {
        await activeView.when(); // Wait for new view to be ready
        console.log("View switch complete:", activeView.type);
         // Ensure points are visible in new view (might require redraw if symbols differ)
         // drawPointsOnMap(); // Optional: Redraw if necessary
         zoomToAllPoints(); // Adjust view to points after switch
    } catch (error) {
        console.error("Error after view switch:", error);
    } finally {
        enableEditingUI(); // Re-enable UI
    }
}

// --- Event Listeners Setup ---

// Setup listeners that DON'T depend on the map being ready
function setupNonMapEventListeners() {
     console.log("Setting up non-map event listeners...");
     // Panel Toggle
     domElements.toggleEditPanelBtn?.addEventListener('click', () => domElements.editPanel?.classList.toggle('collapsed'));
     // Cancel Edit (handles dirty check)
     domElements.cancelEditBtn?.addEventListener('click', () => {
         if (isDirty) {
             showConfirmDialog('取消编辑', '您有未保存的更改，确定要取消并返回控制台吗？', () => { window.location.href = 'dashboard.html'; });
         } else { window.location.href = 'dashboard.html'; }
     });
     // Dialog Cancel/Close
     domElements.cancelDialogBtn?.addEventListener('click', closePointDialog);
     domElements.closeDialogBtn?.addEventListener('click', closePointDialog);
     // Confirmation Dialog Buttons
     domElements.confirmYesBtn?.addEventListener('click', () => { /* ... Keep existing confirm logic ... */ });
     domElements.confirmNoBtn?.addEventListener('click', () => { /* ... Keep existing confirm logic ... */ });
     domElements.confirmDialogCloseBtn?.addEventListener('click', () => { /* ... Keep existing confirm logic ... */ });
     // Unauthorized Dialog Buttons
     domElements.unauthorizedDialog?.querySelectorAll('.close-unauthorized-btn').forEach(btn => btn.addEventListener('click', () => { /* ... Keep existing ... */ }));
     // Dark Mode Toggle in Header
     domElements.darkModeToggle?.addEventListener('click', () => { /* Already handled in initDarkMode */ });
     // Form Input Change Detection (mark dirty)
     [domElements.journeyTitle, domElements.journeyDescription].forEach(el => el?.addEventListener('input', () => setDirty(true)));
     [domElements.pointName, domElements.pointTime, domElements.pointDate, domElements.pointContent, domElements.pointLatitude, domElements.pointLongitude].forEach(el => el?.addEventListener('input', () => { if (!domElements.pointEditDialog?.classList.contains('hidden')) setDirty(true); }));

     // Point Edit Dialog Buttons (Save/Delete/MapPick)
     domElements.savePointBtn?.addEventListener('click', handleSavePoint);
     domElements.deletePointBtn?.addEventListener('click', handleDeletePointClick);
     domElements.mapPickLocationBtn?.addEventListener('click', handleMapPickLocationClick);

     // Save Journey Button
     domElements.saveJourneyBtn?.addEventListener('click', saveJourney); // Moved here, doesn't strictly need map

     console.log("Non-map listeners attached.");
}

// Setup listeners that DO depend on the map being ready
function setupMapToolListeners() {
     console.log("Setting up map tool listeners...");
     // Map Tools
     domElements.modeToggleBtn?.addEventListener('click', toggleMapMode);
     domElements.addLocationBtn?.addEventListener('click', () => setActiveMapTool('add'));
     domElements.selectLocationBtn?.addEventListener('click', () => setActiveMapTool('select'));
     domElements.resetViewBtn?.addEventListener('click', () => zoomToAllPoints());
     console.log("Map tool listeners attached.");
}