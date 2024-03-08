/**
 * Make the status page for the XModule
 */
const axios = require('axios');
const { response } = require('express');

// Axios config and call to get status information
let config = {
	maxBodyLength: Infinity,
	url: 'https://4020906026954545.hostedstatus.com/1.0/status/60b16163e5d993052b815109',
	headers: {}
};

// Declare global variables to track status information
let totalStatus = 0;
let totalOperational = 0;
let totalError = 0;
let overallStatus = null;
let statusColor = null;
let activeIncidents = 0;
let activeMaintenance = 0;
let upcomingMaintenance = 0;
let statusResult = null;
let incidentArray = [];
let brokenStatus = [];

/** An async function that grabs the status data using the public view API and returns JSON */
async function getStatusData() {
	await axios.request(config)
		.then((response) => {
			console.log("STATUS SUCESSFULLY RECIEVED ✔");

			// Iterate through the data and parse information
			// We will start by checking if the data exists and then set the current overall status

			totalOperational = 0;
			totalStatus = 0;

			if (response.data && response.data.result && response.data.result.status) {
				overallStatus = response.data.result.status_overall.status;
				console.log(overallStatus)
				// Depending on the overall status, assign a color to the status
				if (overallStatus == "Operational") {
					statusColor = "green"
				} else if (overallStatus == "Degraded Performance" || overallStatus == "Partial Service Disruption") {
					statusColor = "#ec9706"
				} else if (overallStatus == "Active Maintenance") {
					statusColor = "#05b0f4"
				} else {
					statusColor = "#DA2A2A"
				}
				console.log(overallStatus)
				console.log(statusColor)

				// Set the status array to a variable
				const statusArray = response.data.result.status;
				incidentArray = response.data.result.incidents;
				const activeMaintenanceArray = response.data.result.maintenance.active;
				const upcomingMaintenanceArray = response.data.result.maintenance.upcoming;
				statusResult = response;

				console.log(overallStatus)
				console.log(statusColor)

				// Loop through the status array and add up the total number of services
				statusArray.forEach((status) => {
					if (status.containers && Array.isArray(status.containers)) {
						totalStatus += status.containers.length;
					}
					if (status.status === "Operational") {
						totalOperational += 1;
					} else {
						totalError += 1;
						brokenStatus.push(status.name);
					}
				});

				console.log(overallStatus)
				console.log(statusColor)

				activeIncidents = incidentArray.length;
				activeMaintenance = activeMaintenanceArray.length;
				upcomingMaintenance = upcomingMaintenanceArray.length;

				totalOperational = totalStatus - totalError;

				console.log("OVERALL STATUS: ", overallStatus);
				console.log("TOTAL STATUS ITEMS: ", totalStatus);
				console.log("TOTAL NUMBER OF OPERATIONAL STATUS ITEMS: ", totalOperational);
				console.log("TOTAL STATUS ERRORS: ", totalError);
				console.log("ACTIVE INCIDENTS: ", activeIncidents);
				console.log("ACTIVE MAINTENANCE: ", activeMaintenance);
				console.log("UPCOMING MAINTENANCE: ", upcomingMaintenance);
			}
		})

		.catch((error) => {
			console.log(error);
		});
}

function getCards(filter) {

	let xmCards = []

	for (let i = upcomingMaintenance - 1; i >= 0; i--) {

		for (let j = 0; j < statusResult.data.result.maintenance.upcoming[i].components_affected.length; j++) {
			if (filter == null || filter == 'none' || filter.includes(statusResult.data.result.maintenance.upcoming[i].components_affected[j]._id)) {
				let cardExists = false;
				for (let k = 0; k < xmCards.length; k++) {
					if (xmCards[k].id == statusResult.data.result.maintenance.upcoming[i]._id) {
						cardExists = true;
						break;
					}
				}
				if (!cardExists) {
					let xmMaintenanceCard = {
						"elementType": "contentCard",
						"size": "small",
						"id": `${statusResult.data.result.maintenance.upcoming[i]._id}`,
						"label": `${statusResult.data.result.maintenance.upcoming[i].components_affected.length} Components Affected`,
						"title": `${statusResult.data.result.maintenance.upcoming[i].name}`,
						"description": `${statusResult.data.result.maintenance.upcoming[i].messages[0].details}`,
						"descriptionLineClamp": 3,
						"labelLineClamp": 2,
						"labelTextColor": "#daa900",
						"titleTextColor": "#002856",
						"url": {
							"relativePath": `./status/maintenance/${statusResult.data.result.maintenance.upcoming[i]._id}`
						}
					}
					xmCards.push(xmMaintenanceCard);
				}
			}
		}


	}

	return xmCards;
}

function calculateTime() {

	let d = new Date();
	let dateTimeStart = null;
	let dateTimeEnd = null;
	let startingSoon = 0;

	for (let i = upcomingMaintenance - 1; i >= 0; i--) {
		let ds = new Date(statusResult.data.result.maintenance.upcoming[i].datetime_planned_start)
		dateTimeStart = ds.toLocaleString();

		let de = new Date(statusResult.data.result.maintenance.upcoming[i].datetime_planned_end)
		dateTimeEnd = de.toLocaleString();

		// Calculate time until maintenance to see if upcoming maintenance alert should be shown
		let timeUntil = ds - d;
		timeUntil = timeUntil / 1000 / 60 / 60 / 24;
		console.log(timeUntil)
		if (timeUntil <= 1) {
			startingSoon = startingSoon + 1;
		}
	}

	return startingSoon;
}

function makeStatus(queryStringParameters) {

	// FOR TESTING PURPOSES
	// overallStatus = "Service Disruption";
	// totalError = 5;
	// statusColor = "red";
	// console.log(overallStatus)

	console.log("Building XModule Components... 🔨")
	// Boilerplate JSON
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

	// Header for page (varies depending on status)
	console.log("Building Header... 🔨")
	let xmHeader = {
		"elementType": "hero",
		"height": "fluid",
		"contentContainerWidth": "wide",
		"backgroundImage": {
			"overlayType": "solid",
			// "overlayGradientStartColor": statusColor,
			// "overlayGradientAngle": 180,
			"overlayColor": statusColor
		},
		"content": [
			{
				// Hide me on mobile!
				"elementType": "heroButtons",
				"horizontalAlignment": "right",
				"marginBottom": "0%",
				"marginTop": "2%",
				"buttons": [
					{
						"elementType": "linkButton",
						// "backgroundColor": "#1ee8dc",
						"borderColor": "#daa900",
						"borderWidth": "2px",
						"title": "View Full Status",
						"textColor": "#ffffff",
						"link": {
							"external": "https://status.ucmerced.edu"
						}
					}
				]
			},
			{
				"elementType": "heroHeading",
				"responsiveScaling": true,
				"heading": `Current Status:`,
				"fontSize": "small",
				"textColor": "rgba(220,245,255,0.75)",
				// "textColor": "#ffffff",
				// "fontSize": "2rem",
				"textAlignment": "left",
				"marginTop": "2%",
				"marginBottom": "0%",
			},
			{
				"elementType": "heroHeading",
				"responsiveScaling": true,
				"heading": `${overallStatus}`,
				"fontSize": "large",
				// "textColor": "rgba(220,245,255,0.75)",
				"textColor": "#ffffff",
				// "fontSize": "2rem",
				"textAlignment": "left",
				"marginTop": "0%",
				"marginBottom": "xloose",
			}
		]
	}
	xmJson.header.push(xmHeader);
	console.log("Successfully built header! ✔")

	// Planning for the content section:
	// 3) A button to show either more status (list with components that you can click into) and/or history (list of past incidents/maintenance)

	// 1) Hidden section that shows active incidents and/or active incidents. Only display if there are active incidents or active maintenance
	let noIncident = true;
	if (activeIncidents > 0) {
		noIncident = false;
	}

	if (noIncident == false) {
		let xmActiveIncident = {
			"elementType": "container",
			"id": "active_incident",
			"initiallyHidden": noIncident,
			"margin": "responsive",
			"padding": "medium",
			"borderStyle": "solid",
			"borderColor": "red",
			"borderWidth": "3px",
			"content": [
				{
					"elementType": "detail",
					"titleTextColor": "red",
					"bylineLineHeight": "xxtight",
					"descriptionLineHeight": "xxtight",
					"titleLineHeight": "xxtight",
					"titleHeadingLevel": 1,
					"titleFontSize": "xsmall",
					"titleFontFamily": "bebas2",
					"descriptionFontSize": "xsmall",
					"title": `Active Incident: ${incidentArray[0].name}`,
					"description": "Latest update:",
					"byline": `${incidentArray[0].messages[incidentArray[0].messages.length - 1].details}`,
					"buttons": [
						{
							"elementType": "linkButton",
							"borderColor": "#daa900",
							"borderWidth": "2px",
							"title": "View Incident",
							"textColor": "#002856",
							"marginTop": "medium",
							"icon": "next",
							"iconOnly": true,
							"iconPosition": "right",
							"minWidth": "auto",
							"link": {
								"relativePath": `./status/incidents/${incidentArray[0]._id}`
							}
						}
					]
				}
			]
		}
		xmJson.content.push(xmActiveIncident);
	}


	// 2) Two column layout with upcoming maintenance on the left and external status info on the right
	let xmUpcomingMaintenance = {
		"elementType": "responsiveTwoColumn",
		"id": "upcoming_maintenance",
		"primaryColumn": {
			"content": [
				{
					"elementType": "blockHeading",
					"heading": "Upcoming Maintenance",
					"headingLevel": 2,
					"description": `Scheduled maintenance that may impact services. There are currently ${upcomingMaintenance} planned maintenance events.`,
				}
			]
		},
		"secondaryColumn": {
			"content": [
				{
					"elementType": "blockHeading",
					"heading": "Quick Status",
					"headingLevel": 2,
					"description": `Quick status of common systems. Click to view more.`,
				}
			]
		}
	}

	// Build full status list
	let xmStatusContainer = {
		"elementType": "container",
		"id": "full_status",
		"margin": "responsive",
		"padding": "medium",
		"content": []
	}

	let xmFullStatus = {
		"elementType": "collapsible",
		"id": "full_status_collapse",
		"title": "View All Status Items",
		"initiallyHidden": false,
		"collapsed": false,
		"label": `${totalOperational} out of ${totalStatus} services are operational.`,
		"description": "Click a status item to view more information.",
		"ajaxLoadingIndicator": "large",
		"ajaxLoadingMessage": "Loading Status Items...",
		"responsiveVisibility": {
			"xsmall": false,
			"small": false
		},
		"content": [
			{
				"elementType": "statusList",
				"listStyle": "grouped",
				"marginTop": "tight",
				"noItemsMessage": "Something went wrong, please try again later.",
				"items": []
			}
		]
	}

	let xmFullStatusMobile = {
		"elementType": "collapsible",
		"id": "full_status_collapse_mobile",
		"title": "View All Status Items",
		"initiallyHidden": false,
		"collapsed": true,
		"label": `${totalOperational} out of ${totalStatus} services are operational.`,
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
				"elementType": "statusList",
				"listStyle": "grouped",
				"marginTop": "tight",
				"noItemsMessage": "Something went wrong, please try again later.",
				"items": []
			}
		]
	}

	// Add items to the quick status list
	const statusArray = statusResult.data.result.status;
	statusArray.forEach((status) => {

		let operational = 0;

		for (let i = 0; i < status.containers.length; i++) {
			if (status.containers[i].status == "Operational") {
				operational = operational + 1;
			}
		}

		let statusItem = {
			"title": status.name,
			"statusText": status.status,
			"status": status.code,
			"statusDetails": [
				{
					"detailStyle": "fraction",
					"value": operational.toString(),
					"denominator": status.containers.length.toString(),
					"description": "Subsystems Operational",
					"detailWidth": "narrow"
				}
			],
			"link": {
				"relativePath": `./status/component/${status.id}`,
				"accessory": "button_drilldown"
			}
		}

		xmFullStatus.content[0].items.push(statusItem);
		xmFullStatusMobile.content[0].items.push(statusItem);
	});


	let xmFilter = {
		"elementType": "form",
		"id": "select",
		"marginBottom": "xxtight",
		"items": [{
			"elementType": "formInputSelect",
			"name": "filter",
			"label": "Filter by Affected Systems",
			"options": [{
				"label": "Show all",
				"value": "none"
			},
			{
				"label": "Filter by Affected Systems",
				"value": []
			}
			],
			"events": [{
				"eventName": "change",
				"action": "ajaxUpdate",
				"targetId": "upcoming_maintenance_cards",
				"ajaxRelativePath": "",
				"propagateArgs": true
			}]
		}]
	};

	// Generate cards based on the number of upcoming maintenance events
	xmMaintenanceCardSet = {
		"elementType": "cardSet",
		"id": "upcoming_maintenance_cards",
		"ajaxLoadingIndicator": "large",
		"ajaxLoadingMessage": "Loading Maintenance Items...",
		"noItemsMessage": "There are currently no planned maintenance events. Check back later!",
		"items": []
	}

	// Add items to the filter list
	for (let i = upcomingMaintenance - 1; i >= 0; i--) {
		let components = "";
		let temp = "";
		let componentId = null;

		// Grab container for the label
		for (let j = 0; j < statusResult.data.result.maintenance.upcoming[i].components_affected.length; j++) {

			temp = statusResult.data.result.maintenance.upcoming[i].components_affected[j].name;
			componentId = statusResult.data.result.maintenance.upcoming[i].components_affected[j]._id;

			let filterItem = {
				"value": componentId,
				"label": temp
			}


			if (xmFilter.items[0].options[1].value.length == 0) {
				xmFilter.items[0].options[1].value.push(filterItem);
			} else {
				let idExists = false;
				for (let k = 0; k < xmFilter.items[0].options[1].value.length; k++) {
					if (xmFilter.items[0].options[1].value[k].value == componentId) {
						idExists = true;
						break;
					}
				}
				if (!idExists) {
					xmFilter.items[0].options[1].value.push(filterItem);
				}
			}

			if (components != "") {
				components = components + " & " + temp;
			} else {
				components = temp;
			}
			temp = "";
		}
	}

	// Code bit that makes the filtering work
	if (queryStringParameters != null && 'filter' in queryStringParameters) {
		xmJson.elementFields = {
			"items": getCards(queryStringParameters.filter) //60b2a3c36
		};
	}
	else {
		xmMaintenanceCardSet.items = getCards();

		xmUpcomingMaintenance.primaryColumn.content.push(xmFilter);
		xmUpcomingMaintenance.primaryColumn.content.push(xmMaintenanceCardSet);
	}

	// xmUpcomingMaintenance.primaryColumn.content.push(xmFilter);
	// xmUpcomingMaintenance.primaryColumn.content.push(xmMaintenanceCardSet);
	xmJson.content.push(xmUpcomingMaintenance);


	let xmQuickStatus = {
		"elementType": "statusList",
		"listStyle": "grouped",
		"noItemsMessage": "Something went wrong, please try again later.",
		"items": []
	}

	// Add items to the quick status list
	statusArray.forEach((status) => {

		let operational = 0;

		if (status.name == "Authentication and Identity Management" || status.name == "CatCourses" || status.name == "Network Services" || status.name == "Student Services" || status.name == "UC Merced Connect") {
			for (let i = 0; i < status.containers.length; i++) {
				if (status.containers[i].status == "Operational") {
					operational = operational + 1;
				}
			}

			let statusItem = {
				"title": status.name,
				"statusText": status.status,
				"status": status.code,
				"statusDetails": [
					{
						"detailStyle": "fraction",
						"value": operational.toString(),
						"denominator": status.containers.length.toString(),
						"description": "Subsystems Operational",
						"detailWidth": "narrow"
					}
				],
				"link": {
					"relativePath": `./status/component/${status.id}`
				}
			}
			xmQuickStatus.items.push(statusItem);
		}
	}
	);

	xmUpcomingMaintenance.secondaryColumn.content.push(xmQuickStatus);

	xmStatusContainer.content.push(xmFullStatus);
	xmStatusContainer.content.push(xmFullStatusMobile);
	xmJson.content.push(xmStatusContainer);

	let startingSoon = calculateTime();

	// Banner messages for the status page
	if (totalError == 0 && overallStatus == "Operational" && startingSoon == 0) {
		xmJson.metadata.banners.push({
			"message": "All systems are operational at this time! Experiencing issues? Report an issue here or call (209) 228-HELP (4357).",
			"type": "confirmation",
			"link": {
				"external": "https://ucmerced.service-now.com/servicehub?id=sh_sc_cat_item&sys_id=4720dfe64f97ca002f3bd49f0310c726"
			}
		});
	} else if (totalError > 0 && overallStatus == "Degraded Performance" || overallStatus == "Partial Service Disruption") {
		xmJson.metadata.banners.push({
			"message": `Some systems are experiencing degraded performance at this time. Click here for more information.`,
			"type": "warning",
			"link": {
				"relativePath": `./status/incidents/${incidentArray[0]._id}`
			}
		});
	} else if (totalError > 0 && overallStatus == "Security Issue" || overallStatus == "Service Disruption") {
		xmJson.metadata.banners.push({
			"message": `There is an ongoing incident. Click here for incident details and updates.`,
			"type": "alarm",
			"link": {
				"relativePath": `./status/incidents/${incidentArray[0]._id}`
			}
		});
	}

	if (startingSoon > 0 && totalError == 0) {
		xmJson.metadata.banners.push({
			"message": `${startingSoon} scheduled maintence event is starting within 24 hours. Check upcoming maintence for more info!`,
			"type": "warning"
		});
	}

	console.log("XModule Components sucessfully built! ✔")
	resetStatus();
	return xmJson;
}

// Make the details page for the maintenance events
function makeMaintenanceDetails(maintenanceId) {
	let maintName = "";
	let maintDetail = ""
	let affectedContainers = 0;
	let affectedComponents = 0;

	let d = new Date();
	let ds = null;
	let de = null;
	let dateTimeStart = null;
	let dateTimeEnd = null;
	let startingSoon = true;

	let containerNames = [];
	let componentNames = [];

	for (let i = 0; i < upcomingMaintenance; i++) {
		if (statusResult.data.result.maintenance.upcoming[i]._id == maintenanceId) {
			maintName = statusResult.data.result.maintenance.upcoming[i].name;
			maintDetail = statusResult.data.result.maintenance.upcoming[i].messages[0].details;
			affectedContainers = statusResult.data.result.maintenance.upcoming[i].containers_affected.length;
			affectedComponents = statusResult.data.result.maintenance.upcoming[i].components_affected.length;

			let ds = new Date(statusResult.data.result.maintenance.upcoming[i].datetime_planned_start)
			dateTimeStart = ds.toLocaleString();

			let de = new Date(statusResult.data.result.maintenance.upcoming[i].datetime_planned_end)
			dateTimeEnd = de.toLocaleString();

			// Calculate time until maintenance to see if upcoming maintenance alert should be shown
			let timeUntil = ds - d;
			timeUntil = timeUntil / 1000 / 60 / 60 / 24;
			console.log(timeUntil)
			if (timeUntil <= 2) {
				startingSoon = false;
			}

			for (let j = 0; j < affectedContainers; j++) {
				let listTemplate = {
					"title": statusResult.data.result.maintenance.upcoming[i].containers_affected[j].name
				}
				containerNames.push(listTemplate);
			}

			for (let k = 0; k < affectedComponents; k++) {
				let listTemplate = {
					"title": statusResult.data.result.maintenance.upcoming[i].components_affected[k].name
				}
				componentNames.push(listTemplate);
			}

		}
	}


	// Build boilerplate JSON
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
						"title": "Status Homepage",
						"url": {
							"relativePath": "./status"
						}
					},
					{
						"elementType": "breadcrumbItem",
						"title": "Maintenance",
						"url": {
							"relativePath": "./status"
						}
					},
					{
						"elementType": "breadcrumbItem",
						"title": maintName
					}
				]
			},
			{
				"elementType": "heroHeading",
				"responsiveScaling": true,
				"heading": maintName,
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
	xmJson.header.push
	xmJson.header.push(xmHeader);

	// Build the content section
	const date = new Date();
	let xmContent = {
		"elementType": "responsiveTwoColumn",
		"id": "maintenance_detail",
		"primarySide": "right",
		"primaryWidth": "narrower",
		"primaryColumn": {
			"content": [
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "5%"
				},
				{
					"elementType": "tabs",
					"tabStyle": "folder",
					"marginLeft": "medium",
					"marginRight": "medium",
					"tabs": [
						{
							"title": "Affected Systems",
							"badge": {
								"label": affectedComponents.toString(),
							},
							"content": [
								{
									"elementType": "collapsible",
									"title": "View Affected Systems",
									"borderTopStyle": "none",
									"collapsed": true,
									"content": [
										{
											"elementType": "list",
											"listStyle": "grouped",
											"items": componentNames
										}
									]
								}
							]
						},
						{
							"title": "Affected Sub-systems",
							"badge": {
								"label": affectedContainers.toString(),
							},
							"content": [
								{
									"elementType": "collapsible",
									"title": "View Affected Sub-systems",
									"borderTopStyle": "none",
									"collapsed": true,
									"content": [
										{
											"elementType": "list",
											"listStyle": "grouped",
											"items": containerNames
										}
									]
								}
							]
						}
					]
				},
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "10%"
				},
			]
		},
		"secondaryColumn": {
			"content": [
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "10%"
				},
				{
					"elementType": "detail",
					"description": "Maintenance Details:",
					"titleLineHeight": "0%",
					"bylineLineHeight": "0%",
					"byline": `Last updated: ${date.toLocaleString()}`,
					"body": maintDetail
				},
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "10%"
				},
			]
		}
	}

	xmJson.content.push(xmContent);

	if (startingSoon == false) {
		xmJson.metadata.banners.push({
			"message": `This maintenance event is starting soon! It will begin on ${dateTimeStart} and end on ${dateTimeEnd}.`,
			"type": "warning"
		});
	}

	resetStatus();
	return xmJson;
}

// Make the components detail pagge
function makeComponentDetails(componentId) {

	let containerName = "";
	let containerId = null;
	const statusArray = statusResult.data.result.status;

	for (let i = 0; i < statusArray.length; i++) {
		if (statusArray[i].id == componentId) {
			containerName = statusArray[i].name;
			containerId = i;
		}
	}

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
						"title": "Status Homepage",
						"url": {
							"relativePath": "./status"
						}
					},
					{
						"elementType": "breadcrumbItem",
						"title": "Containers",
						"url": {
							"relativePath": "./status"
						}
					},
					{
						"elementType": "breadcrumbItem",
						"title": containerName
					}
				]
			},
			{
				"elementType": "heroHeading",
				"responsiveScaling": true,
				"heading": containerName,
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
	xmJson.header.push
	xmJson.header.push(xmHeader);

	let xmContent = {
		"elementType": "responsiveTwoColumn",
		"id": "container_detail",
		"responsiveVisibility": {
			"xsmall": false,
			"small": false
		},
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

	let xmContentMobile = {
		"elementType": "responsiveTwoColumn",
		"id": "container_detail_mobile",
		"responsiveVisibility": {
			"medium": false,
			"large": false,
			"xlarge": false
		},
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

	// Code that will display an all components operational graphic if all components are operational
	let operational = 0;
	let total = statusArray[containerId].containers.length;
	let imageUrl = null;
	let operationalText = null;

	for (let i = 0; i < statusArray[containerId].containers.length; i++) {
		if (statusArray[containerId].containers[i].status == "Operational") {
			operational = operational + 1;
		}
	}

	if (operational == total) {
		imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Eo_circle_green_checkmark.svg/2048px-Eo_circle_green_checkmark.svg.png";
		operationalText = "All Components are Operational!"
	} else {
		imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Cross_red_circle.svg/768px-Cross_red_circle.svg.png"
		opetaionalText = "Some Components are Experiencing Issues"
	}

	let operationalGraphic = {
		"elementType": "container",
		"id": "operational_graphic",
		"margin": "medium",
		"padding": "medium",
		"horizontalAlignment": "center",
		"content": [
			{
				"elementType": "divider",
				"borderStyle": "none",
				"marginTop": "10%"
			},
			{
				"elementType": "image",
				"url": imageUrl,
				"cropStyle": "fill",
				"borderRadius": "full"
			},
			{
				"elementType": "blockHeading",
				"heading": operationalText,
				"headingLevel": 2,
				"marginTop": "medium",
				"marginBottom": "medium",
				"headingTextAlignment": "center"
			}
		]
	}

	xmContent.secondaryColumn.content.push(operationalGraphic);
	xmContentMobile.primaryColumn.content.push(operationalGraphic);

	// Code that will display a list of all components and their status
	let componentList = {
		"elementType": "list",
		"listStyle": "grouped",
		"items": []
	}

	for (let i = 0; i < statusArray[containerId].containers.length; i++) {

		if (statusArray[containerId].containers[i].status == "Operational") {
			let listItem = {
				"title": statusArray[containerId].containers[i].name,
				"labelTextColor": "#006E33",
				"label": statusArray[containerId].containers[i].status,
				"accessory": "confirm"
			}
			componentList.items.push(listItem);
		} else {
			let listItem = {
				"title": statusArray[containerId].containers[i].name,
				"labelTextColor": "#F4364C",
				"label": statusArray[containerId].containers[i].status,
				"accessory": "notification_warning"
			}
			componentList.items.push(listItem);
		}
	}

	xmContent.primaryColumn.content.push(componentList);
	xmContentMobile.secondaryColumn.content.push(componentList);

	xmJson.content.push(xmContent);
	xmJson.content.push(xmContentMobile);

	resetStatus();
	return xmJson;
}

function resetStatus() {
	totalStatus = 0;
	totalOperational = 0;
	totalError = 0;
	overallStatus = null;
	statusColor = null;
	activeIncidents = 0;
	activeMaintenance = 0;
	upcomingMaintenance = 0;
	statusResult = null;
	brokenStatus = [];
}

module.exports.resetStatus = resetStatus;
module.exports.makeComponentDetails = makeComponentDetails;
module.exports.getStatusData = getStatusData;
module.exports.makeStatus = makeStatus;
module.exports.makeMaintenanceDetails = makeMaintenanceDetails;