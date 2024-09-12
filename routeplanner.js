const { response } = require("express");
const { createClient } = require("@supabase/supabase-js");
const { route } = require("express/lib/application");
const cattracks = require("./cattracks.js");

// Supabase DB information
const options = {
    auth: {
        persistSession: false
    }
};
const supabase = createClient('https://mivdsabwktxmijnchtin.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdmRzYWJ3a3R4bWlqbmNodGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk4MTkxNjIsImV4cCI6MjAwNTM5NTE2Mn0.9CsS0ylsSXE8nkKJSAg-vIjXZSherXOLPfg31xrykBs', options);

// * Global Variables
let scheduleData = null;    // Holds schedule data
let routeData = null;   // Holds route data
let stopData = null;    // Holds stop data
let routes = [];    // Holds parsed route data

// Pull bus schedule and route information
async function getSchedule() {
    let { data, error } = await supabase
        .from("schedules")
        .select(`
            schedule_id,
            start_time,
            weekend,
            is_break,
            break_min,
            routes!schedules_route_id_fkey (
                route_id,
                route_name
            )
        `)

    if (data) {
        console.log("Successfully pulled schedule data");
        scheduleData = data;
    } else if (error) {
        console.log(error);
        scheduleData = null;
    }
};

async function getRouteData() {
    let { data, error } = await supabase
        .from("route_details")
        .select(`
            route_id,
            route_name,
            stop_number,
            leg_minutes,
            stops (
                stop_id,
                stop_name,
                stop_description
            ),
            routes!route_details_route_id_fkey (
                route_description
            )
        `)

    if (data) {
        console.log("Successfully pulled route data!");
        routeData = data;
    } else if (error) {
        console.log(error);
        routeData = null;
    }
};

async function getStops() {
    let { data, error } = await supabase
        .from("stops")
        .select()

    if (data) {
        console.log("Successfully pulled stop data!");
        stopData = data;
    } else if (error) {
        console.log(error);
        stopData = null;
    }
}

// Parse through returned data and rework variables to be stored in a readable manner
function parseData() {
    routes = []; // Reset routes array

    // Parse through route data and rework variables
    for (let i = 0; i < routeData.length; i++) {
        let existingRoute = routes.find(route => route.route_id === routeData[i].route_id);

        if (!existingRoute) {
            routes.push({
                route_id: routeData[i].route_id,
                route_name: routeData[i].route_name,
                route_description: routeData[i].routes.route_description,
                stops: [],      // Initialize as an empty array
                schedule: []    // Initialize as an empty array
            });

            existingRoute = routes[routes.length - 1];
        }

        existingRoute.stops.push({
            stop_number: routeData[i].stop_number,
            stop_id: routeData[i].stops.stop_id,
            stop_name: routeData[i].stops.stop_name,
            stop_description: routeData[i].stops.stop_description,
            leg_minutes: routeData[i].leg_minutes
        });

        existingRoute.stops.sort((a, b) => a.stop_number - b.stop_number);
    }

    // Use a Set to keep track of the unique schedule IDs
    const scheduleIdsSet = new Set();

    // Parse through schedule data and add the bus schedule to routes
    for (let i = 0; i < scheduleData.length; i++) {
        const routeToUpdate = routes.find(route => route.route_id === scheduleData[i].routes.route_id);

        if (routeToUpdate) {
            // Check if the schedule_id is not already added for this route
            if (!scheduleIdsSet.has(scheduleData[i].schedule_id)) {
                routeToUpdate.schedule.push({
                    schedule_id: scheduleData[i].schedule_id,
                    start_time: scheduleData[i].start_time,
                    weekend: scheduleData[i].weekend,
                    is_break: scheduleData[i].is_break,
                    break_min: scheduleData[i].break_min
                });

                // Add the schedule_id to the Set to prevent duplicates
                scheduleIdsSet.add(scheduleData[i].schedule_id);
            }
        }
    }
}

function findRoutes(startId, stopId) {

    // * First check, see if startId and stopId are the same. If they are the same, return an error.
    if (startId == stopId) {
        console.log("Start and stop are the same!");
        return -1;
    }

    // Find all routes that have the stop with the provided startId
    let routesWithStart = [];
    for (let i = 0; i < routes.length; i++) {
        let route = routes[i];
        for (let j = 0; j < route.stops.length; j++) {
            if (route.stops[j].stop_id == startId) {
                routesWithStart.push(route);
            }
        }
    }
    // console.log("ROUTES WITH START DATA: ", routesWithStart);   // ! Debugging, delete later

    // Find all routes that have the stop with the provided stopId
    let routesWithEnd = [];
    for (let i = 0; i < routes.length; i++) {
        let route = routes[i];
        for (let j = 0; j < route.stops.length; j++) {
            if (route.stops[j].stop_id == stopId) {
                routesWithEnd.push(route);
            }
        }
    }
    // console.log("ROUTES WITH ENDING STOP: ", routesWithEnd);   // ! Debugging, delete later

    // Compare both arrays and create a master array with routes that have both the start and end stops
    let routesWithBoth = [];
    for (let i = 0; i < routesWithStart.length; i++) {
        let route = routesWithStart[i];
        for (let j = 0; j < routesWithEnd.length; j++) {
            if (route.route_id == routesWithEnd[j].route_id) {
                routesWithBoth.push(route);
            }
        }
    }
    // console.log("ROUTES WITH BOTH START AND END: ", routesWithBoth);   // ! Debugging, delete later

    return routesWithBoth;  // ! THIS IS AN ARRAY!!!!!
}

function getNextArrivalTime(routeId, stopId) {  // TODO: Weekend schedule??? Also consider adding select time and date for route planner

    console.log(routeId, stopId);

    let route = routes.find(route => route.route_id == routeId);
    if (route === undefined) {
        console.log("Route not found");
        return;
    }

    let stopNumber = null;
    let legMinutes = 0;

    for (let i = 0; i < route.stops.length; i++) {
        if (route.stops[i].stop_id == stopId) {
            stopNumber = route.stops[i].stop_number;
            break;
        }
    }

    let schedule = route.schedule;
    schedule.sort((a, b) => a.schedule_id - b.schedule_id); // Sort schedule by schedule_id in ascending order
    let currentDate = new Date();
    var options = { hour12: false };    // * This line converts the current time to 24 hour format, the same as the DB
    let currentTime = currentDate.toLocaleTimeString('en-US', options);
    console.log(currentTime);
    let scheduleId = null;
    let scheduleNum = 0;

    let nextStartTime = null;
    let nextArrivalTime = null;

    let lastStartTime = null;
    let lastArrivalTime = null;

    let isFirstSchedule = false;
    let isBreak = false;
    let isLastScheduleBreak = false;

    // Loop through the schdedule to find the next arrival time based on selected initial stop
    for (let i = 0; i < schedule.length; i++) {
        let startTime = (schedule[i].start_time);
        console.log(`Start time: ${startTime}`)
        if ((currentTime < startTime) && (nextStartTime == null || startTime < nextStartTime)) {
            nextStartTime = startTime;
            scheduleNum = i;
            scheduleId = (schedule[i].schedule_id);
        }
        console.log(`Next start time: ${nextStartTime}`)
    }

    if (nextStartTime == null) {
        nextStartTime = schedule[0].start_time;
        scheduleId = schedule[0].schedule_id;
        scheduleNum = 0;
    }

    // Calculate total time of schedule
    let totalTime = 0;
    for (let i = 0; i < route.stops.length; i++) {
        totalTime += route.stops[i].leg_minutes * 60000;
        for (let k = 0; k < schedule.length; k++) {
            if (schedule[k].is_break && route.stops[i].stop_id == 6 && schedule[k].is_break != null) {
                totalTime += schedule[k].break_min * 60000;
            }
        }
    }

    // Check if last start time was within total time of schedule
    if (nextStartTime == schedule[0].start_time) {
        isFirstSchedule = true;
    }

    if (!isFirstSchedule) {
        lastStartTime = schedule[scheduleNum - 1].start_time;
        console.log(`Last start time: ${lastStartTime}`)
        let lastStartTimeDate = new Date('1970-01-01T' + lastStartTime);
        let currentTimeDate = new Date('1970-01-01T' + currentTime);
        if (currentTimeDate - lastStartTimeDate <= totalTime) {
            nextArrivalTime = lastStartTimeDate.getTime();
            console.log(`Next start time: ${nextStartTime}`)
            //scheduleId = scheduleId - 1;
        }
    } else {
        lastStartTime = schedule[0].start_time;
        // scheduleId = scheduleId - 1;
    }

    // Loop through the stops to find the next arrival time based on selected initial stop

    if (stopNumber == 1) {  // If is first stop, set as schedule start time
        nextArrivalTime = (new Date('1970-01-01T' + nextStartTime).getTime());
        lastArrivalTime = (new Date('1970-01-01T' + lastStartTime).getTime());

        let finalNextTime = new Date(nextArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let finalLastTime = new Date(lastArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Check if departure time has passed
        if (finalLastTime < currentTime) {
            return finalNextTime;
        } else {
            return finalLastTime;
        }

    } else {

        nextArrivalTime = (new Date('1970-01-01T' + nextStartTime).getTime())  // sets the next arrival time to the start time
        lastArrivalTime = (new Date('1970-01-01T' + lastStartTime).getTime())

        for (let i = 0; i < schedule.length; i++) {
            if (schedule[i].schedule_id == scheduleId) {
                isBreak = schedule[i].is_break;
                if (schedule[i - 1] != undefined) {
                    isLastScheduleBreak = schedule[i - 1].is_break;
                }
            }
        }

        for (let i = 0; i < route.stops.length; i++) {
            if (route.stops[i].stop_id == stopId) {
                for (let j = 0; j < i; j++) {

                    nextArrivalTime += route.stops[j].leg_minutes * 60000;
                    lastArrivalTime += route.stops[j].leg_minutes * 60000;

                    // Check for break and add break time to previous stop
                    //console.log(isBreak, route.stops[j].stop_id)
                    if (isBreak == true && route.stops[j + 1].stop_id == 6 && isBreak != null) {
                        nextArrivalTime += schedule[scheduleNum].break_min * 60000;
                        //lastArrivalTime += schedule[scheduleNum].break_min * 60000;
                    }

                    if (isLastScheduleBreak == true && route.stops[j + 1].stop_id == 6 && isLastScheduleBreak != null) {
                        lastArrivalTime += schedule[scheduleNum - 1].break_min * 60000;
                    }
                }
            }
        }

        let finalNextTime = new Date(nextArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let finalLastTime = new Date(lastArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let finalLastTimeDate = Date.parse('1970-01-01T' + finalLastTime);
        let currentTimeDate = Date.parse('1970-01-01T' + currentTime);

        console.log(lastArrivalTime, currentTimeDate);
        console.log(lastArrivalTime < currentTimeDate);
        if (lastArrivalTime < currentTimeDate) {
            return finalNextTime;
        } else {
            return finalLastTime;
        }
    }
}

function buildRoutePlan(formSubmission) {

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


    let startPoint = formSubmission.startpoint;
    let endPoint = formSubmission.endpoint;

    parseData();    // Runs the parseData function, which takes the returned DB values and combines them into one big array

    let routesWithBoth = findRoutes(startPoint, endPoint);

    let xmHeader = {
        "elementType": "hero",
        "height": "fluid",
        "contentContainerWidth": "wide",
        "backgroundImage": {
            "overlayType": "solid",
            "overlayColor": "#EFEFEF"
        },
        "content": [
            {
                "elementType": "heroBreadcrumbs",
                "id": "status_detail_bc",
                "separatorCharacter": "/",
                "ellipsize": true,
                "separatorColor": "#daa900",
                "items": [
                    {
                        "elementType": "breadcrumbItem",
                        "title": "Cattracks Homepage",
                        "url": {
                            "relativePath": "./cattracks"
                        }
                    },
                    {
                        "elementType": "breadcrumbItem",
                        "title": "Route Planner",
                        "url": {
                            "relativePath": "./cattracks"
                        }
                    },
                    {
                        "elementType": "breadcrumbItem",
                        "title": `${stopData.find(stop => stop.stop_id == startPoint).stop_name} to ${stopData.find(stop => stop.stop_id == endPoint).stop_name}`,
                    }
                ]
            },
            {
                "elementType": "heroHeading",
                "responsiveScaling": true,
                "heading": `Routes Between`,
                "fontSize": "xsmall",
                "textColor": "rgba(0,40,86,0.75)",
                "textAlignment": "left",
                "marginTop": "3%",
                "marginBottom": "0%",
            },
            {
                "elementType": "heroHeading",
                "responsiveScaling": true,
                "heading": `${stopData.find(stop => stop.stop_id == startPoint).stop_name} & ${stopData.find(stop => stop.stop_id == endPoint).stop_name}`,
                "fontSize": "large",
                // "textColor": "rgba(220,245,255,0.75)",
                "textColor": "#002856",
                // "fontSize": "2rem",
                "textAlignment": "left",
                "marginTop": "0.5%",
                "marginBottom": "2%",
            }
        ]
    }
    xmJson.header.push(xmHeader);

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
                    "heading": "Available Routes",
                    "description": "All the routes that go between the two stops you selected, as well as their departure times."
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
                    "heading": "Plan Another Route",
                    "description": "Select a starting and ending point to see the routes that service those stops, as well as the next departure time."
                }
            ]
        }
    }

    xmRouteCardSet = {
        "elementType": "cardSet",
        "id": "routeCardSet",
        "ajaxLoadingIndicator": "large",
        "ajaxLoadingMessage": "Loading Route Information...",
        "noItemsMessage": "There are no buses serving this route at this time. Check back at a later date. (Is it a weekend?)",
        "items": []
    }

    for (let i = 0; i < routesWithBoth.length; i++) {
        let temp = getNextArrivalTime(routesWithBoth[i].route_id, startPoint);
        let xmRouteCard = {
            "elementType": "contentCard",
            "size": "small",
            "id": JSON.stringify(routesWithBoth[i].route_id),
            "label": `${temp} from ${stopData.find(stop => stop.stop_id == startPoint).stop_name}`,
            "title": routesWithBoth[i].route_name,
            "description": routesWithBoth[i].route_description,
            "descriptionLineClamp": 3,
            "labelLineClamp": 2,
            "labelTextColor": "#daa900",
            "titleTextColor": "#002856",
            "url": {
                "relativePath": `./cattracks/route/${routesWithBoth[i].route_id}`
            }
        }
        xmRouteCardSet.items.push(xmRouteCard);
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
                "minWidth": "9rem"
            },
            {
                "elementType": "linkButton",
                "title": "Return Home",
                "actionStyle": "normal",
                "link": {
                    "relativePath": "./cattracks"
                },
                "minWidth": "9rem"
            }
        ],
        "trackDirtyStateButtonNames": [
            "s1_submit"
        ],
        "buttonsHorizontalAlignment": "center"
    }

    // Add item to the stop selector
    for (let i = 0; i < stopData.length; i++) {
        let formItem = {
            "value": JSON.stringify(stopData[i].stop_id),
            "label": stopData[i].stop_name
        }
        xmRoutePlanner.items[0].options.push(formItem);
        xmRoutePlanner.items[1].options.push(formItem);
    }

    xmContent.secondaryColumn.content.push(xmRoutePlanner);
    xmContent.primaryColumn.content.push(xmRouteCardSet);

    // if ('s1_submit' in formSubmission) {
    //     xmJson.metadata.redirectLink = {
    //         "relativePath": "/cattracks/routeplanner",
    //     };
    // }

    xmJson.content.push(xmContent);
    return xmJson;
}

module.exports.getRouteData = getRouteData;
module.exports.getSchedule = getSchedule;
module.exports.getStops = getStops;
module.exports.buildRoutePlan = buildRoutePlan;
module.exports.findRoutes = findRoutes;