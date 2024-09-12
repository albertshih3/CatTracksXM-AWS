const { response } = require("express");
const { createClient } = require("@supabase/supabase-js");
const { route } = require("express/lib/application");

// Supabase DB information
const options = {
    auth: {
        persistSession: false
    }
};
const supabase = createClient('https://mivdsabwktxmijnchtin.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdmRzYWJ3a3R4bWlqbmNodGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk4MTkxNjIsImV4cCI6MjAwNTM5NTE2Mn0.9CsS0ylsSXE8nkKJSAg-vIjXZSherXOLPfg31xrykBs', options);

// Set Variables
let scheduleData = null;    // Holds schedule data
let routeData = null;   // Holds route data
let stopData = null;    // Holds stop data
let arivTime = null;    // Holds arrival time

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
let routes = [];
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

// Build out a cardset from the schedule data
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


function getCards(selectInitialStop) {
    console.log(`getCards: selectInitialStop = ${selectInitialStop}`);

    let xmCards = []

    for (let i = 0; i < routes.length; i++) {
        let temp = "Click to see full route information.";

        for (let j = 0; j < routes[i].stops.length; j++) {
            if (selectInitialStop == null || selectInitialStop == 'none' || selectInitialStop == routes[i].stops[j].stop_id.toString()) {
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

                    if (selectInitialStop) {
                        temp = `Next Scheduled Departure: ${getNextArrivalTime(routes[i].route_id, selectInitialStop)}`;
                        if (temp == "Next Scheduled Departure: Invalid Date") {
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

    parseData();
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

    let xmHeader = {
        elementType: "blockHeading",
        heading: "Transportation & Parking Services",
        headingLevel: 1,
        description: "Welcome to the Transportation & Parking Services page. Here you can find information on bus routes, schedules, and parking.",
    }

    xmJson.content.push(xmHeader);

    return xmJson;
}

module.exports.parseData = parseData;
module.exports.getRouteData = getRouteData;
module.exports.getSchedule = getSchedule;
module.exports.getStops = getStops;
module.exports.buildHome = buildHome;
module.exports.getNextArrivalTime = getNextArrivalTime;
module.exports.scheduleData = scheduleData;
module.exports.routeData = routeData;
module.exports.stopData = stopData;
module.exports.routes = routes;
//module.exports.getCards = getCards;
//module.exports.isStopInRoute = isStopInRoute;