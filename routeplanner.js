const { response } = require("express");
const { route } = require("express/lib/application");
const cattracks = require("./cattracks.js");
const cattracksfull = require("./cattracksfull.js");
const moment = require('moment-timezone');
const dataAdapter = require('./dataAdapter');

// * Global Variables
let scheduleData = null;    // Holds schedule data
let routeData = null;   // Holds route data
let stopData = null;    // Holds stop data
let routes = [];    // Holds parsed route data

// Helper function to format time in 12-hour AM/PM format
function formatTimeAMPM(timeString) {
    if (!timeString) return timeString;
    
    // Handle different time formats
    let timeMoment;
    if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString; // Already in AM/PM format
    } else if (timeString.includes(':')) {
        // Handle HH:mm or HH:mm:ss format
        const formats = ['HH:mm:ss', 'HH:mm', 'H:mm'];
        timeMoment = moment.tz(timeString, formats, 'America/Los_Angeles');
    } else {
        return timeString; // Return as-is if format is unrecognized
    }
    
    return timeMoment.format('h:mm A');
}

// Pull bus schedule and route information
function getSchedule() {
    try {
        scheduleData = dataAdapter.getSchedules();
        console.log("Successfully pulled schedule data");
    } catch (error) {
        console.log(error);
        scheduleData = null;
    }
};

function getRouteData() {
    try {
        routeData = dataAdapter.getRouteDetails();
        console.log("Successfully pulled route data!");
    } catch (error) {
        console.log(error);
        routeData = null;
    }
};

function getStops() {
    try {
        stopData = dataAdapter.getStops();
        console.log("Successfully pulled stop data!");
    } catch (error) {
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

    console.log(`Finding routes from stop ID ${startId} to stop ID ${stopId}`);
    
    // Ensure data is parsed if routes array is empty
    if (routes.length === 0) {
        parseData();
    }
    
    // Get stop names from stop IDs
    let startStop = stopData.find(stop => stop.stop_id == startId);
    let endStop = stopData.find(stop => stop.stop_id == stopId);
    
    if (!startStop || !endStop) {
        console.log("Start or end stop not found in stop data");
        return [];
    }
    
    console.log(`Looking for routes from "${startStop.stop_name}" to "${endStop.stop_name}"`);
    
    // Load the raw routes data directly from JSON
    const rawRoutesData = dataAdapter.loadRoutesData();
    let routesWithBoth = [];
    
    // Use parsed routes data for consistency
    routes.forEach(route => {
        // Check if this route serves both the start and end stops
        const hasStartStop = route.stops.some(stop => stop.stop_id == startId);
        const hasEndStop = route.stops.some(stop => stop.stop_id == stopId);
        
        if (hasStartStop && hasEndStop) {
            // Handle circular routes: check all occurrences of start and end stops
            const allStartStops = route.stops.filter(stop => stop.stop_id == startId);
            const allEndStops = route.stops.filter(stop => stop.stop_id == stopId);
            
            let validRouteFound = false;
            
            // Check all combinations of start and end stop occurrences
            for (let startStop of allStartStops) {
                for (let endStop of allEndStops) {
                    // Check normal direction (start stop number < end stop number)
                    if (startStop.stop_number < endStop.stop_number) {
                        console.log(`Found valid route: ${route.route_name} (${startStop.stop_number} -> ${endStop.stop_number})`);
                        validRouteFound = true;
                        break;
                    }
                    // Check circular route direction (wrap around)
                    else if (startStop.stop_number > endStop.stop_number) {
                        // Check if this could be a circular route
                        const maxStopNumber = Math.max(...route.stops.map(s => s.stop_number));
                        const minStopNumber = Math.min(...route.stops.map(s => s.stop_number));
                        // If there's a significant gap or if stop numbers wrap around, assume circular
                        if (maxStopNumber - minStopNumber >= route.stops.length - 1) {
                            console.log(`Found valid circular route: ${route.route_name} (${startStop.stop_number} -> ${endStop.stop_number} via wrap-around)`);
                            validRouteFound = true;
                            break;
                        }
                    }
                }
                if (validRouteFound) break;
            }
            
            if (validRouteFound) {
                routesWithBoth.push(route);
            } else {
                console.log(`Route ${route.route_name} serves both stops but no valid direction found`);
                console.log(`Start stop positions: ${allStartStops.map(s => s.stop_number).join(', ')}`);
                console.log(`End stop positions: ${allEndStops.map(s => s.stop_number).join(', ')}`);
            }
        }
    });
    
    console.log(`Found ${routesWithBoth.length} routes serving both stops`);
    return routesWithBoth;
}

function findTransferRoutes(startId, endId, maxTransfers = 1) {
    console.log(`Finding transfer routes from stop ID ${startId} to stop ID ${endId}`);
    
    // Ensure data is parsed if routes array is empty
    if (routes.length === 0) {
        parseData();
    }

    let transferJourneys = [];
    
    // Find routes that serve start and end points
    let routesFromStart = routes.filter(route => 
        route.stops.some(stop => stop.stop_id == startId)
    );
    let routesToEnd = routes.filter(route => 
        route.stops.some(stop => stop.stop_id == endId)
    );
    
    // Find transfer stops - only consider stops that are on routes to the destination
    let possibleTransferStops = new Set();
    
    routesFromStart.forEach(startRoute => {
        routesToEnd.forEach(endRoute => {
            if (startRoute.route_id !== endRoute.route_id) {
                // Find common stops between these routes
                startRoute.stops.forEach(startStop => {
                    endRoute.stops.forEach(endStop => {
                        if (startStop.stop_id === endStop.stop_id && 
                            startStop.stop_id !== startId && 
                            startStop.stop_id !== endId) {
                            
                            // Check if this transfer is valid on the first route
                            const startStopOnRoute = startRoute.stops.find(s => s.stop_id == startId);
                            const transferStopOnFirstRoute = startStop;
                            
                            // For circular routes, check both directions
                            let validOnFirstRoute = false;
                            if (startStopOnRoute) {
                                // Check normal direction (start stop number < transfer stop number)
                                if (transferStopOnFirstRoute.stop_number > startStopOnRoute.stop_number) {
                                    validOnFirstRoute = true;
                                }
                                // Check circular route direction (wrap around)
                                else if (transferStopOnFirstRoute.stop_number < startStopOnRoute.stop_number) {
                                    // This could be valid if it's a circular route - check if route goes in a loop
                                    const maxStopNumber = Math.max(...startRoute.stops.map(s => s.stop_number));
                                    const minStopNumber = Math.min(...startRoute.stops.map(s => s.stop_number));
                                    // If there's a significant gap or if stop numbers wrap around, assume circular
                                    if (maxStopNumber - minStopNumber >= startRoute.stops.length - 1) {
                                        validOnFirstRoute = true;
                                    }
                                }
                            }
                            
                            if (validOnFirstRoute) {
                                // Verify this stop comes before end on the second route  
                                const endStopOnRoute = endRoute.stops.find(s => s.stop_id == endId);
                                const transferStopOnSecondRoute = endStop;
                                
                                let validOnSecondRoute = false;
                                if (endStopOnRoute) {
                                    // Check normal direction (transfer stop number < end stop number)
                                    if (transferStopOnSecondRoute.stop_number < endStopOnRoute.stop_number) {
                                        validOnSecondRoute = true;
                                    }
                                    // Check circular route direction
                                    else if (transferStopOnSecondRoute.stop_number > endStopOnRoute.stop_number) {
                                        const maxStopNumber = Math.max(...endRoute.stops.map(s => s.stop_number));
                                        const minStopNumber = Math.min(...endRoute.stops.map(s => s.stop_number));
                                        if (maxStopNumber - minStopNumber >= endRoute.stops.length - 1) {
                                            validOnSecondRoute = true;
                                        }
                                    }
                                }
                                
                                if (validOnSecondRoute) {
                                    possibleTransferStops.add(startStop.stop_id);
                                }
                            }
                        }
                    });
                });
            }
        });
    });

    // For each potential transfer stop, see if there's a route to the destination
    for (let transferStopId of possibleTransferStops) {
        let routesToEnd = findRoutes(transferStopId, endId);
        if (routesToEnd && routesToEnd.length > 0) {
            // Find routes from start to this transfer stop
            let routesToTransfer = findRoutes(startId, transferStopId);
            if (routesToTransfer && routesToTransfer.length > 0) {
                // Create journey combinations
                for (let firstRoute of routesToTransfer) {
                    for (let secondRoute of routesToEnd) {
                        // Skip if it's the same route (not a real transfer)
                        if (firstRoute.route_id !== secondRoute.route_id) {
                            transferJourneys.push({
                                segments: [
                                    {
                                        route: firstRoute,
                                        from: startId,
                                        to: transferStopId,
                                        transferAt: transferStopId
                                    },
                                    {
                                        route: secondRoute,
                                        from: transferStopId,
                                        to: endId,
                                        transferAt: null
                                    }
                                ]
                            });
                        }
                    }
                }
            }
        }
    }

    console.log(`Found ${transferJourneys.length} transfer routes`);
    return transferJourneys;
}

function findMultiLegJourney(startId, endId, maxTransfers = 1) {
    // First try direct routes - prioritize these heavily
    let directRoutes = findRoutes(startId, endId);
    if (directRoutes && directRoutes.length > 0) {
        console.log(`Found ${directRoutes.length} direct routes - prioritizing these over transfers`);
        return {
            type: 'direct',
            routes: directRoutes.map(route => ({
                segments: [{
                    route: route,
                    from: startId,
                    to: endId,
                    transferAt: null
                }],
                priority: 1 // Highest priority for direct routes
            }))
        };
    }

    // If no direct routes, find routes with transfers
    let transferJourneys = findTransferRoutes(startId, endId);
    
    if (transferJourneys.length > 0) {
        console.log(`Found ${transferJourneys.length} transfer routes as fallback options`);
        return {
            type: 'transfer',
            routes: transferJourneys.map(journey => ({
                ...journey,
                priority: 2 // Lower priority for transfer routes
            }))
        };
    }

    return null; // No routes found
}

function getArrivalTime(routeId, stopId, targetTime = null, planByArrival = false) {
    console.log(routeId, stopId);

    let route = routes.find(route => route.route_id == routeId);
    if (route === undefined) {
        console.log("Route not found");
        return;
    }

    let stopNumber = null;

    for (let i = 0; i < route.stops.length; i++) {
        if (route.stops[i].stop_id == stopId) {
            stopNumber = route.stops[i].stop_number;
            break;
        }
    }

    let schedule = route.schedule;
    schedule.sort((a, b) => a.schedule_id - b.schedule_id);
    
    let referenceTime;
    if (targetTime) {
        // Handle both AM/PM format and 24-hour format
        let timeMoment;
        if (targetTime.includes('AM') || targetTime.includes('PM')) {
            timeMoment = moment.tz(targetTime, 'h:mm A', 'America/Los_Angeles');
        } else {
            timeMoment = moment.tz(targetTime, 'HH:mm', 'America/Los_Angeles');
        }
        referenceTime = timeMoment.format('HH:mm:ss');
    } else {
        referenceTime = moment().tz('America/Los_Angeles').format('HH:mm:ss');
    }
    console.log('Reference time:', referenceTime);
    
    let scheduleId = null;
    let scheduleNum = 0;
    let nextStartTime = null;
    let nextArrivalTime = null;
    let lastStartTime = null;
    let lastArrivalTime = null;
    let isFirstSchedule = false;
    let isBreak = false;
    let isLastScheduleBreak = false;

    if (planByArrival) {
        // Calculate time to target stop from route start
        let timeToStop = 0;
        for (let i = 0; i < route.stops.length; i++) {
            if (route.stops[i].stop_id == stopId) break;
            timeToStop += route.stops[i].leg_minutes;
        }
        
        // Find schedule that arrives closest to target time
        let targetArrivalTime = moment.tz(referenceTime, 'HH:mm:ss', 'America/Los_Angeles');
        let requiredStartTime = targetArrivalTime.clone().subtract(timeToStop, 'minutes');
        
        for (let i = 0; i < schedule.length; i++) {
            let startTime = moment.tz(`1970-01-01 ${schedule[i].start_time}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles');
            if (startTime.format('HH:mm:ss') >= requiredStartTime.format('HH:mm:ss')) {
                nextStartTime = startTime.format('HH:mm:ss');
                scheduleNum = i;
                scheduleId = schedule[i].schedule_id;
                break;
            }
        }
        
        if (nextStartTime == null) {
            nextStartTime = schedule[0].start_time;
            scheduleId = schedule[0].schedule_id;
            scheduleNum = 0;
        }
    } else {
        // Original logic for departure time planning
        for (let i = 0; i < schedule.length; i++) {
            let startTime = schedule[i].start_time;
            console.log(`Start time: ${startTime}`);
            let startTimeInPacific = moment.tz(`1970-01-01 ${startTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles').format('HH:mm:ss');
            if ((referenceTime < startTimeInPacific) && (nextStartTime == null || startTimeInPacific < nextStartTime)) {
                nextStartTime = startTimeInPacific;
                scheduleNum = i;
                scheduleId = schedule[i].schedule_id;
            }
            console.log(`Next start time: ${nextStartTime}`);
        }

        if (nextStartTime == null) {
            nextStartTime = schedule[0].start_time;
            scheduleId = schedule[0].schedule_id;
            scheduleNum = 0;
        }
    }

    // Calculate total time of schedule
    let totalTime = 0;
    for (let i = 0; i < route.stops.length; i++) {
        totalTime += route.stops[i].leg_minutes * 60000;
        for (let k = 0; k < schedule.length; k++) {
            // Find UTC stop by name instead of hardcoded ID
            const isUTCStop = route.stops[i].stop_name && route.stops[i].stop_name.includes('University Transit Center');
            if (schedule[k].is_break && isUTCStop && schedule[k].is_break != null) {
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
        console.log(`Last start time: ${lastStartTime}`);
        let lastStartTimeInPacific = moment.tz(`1970-01-01 ${lastStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles');
        let currentTimeInPacific = moment.tz(referenceTime, 'HH:mm:ss', 'America/Los_Angeles');
        if (currentTimeInPacific.diff(lastStartTimeInPacific) <= totalTime) {
            nextArrivalTime = lastStartTimeInPacific.valueOf();
            console.log(`Next start time: ${nextStartTime}`);
        }
    } else {
        lastStartTime = schedule[0].start_time;
    }

    // Calculate arrival time at the specific stop
    if (stopNumber == 1) {
        nextArrivalTime = moment.tz(`1970-01-01 ${nextStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles').valueOf();
        lastArrivalTime = moment.tz(`1970-01-01 ${lastStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles').valueOf();

        let finalNextTime = moment(nextArrivalTime).tz('America/Los_Angeles').format('h:mm A');
        let finalLastTime = moment(lastArrivalTime).tz('America/Los_Angeles').format('h:mm A');

        if (finalLastTime < referenceTime) {
            return finalNextTime;
        } else {
            return finalLastTime;
        }
    } else {
        nextArrivalTime = moment.tz(`1970-01-01 ${nextStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles').valueOf();
        lastArrivalTime = moment.tz(`1970-01-01 ${lastStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'America/Los_Angeles').valueOf();

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

                    // Find UTC stop by name instead of hardcoded ID
                    let isUTCStop = false;
                    if (j + 1 < route.stops.length) {
                        const nextStop = route.stops[j + 1];
                        isUTCStop = nextStop.stop_name && nextStop.stop_name.includes('University Transit Center');
                    }

                    if (isBreak == true && isUTCStop && isBreak != null) {
                        nextArrivalTime += schedule[scheduleNum].break_min * 60000;
                    }

                    if (isLastScheduleBreak == true && isUTCStop && isLastScheduleBreak != null) {
                        lastArrivalTime += schedule[scheduleNum - 1].break_min * 60000;
                    }
                }
            }
        }

        let finalNextTime = moment(nextArrivalTime).tz('America/Los_Angeles').format('h:mm A');
        let finalLastTime = moment(lastArrivalTime).tz('America/Los_Angeles').format('h:mm A');

        let currentTimeMoment = moment.tz(referenceTime, 'HH:mm:ss', 'America/Los_Angeles');

        console.log(lastArrivalTime, currentTimeMoment.valueOf());
        console.log(lastArrivalTime < currentTimeMoment.valueOf());
        if (lastArrivalTime < currentTimeMoment.valueOf()) {
            return finalNextTime;
        } else {
            return finalLastTime;
        }
    }
}

function getNextArrivalTime(routeId, stopId) {
    return getArrivalTime(routeId, stopId);
}

function calculateJourneyTimes(journey, targetTime = null, planByArrival = false) {
    let journeyTimes = [];
    
    if (planByArrival && targetTime) {
        // For arrival-based planning, we need to find the bus schedule that arrives closest to the target time
        // We'll use the getArrivalTime function with planByArrival=true for the destination stop
        
        // Start with the last segment and work backwards
        let segments = journey.segments.slice(); // Copy the segments
        
        // For multi-segment journeys, we need to calculate backwards
        if (segments.length === 1) {
            // Single segment journey
            let segment = segments[0];
            let departureTime = getArrivalTime(segment.route.route_id, segment.from, targetTime, true); // Use arrival planning
            let arrivalTime = getArrivalTime(segment.route.route_id, segment.to, departureTime, false); // Calculate actual arrival time
            
            journeyTimes.push({
                segment: 1,
                route: segment.route,
                from: segment.from,
                to: segment.to,
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                transferAt: segment.transferAt
            });
        } else {
            // Multi-segment journey - work backwards from target time
            let workingArrivalTime = targetTime;
            
            // Process segments in reverse order
            for (let i = segments.length - 1; i >= 0; i--) {
                let segment = segments[i];
                
                if (i === segments.length - 1) {
                    // Last segment - arrive at target time
                    let departureTime = getArrivalTime(segment.route.route_id, segment.from, workingArrivalTime, true);
                    let arrivalTime = workingArrivalTime;
                    
                    journeyTimes.unshift({
                        segment: i + 1,
                        route: segment.route,
                        from: segment.from,
                        to: segment.to,
                        departureTime: departureTime,
                        arrivalTime: arrivalTime,
                        transferAt: segment.transferAt
                    });
                    
                    // Set working time for next segment (subtract transfer buffer)
                    let departureMoment = moment.tz(departureTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
                    workingArrivalTime = departureMoment.clone().subtract(10, 'minutes').format('h:mm A');
                } else {
                    // Earlier segments
                    let departureTime = getArrivalTime(segment.route.route_id, segment.from, workingArrivalTime, true);
                    let arrivalTime = workingArrivalTime;
                    
                    journeyTimes.unshift({
                        segment: i + 1,
                        route: segment.route,
                        from: segment.from,
                        to: segment.to,
                        departureTime: departureTime,
                        arrivalTime: arrivalTime,
                        transferAt: segment.transferAt
                    });
                    
                    // Set working time for next segment
                    let departureMoment = moment.tz(departureTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
                    workingArrivalTime = departureMoment.clone().subtract(10, 'minutes').format('h:mm A');
                }
            }
        }
    } else {
        // For departure-based planning, work forwards from the target time
        let currentTime = targetTime;
        
        for (let i = 0; i < journey.segments.length; i++) {
            let segment = journey.segments[i];
            let departureTime = getArrivalTime(segment.route.route_id, segment.from, currentTime, false);
            let arrivalTime = getArrivalTime(segment.route.route_id, segment.to, currentTime, false);
            
            journeyTimes.push({
                segment: i + 1,
                route: segment.route,
                from: segment.from,
                to: segment.to,
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                transferAt: segment.transferAt
            });
            
            // For next segment, check transfer time
            if (i < journey.segments.length - 1) {
                let nextSegment = journey.segments[i + 1];
                let nextDepartureTime = getArrivalTime(nextSegment.route.route_id, nextSegment.from, arrivalTime, false);
                
                // Calculate transfer time in minutes
                let arrivalMoment = moment.tz(arrivalTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
                let departureMoment = moment.tz(nextDepartureTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
                let transferMinutes = departureMoment.diff(arrivalMoment, 'minutes');
                
                // If transfer time is too long, too short, or negative, reject this journey
                if (transferMinutes > 30 || transferMinutes < 5) {
                    return null; // Invalid journey due to transfer time constraints
                }
                
                currentTime = arrivalTime;
            }
        }
    }
    
    return journeyTimes;
}

function buildRoutePlan(formSubmission) {
    // Load data first
    getSchedule();
    getRouteData();
    getStops();

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


    parseData();    // Runs the parseData function, which takes the returned DB values and combines them into one big array

    let planByArrival = formSubmission.planType === 'arrival';
    let targetTime = formSubmission.targetTime || null;
    let startPoint = parseInt(formSubmission.startpoint);
    let endPoint = parseInt(formSubmission.endpoint);
    
    // Get both direct routes and transfer routes separately
    let directRoutes = findRoutes(startPoint, endPoint);
    let transferRoutes = findTransferRoutes(startPoint, endPoint);

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
                            "relativePath": "./cattracksfull"
                        }
                    },
                    {
                        "elementType": "breadcrumbItem",
                        "title": "Route Planner",
                        "url": {
                            "relativePath": "./cattracksfull"
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
                "heading": directRoutes && directRoutes.length > 0 ? "Route Options" : "Routes with Transfers",
                "fontSize": "xsmall",
                "textColor": "rgba(0,40,86,0.75)",
                "textAlignment": "left",
                "marginTop": "3%",
                "marginBottom": "0%",
            },
            {
                "elementType": "heroHeading",
                "responsiveScaling": true,
                "heading": `${stopData.find(stop => stop.stop_id == startPoint).stop_name} to ${stopData.find(stop => stop.stop_id == endPoint).stop_name}`,
                "fontSize": "large",
                "textColor": "#002856",
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
                    "heading": directRoutes && directRoutes.length > 0 ? "Direct Routes" : "Route Options",
                    "description": directRoutes && directRoutes.length > 0 ? 
                        "Direct routes between your selected stops with departure times." :
                        "Routes available to reach your destination."
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
                    "description": "Plan routes by departure or arrival time. System will find both direct routes and routes with transfers."
                }
            ]
        }
    }

    // Handle direct routes first
    if (directRoutes && directRoutes.length > 0) {
        let xmDirectRouteCardSet = {
            "elementType": "cardSet",
            "id": "directRouteCardSet",
            "ajaxLoadingIndicator": "large",
            "ajaxLoadingMessage": "Loading Direct Routes...",
            "noItemsMessage": "No direct routes found.",
            "items": []
        };

        for (let i = 0; i < directRoutes.length; i++) {
            let route = directRoutes[i];
            // Create a journey structure for consistency with existing functions
            let journey = {
                segments: [{
                    route: route,
                    from: startPoint,
                    to: endPoint,
                    transferAt: null
                }]
            };
            
            let journeyTimes = calculateJourneyTimes(journey, targetTime, planByArrival);
            if (journeyTimes === null) continue;
            
            let segment = journeyTimes[0];
            let xmRouteCard = {
                "elementType": "contentCard",
                "size": "small",
                "id": `direct_${segment.route.route_id}`,
                "label": `${segment.departureTime} from ${stopData.find(stop => stop.stop_id == segment.from).stop_name}`,
                "title": segment.route.route_name,
                "description": segment.route.route_description,
                "descriptionLineClamp": 3,
                "labelLineClamp": 2,
                "labelTextColor": "#daa900",
                "titleTextColor": "#002856",
                "url": {
                    "relativePath": `./cattracks/route/${segment.route.route_id}`
                }
            };
            xmDirectRouteCardSet.items.push(xmRouteCard);
        }
        xmContent.primaryColumn.content.push(xmDirectRouteCardSet);
    }

    // Handle transfer routes in a collapsible section
    if (transferRoutes && transferRoutes.length > 0) {
        // Add collapsible section for multi-line routes
        let xmTransferSection = {
            "elementType": "collapsible",
            "id": "transferRoutesSection",
            "title": "Multi-Line Routes (Requires Transfers)",
            "description": `${transferRoutes.length} route${transferRoutes.length > 1 ? 's' : ''} available with transfers`,
            "collapsed": directRoutes && directRoutes.length > 0, // Collapse if we have direct routes
            "content": []
        };

        let xmTransferRouteCardSet = {
            "elementType": "cardSet",
            "id": "transferRouteCardSet",
            "ajaxLoadingIndicator": "large",
            "ajaxLoadingMessage": "Loading Transfer Routes...",
            "noItemsMessage": "No transfer routes found.",
            "items": []
        };

        for (let i = 0; i < transferRoutes.length; i++) {
            let journey = transferRoutes[i];
            let journeyTimes = calculateJourneyTimes(journey, targetTime, planByArrival);
            
            // Skip journeys with invalid transfer times (null result)
            if (journeyTimes === null) {
                continue;
            }
            
            // Transfer journey
            let firstSegment = journeyTimes[0];
            let secondSegment = journeyTimes[1];
            let transferStop = stopData.find(stop => stop.stop_id == firstSegment.transferAt);
            
            // Handle missing transfer stop data gracefully
            if (!transferStop) {
                console.warn(`Transfer stop with ID ${firstSegment.transferAt} not found in stop data`);
                continue; // Skip this journey if transfer stop data is missing
            }
            
            // Calculate and display transfer time
            let arrivalMoment = moment.tz(firstSegment.arrivalTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
            let departureMoment = moment.tz(secondSegment.departureTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
            let transferMinutes = departureMoment.diff(arrivalMoment, 'minutes');
            
            // Calculate total journey time
            let journeyStartMoment = moment.tz(firstSegment.departureTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
            let journeyEndMoment = moment.tz(secondSegment.arrivalTime, ['h:mm A', 'HH:mm'], 'America/Los_Angeles');
            let totalJourneyMinutes = journeyEndMoment.diff(journeyStartMoment, 'minutes');
            
            let xmRouteCard = {
                "elementType": "contentCard",
                "size": "large",
                "id": `transfer_${firstSegment.route.route_id}_${secondSegment.route.route_id}`,
                "label": `Depart at ${firstSegment.departureTime} → ${totalJourneyMinutes} min transfer time`,
                "title": `${firstSegment.route.route_name} → ${secondSegment.route.route_name}`,
                "description": `Start by taking ${firstSegment.route.route_name} at ${firstSegment.departureTime}. Transfer at ${transferStop.stop_name}. It will be a ${transferMinutes} min wait. Take ${secondSegment.route.route_name} to reach your destination.`,
                "descriptionLineClamp": 10,
                "descriptionFontSize": "large",
                "labelLineClamp": 2,
                "labelTextColor": "#daa900",
                "titleTextColor": "#002856"
            };
            xmTransferRouteCardSet.items.push(xmRouteCard);
        }
        
        xmTransferSection.content.push(xmTransferRouteCardSet);
        xmContent.primaryColumn.content.push(xmTransferSection);
    }

    // If no routes found at all
    if ((!directRoutes || directRoutes.length === 0) && (!transferRoutes || transferRoutes.length === 0)) {
        let noRoutesMessage = {
            "elementType": "blockHeading",
            "heading": "No Routes Found",
            "description": "No routes found between these stops. Try selecting different stops or check if service is available on this day."
        };
        xmContent.primaryColumn.content.push(noRoutesMessage);
    }

    let xmRoutePlanner = {
        "elementType": "form",
        "id": "routePlan",
        "initiallyHidden": false,
        "relativePath": "./cattracks/routeplanner",
        "items": [
            {
                "elementType": "formInputSelect",
                "name": "planType",
                "label": "Plan By",
                "value": "departure",
                "options": [
                    { "value": "departure", "label": "Departure Time" },
                    { "value": "arrival", "label": "Arrival Time" }
                ]
            },
            {
                "elementType": "formInputTime",
                "name": "targetTime",
                "label": "Target Time (optional)"
            },
            {
                "elementType": "formInputAssistedSelect",
                "name": "startpoint",
                "label": "Select Starting Point",
                "value": "23",
                "options": [],
            },
            {
                "elementType": "formInputAssistedSelect",
                "name": "endpoint",
                "label": "Select Destination", 
                "value": "17",
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
                    "relativePath": "./cattracksfull"
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
        xmRoutePlanner.items[2].options.push(formItem);
        xmRoutePlanner.items[3].options.push(formItem);
    }

    xmContent.secondaryColumn.content.push(xmRoutePlanner);

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
module.exports.findTransferRoutes = findTransferRoutes;
module.exports.findMultiLegJourney = findMultiLegJourney;
module.exports.getArrivalTime = getArrivalTime;
module.exports.calculateJourneyTimes = calculateJourneyTimes;
module.exports.formatTimeAMPM = formatTimeAMPM;