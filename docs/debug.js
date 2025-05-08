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
        // Diagnostic: Validate and log potential rendering issues
        // USED IT FOR DEBUGGING, CAN BE USED LATER AGAIN
        /*
            const issues = {
                missingCoords: [],
                invalidCoords: [],
                unknownStatus: [],
                unknownType: [],
                unknownCounty: []
            };

            const allowedStatuses = ['complete', 'ongoing', 'planning', 'design', 'planning & design'];
            const allowedTypes = ['water', 'sanitation', 'boreholes', 'dams', 'irrigation', 'other'];
            const allowedCounties = ['nyeri', 'embu', 'meru', 'kirinyaga', 'tharaka nithi'];

            projects.forEach(project => {
                const name = project.project_name || 'Unnamed';
                const lat = parseFloat(project.lat);
                const lng = parseFloat(project.lng);
                const status = (project.status || '').toLowerCase().trim();
                const type = (project.project_type || '').toLowerCase().trim();
                const county = (project.county || '').toLowerCase().trim();

                if (project.lat == null || project.lng == null) {
                    issues.missingCoords.push(name);
                } else if (isNaN(lat) || isNaN(lng)) {
                    issues.invalidCoords.push(name);
                }

                if (!allowedStatuses.includes(status)) {
                    issues.unknownStatus.push({ name, status });
                }

                if (!allowedTypes.includes(type)) {
                    issues.unknownType.push({ name, type });
                }

                if (!allowedCounties.includes(county)) {
                    issues.unknownCounty.push({ name, county });
                }
            });

            console.groupCollapsed("🚨 Project Data Validation Report");
            console.log("❌ Projects with Missing Coordinates:", issues.missingCoords);
            console.log("❌ Projects with Invalid Coordinates:", issues.invalidCoords);
            console.log("❓ Projects with Unknown Status:", issues.unknownStatus);
            console.log("❓ Projects with Unknown Type:", issues.unknownType);
            console.log("❓ Projects with Unknown County:", issues.unknownCounty);
            console.groupEnd();

            */
         if (projects.length === 0) {
             // console.warn("No project locations found in the database or returned by API.");
             L.popup().setLatLng(map.getCenter()).setContent("No projects found.").openOn(map);
             return;
         }
        })