// index.js
const serverless = require('serverless-http');
const express = require('express');
const bodyParser = require('body-parser');
const status = require('./status.js');
const incidents = require('./incidents.js');
const cattracks = require('./cattracks.js');
const cattracks_route = require('./cattracks_route.js');
const routeplanner = require('./routeplanner.js');

// instantiate the express server
const app = express();

// used to get post events as JSON objects correctly
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
	
app.get('/', function (req, res) {
    res.send('Hello World!')
  })

app.get('/status', async function (req, res) {
    let currentStatus = await status.getStatusData();
    console.log(req.headers);
    console.log(req.query);
    res.json(status.makeStatus(req.query));
    console.log("ALL DONE! 🎉")
})

app.get('/status/component/:id', async function (req, res) {
    let currentStatus = await status.getStatusData();
    console.log(req.params);
    res.json(status.makeComponentDetails(req.params.id));

})

app.get('/status/maintenance/:id', async function (req, res) {
    let currentStatus = await status.getStatusData();
    console.log(req.params);
    res.json(status.makeMaintenanceDetails(req.params.id));
})

app.get('/status/incidents/:id', async function (req, res) {
    let currentStatus = await incidents.getStatusData();
    console.log(req.params);
    res.json(incidents.makeIncidentDetails(req.params.id));
})

app.get('/cattracks', async function (req, res) {
    await cattracks.getRouteData();
    await cattracks.getSchedule();
    await cattracks.getStops();
    console.log(req.headers);
    console.log(req.query);
    res.json(cattracks.buildHome(req.query));
    console.log("ALL DONE! 🎉")
})

app.post('/cattracks/routeplanner', async function (req, res) {
    console.log(req.headers);
    console.log(req.query);
    console.log(req.body);

    await routeplanner.getRouteData();
    await routeplanner.getSchedule();
    await routeplanner.getStops();

    res.json(routeplanner.buildRoutePlan(req.body));
})

app.get('/cattracks/route/:id', async function (req, res) {
    await cattracks_route.getRouteData();
    await cattracks_route.getSchedule();
    console.log(req.headers);
    let xmJson = cattracks_route.buildRouteInformation(req.params.id);
    res.json(xmJson);
    console.log("ALL DONE! 🎉")
})

module.exports.handler = serverless(app);
