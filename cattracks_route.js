const { response } = require("express");
const { route } = require("express/lib/application");
const cattracks = require('./cattracks.js');
const cattracksfull = require('./cattracksfull.js');
const moment = require('moment-timezone');
const dataAdapter = require('./dataAdapter');

// Set Variables
let scheduleData = null;    // Holds schedule data
let routeData = null;   // Holds route data
let stopData = null;    // Holds stop data
let arivTime = null;    // Holds arrival time

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

function getNextArrivalTime(routeId, stopId) {
    console.log('Getting next arrival for route', routeId, 'stop', stopId);
    
    // Find the route in our parsed data
    let route = routes.find(route => route.route_id == routeId);
    if (!route) {
        console.log("Route not found");
        return "N/A";
    }
    
    // Find the stop name from the stop ID
    let targetStop = route.stops.find(stop => stop.stop_id == stopId);
    if (!targetStop) {
        console.log("Stop not found in route");
        return "N/A";
    }
    
    // Use dataAdapter to get the next arrival time directly from JSON
    try {
        const nextTime = dataAdapter.getNextArrival(route.route_name, targetStop.stop_name);
        return nextTime || "N/A";
    } catch (error) {
        console.error('Error getting next arrival:', error);
        return "N/A";
    }
}

function getTimeDifferenceInMinutes(arivTime) {
    if (!arivTime || arivTime === "N/A") {
        return -1;
    }
    
    // Get the current time in Pacific timezone
    let currentTime = moment().tz('America/Los_Angeles');

    // Create arrival time moment in Pacific timezone
    let arrivalTime = moment.tz(arivTime, 'HH:mm', 'America/Los_Angeles');
    
    // If arrival time is earlier than current time, assume it's tomorrow
    if (arrivalTime.isBefore(currentTime)) {
        arrivalTime.add(1, 'day');
    }

    // Calculate the difference in minutes
    let differenceInMinutes = arrivalTime.diff(currentTime, 'minutes');

    return differenceInMinutes;
}

// Parse through returned data and rework variables to be stored in a readable manner

function buildRouteInformation(routeId) {
    // Load data first
    getSchedule();
    getRouteData();
    getStops();
    
    parseData();

    let route = null;

    for (let i = 0; i < routes.length; i++) {
        if (routes[i].route_id == routeId) {
            route = routes[i];
            break;
        }
    }
    let routeName = route.route_name;

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
                        "title": "Routes",
                        "url": {
                            "relativePath": "./cattracksfull"
                        }
                    },
                    {
                        "elementType": "breadcrumbItem",
                        "title": routeName,
                    }
                ]
            },
            {
                "elementType": "heroHeading",
                "responsiveScaling": true,
                "heading": routeName,
                "fontSize": "large",
                // "textColor": "rgba(220,245,255,0.75)",
                "textColor": "#002856",
                // "fontSize": "2rem",
                "textAlignment": "left",
                "marginTop": "3%",
                "marginBottom": "2%",
            }
        ]
    }
    xmJson.header.push(xmHeader);

    // Build the content page so the page looks decent
    let date = new Date();
    let xmContent = {
        "elementType": "responsiveTwoColumn",
        "id": "content",
        "primarySide": "right",
        "primaryColumn": {
            "content": [
                {
                    "elementType": "divider",
                    "borderStyle": "none",
                    "marginTop": "5%"
                }
            ]
        },
        "secondaryColumn": {
            "content": []
        }
    }

    let xmScheduleList = {
        "elementType": "statusList",
        "id": "scheduleList",
        "marginTop": "none",
        "listStyle": "grouped",
        "showAccessoryIcons": false,
        "itemSize": "small",
        "imageStyle": "hero",
        "imageHorizontalPosition": "left",
        "imageHeight": "4rem",
        "imageWidth": "3rem",
        "responsiveVisibility": {
            "xsmall": false,
            "small": false
        },
        "items": []
    }

    let xmScheduleListMobile = {
        "elementType": "statusList",
        "id": "scheduleListMobile",
        "marginTop": "none",
        "listStyle": "grouped",
        "showAccessoryIcons": false,
        "itemSize": "small",
        "imageStyle": "hero",
        "imageHorizontalPosition": "left",
        "imageHeight": "4rem",
        "imageWidth": "3rem",
        "responsiveVisibility": {
            "medium": false,
            "large": false,
            "xlarge": false
        },
        "items": []
    }

    let xmRouteDetails =
    {
        "elementType": "detail",
        "description": "Route Details:",
        // "titleLineHeight": "0%",
        // "bylineLineHeight": "0%",
        "byline": `Last updated: ${date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`,
        "responsiveVisibility": {
            "xsmall": false,
            "small": false
        },
        "body": route.route_description
    }

    let xmRouteDetailsMobile =
    {
        "elementType": "collapsible",
        "id": "full_status_collapse_mobile",
        "title": "View Route Details",
        "initiallyHidden": false,
        "collapsed": true,
        "label": `Information:`,
        "description": "Click a status item to view more information.",
        "ajaxLoadingIndicator": "large",
        "ajaxLoadingMessage": "Loading Status Items...",
        "responsiveVisibility": {
            "medium": false,
            "large": false,
            "xlarge": false
        },
        "content": [
            {
                "elementType": "detail",
                // "titleLineHeight": "0%",
                // "bylineLineHeight": "0%",
                "byline": `Last updated: ${date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`,
                "body": route.route_description
            }
        ]
    }

    let xmDivider = {
        "elementType": "divider",
        "borderStyle": "none",
        "marginTop": "15%"
    }

    let xmDividerMobile = {
        "elementType": "divider",
        "borderStyle": "none",
    }

    for (let i = 0; i < route.stops.length; i++) {

        let nextArrival = getNextArrivalTime(routeId, route.stops[i].stop_id);
        let arivTime = `Arriving at ${nextArrival}`;
        let minAway = "minutes away"
        arivMin = JSON.stringify(getTimeDifferenceInMinutes(nextArrival));
        url = "https://static.modolabs.com/modo4/documentation/images/shuttles/shuttle_stops/default.svg" // Default stop image

        if (arivMin < 0) {
            arivMin = `N/A`
            arivTime = `There are no more buses scheduled for today. The next bus will arrive tomorrow at ${getNextArrivalTime(routeId, route.stops[i].stop_id)}`
        } else if (arivMin > 60) {
            arivMin = `> 1hr`
            arivTime = `The next bus will arrive at ${nextArrival}`
        } else if (arivMin <= 5) {
            arivTime = `Arriving soon at ${nextArrival}`
            url = "https://static.modolabs.com/modo4/documentation/images/shuttles/shuttle_stops/at_stop.svg" // Arriving at stop image
            minAway = 'minutes away'
        }

        if (arivMin == 1) {
            arivMin = `Arriving`
            arivTime = `The bus is approaching the stop. Have your CatCard ready.`
            minAway = 'Now'
        }

        let scheduleListItem = {
            "title": route.stops[i].stop_name,
            "image": {
                "url": url //leavnng, at_stop or default
            },
            "description": arivTime,
            "statusDetails": [
                {
                    "value": arivMin,
                    "description": minAway
                }
            ]
        }
        xmScheduleList.items.push(scheduleListItem);
        xmScheduleListMobile.items.push(scheduleListItem);
    }

    xmContent.primaryColumn.content.push(xmScheduleList);
    xmContent.secondaryColumn.content.push(xmDivider);
    xmContent.secondaryColumn.content.push(xmRouteDetails);

    xmContent.primaryColumn.content.push(xmRouteDetailsMobile);
    xmContent.secondaryColumn.content.push(xmScheduleListMobile);


    xmJson.content.push(xmContent);
    return xmJson;
}

module.exports.parseData = parseData;
module.exports.getRouteData = getRouteData;
module.exports.getSchedule = getSchedule;
module.exports.buildRouteInformation = buildRouteInformation;