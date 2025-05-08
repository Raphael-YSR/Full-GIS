document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map', {
        center: [-0.4, 37.6],
        zoom: 10,
        zoomControl: false
    });

    // Define map layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.6
    });

    const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const googleHybridLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    const googleSatLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    // Store all layers
    const baseLayers = {
        'osm': osmLayer,
        'carto': cartoLayer,
        'googleHybrid': googleHybridLayer,
        'googleSat': googleSatLayer
    };

    // Add default layer
    cartoLayer.addTo(map);

    let currentLayer = 'carto';

    function changeMapLayer(layerName) {
        // Remove current layer
        map.removeLayer(baseLayers[currentLayer]);

        // Add selected layer
        baseLayers[layerName].addTo(map);

        // Update current layer
        currentLayer = layerName;
    }

    // --- Fetch Project Locations from Your Backend ---
    const apiUrl = '/api/projects/locations';

    console.log(`Fetching data from ${apiUrl}...`);

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(`HTTP error! Status: ${response.status}. Details: ${JSON.stringify(errData)}`);
                }).catch(() => {
                    throw new Error(`HTTP error! Status: ${response.status}. Could not parse error response.`);
                });
            }
            console.log("Received response, parsing JSON...");
            return response.json();
        })
        .then(projects => {
            console.log(`Received ${projects.length} projects:`, projects);

            if (projects.length === 0) {
                console.warn("No project locations found in the database or returned by API.");
                L.popup().setLatLng(map.getCenter()).setContent("No projects found.").openOn(map);
                return; // Important:  Exit the function if no projects
            }

            // --- Add Markers to the Map ---
            projects.forEach(project => {
                const lat = parseFloat(project.lat);
                const lng = parseFloat(project.lng);

                if (!isNaN(lat) && !isNaN(lng)) {
                    let iconUrl = '';

                    // Determine icon based on project status
                    console.log("Project status:", project.status);
                    if (project.status && project.status.toLowerCase() === 'complete') {
                        iconUrl = 'images/pr-blue.png';
                    } else if (project.status && project.status.toLowerCase() === 'design') {
                        iconUrl = 'images/pr-hollow.png';
                    } else if (project.status && project.status.toLowerCase() === 'ongoing') {
                        iconUrl = 'images/pr-gray.png';
                    } else {
                        // Default icon if status is unknown or missing
                        iconUrl = 'marker-icon.png'; // Use default leaflet marker or a default icon.
                    }

                    const projectIcon = L.icon({
                        iconUrl: iconUrl,
                        iconSize: [16, 16], // Adjust size as needed
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                    });

                    const marker = L.marker([lat, lng], { icon: projectIcon })
                        .addTo(map)
                        .bindPopup(
                            `<b>${project.project_name || 'N/A'}</b><br>` +
                            `County: ${project.county || 'N/A'}<br>` +
                            `Status: ${project.status || 'N/A'}<br>` +
                            `Progress: ${project.progress !== null ? project.progress + '%' : 'N/A'}<br>` +
                            `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>` +
                            `Description: ${project.description || 'No description'}`
                        );
                } else {
                    console.warn(`Skipping project "${project.project_name}" due to invalid coordinates: lat=${project.lat}, lng=${project.lng}`);
                }
            });
            console.log("Finished adding markers.");
        })
        .catch(error => {
            console.error('Error fetching or processing project locations:', error);
            L.popup()
                .setLatLng(map.getCenter())
                .setContent(`<b>Error loading project data:</b><br>${error.message}`)
                .openOn(map);
        });

    //////////
    // PRINT//
    //////////

    const printBtn = document.getElementById('print-btn');
    if (printBtn) { // Make sure the button exists.
        printBtn.addEventListener('click', () => {
            window.print();
            const printer = L.easyPrint({
                tileLayer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }),
                sizeModes: ['Current'],
                exportOnly: true,
                filename: 'myMap'
            });
            printer.printMap();
        });
    }




    ///////////
    // POPUP //
    ///////////
    // POPUP
function showLayerPopup() {
    const layerPopup = document.getElementById("layerPopup");
    if (layerPopup) {
        layerPopup.style.display = "block";
        layerPopup.classList.add("show");
    } else {
        console.error("Layer popup element not found!");
    }
}

// Expose layer switcher globally (already defined inside DOMContentLoaded)
window.changeMapLayer = changeMapLayer;

// Close the Layers popup
window.closeLayerPopup = function () {
    const popup = document.getElementById('layerPopup');
    if (popup) popup.style.display = 'none';
};

// Toggle sub-options for statuses
window.toggleSubOptions = function (id) {
    const subOptions = document.getElementById(`subOptions${id}`);
    const icon = document.getElementById(`icon${id}`);
    if (subOptions && icon) {
        const isVisible = subOptions.style.display === 'block';
        subOptions.style.display = isVisible ? 'none' : 'block';
        icon.textContent = isVisible ? '+' : '−';
    }
};

// Toggle map layer options
window.toggleMapLayers = function () {
    const mapLayerOptions = document.getElementById('mapLayerOptions');
    const icon = document.getElementById('mapLayersIcon');
    if (mapLayerOptions && icon) {
        const isVisible = mapLayerOptions.style.display === 'block';
        mapLayerOptions.style.display = isVisible ? 'none' : 'block';
        icon.textContent = isVisible ? '+' : '−';
    }
};

// Open the popup when "LAYERS" button is clicked
document.getElementById('layers-btn').addEventListener('click', function () {
    const popup = document.getElementById('layerPopup');
    if (popup) popup.style.display = 'block';
});



function closeLayerPopup() {
    const layerPopup = document.getElementById("layerPopup");
    if (layerPopup) {
        layerPopup.classList.remove("show");
        setTimeout(() => {
            layerPopup.style.display = "none";
        }, 300);
    } else {
        console.error("Layer popup element not found!");
    }
}

function toggleSubOptions(option) {
    const subOptions = document.getElementById("subOptions" + option);
    const icon = document.getElementById("icon" + option);

    if (subOptions && icon) {
        if (subOptions.style.display === "block") {
            subOptions.style.display = "none";
            icon.textContent = "+";
        } else {
            subOptions.style.display = "block";
            icon.textContent = "−";
        }
    } else {
        console.error("Sub-options or icon element not found for option:", option);
    }
}

// Map Layers
function toggleMapLayers() {
    const mapLayerOptions = document.getElementById("mapLayerOptions");
    const mapLayersIcon = document.getElementById("mapLayersIcon");

    if (mapLayerOptions && mapLayersIcon) {
        if (mapLayerOptions.style.display === "block") {
            mapLayerOptions.style.display = "none";
            mapLayersIcon.textContent = "+";
        } else {
            mapLayerOptions.style.display = "block";
            mapLayersIcon.textContent = "−";
        }
    } else {
        console.error("Map layer options or icon element not found.");
    }
}

function changeMapLayer(layer) {
    console.log("Map layer changed to:", layer);
    // Add your map layer change logic here
}

document.getElementById("layers-btn").addEventListener("click", showLayerPopup);


    /////////////////
    // FILTER OPTIONS
    /////////////////


    function toggleMapLayers() {
        let mapLayerOptions = document.getElementById("mapLayerOptions");
        let icon = document.getElementById("mapLayersIcon");
        if (mapLayerOptions) { // Check
            if (mapLayerOptions.style.display === "block") {
                mapLayerOptions.style.display = "none";
                icon.textContent = "+";
            } else {
                mapLayerOptions.style.display = "block";
                icon.textContent = "−";
            }
        }
    }
    function toggleMainOption(option) {
        let mainCheckbox = document.getElementById("option" + option);
        let subOptions = document.querySelectorAll('.sub-option[data-main="' + option + '"]');
        if (mainCheckbox) {  // Check
            subOptions.forEach(sub => {
                sub.checked = mainCheckbox.checked;
            });
        }
    }

    document.querySelectorAll(".sub-option").forEach(subOption => {
        subOption.addEventListener("change", function () {
            let mainOption = this.getAttribute("data-main");
            let mainCheckbox = document.getElementById("option" + mainOption);
            let allSubOptions = document.querySelectorAll('.sub-option[data-main="' + mainOption + '"]');
            if (mainCheckbox) { // Check
                let allChecked = Array.from(allSubOptions).every(sub => sub.checked);
                let anyChecked = Array.from(allSubOptions).some(sub => sub.checked);

                if (allChecked) {
                    mainCheckbox.checked = true;
                } else if (!anyChecked) {
                    mainCheckbox.checked = false;
                }
            }
        });
    });



    // Add event listener to the layers button
    const layersBtn = document.getElementById("layers-btn");
    if (layersBtn) {
        layersBtn.addEventListener("click", showLayerPopup);
    }


    // Example code (check if it causes errors, might be incomplete)
    const completeRadio = document.querySelector('input[value="complete"]');
    const completeSubCategories = document.querySelectorAll('input[type="radio"]');

    if (completeRadio) {
        completeRadio.addEventListener('change', () => {
            completeSubCategories.forEach(subCategory => {
                subCategory.checked = completeRadio.checked;
            });
        });
    }
});

