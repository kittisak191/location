const functions = require('firebase-functions');
const admin = require('firebase-admin');
const line = require('@line/bot-sdk');
const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const { postToDialogflow, createLineTextEvent, convertToDialogflow } = require('./dialogflow');

admin.initializeApp({});

const config = {
    channelAccessToken: functions.config().line.channel_access_token,
    channelSecret: functions.config().line.channel_secret
 }
const app = express()

async function handleEvent(req, event) {
    switch (event.type) {
       case 'message':
           switch(event.message.type) {
               case 'text':
                   return postToDialogflow(req)
               case 'location':
                   const locationText = `LAT: ${event.message.latitude}, LNG: ${event.message.longitude}`
                   const locationMsg = createLineTextEvent(req, event, locationText)
                   return convertToDialogflow(req, locationMsg)
           }
       case 'postback':
           const dateText = `DATE: ${event.postback.params.date}`
           const dateMsg = createLineTextEvent(req, event, dateText)
           return convertToDialogflow(req, dateMsg)
    }
}

function handleFullfillment(agent) {
    const userId = agent.originalRequest.payload.data.source.userId;
    const { name, latitude, longitude, selected_date } = agent.parameters;
    const doc = {
        uid: userId,
        name,
        latitude,
        longitude,
        selected_date
    };
    firebase.firestore().collection('member').doc(userId).set(doc);

    agent.add('บันทึกข้อมูลสำเร็จแล้ว');
}

app.post('/webhook', line.middleware(config), (req, res) => { 
   const events = req.body.events
   events.foreach(event => {
       handleEvent(req, event)
    });
});
app.use(express.json());
app.post('/fullfillment', (request, response) => {
    const agent = new WebhookClient({ request, response });
    let intentMap = new Map();
    intentMap.set('Register - Date1', handleFullfillment);
    agent.handleRequest(intentMap);
});

exports.api = functions
   .region('asia-northeast1')
   .https
   .onRequest(app); 