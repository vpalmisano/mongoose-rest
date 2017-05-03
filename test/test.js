/*jshint node:true */
'use strict';

const assert = require('assert');
const request = require('request');
const util = require('util');
const MongooseRest = require('..');


//
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

function TestServer(port, schema, options){
    mongoose.connect('mongodb://localhost/mongoose-rest_test', function(err){
        if(err){
            console.error('Unable to connect to mongodb test server');
        }
    });

    var TestSchema = new mongoose.Schema(schema);
    var TestModel = mongoose.model('TestModel', TestSchema);

    TestModel.remove({}, function(ret){
        console.log('Cleanup done');
    });

    //
    var app = express();
    app.set('port', process.env.PORT || 3000)
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    MongooseRest.route(app, TestModel, options);

    var server = http.createServer(app);
    server.listen(port, function(){
        console.log('Express test server listening');
    });

    //
    this.close = function(done){
        server.close();
        server = null;

        delete mongoose.models.TestModel;
        delete mongoose.modelSchemas.TestModel;
        mongoose.connection.close(done)
    }
}

function makeRequest(url, method, query, body){
    return new Promise(function(resolve, reject){
        request({
            url: url,
            method: method || 'GET',
            headers: {
                'Accept': 'application/json',
            },
            qs: query,
            json: body,
        }, function(err, response, body){
            if(err){
                return reject(err);
            }
            resolve(response);
        })
    });
}

function logResponse(res){
    console.log(res.body);
}

//
describe('MongooseRest tests', function(){
    const PORT = 12345;
    var server;

    before(function(){
        server = new TestServer(PORT, {
            _id: {
                type: Number,
            },
            text: { 
                type: String,
            },
            value: { 
                type: Boolean
            }
        }, {
            modelAuth: {
                _id: {
                    auth_view: true,
                    auth_edit: true,
                },
                text: {
                    auth_view: true,
                    auth_edit: true,
                }
            },

            preList: [

            ],

            preGet: [

            ],
            
            preCreate: [
            
            ],

            preUpdate: [

            ],
            
            preDelete: [

            ],

        });
    });

    after(function(done){
        if(server){
            server.close(done);
            server = null;
        }
    });
    
    //
    it('add item', function(){
        return makeRequest('http://localhost:'+PORT+'/api/v1/TestModel', 'POST', {}, {
            _id: 0,
            text: 'text1',
            value: true
        });
    });

    it('add item', function(){
        return makeRequest('http://localhost:'+PORT+'/api/v1/TestModel', 'POST', {}, {
            _id: 1,
            text: 'text2',
            value: false
        });
    });

    it('list items', function(){
        return makeRequest('http://localhost:'+PORT+'/api/v1/TestModel', 'GET', {}).then(logResponse);
    });


    it('delete items', function(){
        return Promise.all([
            makeRequest('http://localhost:'+PORT+'/api/v1/TestModel/0', 'DELETE').then(logResponse),
            makeRequest('http://localhost:'+PORT+'/api/v1/TestModel/1', 'DELETE').then(logResponse),
        ]);
    });

});

