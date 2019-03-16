'use strict';

let isTestingMode = false;

exports.handler = (event, context, callback) => {
    
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    var person = event;

    if (!person.name) {
        throw "A persons name is required";
    }

    if (!person.phoneNumber) {
        throw "A valid phone number in E.146 format is required";
    }

    if (!person.city) {
        throw "A valid city name is required"
    }

    getWeatherReport(person)
    .then(getCoatReport)
    .then(function (coatReport) {
        sendMessage(coatReport.person.phoneNumber, coatReport.summary).then(function () {
            console.info(`Coat report successfully sent to ${coatReport.person.name}!`);

            callback(null, 'Finished');
        });
    });

};

function getWeatherReport(person) {

    return new Promise((resolve, reject) => { 

        console.info(`Getting weather report for city ${person.city}...`);

        let request = require('request');
        let apiKey = '794a96960edd8825cc1a287b5c21d2a3';
        let url = `http://api.openweathermap.org/data/2.5/weather?q=${person.city}&units=metric&appid=${apiKey}`
        
        request(url, function (error, response, body) {
            if(error){
                console.log('error:', error);
                reject(error);
            } else {
                let summary = JSON.parse(body)
                
                let weatherReport = {
                    person,
                    temperature: summary.main.temp,
                    condition: summary.weather[0].main
                };

                console.info(`Weather report retrieved for city ${person.city}`);

                resolve(weatherReport);
            }
        });
    });
}

function getCoatReport(weatherReport) {
    return new Promise((resolve, reject) => { 
        let coatRequired = isCoatRequired(weatherReport);
        let temperatureTruncated = Math.trunc(weatherReport.temperature);

        let conditionMap = {
            "rain": "it's raining",
            "drizzle": "it's raining lightly",
            "thunderstorm": "there's a chance of thunderstorms",
            "snow": "it's probably going to snow"
        }
        
        let conditionDescription = conditionMap[weatherReport.condition.toLowerCase()];
        let coatRequiredDescription = (coatRequired) ? "so take your coat!" : " you can leave your coat at home!";
        let signature = "\n\nPowered by Coat Predictor"
        let summary = `Hey ${weatherReport.person.name}, it's ${temperatureTruncated}C in ${weatherReport.person.city} and ${conditionDescription} ${coatRequiredDescription}${signature}`;
        
        console.info(summary);

        let coatReport = {
            person: weatherReport.person,
            summary
        };

        resolve(coatReport);
    });
}

function isCoatRequired(weatherReport) {

    let temperature = weatherReport.temperature;
    let condition = weatherReport.condition;

    if (temperature < 10 || 
        condition.toLowerCase() == "rain" ||
        condition.toLowerCase() == "drizzle" ||
        condition.toLowerCase() == "thunderstorm") {
    
        return true;
    }

    return false;
}

function sendMessage(phoneNumber, message) {

    return new Promise((resolve, reject) => { 

        if (isTestingMode) {
            resolve();
            return;
        }

        console.info(`Sending weather summary SMS to ${phoneNumber}`)

        let AWS = require('aws-sdk');
        AWS.config.loadFromPath('./config.json');

        var params = {
            Message: message,
            PhoneNumber: phoneNumber,
        };

        var publishTextPromise = new AWS
            .SNS({apiVersion: '2010-03-31'})
            .publish(params)
            .promise();

        publishTextPromise.then(
            function(data) {
                console.log(`SMS successfully sent with id: ${data.MessageId} to ${phoneNumber}`);
                resolve();

            }).catch(function(error) {
                console.error(error, error.stack);
                reject();
            }
        );
    });
}