const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Set Variables
let routesData = null;   // Holds route data from JSON file
let routes = [];         // Processed routes array
let allStops = [];       // All unique stops from routes

// Load route data from JSON file
function loadRoutesData() {
    try {
        const routesPath = path.join(__dirname, 'routes.json');
        const data = fs.readFileSync(routesPath, 'utf8');
        routesData = JSON.parse(data);
        console.log("Successfully loaded routes data from JSON file");
        return true;
    } catch (error) {
        console.log("Error loading routes data:", error);
        routesData = null;
        return false;
    }
}

// Extract all unique stops from the routes data
function extractStops() {
    allStops = [];
    const stopSet = new Set();
    
    if (!routesData) return;
    
    routesData.forEach((route, routeIndex) => {
        const schedule = route.weekday || route.weekend || [];
        schedule.forEach((stopData, stopIndex) => {
            if (!stopSet.has(stopData.stop)) {
                stopSet.add(stopData.stop);
                allStops.push({
                    stop_id: allStops.length + 1,
                    stop_name: stopData.stop,
                    stop_description: stopData.stop
                });
            }
        });
    });
    
    console.log(`Extracted ${allStops.length} unique stops`);
}

// Parse through JSON data and rework variables to be stored in a readable manner
function parseData(forceWeekendMode = null) {
    if (!routesData) {
        if (!loadRoutesData()) {
            return;
        }
    }
    
    routes = []; // Reset routes array
    extractStops(); // Extract all unique stops

    // Use forced mode if provided, otherwise use current day
    const currentIsWeekend = forceWeekendMode !== null ? forceWeekendMode : isWeekend();
    console.log(`Displaying ${currentIsWeekend ? 'weekend' : 'weekday'} services${forceWeekendMode !== null ? ' (manually selected)' : ''}`);

    // Parse through route data from JSON
    routesData.forEach((routeInfo, index) => {
        // Filter logic for E1 and E2 routes
        const isE1OrE2 = routeInfo.route === 'E1' || routeInfo.route === 'E2' || routeInfo.route === 'E-1' || routeInfo.route === 'E-2';
        
        // Skip E1/E2 routes on weekdays, skip other routes on weekends
        if (currentIsWeekend && !isE1OrE2) {
            console.log(`Skipping ${routeInfo.route} (weekday route on weekend)`);
            return;
        }
        if (!currentIsWeekend && isE1OrE2) {
            console.log(`Skipping ${routeInfo.route} (weekend route on weekday)`);
            return;
        }
        
        const schedule = routeInfo.weekday || routeInfo.weekend || [];
        
        if (schedule.length === 0) return;
        
        // Create route object
        const route = {
            route_id: index + 1,
            route_name: routeInfo.route,
            route_description: routeInfo.description,
            stops: [],
            schedule: []
        };
        
        // Process stops and their times
        schedule.forEach((stopData, stopIndex) => {
            const stopId = allStops.find(s => s.stop_name === stopData.stop)?.stop_id || stopIndex + 1;
            
            route.stops.push({
                stop_number: stopIndex + 1,
                stop_id: stopId,
                stop_name: stopData.stop,
                stop_description: stopData.stop,
                leg_minutes: stopIndex === 0 ? 0 : 3 // Assume 3 minutes between stops
            });
            
            // Convert times to schedule entries
            stopData.times.forEach((time, timeIndex) => {
                route.schedule.push({
                    schedule_id: timeIndex + 1,
                    start_time: time,
                    weekend: routeInfo.weekend ? true : false,
                    is_break: false,
                    break_min: 0
                });
            });
        });
        
        // Remove duplicate schedule entries (keep only unique start times)
        const uniqueSchedule = [];
        const seenTimes = new Set();
        route.schedule.forEach(schedEntry => {
            if (!seenTimes.has(schedEntry.start_time)) {
                seenTimes.add(schedEntry.start_time);
                uniqueSchedule.push(schedEntry);
            }
        });
        route.schedule = uniqueSchedule;
        
        routes.push(route);
        console.log(`Added route: ${routeInfo.route}`);
    });
}

// Get next arrival time for a specific route and stop
function getNextArrivalTime(routeId, stopName) {
    console.log(routeId, stopName);

    let route = routes.find(route => route.route_id == routeId);
    if (route === undefined) {
        console.log("Route not found");
        return "Route not found";
    }

    // Find the stop in the route
    let stop = route.stops.find(s => s.stop_name === stopName || s.stop_id == stopName);
    if (!stop) {
        console.log("Stop not found in route");
        return "Stop not found";
    }

    // Get current time in Pacific timezone
    let currentTime = moment().tz('America/Los_Angeles').format('HH:mm:ss');
    console.log(`Current time (Pacific): ${currentTime}`);

    // Find corresponding route data in original JSON to get times for this stop
    if (!routesData) {
        return "No route data available";
    }

    let routeInfo = routesData.find(r => r.route === route.route_name);
    if (!routeInfo) {
        console.log("Route info not found in JSON data");
        return "Route info not found";
    }

    // Get schedule (weekday or weekend)
    let schedule = routeInfo.weekday || routeInfo.weekend || [];
    let stopSchedule = schedule.find(s => s.stop === stop.stop_name);
    
    if (!stopSchedule || !stopSchedule.times) {
        console.log("No schedule found for this stop");
        return "No schedule available";
    }

    // Find next departure time using moment for proper timezone handling
    let nextTime = null;
    let currentTimeMoment = moment.tz(currentTime, 'HH:mm:ss', 'America/Los_Angeles');
    
    for (let time of stopSchedule.times) {
        // Convert schedule time to Pacific timezone moment
        let scheduleTimeMoment = moment.tz(`1970-01-01 ${time}:00`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles');
        let scheduleTimeToday = moment().tz('America/Los_Angeles').startOf('day')
            .add(scheduleTimeMoment.hour(), 'hours')
            .add(scheduleTimeMoment.minute(), 'minutes');
        
        if (scheduleTimeToday.isAfter(currentTimeMoment)) {
            nextTime = scheduleTimeToday.format('HH:mm');
            break;
        }
    }

    // If no time found for today, get first time of tomorrow
    if (!nextTime && stopSchedule.times.length > 0) {
        let firstTime = stopSchedule.times[0];
        let firstTimeMoment = moment.tz(`1970-01-01 ${firstTime}:00`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles');
        nextTime = firstTimeMoment.format('HH:mm') + " (next day)";
    }

    return nextTime || "No more departures today";
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper function to check if current day is weekend (in Pacific timezone)
function isWeekend() {
    const currentMoment = moment().tz('America/Los_Angeles');
    const dayOfWeek = currentMoment.day(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === 0 || dayOfWeek === 6;
}


function getCards(selectInitialStop) {
    console.log(`getCards: selectInitialStop = ${selectInitialStop}`);

    let xmCards = []

    for (let i = 0; i < routes.length; i++) {
        let temp = "Select a stop to view next arrival time.";

        for (let j = 0; j < routes[i].stops.length; j++) {
            if (selectInitialStop == null || selectInitialStop == 'none' || selectInitialStop == routes[i].stops[j].stop_name || selectInitialStop == routes[i].stops[j].stop_id.toString()) {
                let cardExists = false;
                for (let k = 0; k < xmCards.length; k++) {
                    if (xmCards[k].id == routes[i].route_id) {
                        cardExists = true;
                        break;
                    }
                }
                if (!cardExists) {
                    console.log(`Creating card for ${routes[i].route_name}`);
                    console.log(`selectInitialStop: ${selectInitialStop}`);

                    if (selectInitialStop && selectInitialStop !== 'none') {
                        const stopName = allStops.find(s => s.stop_id.toString() === selectInitialStop)?.stop_name || selectInitialStop;
                        const nextTime = getNextArrivalTime(routes[i].route_id, stopName);
                        temp = `Next Scheduled Departure: ${nextTime}`;
                        if (nextTime.includes("not found") || nextTime.includes("No more") || nextTime.includes("No route")) {
                            temp = "No more departures today."
                        }
                    }

                    let xmRouteCard = {
                        "elementType": "contentCard",
                        "size": "small",
                        "id": JSON.stringify(routes[i].route_id),
                        "label": `${temp}`,
                        "title": routes[i].route_name,
                        "description": routes[i].route_description,
                        "descriptionLineClamp": 3,
                        "labelLineClamp": 2,
                        "labelTextColor": "#daa900",
                        "titleTextColor": "#002856",
                        "url": {
                            "relativePath": `./cattracks/route/${routes[i].route_id}`
                        }
                    }
                    xmCards.push(xmRouteCard);
                }
            }
        }
    }
    return xmCards;
}

function buildHome(queryStringParameters) {
    // Load and parse data from JSON file
    if (!routesData) {
        loadRoutesData();
    }
    
    // Check if user wants to force weekend/weekday mode
    let forceWeekendMode = null;
    if (queryStringParameters && 'serviceType' in queryStringParameters) {
        forceWeekendMode = queryStringParameters.serviceType === 'weekend';
    }
    
    parseData(forceWeekendMode);
    // console.log(JSON.stringify(routes, null, 2));

    let xmJson = {
        "metadata": {
            "version": "2.0",
            "banners": []
        },
        "contentContainerWidth": "full",
        "header": [],
        "content": [],
        "elementFields": {}
    }

    // Build the content page so the page looks decent
    let xmContent = {
        "elementType": "responsiveTwoColumn",
        "id": "content",
        "primarySide": "right",
        "primaryColumn": {
            "content": [
                {
                    "elementType": "divider",
                    "borderStyle": "none",
                    "marginTop": "3%"
                },
                {
                    "elementType": "blockHeading",
                    "heading": "Quick View",
                    "description": "Select the bus stop nearest to you to see routes that service that stop, as well as the next departure time from your location."
                }
            ]
        },
        "secondaryColumn": {
            "content": [
                {
                    "elementType": "divider",
                    "borderStyle": "none",
                    "marginTop": "3%"
                },
                {
                    "elementType": "blockHeading",
                    "heading": "Route Planner",
                    "description": "Select a starting and ending point to see the routes that service those stops, as well as the next departure time."
                }
            ]
        }
    }

    let xmRoutePlanner = {
        "elementType": "form",
        "id": "routePlan",
        "initiallyHidden": false,
        "relativePath": "./cattracks/routeplanner",
        "items": [
            {
                "elementType": "formInputAssistedSelect",
                "name": "startpoint",
                "label": "Select Starting Point",
                "value": "6",
                "options": [],
            },
            {
                "elementType": "formInputAssistedSelect",
                "name": "endpoint",
                "label": "Select Destination",
                "value": "6",
                "options": [],
            }
        ],
        "buttons": [
            {
                "elementType": "formButton",
                "name": "s1_submit",
                "title": "Submit",
                "buttonType": "submit",
                "actionStyle": "constructive",
                "minWidth": "8rem"
            }
        ],
        "trackDirtyStateButtonNames": [
            "s1_submit"
        ],
        "buttonsHorizontalAlignment": "left"
    }

    xmRouteCardSet = {
        "elementType": "cardSet",
        "id": "routeCardSet",
        "ajaxLoadingIndicator": "large",
        "ajaxLoadingMessage": "Loading Route Information...",
        "noItemsMessage": "There are currently no buses running. Check back later!",
        "responsiveVisibility": {
            "small": false,
            "xsmall": false,
        },
        "items": []
    }

    xmRouteCardSetMobile = {
        "elementType": "cardSet",
        "id": "routeCardSetMobile",
        "ajaxLoadingIndicator": "large",
        "ajaxLoadingMessage": "Loading Route Information...",
        "noItemsMessage": "There are currently no buses running. Check back later!",
        "responsiveVisibility": {
            "medium": false,
            "large": false,
            "xlarge": false,
        },
        "initiallyHidden": true,
        "items": []
    }

    // Service type toggle
    const currentIsWeekend = forceWeekendMode !== null ? forceWeekendMode : isWeekend();
    let xmServiceTypeToggle = {
        "elementType": "form",
        "id": "serviceTypeSelector",
        "initiallyHidden": false,
        "items": [{
            "elementType": "formInputAssistedSelect",
            "name": "serviceType",
            "label": "Service Type",
            "value": currentIsWeekend ? "weekend" : "weekday",
            "options": [
                {
                    "value": "weekday",
                    "label": "Weekday Service"
                },
                {
                    "value": "weekend", 
                    "label": "Weekend Service"
                }
            ],
            "events": [
                {
                    "eventName": "change",
                    "action": "ajaxUpdate",
                    "targetId": "routeCardSet",
                    "ajaxRelativePath": "",
                    "propagateArgs": true
                },
                {
                    "eventName": "change",
                    "action": "ajaxUpdate",
                    "targetId": "routeCardSetMobile",
                    "ajaxRelativePath": "",
                    "propagateArgs": true
                }
            ]
        }]
    }

    // Select initial stop form
    let xmFirstStopSelector = {
        "elementType": "form",
        "id": "selectInitialStop",
        "initiallyHidden": false,
        "items": [{
            "elementType": "formInputAssistedSelect",
            "name": "selectInitialStop",
            "label": "Select your nearest bus stop",
            "value": "Please select a bus stop",
            // "description": "Select the bus stop nearest to you to see routes that service that stop, as well as the next departure time from your location.",
            "options": [
                {
                    "value": "none",
                    "label": "Please select a bus stop"
                },
                {
                    "label": "Popular Stops",
                    "value": []
                },
                {
                    "label": "All Other Stops",
                    "value": []
                }
            ],
            "events": [
                {
                    "eventName": "change",
                    "action": "toggle",
                    "animation": "slide",
                    "targetId": "routeCardSetMobile",
                    "ajaxRelativePath": "",
                    "propagateArgs": true
                },
                {
                    "eventName": "change",
                    "action": "ajaxUpdate",
                    "targetId": "routeCardSet",
                    "ajaxRelativePath": "",
                    "propagateArgs": true
                },
                {
                    "eventName": "change",
                    "action": "ajaxUpdate",
                    "targetId": "routeCardSetMobile",
                    "ajaxRelativePath": "",
                    "propagateArgs": true
                }
            ]
        }]
    }

    // Add item to the stop selector
    for (let i = 0; i < allStops.length; i++) {
        let formItem = {
            "value": JSON.stringify(allStops[i].stop_id),
            "label": allStops[i].stop_name
        }

        // Popular stops (these are some common ones based on route names)
        const popularStopNames = ["University Transit Center", "R Street Village Apartments", "Merced Mall", "Target", "Amtrak Station", "UC Merced Downtown Campus Center"];
        const isPopular = popularStopNames.some(popular => allStops[i].stop_name.includes(popular));
        
        if (isPopular) {
            xmFirstStopSelector.items[0].options[1].value.push(formItem);
        } else {
            xmFirstStopSelector.items[0].options[2].value.push(formItem);
        }

        xmRoutePlanner.items[0].options.push(formItem);
        xmRoutePlanner.items[1].options.push(formItem);
    }

    // Code bit that makes the filtering work
    if (queryStringParameters != null && ('selectInitialStop' in queryStringParameters || 'serviceType' in queryStringParameters)) {
        const selectedStop = queryStringParameters.selectInitialStop || null;
        xmJson.elementFields = {
            "initiallyHidden": false,
            "items": getCards(selectedStop)
        };
    }
    else {
        xmRouteCardSet.items = getCards();
        xmRouteCardSetMobile.items = getCards();
    }

    // Always add all components to the main content in the correct order
    xmJson.content.push(xmServiceTypeToggle);
    xmJson.content.push(xmFirstStopSelector);
    xmJson.content.push(xmRouteCardSet);
    xmJson.content.push(xmRouteCardSetMobile);

    console.log(xmContent.primaryColumn);

    return xmJson;
}

module.exports = {
    parseData,
    loadRoutesData,
    extractStops,
    buildHome,
    getNextArrivalTime,
    get routesData() { return routesData; },
    get allStops() { return allStops; },
    get routes() { return routes; }
};
//module.exports.getCards = getCards;
//module.exports.isStopInRoute = isStopInRoute;