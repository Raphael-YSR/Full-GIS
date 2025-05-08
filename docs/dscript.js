document.addEventListener('DOMContentLoaded', function () {
    window.map = L.map('map', {
        center: [-0.2, 37.6],
        zoom: 9.25,
        zoomControl: false,
        zoomAnimation: true,
        fadeAnimation: true
    });

    // --- Define Map Layers ---

    const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.6
    });


    const googleHybridLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    const googleSatLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    const baseLayers = {
        'osm': osmLayer,
        'carto': cartoLayer,
        'googleHybrid': googleHybridLayer,
        'googleSat': googleSatLayer
    };

    cartoLayer.addTo(map);
    let currentLayer = 'carto';
    updateLabelColors(currentLayer); // Initial label color setting

    function changeMapLayer(layerName) {
        map.removeLayer(baseLayers[currentLayer]);
        baseLayers[layerName].addTo(map);
        currentLayer = layerName;
        updateLabelColors(layerName); // Update label colors when layer changes

    }

    // --- Label Color Management ---
    function updateLabelColors(layerName) {
        const isDarkBackground = layerName === 'googleHybrid' || layerName === 'googleSat';
        const mapContainer = document.getElementById('map'); // Get the map container
        if (isDarkBackground) {
            mapContainer.classList.add('dark-mode');
            mapContainer.classList.remove('light-mode');
        } else {
            mapContainer.classList.add('light-mode');
            mapContainer.classList.remove('dark-mode');
        }
        // CSS rules will handle the actual color change based on these classes
    }

    // --- Global Variables & Popups ---
    const allMarkers = [];
    const activeFilters = {
        status: {},
        types: {},
        county: 'all',
        showNames: true // Default show names
    };
    const zoomThresholdForLabels = 12; // Show labels at zoom level 12 or higher

    // drawing styles globally so they can be used by multiple functions
    const drawingStyles = {
        polyline: {
            color: '#1E88E5',  // Blue color for lines
            weight: 1,
            opacity: 0.8,
            dashArray: '1, 1'  // Add dashed style to lines
        },
        polygon: {
            color: '#43A047',  // Green color for polygons
            fillColor: '#43A047',
            fillOpacity: 0.2,
            weight: 1
        },
        rectangle: {
            color: '#E53935',  // Red color for rectangles
            fillColor: '#E53935',
            fillOpacity: 0.2,
            weight: 1
        },
        marker: {
            icon: new L.Icon({
                iconUrl: 'images/pr-black.png',
                iconSize: [12, 12],
                iconAnchor: [7, 15]
            })
        },
        circle: {
            color: '#FF9800',  // Orange color for circles
            fillColor: '#FF9800',
            fillOpacity: 0.2,
            weight: 1
        },
        measurement: {  // Special style for measurement lines
            color: '#9C27B0',  // Purple for measurement
            weight: 1,
            opacity: 0.8,
            dashArray: '2, 2'  
        }
    };
    // Project detail popup setup
    const projectDetailPopup = document.createElement('div');
        projectDetailPopup.className = 'layer-popup project-detail-popup';
        projectDetailPopup.style.right = '10px';
        projectDetailPopup.style.left = 'auto';
        projectDetailPopup.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; // Add this line
        projectDetailPopup.innerHTML = `
            <span class="close-btn" onclick="closeProjectDetailPopup()">×</span>
            <div id="project-detail-content"></div>
    `;
    document.body.appendChild(projectDetailPopup);

    window.closeProjectDetailPopup = function() {
        projectDetailPopup.classList.remove("show");
        setTimeout(() => {
            projectDetailPopup.style.display = "none";
        }, 300);
    };

    function showProjectDetail(project) {
         const content = document.getElementById('project-detail-content');
         

         // Calculate progress bar width
         const progress = project.progress !== null ? project.progress : 0;
         const progressBarHtml = `
             <div style="margin-top: 8px;">
                 <div style="background-color: #444; height: 12px; border-radius: 6px; overflow: hidden;">
                     <div style="background-color: #4CAF50; height: 100%; width: ${progress}%;"></div>
                 </div>
                 <div style="text-align: right; font-size: 12px; margin-top: 2px;">${progress}%</div>
             </div>
         `;
         
         
         // Truncate description if needed
         const maxDescLength = 150;
         let description = project.description || 'No description available';
         let readMoreBtn = '';
         
         if (description.length > maxDescLength) {
             const shortDesc = description.substring(0, maxDescLength) + '...';
             // Use backticks for template literals and escape the description properly
             readMoreBtn = `<div style="margin-top: 5px;"><button class="btn read-more-btn" style="font-size: 10px; padding: 3px 8px;" onclick="toggleFullDescription(this, \`${encodeURIComponent(description)}\`)">READ MORE</button></div>`;
             description = shortDesc;
         }
         
         content.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px;">${project.project_name ? project.project_name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Unnamed Project'}</h3>
            <div><strong>STATUS:</strong> ${project.status || 'N/A'}</div>
            <div><strong>COUNTY:</strong> ${project.county || 'N/A'}</div>
            <div style="margin-top: 10px;"><strong>DESCRIPTION:</strong></div>
            <div class="project-description">${description}</div>
            ${readMoreBtn}
            <div style="margin-top: 10px;"><strong>PROGRESS:</strong></div>
            ${progressBarHtml}
        `;
         
         projectDetailPopup.style.display = "block";
         // Use requestAnimationFrame to ensure the display style is applied before adding the class
         requestAnimationFrame(() => {
             projectDetailPopup.classList.add("show");
         });
    }
    
    window.toggleFullDescription = function(button, encodedDesc) {
        // Decode using backticks if necessary or adjust based on how it's encoded
        const description = decodeURIComponent(encodedDesc);
        const descElement = button.parentElement.previousElementSibling;
        
        if (button.textContent === "READ MORE") {
            descElement.textContent = description;
            button.textContent = "READ LESS";
        } else {
            descElement.textContent = description.substring(0, 150) + '...';
            button.textContent = "READ MORE";
        }
    };

    // --- Filter Initialization ---
    const statusMapping = {
         'COMPLETE': 'complete',
         'IN PROGRESS': 'ongoing',
         'PLANNING & DESIGN': 'planning',
         'DESIGN': 'design'
     };
     Object.keys(statusMapping).forEach(status => {
         activeFilters.status[statusMapping[status]] = true;
     });
     const typeCategories = ['Water', 'Sanitation', 'Boreholes', 'Dams', 'Irrigation', 'Other'];
     typeCategories.forEach(type => {
         activeFilters.types[type.toLowerCase()] = true;
     });

    // --- Fetch Project Locations ---
    const apiUrl = '/api/projects/locations';
    //console.log(`Fetching data from ${apiUrl}...`);

    fetch(apiUrl)
        .then(response => {
             if (!response.ok) {
                 return response.json().then(errData => {
                     throw new Error(`HTTP error! Status: ${response.status}. Details: ${JSON.stringify(errData)}`);
                 }).catch(() => {
                     throw new Error(`HTTP error! Status: ${response.status}. Could not parse error response.`);
                 });
             }
             // console.log("Received response, parsing JSON...");
             return response.json();
        })
        .then(projects => {

             if (projects.length === 0) {
                 // console.warn("No project locations found in the database or returned by API.");
                 L.popup().setLatLng(map.getCenter()).setContent("No projects found.").openOn(map);
                 return;
             }

            // --- Add Markers to the Map ---
            projects.forEach(project => {
                createProjectMarker(project);
            });


            initializeFilterUI(); // Setup filters
            updateFiltersFromUI(); // Ensure initial filter state is correct
            applyFilters(); // Apply initial filters (which includes label check)
        })
            .catch(error => {
                // console.error('Error fetching or processing project locations:', error);
                showErrorToast(error.message);
            });

            // Add this new function (ideally right after your showCountyToast function)
            function showErrorToast(errorMessage) {
            // Remove any existing toast
            const existingToast = document.getElementById('error-toast');
            if (existingToast) {
                existingToast.remove();
            }
            
            // Create toast element
            const toast = document.createElement('div');
            toast.id = 'error-toast';
            toast.style.position = 'absolute';
            toast.style.top = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 20px';
            toast.style.background = '#e53935'; 
            toast.style.color = 'white';
            toast.style.borderRadius = '5px';
            toast.style.zIndex = '1000';
            toast.style.fontFamily = "'ABCFavoritMono-Bold', monospace";
            toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            
            // Add error header and message
            toast.innerHTML = `<div style="font-weight:bold;">ERROR LOADING PROJECTS DATA</div>`;
            
            // Add to document
            document.body.appendChild(toast);
            
            // Trigger animation
            setTimeout(() => {
                toast.style.opacity = '1';
            }, 10);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 8000);
            }

    // --- Function to Create Project Marker (Using DivIcon) ---
    function createProjectMarker(project) {
        const lat = parseFloat(project.lat);
        const lng = parseFloat(project.lng);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Skipping project "${project.project_name}" due to invalid coordinates: lat=${project.lat}, lng=${project.lng}`);
            return;
        }

        let iconUrl = '';
        let status = project.status ? project.status.toLowerCase().trim() : 'unknown'; // Normalize status

        // Determine icon based on project status
        switch (status) {
            case 'complete':
                iconUrl = 'images/pr-blue.png';
                break;
            case 'planning & design': // Handle combined status
            case 'planning':
                iconUrl = 'images/pr-black.png';
                status = 'planning'; // Standardize
                break;
            case 'ongoing':
                iconUrl = 'images/pr-gray.png';
                status = 'ongoing'; // Standardize
                break;
            case 'design':
                iconUrl = 'images/pr-load.png';
                break;
            default:
                iconUrl = 'images/pr-hollow.png';
                status = 'unknown';
        }

        // Size of the image icon 
        const iconSize = [7, 7]; 

        // Create HTML for the DivIcon
         const markerHtml = `
         <div class="project-marker-content">
             <img src="${iconUrl}" width="${iconSize[0]}" height="${iconSize[1]}" alt="Project">
             ${project.project_name ? `<span class="project-label-text">${project.project_name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>` : ''}
         </div>
     `;
     

        const projectDivIcon = L.divIcon({
            html: markerHtml,
            className: 'project-marker-divicon', // Base class for styling container
            iconSize: iconSize, // Set to image size for anchor calculation
            iconAnchor: [iconSize[0] / 2, iconSize[1]] // Anchor at the bottom-center of the image
        });

        const marker = L.marker([lat, lng], {
            icon: projectDivIcon
        });

        // Click event for detail popup
        marker.on('click', function() {
            // console.log(`Marker clicked: ${project.project_name || 'Unnamed'}`);
            showProjectDetail(project);
        });

        // Store project type normalized to lowercase
        let rawType = project.project_type ? project.project_type.toLowerCase().trim() : 'other';
        //to match UI selection
        switch (rawType) {
            case 'dam':
                rawType = 'dams';
                break;
            case 'sewer':
                rawType = 'sanitation'; 
                break;
        }
        const projectType = rawType;


        // Store marker with metadata for filtering
        allMarkers.push({
            marker: marker,
            project: project,
            status: status,
            type: projectType,
            county: project.county ? project.county.toLowerCase() : ''
        });

    }

    // --- Function to Update Label Visibility (For DivIcon labels) ---
    function updateLabelVisibility() {
        const currentZoom = map.getZoom();
        const shouldShowLabels = currentZoom >= zoomThresholdForLabels && activeFilters.showNames;
        const mapBounds = map.getBounds(); // Get current map viewport bounds


        let visibleLabelCount = 0;

        allMarkers.forEach(item => {
            const marker = item.marker;

            // Check if marker is currently added to the map
            if (map.hasLayer(marker)) {
                const markerElement = marker.getElement(); // Get the DivIcon's DOM element
                if (!markerElement) return; // Skip if element not rendered yet

                const markerLatLng = marker.getLatLng();

                // Check if marker is within current map bounds
                if (shouldShowLabels && mapBounds.contains(markerLatLng)) {
                    // Add class to show the label via CSS
                    if (!markerElement.classList.contains('label-visible')) {
                        markerElement.classList.add('label-visible');
                    }
                    visibleLabelCount++;
                } else {
                    // Remove class to hide the label via CSS
                    if (markerElement.classList.contains('label-visible')) {
                        markerElement.classList.remove('label-visible');
                    }
                }
            } else {
                // Ensure class is removed if marker is not on map
                const markerElement = marker.getElement();
                if (markerElement && markerElement.classList.contains('label-visible')) {
                    markerElement.classList.remove('label-visible');
                }
            }
        });
    }

// Fetch the counties GeoJSON
let countyLayer; //accessed globally

fetch('/api/countyBounds')
    .then(response => response.json())
    .then(data => {
        countyLayer = L.geoJSON(data, {
            style: {
                color: "#4a7ebb",       // Border color - medium blue
                weight: 1,              // Thin border (1px)
                fillColor: "#a3c7eb",   // Fill color - light blue
                fillOpacity: 0.2,       // Very faded fill (20% opacity)
                opacity: 0.5,           // Border opacity (80%)
                dashArray: ""           // Solid line
            },
            onEachFeature: (feature, layer) => {
                // County name for toast
                const countyName = feature.properties.county_name;
                
                layer.on('click', function() {
                    // Show toast notification instead of popup
                    showCountyToast(countyName);
                });
                
                // Highlight county on hover
                layer.on({
                    mouseover: function(e) {
                        const layer = e.target;
                        layer.setStyle({
                            fillOpacity: 0.3,
                            fillColor: "#6fa4e0"
                        });
                        layer.bringToFront();
                    },
                    mouseout: function(e) {
                        const layer = e.target;
                        layer.setStyle({
                            fillOpacity: 0.2,
                            fillColor: "#a3c7eb"
                        });
                    }
                });
            }
        });
        
        // Don't add to map by default - will be toggled by checkbox
        
        // Set up the checkbox listener for county visibility
        const showCountyCheckbox = document.querySelector('.checkbox.showCounty');
        if (showCountyCheckbox) {
            showCountyCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    if (!map.hasLayer(countyLayer)) {
                        countyLayer.addTo(map);
                    }
                } else {
                    if (map.hasLayer(countyLayer)) {
                        map.removeLayer(countyLayer);
                    }
                }
            });
        }
    })
    .catch(error => {
        console.error('Error loading counties:', error);
        // alert('Failed to load county data. See console for details.');
    });

// Shows county toast when county is clicked
    function showCountyToast(countyName) {
    // Remove any existing toast
    const existingToast = document.getElementById('county-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'county-toast';
    toast.style.position = 'absolute';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '10px 20px';
    toast.style.background = '#314591';
    toast.style.color = 'white';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1000';
    toast.style.fontFamily = "'ABCFavoritMono-Bold', monospace";
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    
    // Format the county name to uppercase and add "COUNTY"
    toast.textContent = countyName.toUpperCase() + " COUNTY";
    
    // Add to document
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.style.opacity = '0.97';
    }, 10);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}


// --- Filter UI and Logic ---
function initializeFilterUI() {
    // console.log("Initializing filter UI...");


    // Set all checkboxes to checked by default
    document.querySelectorAll('.option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
    });
    document.querySelectorAll('.sub-option').forEach(checkbox => {
        checkbox.checked = true;
    });
    
// County selection
const countySelect = document.getElementById('county-select');
if (countySelect) {
    countySelect.addEventListener('change', function() {
        activeFilters.county = this.value.toLowerCase(); // Ensure lowercase comparison
        applyFilters();
        
        // Add zoom to selected county
        if (this.value !== 'all' && countyLayer) {
            let selectedCountyLayer;
            
            countyLayer.eachLayer(layer => {
                const countyName = layer.feature.properties.county_name.toLowerCase();
                if (countyName === this.value.toLowerCase()) {
                    selectedCountyLayer = layer;
                }
            });
            
            if (selectedCountyLayer) {
                // Fit to bounds with padding and max zoom
                map.fitBounds(selectedCountyLayer.getBounds(), {
                    padding: [50, 50],  
                    maxZoom: 12         
                });
            }
        } else if (this.value === 'all') {
            map.flyTo([-0.2, 37.6], 9.25, {
                duration: 1.5,  // Animation duration in seconds
                easeLinearity: 0.25
            });
        }
    });
}
    
    // Initialize show names checkbox
    const showNamesCheckbox = document.querySelector('.checkbox.showNames');
    if (showNamesCheckbox) showNamesCheckbox.checked = activeFilters.showNames;

    // Setup all event listeners for filters
    setupFilterEventListeners();
    // console.log("Filter UI initialized.");
}

function setupFilterEventListeners() {
    // Status main checkboxes (COMPLETE, IN PROGRESS, PLANNING & DESIGN)
    document.querySelectorAll('.option input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const optionId = this.id.replace('option', '');
            const subOptions = document.querySelectorAll(`.sub-option[data-main="${optionId}"]`);
            
            // When main checkbox changes, update all its suboptions to match
            subOptions.forEach(subOption => subOption.checked = this.checked);
            
            // Update filter state from UI elements
            updateFiltersFromUI();
            
            // Apply the filters to update map markers
            applyFilters();
        });
    });

    // Sub-option checkboxes (Water, Sanitation, etc.)
    document.querySelectorAll('.sub-option').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // When a suboption changes, check if we need to update the parent checkbox
            const mainOptionId = this.getAttribute('data-main');
            const mainCheckbox = document.getElementById(`option${mainOptionId}`);
            const relatedSubOptions = document.querySelectorAll(`.sub-option[data-main="${mainOptionId}"]`);
            
            // If any suboption is checked, ensure the parent checkbox is also checked
            const anySubOptionChecked = Array.from(relatedSubOptions).some(opt => opt.checked);
            mainCheckbox.checked = anySubOptionChecked;
            
            // Update filter state and apply
            updateFiltersFromUI();
            applyFilters();
        });
    });

    // County selection
    const countySelect = document.getElementById('county-select');
    if (countySelect) {
        countySelect.addEventListener('change', function() {
            activeFilters.county = this.value.toLowerCase(); // Ensure lowercase comparison
            applyFilters();
            // console.log(`County filter changed to: ${this.value}`);
        });
    }

    // Show names checkbox
    const showNamesCheckbox = document.querySelector('.checkbox.showNames');
    if (showNamesCheckbox) {
        showNamesCheckbox.addEventListener('change', function() {
            activeFilters.showNames = this.checked;
            // No need to call applyFilters() just for toggling names
            updateLabelVisibility(); // Just update the label visibility directly
            // console.log(`Show project names: ${this.checked}`);
        });
    }
}

// Modified updateFiltersFromUI function to handle exclusion logic
function updateFiltersFromUI() {

    // Define clear mapping between status options and their values
    const statusMap = {
        '1': 'complete',
        '2': 'ongoing',    // This matches 'IN PROGRESS' in UI
        '3': 'planning'    // This matches 'PLANNING & DESIGN' in UI
    };

    // Reset filters to empty objects
    activeFilters.status = {};
    activeFilters.types = {};
    activeFilters.exclusions = []; // New array to track status+type combinations to exclude

    // First, process all main option checkboxes (status categories)
    document.querySelectorAll('.option input[type="checkbox"]').forEach(checkbox => {
        const mainOption = checkbox.id.replace('option', '');
        const statusKey = statusMap[mainOption];
        
        if (statusKey) {
            if (checkbox.checked) {
                // Add the status to active filters
                activeFilters.status[statusKey] = true;
                
                // Add special handling for combined statuses
                if (statusKey === 'planning') {
                    activeFilters.status['design'] = true; // Make sure 'design' status is included with 'planning'
                }
            } else {
                // Process unchecked main options and their suboptions for exclusions
                // Track all unchecked type suboptions for this status
                document.querySelectorAll(`.sub-option[data-main="${mainOption}"]`).forEach(subCheckbox => {
                    if (!subCheckbox.checked) {
                        const typeKey = subCheckbox.parentElement.textContent.trim().toLowerCase();
                        if (typeKey) {
                            // Add this status+type combo to exclusions
                            activeFilters.exclusions.push({
                                status: statusKey,
                                type: typeKey
                            });
                        }
                    }
                });
            }
        }
    });
    

    // Process suboptions (project types) that are checked under checked parent options
    document.querySelectorAll('.sub-option').forEach(checkbox => {
        const mainOption = checkbox.getAttribute('data-main');
        const parentCheckbox = document.getElementById(`option${mainOption}`);
        
        if (parentCheckbox && parentCheckbox.checked) {
            const typeKey = checkbox.parentElement.textContent.trim().toLowerCase();
            
            if (checkbox.checked) {
                // Add this type to active filters
                if (typeKey) {
                    activeFilters.types[typeKey] = true;
                }
            } else {
                // If parent is checked but this type is unchecked, add to exclusions
                const statusKey = statusMap[mainOption];
                if (statusKey && typeKey) {
                    activeFilters.exclusions.push({
                        status: statusKey,
                        type: typeKey
                    });
                }
            }
        }
    });

    // Make sure county filter is up-to-date
    const countySelect = document.getElementById('county-select');
    if (countySelect) {
        activeFilters.county = countySelect.value.toLowerCase();
    }

    //console.log("Updated filters:", JSON.stringify(activeFilters));
}


// function to handle exclusion logic and county filtering
function applyFilters() {
    // console.log("Applying filters...", JSON.stringify(activeFilters));
    let shownCount = 0;

    allMarkers.forEach(item => {
        const { marker, status, type, county } = item;

        // Check if the marker's status is in our active filters
        const statusMatch = activeFilters.status[status] === true;
        
        // Check if the marker's type is in our active filters
        const typeMatch = activeFilters.types[type] === true;
        
        // Check if the marker's county matches the filter (or if 'all' counties are shown)
        // Update this line in your applyFilters() function
        const countyMatch = activeFilters.county === 'all' || 
                    county.toLowerCase().trim() === activeFilters.county.toLowerCase().trim();

        // Check if this marker should be excluded based on specific status+type combination
        const isExcluded = activeFilters.exclusions.some(exclusion => 
            exclusion.status === status && exclusion.type === type
        );

        // Only show markers that match ALL criteria AND are not excluded
        
        const shouldShow = statusMatch && typeMatch && countyMatch && !isExcluded;

        if (shouldShow) {
            if (!map.hasLayer(marker)) {
                map.addLayer(marker);
            }
            shownCount++;
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });

    // Filter county layer if it exists
    if (countyLayer) {
        if (activeFilters.county !== 'all') {
            // Filter to show only the selected county
            countyLayer.eachLayer(layer => {
                const countyName = layer.feature.properties.county_name.toLowerCase();
                if (countyName === activeFilters.county) {
                    layer.setStyle({
                        opacity: 0.8,
                        weight: 2,
                        fillOpacity: 0.3
                    });
                } else {
                    layer.setStyle({
                        opacity: 0.2,
                        weight: 1,
                        fillOpacity: 0.1
                    });
                }
            });
        } else {
            // Reset all counties to default style
            countyLayer.eachLayer(layer => {
                layer.setStyle({
                    color: "#4a7ebb",
                    weight: 1,
                    fillColor: "#a3c7eb",
                    fillOpacity: 0.2,
                    opacity: 0.5
                });
            });
        }
    }

    // Update label visibility AFTER markers are added/removed
    updateLabelVisibility();

    //console.log(`Filters applied. ${shownCount} markers are currently visible.`);
}


    // Update labels immediately when map stops moving or zooming
    map.on('zoomend moveend', updateLabelVisibility);

    // Optional: Update labels more frequently during pan/zoom for smoother hide/show near viewport edges
    // map.on('move zoom', L.Util.throttle(updateLabelVisibility, 100)); // Throttle to avoid performance hit

    // --- Print and Layer UI Control Logic ---
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            console.log("Print button clicked");
            // Simple browser print
            window.print();
        });
    }

    function showLayerPopup() {
        // console.log("Opening layer popup");
        const layerPopup = document.getElementById("layerPopup");
        if (layerPopup) {
            layerPopup.style.display = "block";
            requestAnimationFrame(() => { // Ensure display:block is applied first
                layerPopup.classList.add("show");
            });
        } else {
           // console.error("Layer popup element not found!");
        }
    }

    function closeLayerPopup() {
        // console.log("Closing layer popup");
        const layerPopup = document.getElementById("layerPopup");
        if (layerPopup) {
            layerPopup.classList.remove("show");
            setTimeout(() => { // Wait for transition to finish
                layerPopup.style.display = "none";
            }, 300); // Match transition duration
        } else {
            console.error("Layer popup element not found!");
        }
    }

    function toggleSubOptions(option) {
        const subOptions = document.getElementById("subOptions" + option);
        const icon = document.getElementById("icon" + option);

        if (subOptions && icon) {
            const isVisible = subOptions.style.display === "block";
            subOptions.style.display = isVisible ? "none" : "block";
            icon.textContent = isVisible ? "+" : "−";
            //console.log(`Toggled sub-options for option ${option}`);
        } else {
            console.error("Sub-options or icon element not found for option:", option);
        }
    }

    function toggleMapLayers() {
        const mapLayerOptions = document.getElementById("mapLayerOptions");
        const mapLayersIcon = document.getElementById("mapLayersIcon");

        if (mapLayerOptions && mapLayersIcon) {
            const isVisible = mapLayerOptions.style.display === "block";
            mapLayerOptions.style.display = isVisible ? "none" : "block";
            mapLayersIcon.textContent = isVisible ? "+" : "−";
            // console.log("Toggled map layer options");
        } else {
            console.error("Map layer options or icon element not found");
        }
    }

    // Attach event handlers
    const layersBtn = document.getElementById("layers-btn");
    if (layersBtn) layersBtn.addEventListener("click", showLayerPopup);

    const closeBtn = document.querySelector("#layerPopup .close-btn"); // Be specific
    if (closeBtn) closeBtn.addEventListener("click", closeLayerPopup);

    // Make functions globally available if needed by HTML onclick attributes
    window.closeLayerPopup = closeLayerPopup;
    window.toggleSubOptions = toggleSubOptions;
    window.toggleMapLayers = toggleMapLayers;
    window.changeMapLayer = changeMapLayer; // Ensure this is global if called from HTML radio buttons




    // Initialize drawing features
initializeDrawControls();

// Add click handlers for the drawing tool buttons
setupDrawingToolButtons();

function initializeDrawControls() {
    // Create a FeatureGroup to store editable layers
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Initialize the draw control and pass it the FeatureGroup of editable layers
    drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polyline: {
                shapeOptions: drawingStyles.polyline,
                metric: true
            },
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>Error:</strong> Polygon edges cannot cross!'
                },
                shapeOptions: drawingStyles.polygon,
                showArea: true,
                metric: true
            },
            rectangle: {
                shapeOptions: drawingStyles.rectangle,
                showArea: true,
                metric: true
            },
            circle: {
                shapeOptions: {
                    color: '#FF9800',  // Orange color for circles
                    fillColor: '#FF9800',
                    fillOpacity: 0.2,
                    weight: 1
                },
                showRadius: true,
                metric: true
            },

            circlemarker: false,
            marker: {
                icon: drawingStyles.marker.icon
            }
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    


drawControl.options.draw.polyline.shapeOptions = drawingStyles.polyline;
drawControl.options.draw.polygon.shapeOptions = drawingStyles.polygon;
drawControl.options.draw.rectangle.shapeOptions = drawingStyles.rectangle;    
   


// Handle the created event to add the layer to our drawnItems group
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        
        // For polylines, add distance measurement
        if (event.layerType === 'polyline') {
            const length = calculatePolylineDistance(layer);
            layer.bindPopup(`Distance: ${length.toFixed(2)} meters`);
        }
        
        // For polygons and rectangles, add area measurement
        if (event.layerType === 'polygon' || event.layerType === 'rectangle') {
            const area = calculatePolygonArea(layer);
            layer.bindPopup(`Area: ${area.toFixed(2)} square meters`);
        }
        
        drawnItems.addLayer(layer);
    });
}

function setupDrawingToolButtons() {
    const optionIcons = document.querySelectorAll('.search-options .option-icon');
    let activeIcon = null;
    let activeHandler = null;

    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('click', function() {
        document.querySelector('.search-options').classList.remove('hidden');
    });

    optionIcons.forEach((icon, index) => {
        icon.addEventListener('click', function() {
            if (activeIcon === this) {
                this.classList.remove('active-tool');
                activeIcon = null;

                if (activeHandler && activeHandler.disable) {
                    activeHandler.disable();
                    activeHandler = null;
                }
                return;
            }

            if (activeIcon) {
                activeIcon.classList.remove('active-tool');
            }
            this.classList.add('active-tool');
            activeIcon = this;

            if (activeHandler && activeHandler.disable) {
                activeHandler.disable();
            }

            let handler;
            switch(index) {
                case 0:
                    handler = new L.Draw.Polyline(map, {
                        ...drawControl.options.draw.polyline,
                        shapeOptions: drawingStyles.measurement
                    });
                    break;
                case 1:
                    handler = new L.Draw.Polyline(map, drawControl.options.draw.polyline);
                    break;
                case 2:
                    handler = new L.Draw.Polygon(map, drawControl.options.draw.polygon);
                    break;
                case 3:
                    handler = new L.Draw.Marker(map, { icon: drawingStyles.marker.icon });
                    break;
                case 4:
                    handler = new L.Draw.Rectangle(map, drawControl.options.draw.rectangle);
                    break;
                case 5:
                    handler = new L.Draw.Circle(map, drawControl.options.draw.circle);
                    break;
            }

            if (handler) {
                activeHandler = handler;
                handler.enable();
            }

            document.getElementById('export_features').style.display = 'inline-block';
        });
    });
}

// Calculate the distance of a polyline in meters
function calculatePolylineDistance(polyline) {
    const latlngs = polyline.getLatLngs();
    let distance = 0;
    
    for (let i = 0; i < latlngs.length - 1; i++) {
        distance += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    
    return distance;
}

// Calculate the area of a polygon in square meters
function calculatePolygonArea(polygon) {
    return L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
}

// Export Button Management
const exportButton = document.getElementById('export_features');
if (exportButton) {
    // Initially hide the export button
    exportButton.style.display = 'none';
    
    // Show export button when features are added
    map.on(L.Draw.Event.CREATED, function() {
        exportButton.style.display = 'inline-block';
    });
    
    // Hide export button if all features are removed
    map.on(L.Draw.Event.DELETED, function() {
        if (drawnItems.getLayers().length === 0) {
            exportButton.style.display = 'none';
        }
    });
    
    // Add export functionality
    exportButton.addEventListener('click', function() {
        exportDrawnFeatures();
    });
}

// Function to export drawn features
function exportDrawnFeatures() {
    const layers = drawnItems.getLayers();
    
    if (layers.length === 0) {
        alert('No features to export. Draw some features on the map first.');
        return;
    }
    
    const geoJson = drawnItems.toGeoJSON();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJson));
    
    // download link
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute("href", dataStr);
    downloadLink.setAttribute("download", "map_features.geojson");
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}
});