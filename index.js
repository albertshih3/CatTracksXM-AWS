// index.js
const serverless = require('serverless-http');
const express = require('express');
const bodyParser = require('body-parser');
const cattracks = require('./cattracks.js');
const cattracksfull = require('./cattracksfull.js');
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

app.get('/cattracks', function (req, res) {
    try {
        console.log(req.headers);
        console.log(req.query);
        res.json(cattracks.buildHome(req.query));
        console.log("ALL DONE! 🎉")
    } catch (error) {
        console.error('Error in /cattracks:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})

app.get('/cattracksfull', function (req, res) {
    try {
        console.log(req.headers);
        console.log(req.query);
        res.json(cattracksfull.buildHome(req.query));
        console.log("ALL DONE! 🎉")
    } catch (error) {
        console.error('Error in /cattracksfull:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})


app.post('/cattracks/routeplanner', function (req, res) {
    try {
        console.log(req.headers);
        console.log(req.query);
        console.log(req.body);

        res.json(routeplanner.buildRoutePlan(req.body));
    } catch (error) {
        console.error('Error in /cattracks/routeplanner:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})

app.get('/cattracks/route/:id', function (req, res) {
    try {
        console.log(req.headers);
        let xmJson = cattracks_route.buildRouteInformation(req.params.id);
        res.json(xmJson);
        console.log("ALL DONE! 🎉")
    } catch (error) {
        console.error('Error in /cattracks/route/:id:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
})

// Schedule Manager routes removed - no longer needed with static JSON data

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

module.exports.handler = serverless(app);
