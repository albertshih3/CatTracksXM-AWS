const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Load routes data from JSON file
let routesData = null;

function loadRoutesData() {
    if (!routesData) {
        try {
            const filePath = path.join(__dirname, 'routes.json');
            const rawData = fs.readFileSync(filePath, 'utf8');
            routesData = JSON.parse(rawData);
            console.log("Successfully loaded routes.json data");
        } catch (error) {
            console.error("Error loading routes.json:", error);
            routesData = [];
        }
    }
    return routesData;
}

// Get all route names and basic info (mimics Supabase routes table)
function getRoutes() {
    const data = loadRoutesData();
    return data.map((route, index) => ({
        route_id: index + 1,
        route_name: route.route,
        route_description: route.description || route.route
    }));
}

// Get all unique stops (mimics Supabase stops table)
function getStops() {
    const data = loadRoutesData();
    const stopsMap = new Map();
    const uniqueStopNames = new Set();

    // First pass: collect all unique stop names
    data.forEach(route => {
        // Check both weekday and weekend schedules
        ['weekday', 'weekend'].forEach(scheduleKey => {
            if (route[scheduleKey]) {
                route[scheduleKey].forEach(stopData => {
                    uniqueStopNames.add(stopData.stop);
                });
            }
        });
    });

    // Sort stop names alphabetically for deterministic ID assignment
    const sortedStopNames = Array.from(uniqueStopNames).sort();
    
    // Create stops with deterministic IDs
    const stops = sortedStopNames.map((stopName, index) => {
        const stopEntry = {
            stop_id: index + 1,
            stop_name: stopName,
            stop_description: stopName
        };
        stopsMap.set(stopName, stopEntry);
        return stopEntry;
    });

    return stops;
}

// Get route details with stops (mimics Supabase route_details table)
function getRouteDetails() {
    const data = loadRoutesData();
    const routeDetails = [];
    const globalStops = getStops(); // Get the global stop mapping
    
    data.forEach((route, routeIndex) => {
        // Check both weekday and weekend schedules
        ['weekday', 'weekend'].forEach(scheduleKey => {
            if (route[scheduleKey]) {
                route[scheduleKey].forEach((stopData, stopIndex) => {
                    // Find the global stop ID for this stop name
                    const globalStop = globalStops.find(stop => stop.stop_name === stopData.stop);
                    const stopId = globalStop ? globalStop.stop_id : stopIndex + 1; // Fallback to old system if not found
                    
                    routeDetails.push({
                        route_id: routeIndex + 1,
                        route_name: route.route,
                        stop_number: stopIndex + 1,
                        leg_minutes: 0, // Default value since not in JSON
                        stops: {
                            stop_id: stopId,
                            stop_name: stopData.stop,
                            stop_description: stopData.stop
                        },
                        routes: {
                            route_description: route.description || route.route
                        }
                    });
                });
            }
        });
    });

    return routeDetails;
}

// Get schedules with expanded time data (mimics Supabase schedules table)
function getSchedules() {
    const data = loadRoutesData();
    const schedules = [];
    let scheduleId = 1;

    data.forEach((route, routeIndex) => {
        // Check both weekday and weekend schedules
        ['weekday', 'weekend'].forEach(scheduleKey => {
            if (route[scheduleKey]) {
                // Get all unique times across all stops for this route
                const allTimes = new Set();
                route[scheduleKey].forEach(stopData => {
                    stopData.times.forEach(time => allTimes.add(time));
                });

                // Create schedule entries for each unique time
                Array.from(allTimes).sort().forEach(time => {
                    schedules.push({
                        schedule_id: scheduleId++,
                        start_time: time,
                        weekend: scheduleKey === 'weekend',
                        is_break: false,
                        break_min: 0,
                        route_id: routeIndex + 1,
                        routes: {
                            route_id: routeIndex + 1,
                            route_name: route.route,
                            route_description: route.description || route.route
                        }
                    });
                });
            }
        });
    });

    return schedules;
}

// Get schedules for a specific route
function getSchedulesByRoute(routeId) {
    const allSchedules = getSchedules();
    return allSchedules.filter(schedule => schedule.route_id === routeId);
}

// Get route data by route name
function getRouteByName(routeName) {
    const data = loadRoutesData();
    return data.find(route => route.route === routeName);
}

// Get stop times for a specific route and stop
function getStopTimes(routeName, stopName) {
    const data = loadRoutesData();
    const route = data.find(r => r.route === routeName);
    
    if (!route) return [];
    
    // Check both weekday and weekend schedules
    for (let scheduleKey of ['weekday', 'weekend']) {
        if (route[scheduleKey]) {
            const stop = route[scheduleKey].find(s => s.stop === stopName);
            if (stop) return stop.times;
        }
    }
    
    return [];
}

// Get all stops for a specific route
function getRouteStops(routeName) {
    const data = loadRoutesData();
    const route = data.find(r => r.route === routeName);
    
    if (!route) return [];
    
    // Check both weekday and weekend schedules
    for (let scheduleKey of ['weekday', 'weekend']) {
        if (route[scheduleKey]) {
            return route[scheduleKey].map(stopData => ({
                stop_name: stopData.stop,
                times: stopData.times
            }));
        }
    }
    
    return [];
}

// Calculate next arrival time for a route at a specific stop
function getNextArrival(routeName, stopName, currentTime = null) {
    if (!currentTime) {
        currentTime = moment().tz('America/Los_Angeles').format('HH:mm');
    }
    
    const times = getStopTimes(routeName, stopName);
    const currentMoment = moment(currentTime, 'HH:mm');
    
    // Find next time
    for (let time of times) {
        const timeMoment = moment(time, 'HH:mm');
        if (timeMoment.isAfter(currentMoment)) {
            return time;
        }
    }
    
    // If no time found today, return first time tomorrow
    return times.length > 0 ? times[0] : null;
}

// Helper function to check if current time is weekend
function isWeekend() {
    const now = moment().tz('America/Los_Angeles');
    return now.day() === 0 || now.day() === 6; // Sunday = 0, Saturday = 6
}

module.exports = {
    loadRoutesData,
    getRoutes,
    getStops,
    getRouteDetails,
    getSchedules,
    getSchedulesByRoute,
    getRouteByName,
    getStopTimes,
    getRouteStops,
    getNextArrival,
    isWeekend
};