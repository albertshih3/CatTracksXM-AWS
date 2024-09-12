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
					statusColor = "yellow"
				} else {
					statusColor = "#E56565"
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

function makeIncidentDetails(incidentId) {

	let incidentName = "";
	let containerId = 0;

	let affectedContainers = 0;
	let affectedComponents = 0;

	let containerNames = [];
	let componentNames = [];

	for (let i = 0; i < incidentArray.length; i++) {
		if (incidentArray[i]._id == incidentId) {
			incidentName = incidentArray[i].name;
			containerId = i;
		}

		affectedContainers = incidentArray[i].containers_affected.length;
		affectedComponents = incidentArray[i].components_affected.length;


		for (let j = 0; j < affectedContainers; j++) {
			let listTemplate = {
				"title": incidentArray[i].containers_affected[j].name
			}
			containerNames.push(listTemplate);
		}

		for (let k = 0; k < affectedComponents; k++) {
			let listTemplate = {
				"title": incidentArray[i].components_affected[k].name
			}
			componentNames.push(listTemplate);
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
						"title": "Incidents",
						"url": {
							"relativePath": "./status"
						}
					},
					{
						"elementType": "breadcrumbItem",
						"title": `Active Incident: ${incidentName}`
					}
				]
			},
			{
				"elementType": "heroHeading",
				"responsiveScaling": true,
				"heading": `Active Incident: ${incidentName}`,
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
		"primarySide": "right",
		"primaryColumn": {
			"content": [
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "5%"
				},
				{
					"elementType": "blockHeading",
					"heading": "Incident Updates",
				}
			]
		},
		"secondaryColumn": {
			"content": [
				{
					"elementType": "divider",
					"borderStyle": "none",
					"marginTop": "5%"
				},
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

				},
				{
					"elementType": "collapsible",
					"title": "View Affected Components",
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

	}

	let xmIncidentList = {
		"elementType": "list",
		"listStyle": "grouped",
		"items": []
	}

	for (let i = (incidentArray[0].messages.length) - 1; i >= 0; i--) {
		let messageTime = new Date(incidentArray[0].messages[i].datetime);
		console.log(messageTime)
		let incidentItem = {
			"title": incidentArray[0].messages[i].details,
			"description": messageTime.toLocaleString()
		}
		xmIncidentList.items.push(incidentItem);
	}
	xmContent.primaryColumn.content.push(xmIncidentList);

	xmJson.content.push(xmContent);

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

module.exports.makeIncidentDetails = makeIncidentDetails;
module.exports.getStatusData = getStatusData;