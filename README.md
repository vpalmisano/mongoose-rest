# mongoose-rest-router

[![Build Status](https://travis-ci.org/vpalmisano/mongoose-rest-router.png)](https://travis-ci.org/vpalmisano/mongoose-rest-router)

## Install

```sh
npm install --save mongoose-rest-router
```

## Usage example


```javascript
const mongoose = require('mongoose');

var TestSchema = new mongoose.Schema({
    user: { 
        type: String,
    },
    text: { 
        type: String,
    },
});
var TestModel = mongoose.model('TestModel', TestSchema);
```

```javascript
const MongooseRest = require('mongoose-rest-router');
var app = express();

MongooseRest.route(app, TestModel, {
    modelAuth: {
        user: {
            auth_view: true,
            auth_edit: true
        },
        text: {
            auth_view: true,
            auth_edit: function(req){ return req.user === 'admin' }
        },
    },

    preAll: [
        function(req, res, next){
            req.user = req.query.user;
            next();
        }
    ],

    preList: [

    ],

    preGet: [

    ],
    
    preCreate: [
        
    ],

    preUpdate: [

    ],
    
    preDelete: [

    ]

});

```