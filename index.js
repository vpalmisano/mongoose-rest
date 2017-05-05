/*jshint node:true */
'use strict';

const debug = require('debug')('mongoose-rest');
const _ = require('lodash');

module.exports.route = function(router, Model, options){

    var path = '/api/'+(options.version || 'v1')+'/'+Model.modelName;

    // parse query
    function parseQuery(req, res, next){
        debug('parseQuery', req.query)
        //
        if(req.query.query){
            try{
                req.query.query = JSON.parse(req.query.query);
            }catch(err){
                console.error('error parsing query', err);
                req.query.query = {};
            }
        }
        else{
            req.query.query = {};
        }
        //
        if(req.query.select){
            try{
                req.query.select = JSON.parse(req.query.select);
            }catch(err){
                console.error('error parsing select', err);
            }
        }
        else{
            req.query.select = {};
        }
        //
        if(req.query.populate){
            try{
                req.query.populate = JSON.parse(req.query.populate);
            }catch(err){
                console.error('error parsing populate', err);
            }
        }
        else{
            req.query.populate = [];
        }
        //
        next();
    }

    function getModelAuth(model){
        var m = options.modelAuth || model.schema.paths;
        //
        return Object.keys(m).map(function(name){
            var options = m[name].options || m[name];
            //
            if(options.type && _.isArray(options.type)){
                options = options.type[0];
            }
            //
            return {
                name: name, 
                auth_view: options.auth_view,
                auth_edit: options.auth_edit,
            };
        });
    }

    //
    const modelAuth = getModelAuth(Model);

    function applyModelAuth(req, auth_type){
        return Promise.all(modelAuth.map(function(opt){
            //
            var auth = opt[auth_type];
            if(_.isFunction(auth)){
                return new Promise(function(resolve, reject){
                    var ret = auth(req, null, function(err){
                        if(err){
                            resolve({
                                name: opt.name,
                                value: false,
                            });
                        }
                        else{
                            resolve({
                                name: opt.name,
                                value: true,
                            });
                        }
                    });
                    //
                    if(ret !== undefined){
                        if(ret instanceof Promise){
                           ret.then(function(ret){
                                resolve({
                                    name: opt.name,
                                    value: ret,
                                });
                            });
                        }
                        else if(_.isBoolean(ret)){
                            resolve({
                                name: opt.name,
                                value: ret,
                            });
                        }
                    }
                });
            }
            else if(_.isBoolean(auth)){
                return Promise.resolve({
                    name: opt.name,
                    value: auth,
                });
            }
            //
            return Promise.resolve({
                name: opt.name,
                value: false,
            });
        }))
        .then(function(results){
            var select = {};
            results.forEach(function(res){
                if(res.value){
                    select[res.name] = 1;
                }
            });
            return Promise.resolve(select);
        });
    }

    // filter auth_view fields
    function filterSelect(req, res, next){
        //
        applyModelAuth(req, 'auth_view')
        .then(function(select){
            //
            if(Object.keys(req.query.select).length > 0){
                req.query.select = Object.keys(req.query.select).filter(function(name){
                    return select[name] === 1;
                });
            }
            else{
                req.query.select = select;
            }
            debug('select', req.query.select);
            //
            next();
        }, next);
    }

    // filter auth_edit fields
    function filterBody(req, res, next){
        //
        applyModelAuth(req, 'auth_edit')
        .then(function(select){
            // returns body properties in select
            Object.keys(req.body).forEach(function(name){
                if(!select[name]){
                    delete(req.body[name])
                }
            });
            debug('select body', req.body);
            //
            next();
        }, next);
    }

    //
    router.get(path, [].concat(
        options.preAll || [],
        parseQuery,
        filterSelect,
        options.preList || [],
        function(req, res, next){
            debug('get', path, req.query);
            //
            var countQuery = Model.count(req.query.query);
            var q = Model.find(req.query.query)
                         .select(req.query.select);
            //
            if(req.query.sort){
                q = q.sort(req.query.sort);
            }
            //
            if(req.query.skip){
                q = q.skip(parseInt(req.query.skip) || 0);
            }
            //
            if(req.query.limit){
                q = q.limit(parseInt(req.query.limit) || 0);
            }
            //
            req.query.populate.forEach(function(p){
                q = q.populate(p);
            });
            //
            q = q.lean(true);
            //
            Promise.all([countQuery, q])
            .then(function(results){               
                res.set('X-Total-Count', results[0]);
                req.document = results[1];
                next();
            }, next);
        },
        //
        options.postList || [],
        // last
        function(req, res, next){
            res.json(req.document);
        }
    ));

    router.get(path+'/:id', [].concat(
        options.preAll || [],
        parseQuery,
        filterSelect,
        options.preGet || [],
        function(req, res, next){
            debug('get', path, req.query);
            //
            var q = Model.find(req.query.query)
                         .findOne({ _id: req.params.id })
                         .select(req.query.select);
            //
            req.query.populate.forEach(function(p){
                q = q.populate(p);
            });
            //
            q = q.lean(true);
            //
            q.then(function(result){
                req.document = result;
                next();
            }, next);
        },
        //
        options.postGet || [],
        // last
        function(req, res, next){
            res.json(req.document);
        }
    ));

    // create
    router.post(path, [].concat(
        options.preAll || [],
        parseQuery,
        options.preCreate || [],
        filterBody,
        function(req, res, next){
            debug('post', path, req.query, req.params.id, req.body);
            //           
            new Model(req.body)
            .save()
            .then(function(result){
                req.document = result;
                next();
            }, next);
        },
        //
        options.postCreate || [],
        // last
        function(req, res, next){
            res.json({
                message: Model.modelName+' created'
            });
        }
    ));

    // update
    router.patch(path+'/:id', [].concat(
        options.preAll || [],
        parseQuery,
        options.preUpdate || [],
        function(req, res, next){
            debug('patch', path, req.query, req.params.id, req.body);
            // query matching document
            var q = Model
            .find(req.query.query)
            .findOne({ _id: req.params.id })
            .then(function(result){
                if(!result){
                    return next(new Error(Model.modelName+' '+req.params.id+' not found'));
                }
                req.document = result;
                next();
            });
        },
        filterBody,
        function(req, res, next){
            // update values
            Object.keys(req.body).forEach(function(k){
                req.document[k] = req.body[k];
            });
            // save
            return req.document.save()
            .then(function(result){
                req.document = result;
                next();
            }, next);
        },
        //
        options.postUpdate || [],
        // last
        function(req, res, next){
            res.json({
                message: Model.modelName+' updated'
            });
        }
    ));

    router.delete(path+'/:id', [].concat(
        options.preAll || [],
        parseQuery,
        options.preDelete || [],
        function(req, res, next){
            debug('delete', path, req.query, req.params.id);
            //
            Model
            .find(req.query.query)
            .findOne({ _id: req.params.id })
            .then(function(result){
                return result.remove();
            })
            .then(function(result){
                req.document = result;
                next();
            }, next)
        },
        //
        options.postDelete || [],
        // last
        function(req, res, next){
            res.json({
                message: Model.modelName+' '+req.params.id+' deleted'
            });
        }
    ));

}