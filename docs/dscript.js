document.addEventListener("DOMContentLoaded", function () {
  window.map = L.map("map", {
    center: [-0.2, 37.6],
    zoom: 9.25,
    zoomControl: false,
    zoomAnimation: true,
    fadeAnimation: true,
  });

  const cartoLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    },
  );
  cartoLayer.addTo(map);

  const markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 16,
  });
  map.addLayer(markers);

  // Updated path to /gis/...
  fetch("/gis/projects/locations")
    .then((response) => response.json())
    .then((data) => {
      data.forEach((project) => {
        if (project.lat && project.lng) {
          const marker = L.marker([project.lat, project.lng]);
          const popupContent = `
                        <div class="p-3 font-marlinsoftmedium">
                            <h3 class="text-lg font-bold text-gray-800 mb-1 border-b pb-1">${project.project_name}</h3>
                            <div class="mt-2 space-y-1 text-sm">
                                <p><span class="font-semibold text-blue-600">Type:</span> ${project.type}</p>
                                <p><span class="font-semibold text-blue-600">Status:</span> ${project.status}</p>
                                <div class="mt-2">
                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${project.progress}%"></div>
                                    </div>
                                    <p class="text-xs text-right mt-1">${project.progress}% Complete</p>
                                </div>
                            </div>
                            <button onclick="window.location.href='/edit-data?id=${project.id}'"
                                    class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded text-xs transition duration-200 shadow-sm">
                                Edit Details
                            </button>
                        </div>
                    `;
          marker.bindPopup(popupContent, { maxWidth: 220 });
          markers.addLayer(marker);
        }
      });
    })
    .catch((err) => console.error("Error loading projects:", err));
});
