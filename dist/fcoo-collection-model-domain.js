/****************************************************************************
fcoo-collection-model-domain.js,

Objects and methods to create and manages list of models
****************************************************************************/
(function ($, i18next, moment, window/*, document, undefined*/) {
    "use strict";

    //Create fcoo-namespace
    var ns = window.fcoo = window.fcoo || {},
        nsCollection = ns.collection = ns.collection || {},
        nsModel = ns.model = ns.model || {};


    function state2ColorName( state ){
        let result = 'success';
        switch (state){
            case nsCollection.stateOk   : result = 'success'; break;
            case nsCollection.stateWarn : result = 'warning'; break;
            case nsCollection.stateAlert: result = 'alert';   break;
            case nsCollection.stateFail : result = 'error';   break;
        }
        return result;
    }

    nsModel.options = $.extend(true, nsModel.options, {
        includeModel: false,    //If true all Models and Domains are loaded and created

        modelList: {
            //data located in file under sub-dir 'static' contains all the groups
            dataSubDir  : 'model-domain',
            dataFileName: 'model-domain.json',
            model       : {},   //Options for Model in current instans of ModelList
            domain      : {},   //Options for Domain in current instans of ModelList
        },

        model : {},  //Global default options for Model
        domain: {}   //Global default options for Domain
    });


    /****************************************************************************
    nsModel.createModels(options)
    Set options and creates and loads models and domain-groups
    ****************************************************************************/
    nsModel.createModels = function(modelOptions = {}){
        //Create and load modelList
        let modelList = nsModel.modelList = new nsModel.ModelList(modelOptions);

        ns.promiseList.append({
            fileName: {subDir: modelList.options.dataSubDir, fileName: modelList.options.dataFileName},
            resolve : modelList.resolve.bind(modelList)
        });
    };

    /****************************************************************************
    ModelList
    ****************************************************************************/
    function ModelList(options) {
        this.options = $.extend(true, {}, nsModel.options.modelList, options || {});
        this.list   = [];
        this.models = {};
        this.onResolve = []; //[]FUNCTION(modelList) to be called every time meta-data are resolved/read
    }
    nsModel.ModelList = ModelList;

    nsModel.ModelList.prototype = {
        /*********************************************
        getModel
        *********************************************/
        getModel: function(modelId){
            return this.models[modelId];
        },

        /*********************************************
        getDomain
        *********************************************/
        getDomain: function(modelId, domainId){
            let model = this.getModel(modelId);
            return model ? model.getDomain(domainId) : null;
        },

        /*********************************************
        resolve - create all models and domains
        *********************************************/
        resolve: function(data){
            data.forEach( modelOpt => {
                var newModel = new Model(modelOpt, this);
                this.list.push( newModel );
                this.models[newModel.options.id] = newModel;
            }, this);
        },

        /*********************************************
        visitAllDomains( domainFunc )
        domainFunc = FUNCTION(domain)
        *********************************************/
        visitAllDomains: function(domainFunc){
            this.list.forEach( model => model.domainList.forEach( domain => domainFunc(domain) ) );
        }
    };

    /****************************************************************************
    Model
    ****************************************************************************/
    function Model(options, modelList) {
        this.options = $.extend(true, {}, nsModel.options.model, modelList ? modelList.options.model : {}, options || {});
        this.options.name = this.options.name || this.options.id;
        this.modelList = modelList;
        this.domainList = [];
        this.domains = {};
        (options.domain || []).forEach( domainOpt => {
            var newDomain = new Domain(domainOpt, this);
            this.domainList.push( newDomain );
            this.domains[newDomain.options.id] = newDomain;
        }, this);
    }
    nsModel.Model = Model;

    nsModel.Model.prototype = {
        /*********************************************
        getDomain
        *********************************************/
        getDomain: function(domainId){
            return this.domains[domainId];
        }
    };

    /****************************************************************************
    Domain
    ****************************************************************************/
    function Domain(options = {}, model) {
        this.model = model;
        this.options = $.extend(true, {
            type                : this.model.options.type || 'met',
            owner               : this.model.options.domainOwner || '',
            area                : "regional",
            resolution          : "1nm",
            period              : model.domainPeriod || 6,
            process             : 3,
        }, nsModel.options.domain, model.options.domain, options);

        this.options.abbr = this.options.abbr || this.options.id;
        this.options.name = this.options.name || this.options.abbr;
        this.options.link = this.options.link || this.model.options.link;
        switch (this.options.area){
            case "global": this.options.areaName = {da:'Global',   en:'Global'  }; break;
            case "local" : this.options.areaName = {da:'Lokal',    en:'Local'   }; break;
            default      : this.options.areaName = {da:'Regional', en:'Regional'}; break;
        }
        this.isGlobal = (options.area == 'global');
    }
    nsModel.Domain = Domain;

    nsModel.Domain.prototype = {
        /*********************************************
        fullName
        *********************************************/
        fullName: function(){
            //**************************************
            function getShortName(id){
                var idLower = id.toLowerCase(),
                    nameExists = i18next.exists('name:'+idLower),
                    linkExists = i18next.exists('link:'+idLower);
                return {
                    text : id.toUpperCase(),
                    title: nameExists ? 'name:'+idLower : null,
                    link : linkExists ? 'link:'+idLower : null
                };
            }
            //**************************************
            var result = [];
            if (this.options.owner)
                result.push(
                    getShortName(this.options.owner),
                    '/'
                );
            result.push(
                getShortName(this.model.options.abbr),
                '/',
                {text: this.options.name, link: this.options.url}
            );
            return result;
        },

        fullNameSimple: function(){
            var result = '';
            $.each([this.options.owner, this.model.options.name, this.options.abbr], function(index, text){
                if (text)
                    result = result + (result ? '&nbsp;/&nbsp;' : '') + text.toUpperCase();
            });
            result = result + '&nbsp;(' + i18next.s(this.options.areaName) + ')';
            return result;
        },


        /*********************************************
        createDetailContent - create bs-content with details
        status = dynamic data = {
            disabled            : BOOLEAN
            delayed             : BOOLEAN
            lastModified        : moment or dateString with time for last modification/update
            epoch               : moment or dateString with time for last epoch
            expectedNextUpdate  : moment or dateString with time for next expected update
            start               : moment or dateString with start-time for the period of forecast
            end                 : moment or dateString with end-time for the period of forecast
        }
        *********************************************/
        createDetailContent: function( $container, status, STATUSTEXT ){
            //*****************************************************
            function replaceSpace( text ){
                return text.replace(/ /g, '&nbsp;');
            }
            //*****************************************************
            function abbrAndName( options  ){
                let o       = options,
                    idLower = o.id ? o.id.toLowerCase() : 'UNKNOWN',
                    abbr    = i18next.exists('abbr:'+idLower) ? i18next.t('abbr:'+idLower) : o.id.toUpperCase();

                let name =  i18next.exists('name:'+idLower) ?
                            i18next.t('name:'+idLower) :
                            ($.isPlainObject(o.name) ? i18next.s(o.name) : o.name) || o.abbr;

                let textList, linkList;

                if (name){
                    textList = o.prefix ? [o.prefix] : [],
                    linkList = o.prefix ? [''] : [];

                    if (o.link || i18next.exists('link:'+idLower))
                        linkList.push(o.link || 'link:'+idLower);

                    textList.push(name);
                    if (name && (name.toUpperCase() !== abbr.toUpperCase()))
                        textList.push('(' + abbr + ')');

                    if (o.postfix)
                        textList.push(o.postfix);
                }
                else
                    textList = {da:'Ukendt', en:'Unknown'};

                return {
                    type     : 'textarea',
                    class    : 'info-box',
                    label    : o.label,
                    text     : textList,
                    textClass:'text-center',
                    link     : linkList,
                    center   : true,
                    middle   : true
                };
            }
            /*****************************************************
            momentAsText(options)
            options = {
                label,
                date,
                inclRelative
                exactRelative
                pastRelative
                furtureRelative
            }

            *****************************************************/
            function momentAsText( options ){
                let o = options,
                    m = o.date ? moment(o.date) : null,
                    now = window.__jbs_getNowMoment(),
                    text,
                    inclRelative = o.inclRelative || o.exactRelative || o.pastRelative || o.furtureRelative;

                if (m && m.isValid()){
                    text =
                        $('<span/>')
                            .vfFormat('datetime_format', {dateFormat: {weekday:'None', month:'Short', year:'Short'}})
                            .vfValue(m)
                            .text();

                    if (inclRelative){
                        var diff      = m.diff( now.startOf(1, 'hours'), 'minutes'),
                            roundDiff = Math.round(diff/60),
                            relText = {da: '(Nu)', en:'(Now)'};


                        if ( (o.pastRelative && (roundDiff >= 0)) || (o.furtureRelative && (roundDiff < 0)) )
                            inclRelative = false;
                        if (inclRelative ){
                            if (o.exactRelative){
                                var days  = Math.floor(diff / 60 / 24),
                                    hours = Math.round(diff/60 - days*24);
                                if ((days > 0) || (hours > 0)){
                                    relText = {
                                        da: '(' + (days > 0 ? days + (days > 1 ? ' dage' : ' dag') : ''),
                                        en: '(' + (days > 0 ? days + (days > 1 ? ' days' : ' day') : '')
                                    };
                                    if (hours > 0){
                                        if (days > 0){
                                            relText.da = relText.da + ' og ';
                                            relText.en = relText.en + ' and ';
                                        }
                                        relText.da = relText.da + hours + (hours > 1 ? ' timer' : ' time');
                                        relText.en = relText.en + hours + (hours > 1 ? ' hours' : ' hour');
                                    }
                                    relText.da = relText.da + ')';
                                    relText.en = relText.en + ')';
                                }
                            }
                            else {
                                if (roundDiff == 0){
                                    //Special case: less that one hour from/to the moment
                                    relText = diff > 0 ?
                                              {da: "(lige om lidt)",   en: "(shortly)"  } :
                                              {da: "(for lidt siden)", en: "(recently)" };
                                }
                                else {
                                    var absDiff = Math.abs(roundDiff),
                                        sing    = absDiff == 1;
                                    if (diff > 0)
                                        relText = {
                                            da: '(om ca. '+absDiff + (sing ? ' time':' timer')+')',
                                            en: '(in app. '+absDiff + (sing ? ' hour':' hours')+')'
                                        };
                                    else
                                        relText = {
                                            da: '(for ca. '+absDiff + (sing ? ' time':' timer')+' siden)',
                                            en: '(app. '+absDiff + (sing ? ' hour':' hours')+' ago)'
                                        };
                                }
                            }
                            text = replaceSpace(text) + ' ' + replaceSpace(i18next.sentence(relText));
                        }
                    }
                }
                else
                    text = {da:'Ukendt', en:'Unknown'};

                return {
                    label : o.label,
                    class : 'info-box',
                    type  : 'textarea',
                    text  : text,
                    center: true,
                    middle: true
                };
            }
            //*****************************************************
            function createSubContainer(contentList){
                let $div = $('<div></div>').addClass('align-items-stretch row'),
                    colClass = 'col-md-'+(12/contentList.length);

                contentList.forEach( content => {
                    $div._bsAppendContent( content );
                    let $content = $div.children().last();
                    $content.addClass(colClass);
                    $content.children().first().addClass('h-100');
                });

                return $div;
            }
            //*****************************************************

            $container.empty();

            let content = [],
                subContent,
                hasDynamicContent = !!status;

            if (STATUSTEXT)
                content.push({label: 'DEBUG', type: 'textarea', center: true, text: STATUSTEXT});


            if (hasDynamicContent){
                if (status.disabled)
                    content.push({
                        type     : 'textarea',
                        center   : true,
                        icon     : 'far fa-eye-slash',
                        colorName: 'error',
                        text     : {
                            da: replaceSpace('VISES IKKE') + ' ' + replaceSpace('Prognosen er ikke tilgængelig'),
                            en: replaceSpace('NOT SHOWN')  + ' ' + replaceSpace('The forecast is not available')
                        }
                    });
                else {
                    subContent = [];
                    subContent.push(
                        momentAsText({
                            label       : {da: 'Opdateret', en:'Updated'},
                            date        : status.lastModified,
                            pastRelative: true
                        })
                    );

                    const label = {da: 'Forventet næste opdatering', en:'Expected next update'};
                    if (status.delayed){
                        subContent.push({
                            label    : label,
                            class    : 'info-box',
                            type     : 'textarea',
                            center   : true,
                            middle   : true,
                            colorName: state2ColorName(status.state),
                            text     : {da: 'FORSINKET', en: 'DELAYED'}
                        });
                    }
                    else
                        subContent.push(
                            momentAsText({
                                label          : label,
                                date           : status.expectedNextUpdate,
                                furtureRelative: true
                            })
                        );
                    content.push( createSubContainer(subContent) );

                    subContent = [];
                    subContent.push(
                        momentAsText({
                            label       : {da: 'Prognosen går fra', en:'The forecast starts at'},
                            date        : status.start,
                            inclRelative: true
                        })
                    );
                    subContent.push(
                        momentAsText({
                            label       : {da: 'Prognosen går til', en:'The forecast ends at'},
                            date        : status.end,
                            inclRelative: true

                        })
                    );

                    content.push( createSubContainer(subContent) );
                }
            }

            //Two columns with Owner and Model
            content.push(
                createSubContainer([
                    abbrAndName({id: this.options.owner,      label: {da:'Ejer/Distributør', en: 'Owner/Distributor'} }),
                    abbrAndName({id: this.model.options.name, label: {da:'Model',            en: 'Model'            } })
                ])
            );

            //Two columns with Domain and Resolution
            content.push(
                createSubContainer([
                    abbrAndName({id: this.options.abbr, name: this.options.name, link: this.options.link, label: {da:'Område/Opsætning', en: 'Domain/Setting'}, prefix: i18next.s(this.options.areaName)+' ='} ),
                    hasDynamicContent ? {
                        type      : 'textarea',
                        label     : {da: 'Opdatering og Opløsning', en:'Updating and Resolution'},
                        text      : this.options.period && this.options.resolution ? {
                            da: 'Prognosen opdateres hver '      + this.options.period +'. time og den horisontale opløsning i prognosen er ' + this.options.resolution,
                            en: 'The forecast is updated every ' + this.options.period +' hours and the horizontal resolution is '             + this.options.resolution
                        } : {da: 'Ukendt', en: 'Unknown'},
                        class     : '',
                        textClass : 'text-center',
                        center    : true,
                        middle    : true
                    } : {
                        type      : 'textarea',
                        label     : {da: 'Opløsning', en:'Resolution'},
                        text      : this.options.resolution ? {
                            da: 'Den horisontale opløsning i prognosen er ' + this.options.resolution,
                            en: 'The horizontal resolution is '             + this.options.resolution
                        } : {da: 'Ukendt', en: 'Unknown'},
                        class     : '',
                        textClass : 'text-center',
                        center    : true,
                        middle    : true
                    }
                ])
            );



            $container._bsAppendContent(content);
        }
    };
}(jQuery, this.i18next, this.moment, this, document));
;
/****************************************************************************
collections.js

Create collections and datasets
****************************************************************************/

(function ($, L, i18next, moment, window/*, document, undefined*/) {
    "use strict";

    //Test-mode: If true the "NOW" is updated every 10 sec
    window.FCOOCOLLECTION_TEST_NOW = window.FCOOCOLLECTION_TEST_NOW || false;

    //Create fcoo-namespace
    let ns = window.fcoo = window.fcoo || {},
        nsMap = ns.map = ns.map || {},
        nsCollection = ns.collection = ns.collection || {},
        nsParameter  = ns.parameter = ns.parameter || {};


    nsCollection.options = $.extend(true, {
        includeCollections: false,   //If true all Collections and Datasets are loaded and created

        relativeTimeRange: [],   //The relative time-range for the application. Will deterrmin the time-range for the collections

        collectionList: {
            dataSubDir      : 'setup',
            dataFileName    : 'fcoo-collections.json',
            updateDuration  : 20, //5,  //Interval (minutes) between updating the metadata
        },

        //Default map-options for the map in the modal of the Collection
        modalMapOptions: {
            zoomControl         : false,
            attributionControl  : false,    //Use bsAttributionControl instead of default attribution-control
            bsAttributionControl: true,

            closePopupOnClick   : true,	    //true	Set it to false if you don't want popups to close when user clicks the map.
            boxZoom             : false,    //true	Whether the map can be zoomed to a rectangular area specified by dragging the mouse while pressing the shift key.
            doubleClickZoom     : true,	    //true	Whether the map can be zoomed in by double clicking on it and zoomed out by double clicking while holding shift. If passed 'center', double-click zoom will zoom to the center of the view regardless of where the mouse was.
            dragging            : true,     //true	Whether the map be draggable with mouse/touch or not.
            zoomSnap            : .25,	    //1	Forces the map's zoom level to always be a multiple of this, particularly right after a fitBounds() or a pinch-zoom. By default, the zoom level snaps to the nearest integer; lower values (e.g. 0.5 or 0.1) allow for greater granularity. A value of 0 means the zoom level will not be snapped after fitBounds or a pinch-zoom.
            zoomDelta           : .25,	    //1	Controls how much the map's zoom level will change after a zoomIn(), zoomOut(), pressing + or - on the keyboard, or using the zoom controls. Values smaller than 1 (e.g. 0.5) allow for greater granularity.
            trackResize         : false,	//true	Whether the map automatically handles browser window resize to update itself.
            minZoom             : 2,        //Minimum zoom level of the map. If not specified and at least one GridLayer or TileLayer is in the map, the lowest of their minZoom options will be used instead.
            maxZoom	            : 7        //Maximum zoom level of the map. If not specified and at least one GridLayer or TileLayer is in the map, the highest of their maxZoom options will be used instead.
        },

        //css for container holding the map in the info-modal
        mapContainerCss: {
            width : '100%',
            border: '3px solid transparent'
        },


    }, nsCollection.options || {} );

    //Var and methods for state
    const stateOk    = nsCollection.stateOk    = 1,
          stateWarn  = nsCollection.stateWarn  = 2,
          stateAlert = nsCollection.stateAlert = 3,
          stateFail  = nsCollection.stateFail  = 4;

    nsCollection.getStateIcon = function(state){
        let result = ns.bsIcon.success;
        switch (state){
            case stateOk   : result = ns.bsIcon.success; break;
            case stateWarn : result = ns.bsIcon.warning; break;
            case stateAlert: result = ns.bsIcon.alert;   break;
            case stateFail : result = ns.bsIcon.error;   break;
        }
        return result;
    };


    //colorNameList = []COLORNAME = different colors for domains
    const colorNameList   = ["blue", "green", "cyan", "purple", "grey", "pink"],
          globalColorName = "brown";


    const timeUnit = window.FCOOMAPSTIME_TEST_NOW ? 'seconds' : 'hour';
    nsCollection.globalMin       = null;
    nsCollection.globalMax       = null;
    nsCollection.globalMinMoment = null;
    nsCollection.globalMaxMoment = null;


    /****************************************************************************
    nsCollection.setTimeRange(start, end)
    Set the globale time-range and update all collections
    ****************************************************************************/
    let timeRange = null;

    nsCollection.setTimeRange = function(start, end){
        timeRange = [start, end];
        if (typeof start == 'number'){
            nsCollection.globalMin       = start;
            nsCollection.globalMinMoment = window.__jbs_getNowMoment().add(start, 'hour');
        }
        else {
            nsCollection.globalMinMoment = moment.utc(start);
            nsCollection.globalMin = nsCollection.globalMinMoment.diff(window.__jbs_getNowMoment(), 'hour');
        }

        if (typeof end == 'number'){
            nsCollection.globalMax       = end;
            nsCollection.globalMaxMoment = window.__jbs_getNowMoment().add(end, 'hour');
        }
        else {
            nsCollection.globalMaxMoment = moment.utc(end);
            nsCollection.globalMax = nsCollection.globalMaxMoment.diff(window.__jbs_getNowMoment(), 'hour');
        }

        nsCollection.updateAll();

    };

    /****************************************************************************
    _onNowChanged
    ****************************************************************************/
    nsCollection._onNowChanged = function(){
        if (timeRange && timeRange.length == 2)
            nsCollection.setTimeRange(timeRange[0], timeRange[1]);
        else
            nsCollection.updateAll();
    };

    /****************************************************************************
    updateAll
    ****************************************************************************/
    nsCollection.updateAll = function(){
        if (nsCollection.collectionList)
            (nsCollection.collectionList.list || []).forEach( collection => collection.update() );
    };

    /****************************************************************************
    Add event to update colleactions/models/domains info when "now" changes
    ****************************************************************************/
    if (window.FCOOCOLLECTION_TEST_NOW){
        let testInterval = new window.Intervals({durationUnit: 'seconds'});
        testInterval.addInterval({
            duration: 2,
            data    : {},
            resolve : nsCollection._onNowChanged
        });
    }
    else
        window.intervals.addInterval({
            duration: moment.duration(1, timeUnit).asMinutes(),
            data    : {},
            resolve : nsCollection._onNowChanged
        });


    /****************************************************************************
    nsCollection.createCollections
    ****************************************************************************/
    nsCollection.createCollections = function(collectionListOptions){
        //Create and load collections and layers
        nsCollection.collectionList = new CollectionList(collectionListOptions);
    };

    /****************************************************************************
    nsCollection.getCollection
    ****************************************************************************/
    nsCollection.getCollection = function(id){
        return nsCollection.collectionList ? nsCollection.collectionList.getCollection(id) : null;
    };

    /****************************************************************************
    CollectionList
    ****************************************************************************/
    function CollectionList(options = {}) {
        this.options = $.extend(true, {}, nsCollection.options.collectionList || {}, options);
        this.list    = [];

        //Set time-range from nsCollection.options.relativeTimeRange
        timeRange = timeRange || nsCollection.options.relativeTimeRange;

        //Load path from setup-file
        ns.promiseList.append({
            fileName: {subDir: this.options.dataSubDir, fileName: this.options.dataFileName},
            resolve : this.resolve.bind(this),
            wait    : true
        });

    }

    CollectionList.prototype = {
        resolve: function(data){
            //data content setup for different type of collections. This packages using 'tile'
            let clOptions = data.tile || {};
            this.options = $.extend(this.options, clOptions);
            if (this.options.path)
                ns.promiseList.append({
                    fileName: this.options.path,
                    resolve : this.resolveCollections.bind(this),
                    wait    : true,
                });
        },

        resolveCollections: function(data){
            //Create all the Collections
            $.each( data.collections, function(id, options){
                this.list.push( new nsCollection.Collection(id, options, this) );
            }.bind(this));
        },

        getCollection: function(id){
            return this.list ? this.list.find(collection => collection.id == id) : null;
        }
    };

    /****************************************************************************
    Collection
    ****************************************************************************/
    let Collection = nsCollection.Collection = function(id, options, collectionList) {
        this.id             = id;
        this.options        = options;
        this.collectionList = collectionList;
        this.list           = [];
        this.fullPath       = this.collectionList.options.path + '/' + this.id;
        this.firstTime      = true;

        this.onUpdate       = [];

        //Get meta-data
        //ns.promiseList.appendLast({
        ns.promiseList.append({
            fileName: this.fullPath,
            resolve : this.resolve.bind(this)
        });
    };

    Collection.prototype = {
        /*********************************************
        resolve
        *********************************************/
        resolve: function(data){
            if (this.firstTime){
                //Link Parameter to Collection
                this.parameters = {};
                let cp = data['varray:variables']; //cp = collection-parameters
                nsParameter.visitAllParameters( function(param){
                    if (cp[param.id])
                        this.parameters[param.id] = param;
                    else
                        if (param.type == "vector"){
                            //If both ns-ew- or dir-speed-parameter are in the collection => add the vector-param
                            ['eastward_northward_id', 'speed_direction_id'].forEach( ids => {
                                if (param[ids] && param[ids].length){
                                    let paramIdArray = param[ids].split(':');
                                    if ((paramIdArray.length >= 2) && (cp[paramIdArray[0]]) && (cp[paramIdArray[1]]))
                                        this.parameters[param.id] = param;
                                }
                            }, this);
                        }
                }.bind(this));
                $.each( this.parameters, function(id, param){ param.collection = this; }.bind(this) );

                //Get list of datasets / domains
                this.datasets = {};

            }

            //Update datasets
            (data['varray:datasets'] || []).forEach( options => {
                let datasetId = options.attrs.name.toUpperCase(),
                    dataset = this.datasets[datasetId];
                if (dataset)
                    dataset.update(options);
                else
                    this.datasets[datasetId] = new nsCollection.Dataset( options, this );
            }, this);

            this.update();

            if (this.firstTime){
                this.firstTime = false;
                window.intervals.addInterval({
                    duration: this.collectionList.options.updateDuration,
                    fileName: this.fullPath,
                    resolve : this.resolve,
                    context : this
                });
            }
        },

        /*********************************************
        getDataset
        *********************************************/
        getDataset: function(id){
            return this.datasets[id.toUpperCase()];
        },

        /*********************************************
        addOnUpdate
        *********************************************/
        addOnUpdate: function( func ){
            this.onUpdate.push(func);
        },

        /*********************************************
        update
        *********************************************/
        update: function(){
            $.each(this.datasets, (id, dataset) => dataset.update() );

            //Detect the status of the hole collection based on the status of its datasets
            //minState = lowest common state
            let commonMinState = stateFail;
            $.each(this.datasets, (id, dataset) => commonMinState = Math.min( commonMinState, dataset.displayStatus.state ) );

            //primaryState = highest state of all primary dataset (if any)
            let primaryState = stateOk;
            $.each(this.datasets, (id, dataset) => {
                if (dataset.isPrimary)
                    primaryState = Math.max( primaryState, dataset.displayStatus.state );
            });
            this.state = Math.max( commonMinState, primaryState);

            //Get time range for the collection on the time range from its datasets
            //TODO Perhaps Some method to prioritise between datasets
            this.timeRange = {};
            $.each(this.datasets, function(id, dataset){
                if (dataset.displayStatus.start)
                    this.timeRange.min = this.timeRange.min ? moment.min(this.timeRange.min, dataset.displayStatus.start) : dataset.displayStatus.start;
                if (dataset.displayStatus.end)
                    this.timeRange.max = this.timeRange.max ? moment.max(this.timeRange.max, dataset.displayStatus.end)   : dataset.displayStatus.end;
            }.bind(this) );

            //If the modal with status is open => update it
            if (this.bsModal){
                this.modalOptions = this.modalOptions || {};
                let map = this.elements ? this.elements.map : null;
                if (map){
                    this.modalOptions.mapCenter = map.getCenter();
                    this.modalOptions.mapZoom   = map.getZoom();
                }
                this.asModal(this.modalOptions);
            }

            //Call on-update-func (if any)
            this.onUpdate.forEach( func => func(this), this);
        },




        /*********************************************
        asModal - Show info and status for the datasetss in the Collection
        options = {
            header      : {icon, text}
            asStatic    : BOOLEAN   - if true only static model/domain info are shown
            mapCenter   : LATLNG    - The initial center of the map (optional)
            mapZoom     : NUMBER    - The initial zoom of the map (optional)
            parameter   : PARAMETER - The Parameter that are being displayed (optional)
            backgroundId: STRING (optional) 'strandard', 'charts', 'gray', or 'retro'
            bounds      : BOUNDS (optional), Draw a box on the map
            timeRange   : [INTEGER, INTEGER] (optional) Range for time-slider with dataset for each timestamp
            time        : INTEGER (optional) Start time
        *********************************************/
        asModal: function(options = {}){
            this.modalOptions   = options;
            this.modalAsStatic  = !!options.asStatic;
            this.modalParameter = options.parameter;

            this.timeRange = options.timeRange;

            if (this.modalParameter)
                this.modalHeaderText = this.modalParameter.getName();
            else
                this.modalHeaderText = options.header ? options.header.text : this.options.title || '';


            if (this.bsModal)
                this.bsModal.update( this._modalContent(options) );
            else
                this.bsModal = $.bsModal( this._modalContent(options) );

            this.$accordion = this.bsModal.bsModal.$body.find('.BSACCORDION');

            this.bsModal.show();

            let map = this.elements.map;
            if (map){
                map.invalidateSize();

                if (options.mapCenter)
                    map.setView(options.mapCenter);
                if (options.mapZoom)
                    map.setZoom(options.mapZoom);
                if (options.bounds)
                    map.fitBounds(options.bounds);
            }

            this.updateTimeRangeInfo();

        },


        /*********************************************
        _modalOnHide
        *********************************************/
        _modalOnHide: function(){
            //Save map center and zoom
            this.mapCenter = null;
            this.mapZoom = null;
            let map = this.elements ? this.elements.map : null;
            if (map){
                this.mapCenter = map.getCenter();
                this.mapZoom   = map.getZoom();
            }

            this.accordionStatus = this.$accordion.bsAccordionStatus();
            this.elements = null;
            this.bsModal = null;
            return true;
        },

        /*********************************************
        _accordion_onChange - Update the polygons in the map in the modal
        *********************************************/
        _accordion_onChange: function(accordion, status){
            this.accordionStatus = status;

            if (this.doNotUpdateMap){
                this.doNotUpdateMap = false;
                return;
            }
            //The 'open' domain (if any) is set in second status
            let currentIndex = null;
            let statusIndex = this.hasTimeRange ? 2 : 1;

            if (status && status[statusIndex])
                status[statusIndex].forEach( (open, index) => {
                    if (open)
                        currentIndex = index;
                });
            this._updateModalMap( currentIndex == null ? null : this.list[currentIndex] );
        },


        /*********************************************
        _updateModalMap - Update the accordion and polygon in the modal
        *********************************************/
        _updateModalMap: function( selectedDataset ){
            this.list.forEach( (dataset, index) => {
                var selected = (dataset == selectedDataset);

                if (selected){
                    this.doNotUpdateMap = true;
                    this.$accordion.bsOpenCard(index);
                }

                dataset._updateModalMap( selected );

            }, this);
        },

        /*********************************************
        _timeSlider_onBuild
        Connect the different datasets with there <span>
        with there color in the time-slider
        *********************************************/
        _timeSlider_onBuild: function( result ){
            let $grid = result.slider.cache.$grid;
            this.list.forEach( dataset => dataset._createGridSpan($grid) );
            this._updateTimeRangeInfo();
        },

        /*********************************************
        _timeSlider_onChange
        Hide/showw the time-info for the different datasets
        *********************************************/
        _timeSlider_onChange: function( timeSlider ){
            if (!timeSlider) return;

            this.currentTimeValue = timeSlider.value;

            let currentDatasetFound = false;
            this.list.forEach( dataset => {
                if (currentDatasetFound)
                    dataset._toggleTimeInfo(false);
                else
                    currentDatasetFound = dataset._updateTimeInfo();
            });
        },



        /*********************************************
        updateTimeRangeInfo
        *********************************************/
        updateTimeRangeInfo: function(){
            if (this.timeoutId)
                window.clearTimeout(this.timeoutId);

            this.timeoutId = window.setTimeout(this._updateTimeRangeInfo.bind(this), 20);
        },

        /*********************************************
        updateTimeRangeInfo
        *********************************************/
        _updateTimeRangeInfo: function(){
            this.timeoutId = null;

            if (!this.timeSlider) return;

            let map        = this.elements.map,
                latLng     = map ? map.getCenter() : null,
                isOverLand = map ? map.isOverLand(latLng) : null;

            if (map){
                this.list.forEach( dataset => dataset._updateGridSpan(latLng, isOverLand) );
                this._timeSlider_onChange(this.timeSlider.result);
            }
        },

        /*********************************************
        _modalContent
        *********************************************/
        _modalContent: function(options = {}){

            if (this.timeSlider){
                this.timeSlider.remove();
                this.timeSlider = null;
            }


            this.accordionStatus = this.accordionStatus || [true, true];

            let e = this.elements = {}; //Object holding different elements in the modal

            //Detect device and screen-size and set
            let extraWidth = ns.modernizrDevice.isDesktop || ns.modernizrDevice.isTablet,
                megaWidth  = extraWidth && (Math.min(ns.modernizrMediaquery.screen_height, ns.modernizrMediaquery.screen_width) >= 920),
                mapHeight  = 300 + (extraWidth ? 100 : 0) + (megaWidth ? 100 : 0);

            //Create map-container and map-element and the info-map
            e.$mapContainer = $('<div/>').css(nsCollection.options.mapContainerCss).height(mapHeight);

            e.map = L.map(e.$mapContainer.get(0), $.extend(true, {},
                        nsCollection.options.modalMapOptions, {
                            bsPositionControl: !!options.timeRange,
                            bsPositionOptions: {isExtended: true, mode: 'MAPCENTER'}
                        })
                    );

            if (e.map.bsPositionControl)
                e.map.bsPositionControl.$container.hide();

            if (options.bounds)
                L.rectangle(options.bounds, {color: "var(--cmd-current-map)", weight: 2, fill: false}).addTo(e.map);

            e.$mapContainer.resize( e.map.invalidateSize.bind(e.map) );
            e.map.setView(options.mapCenter || this.mapCenter || [56.2, 11.5], options.mapZoom || this.mapZoom || 6);

            //Set default wms-options if not set
            if (!nsMap.wmsStatic)
                nsMap.standard.wms({});

            //Create background-layer and use the color-event to update time-range info
            e.map.setBackground(options.backgroundId || 'standard');

            e.map.backgroundLandLayer.on('color', this.updateTimeRangeInfo.bind(this) );

            //Create layerGroup to hole all polygons
            e.layerGroup = L.layerGroup().addTo(e.map);

            //Create new pane with zIndex < the map to hole all polygons fra ocean-domains
            var ocnPane = e.map.createPane('oceanPane');
            $(ocnPane).css('zIndex', 1);

            //Clean the layer with polygons and add the one from this
            e.$mapContainer.css({
                'border-color': 'transparent',
                'box-shadow'  : 'none'
            });
            e.layerGroup.clearLayers();

            //Add each dataset to this.list
            this.list = [];
            $.each( this.datasets, function(id, dataset){ this.list.push(dataset); }.bind(this) );
            this.list.sort( (ds1, ds2) => { return ds1.options.sequence_id - ds2.options.sequence_id; } );

            //Add colorNames
            let nextColorNameIndex = 0;
            this.list.forEach( dataset => {
                dataset.colorName = dataset.isGlobal ? globalColorName : colorNameList[nextColorNameIndex++ % colorNameList.length];
            });

            let accordionItems = [];
            let datasetVisible = 0;
            this.list.forEach( (dataset, index) => {
                dataset.include = true;
                if (this.modalParameter){
                    //@todo Check if the dataset contains data from Parameter (if any)
                }
                if (dataset.include){
                    if (!dataset.displayStatus.disabled)
                        datasetVisible++;
                    let accordionContent = dataset.accordionContent(options);
                    if (this.accordionStatus && Array.isArray(this.accordionStatus[1]) &&  this.accordionStatus[1][index])
                        accordionContent.isOpen = true;
                    accordionItems.push( accordionContent );
                }
            });

            //Add polygon (if not disabled and not global) to the overview map in reverse order
            for (var i=this.list.length-1; i>=0; i--){
                let dataset = this.list[i];
                if (dataset.include)
                    dataset.addToMap();
            }
            let footer = null;
            if (options.bounds){
                //Construkt a map-outline in the footer
                let ne = e.map.latLngToLayerPoint( options.bounds.getNorthEast() ),
                    sw = e.map.latLngToLayerPoint( options.bounds.getSouthWest() ),
                    wh  = Math.abs( ne.x - sw.x ) / Math.abs( ne.y - sw.y ),
                    w   = Math.max( wh >= 1 ? 20    : wh*20, 7 ),
                    h   = Math.max( wh >= 1 ? 20/wh : 20,    7 ),
                    txt = i18next.sentence({da:'Aktuelle kort', en:'Current map'});
                footer =  `<div class="cmd-current-map-container"><div style="width:${w}px; height:${h}px;" class="cmd-current-map"></div><span>&nbsp;:&nbsp;${txt}</span></div>`;
            }

            let accordionChildren = [{
                    header  : {icon:'fa-map', text:{da: 'Oversigtskort', en:'Overview map'}},
                    isOpen  : this.accordionStatus[0],
                    content : e.$mapContainer,
                    footer  : footer
                }];



            //Add content to hold time-range info
            this.hasTimeRange = options.timeRange && (datasetVisible > 0);
            if (this.hasTimeRange){
                let $timeContainer      = $('<div></div>'),
                    $timeInfoContainer  = $('<div></div>').addClass('d-flex align-items-end justify-content-center').height(20).appendTo( $timeContainer ),
                    $timeRangeContainer = $('<div></div>').appendTo( $timeContainer ),
                    $input = $('<input type="text"/>').appendTo( $timeRangeContainer ),
                    tMin = options.timeRange[0],
                    tMax = options.timeRange[1],
                    timeSliderOptions = {
                        resizable       : true,
                        ticksOnLine     : true,
                        valueDistances  : 16,
                        grid            : true,
                        handleFixed     : true,
                        slider          :"fixed",
                        mousewheel      : true,
                        showLine        : false,
                        showLineColor   : false,
                        extendLine      : true,

                        min  : tMin,
                        max  : tMax,
                        value: options.time || 0,

                        onBuild      : this._timeSlider_onBuild,
                        onChange     : this._timeSlider_onChange,
                        context      : this

                    };

                //Add time-info and set grid-colors according to the different dataset
                let gridColors = [];
                this.list.forEach( dataset => {
                    if (dataset.include){
                        $timeInfoContainer.append( dataset._createTimeInfo() );
                        gridColors.push({fromValue: 0, value: 1, color: dataset.colorName, className: 'data-set-grid-color-'+dataset.options.sequence_id});
                    }
                });

                if (gridColors.length)
                    timeSliderOptions.gridColors = gridColors;


                this.timeSlider = $input.timeSlider(timeSliderOptions).data('timeSlider');

                accordionChildren.push({
                    icon   : 'fa-plus-large',
                    text   : {da:'Hvilke prognoser dækker kortcenter', en: 'Witch forecasts covers map center'},
                    isOpen : true,
                    content: $timeContainer
                });
            } //if (this.hasTimeRange){...


            accordionChildren.push({
                header  : {icon:'far fa-circle-info', text: {da:'Prognoser', en:'Forecasts'}},
                isOpen  : this.accordionStatus[1],
                content: {
                    type     : 'accordion',
                    children: accordionItems
                }
            });


            var result = {
                    flexWidth : true,
                    extraWidth: extraWidth,
                    megaWidth : megaWidth,

                    header   : {
                        icon : [nsCollection.getStateIcon(this.state)],
                        text : this.modalHeaderText
                    },

                    onHide   : this._modalOnHide.bind(this),
                    content  : {
                        type     : 'accordion',
                        onChange : this._accordion_onChange.bind(this),
                        multiOpen: true,
                        children : accordionChildren
                    },
                    helpId    : this.options.helpId,
                    helpButton: true
                };

            this.updateTimeRangeInfo();

            return result;
        },
    };


}(jQuery, L, this.i18next, this.moment, this, document));
;
/****************************************************************************
datasets.js

Create Datasets
****************************************************************************/

(function ($, L, i18next, moment, window/*, document, undefined*/) {
    "use strict";

    //Create fcoo-namespace
    let ns           = window.fcoo = window.fcoo || {},
        nsModel      = ns.model = ns.model || {},
        nsCollection = ns.collection = ns.collection || {};

    //Dataset states
    const stateOk    = nsCollection.stateOk,
          stateWarn  = nsCollection.stateWarn,
          stateAlert = nsCollection.stateAlert,
          stateFail  = nsCollection.stateFail;


    function createDummyDomain(){
        //Create "dummy" modal and domain for fallback
        let dummyModel = new nsModel.Model({
                id: '', name: '', domainOwner : '',
                domain: [{id: '', name: '', period: '', process: '', resolution: ''}]
            }, nsModel.modelList);

        return dummyModel.domainList[0];
    }

    /****************************************************************************
    *****************************************************************************
    Dataset
    *****************************************************************************
    ****************************************************************************/
    let Dataset = nsCollection.Dataset = function(options, collection) {
        this.id = options.attrs.name.toUpperCase();
        this.collection = collection;

        //Find model and domain and create copy OR create dummy version
        let idArray  = this.id.split(':'),
            modelId  = idArray[0],
            domainId = idArray[1],
            domain, model;

        model = nsModel.modelList.getModel( modelId );
        if (model){
            domain = model.getDomain( domainId );
            if (domain)
                domain = new nsModel.Domain(domain.options, model);
        }
        this.domain = domain || createDummyDomain();

        this.isGlobal = this.domain.isGlobal;
        this.isPrimary = this.isGlobal || !!options.primary;
        this.isOcean = ns.FCMD_FORCE_OCEAN ? true : (this.domain.options.type == 'ocean');

        this.update( options );
    };

    Dataset.prototype = {
        /*********************************************
        update
        Sets status and displayStatus = {
            sequence_id         : NUMBER
            lastModified        : MOMENT
            epoch               : MOMENT
            start               : MOMENT
            end                 : MOMENT
            expectedNextUpdate  : MOMENT
            delayed             : BOOLEAN
            state               : STRING (only range check for displayStatus) =
                stateOk    = On time and start-end cover hole globalMinMoment-globalMaxMoment-range
                stateWarn  = Is delayed or start-end do not cover hole globalMinMoment-globalMaxMoment-range
                stateFail  = start-end is outside globalMinMoment-globalMaxMoment. Also sets disabled = false
        }
        *********************************************/
        update: function(options = {}){
            let o = this.options = $.extend(true, {}, this.options || {}, options);
            let s = this.status = this.status || {};
            let d = this.domain.options;

            //if window.FCOOCOLLECTION_TEST_STATUS == true => display text with the 'reason'
            this.STATUSTEXT = '';
            let ADD = function(...theArgs){
                if (window.FCOOCOLLECTION_TEST_STATUS)
                    this.STATUSTEXT = this.STATUSTEXT + (this.STATUSTEXT ? '<br>' : '') +  theArgs.join(' ');
            }.bind(this);

            s.sequence_id   = o.sequence_id;
            s.lastModified  = moment(o.attrs.created);
            s.epoch         = moment(o.attrs.epoch);

            //Bounty-box in o.extent.spatial.bbox - not used

            //Time-ranges in o.extent.temporal.interval = [][start,end]
            let timeRangeList = o.extent && o.extent.temporal ? o.extent.temporal.interval : null;
            let start, end;
            let now = window.__jbs_getNowMoment();
            if (timeRangeList)
                timeRangeList.forEach( startEnd => {
                    let nextStart = moment(startEnd[0]), nextEnd = moment(startEnd[1]);
                    if (!start || nextStart.isBefore(start))
                        start = nextStart;
                    if (!end || nextEnd.isAfter(end))
                        end = nextEnd;
                }, this);
            s.start = start;
            s.end   = end;

            s.timeRange = [
                start ? start.diff(now, 'hour') : null,
                end   ? end.diff  (now, 'hour') : null
            ];

            //expectedNextUpdate
            if (s.epoch && d.period){
                let nextEpoch = moment(s.epoch).add(d.period, 'hour');
                s.expectedNextUpdate = nextEpoch
                                            .add(d.process || 0, 'hour')  //Expected process-time
                                            .add(45, 'minutes')           //Rounding
                                            .startOf('hour');
                s.delayed = s.expectedNextUpdate.isBefore( now );
                s.delayedHours = now.diff(s.expectedNextUpdate, 'hour');
                ADD('Delayed=', s.delayed, 'Next update=', s.expectedNextUpdate.toString(), 'Delayed hours=', s.delayedHours );
            }
            else {
                s.expectedNextUpdate = null;
                s.delayed = false;
            }

            //Set state
            s.state = stateOk;
            if (s.disabled)
                s.state = stateFail;
            else
                if (s.delayed){
                    s.state = stateWarn;
                    if (s.delayedHours > d.period)
                        s.state = stateAlert;
                    if ( s.end && s.end.isBefore(window.__jbs_getNowMoment()) )
                        s.state = stateFail;

                }

            //Create displayStatus = status but with correction relative to globalMinMoment and globalMaxMoment
            let ds = this.displayStatus = {};
            $.each(s, (id, value) => ds[id] = value instanceof moment ? moment(value) : value );

            //Set state based on the time range of the dataset compared with the global time range
            let /*now      = window.__jbs_getNowMoment(),*/
                dsMin = ds.start ? ds.start.diff(now, 'hour') : null,
                dsMax = ds.end   ? ds.end.diff  (now, 'hour') : null,
                glMin = nsCollection.globalMin,
                glMax = nsCollection.globalMax,
                minExists = !!nsCollection.globalMinMoment && (dsMin !== null),
                maxExists = !!nsCollection.globalMaxMoment && (dsMax !== null);


            //Check relation between dastaset.start -> dataset.end and globalMinMoment -> globalMaxMoment

            //start-end is outside globalMin-globalMax
            if ( ( minExists && (dsMin > glMax) ) || ( maxExists && (dsMax < glMin)  ) ) {
                ds.state = nsCollection.stateFail;
                ds.disabled = true;
                ADD('start-end is outside globalMin-globalMax', ds.state);
            }


            //Adjust start and end to globalMinMoment and globalMaxMoment
            if (minExists && (dsMin < glMin))
                ds.start = moment(nsCollection.globalMinMoment);

            if (maxExists && (dsMax > glMax))
                ds.end = moment(nsCollection.globalMaxMoment);

            //Add debug info regarding the range
            if (window.FCOOCOLLECTION_TEST_STATUS){
                ADD('Global Range  = ' + glMin + ' to ' + glMax);
                ADD('Dataset Range = ' + dsMin + ' to ' + dsMax);
            }
        },

        /*********************************************
        getIcon
        Global: square, not Global: full square
        *********************************************/
        getIcon: function(){
            return this.isGlobal ? 'far fa-square-full text-'+this.colorName : ['fas fa-square-full text-'+this.colorName, 'fal fa-square-full'];
        },


        /*********************************************
        accordionContent
        *********************************************/
        accordionContent: function(options = {}){
            let icons = []; //1. Status (only if not static), 2. color on info-map or not-shown

            //Status-icon
            if (!options.asStatic)
                icons.push( nsCollection.getStateIcon(this.displayStatus.state) );

            //Colored square icon (visible) or eye-slash-icon
            if (options.asStatic || !this.displayStatus.disabled){
                if (this.errorLoadingMask)
                    icons.push(['far fa-square fa-sm', 'far fa-slash']);
                else
                    icons.push( this.getIcon() );
            }
            else
                icons.push('far fa-eye-slash');

            return {
                header: {
                    icon: icons,
                    text: this.domain.fullNameSimple()
                },
                content: function( $container) {
                    this.domain.createDetailContent( $container, this.displayStatus, this.STATUSTEXT );
                }.bind(this)
            };
        },


        /*********************************************
        **********************************************
        POLYGON ON MAP
        **********************************************
        *********************************************/

        /*********************************************
        addToMap
        Add polygon to the map in domainGroup-variable
        *********************************************/
        addToMap: function(){
            if (this.isGlobal && this.displayStatus.disabled) return;

            let e = this.collection.elements;

            if (this.isGlobal){
                e.$mapContainer.css({
                    'cursor'      : 'pointer',
                    'border-color': this.colorName
                });

                //Add a tooltip to the map with info on the global model
                let tooltip = L.tooltip(L.latLng([0, 0]), { sticky: true, permanent: true }).setContent(this.domain.fullNameSimple().replace('&nbsp;', ' ' ));
                tooltip.addTo(e.map);

                e.map.on('mouseover', ()      => tooltip.addTo(e.map)      );
                e.map.on('mouseout',  ()      => tooltip.removeFrom(e.map) );
                e.map.on('mousemove', (event) => tooltip.setLatLng(e.map.layerPointToLatLng(event.layerPoint)) );
                e.map.on('click', function( event ){
                    if (this.collection.preventMapClick)
                        this.collection.preventMapClick = false;
                    else
                        this._polygon_onClick(event);
                }.bind(this) );

                return;
            }


            if (this.latLngs)
                this.addPolygon();
            else {
                if (!this.domain.options.mask)
                    this.errorLoadingMask = true;
                if (!this.errorLoadingMask)
                    //Load polygons from json-file
                    Promise.getJSON(
                        ns.dataFilePath({subDir: 'model-domain', fileName: this.domain.options.mask}), {
                        useDefaultErrorHandler: false,
                        resolve: this.addPolygon.bind(this),
                        reject : this.rejectPolygon.bind(this)
                    });
            }
        },

        /*********************************************
        addPolygon
        *********************************************/
        addPolygon: function(geoJSON){
            let latLngs = null;
            if (geoJSON){
                var coordinates = geoJSON.features[0].geometry.coordinates,
                    indexOfBiggest = -1;
                $.each(coordinates, function(index, lngLats){
                    if ((indexOfBiggest == -1) || (lngLats.length > coordinates[indexOfBiggest]))
                        indexOfBiggest = index;
                });
                latLngs = geoJSON.features[0].geometry.coordinates[indexOfBiggest];
                latLngs.forEach( (lngLat, index) => { latLngs[index] = [lngLat[1], lngLat[0]]; });
            }

            this.latLngs = this.latLngs || latLngs;

            let disabled        = this.displayStatus.disabled;
            this.polygon = L.polygon(this.latLngs, {
                borderColorName : disabled ? 'black' : this.colorName,
                colorName       : disabled ? 'gray'  : this.colorName,
                extraTransparent: true,
                addInteractive  : true,
                border          : true,
                shadow          : false,
                hover           : true,
                interactive     : true,
                pane            : (this.isOcean ? 'oceanPane' : 'overlayPane')
            })
                .addTo(this.collection.elements.layerGroup)
                .bringToFront();

            this.polygon
                .on('click', this._polygon_onClick.bind(this) )
                .bindTooltip(this.domain.fullNameSimple(), {sticky: true});
        },

        rejectPolygon: function(){
            this.errorLoadingMask = true;

            //Reload the modal
            this.collection.update();
        },


        /*********************************************
        _polygon_onClick
        *********************************************/
        _polygon_onClick: function(){
            if (!this.isGlobal)
                this.collection.preventMapClick = true;
            this.collection._updateModalMap( this );
        },

        /*********************************************
        _updateModalMap
        *********************************************/
        _updateModalMap: function( selected ){
                let e        = this.collection.elements,
                    map      = e.map,
                    disabled = this.displayStatus.disabled;
                if (this.isGlobal && disabled) return;

                if (this.isGlobal){
                    e.$mapContainer.css('box-shadow', selected ? '0 0 6px 1px ' + this.colorName : 'none');
                    if (selected)
                        map.setZoom( map.getMinZoom(), {animate: false} );
                }
                else
                    if (this.polygon){
                        //Set style of selected/not-selected polygon
                        this.polygon.setStyle({
                            transparent    : true, //!selected || !this.isOcean,
                            weight         : selected && !this.isOcean ? 3 : 1,
                        borderColorName: (selected && !this.isOcean) || disabled ? 'black' : this.colorName,
                        });
                        if (selected)
                            map.fitBounds(this.polygon.getBounds(), {_maxZoom: map.getZoom()});
                    }
        },

        /*********************************************
        **********************************************
        TIME-SLIDER IN MODEL WITH INFO ON DATASET AT LATLNG
        **********************************************
        *********************************************/

        /*********************************************
        _createGridSpan
        Connect the dataset with its <span> in the time-slider grid
        *********************************************/
        _createGridSpan: function($grid){
            let cTimeRange = this.collection.timeRange;

            this.showColorSpan = null;

            if (this.include){
                let $colorSpan = $grid.find('.grid-color.data-set-grid-color-'+this.options.sequence_id);
                this.$colorSpan = $colorSpan.get(0) ? $colorSpan : null;
            }
            else
                this.$colorSpan = null;

            if (this.$colorSpan){
                //Check if the dataset has a valid time-range
                let start = null,
                    end   = null,
                    keep  = false;
                if (this.status.timeRange){
                    start = this.status.timeRange[0];
                    end   = this.status.timeRange[1];
                    keep = (start !== null) && (end !== null) && (start < cTimeRange[1]) && (end > cTimeRange[0]);
                }

                if (keep){
                    //Set z-index to correspond to sequence and relative position and length
                    let range = cTimeRange[1] - cTimeRange[0];
                    start = Math.max(start, cTimeRange[0]);
                    end   = Math.min(end, cTimeRange[1]);

                    this.$colorSpan.css({
                        'left'   : 100*(start - cTimeRange[0])/range +'%',
                        'width'  : 100*(end - start)/range + '%',
                        'z-index': 1000 - this.options.sequence_id
                    });
                }
                else {
                    this.$colorSpan.remove();
                    this.$colorSpan = null;
                }
            }
        },

        /*********************************************
        _updateGridSpan
        Update the color-bar in the time-slider
        *********************************************/
        _updateGridSpan: function(latLng, isOverLand){
            let show = this.isGlobal && (!isOverLand || !this.isOcean);

            if (!show){
                if (this.isOcean && isOverLand)
                    show = false;
                else
                    show = this.polygon && this.polygon.contains(latLng);
            }

            if (this.showColorSpan !== show){
                this.showColorSpan = show;
                this.$colorSpan ? this.$colorSpan.toggle(show) : null;
            }
        },


        /*********************************************
        _createTimeInfo
        Create a <div> with info about the dataset
        *********************************************/
        _createTimeInfo: function(){
            this.$timeInfo =
                $('<div></div>')
                    .addClass('d-inline-block')
                    .css('cursor', 'pointer')
                    .on('click', this._polygon_onClick.bind(this))
                    ._bsAddHtml({
                        icon: [this.getIcon()],
                        text: this.domain.fullNameSimple(),
                    });
            return this.$timeInfo;
        },

        /*********************************************
        _toggleTimeInfo
        Show/hide the <div> Update the color-bar in the time-slider
        *********************************************/
        _toggleTimeInfo: function( show ){
            this.$timeInfo.toggleClass('d-none', !show);
        },

        /*********************************************
        _updateTimeInfo
        Show/hide the <div> Update the color-bar in the time-slider
        *********************************************/
        _updateTimeInfo: function(){
            let time   = this.collection.currentTimeValue,
                tRange = this.status.timeRange,
                start  = tRange ? tRange[0] : null,
                end    = tRange ? tRange[1] : null,
                show   = this.showColorSpan && tRange && (start <= time) && (end >= time);

            this._toggleTimeInfo( show );
            return show;
        },


    };

}(jQuery, L, this.i18next, this.moment, this, document));
;
/****************************************************************************
load.js,

Method to load all data regarding models, domains, domain-groups

There are two ways to load and create models and virtuel datasets (domain-groups)
1: Set fcoo.model.includeModel = true before the fcoo.promiseList is resolved, or
2: Call fcoo.model.create( options (optional) )

****************************************************************************/
(function ($, window/*, document, undefined*/) {
    "use strict";

    //Create fcoo-namespace
    var ns = window.fcoo = window.fcoo || {},
        nsModel = ns.model = ns.model || {},
        nsCollection = ns.collection = ns.collection || {};



    /****************************************************************************
    Adding 'empty' promises to fcoo.promiseList to detect if models and
    domain-groups should be loaded
    ****************************************************************************/
    ns.promiseList.appendFirst({
        data: 'Check if models need to be loaded',
        resolve: function(){
            if (nsModel.options.includeModel || nsCollection.options.includeCollections)
                nsModel.createModels();
        }
    });
    ns.promiseList.appendFirst({
        data: 'Check if collections need to be loaded',
        resolve: function(){
            if (nsCollection.options.includeCollections)
                nsCollection.createCollections();
        }
    });

}(jQuery, this, document));
;
/****************************************************************************
fcoo-parameter-unit-extend.js

Extend Parameter from fcoo-parameter-unit with method to
find the cooresponding model-group and to show the modal window with info
on the model-group
****************************************************************************/
(function ($/*, window, document, undefined*/) {
    "use strict";

//2todo - skal bruge virtuelle data sæt i stedet for !!!


    //Create fcoo-namespace
    var ns = window.fcoo = window.fcoo || {},
        nsParameter = ns.parameter = ns.parameter || {};

    $.extend(nsParameter.Parameter.prototype, {
        collectionAsModal: function(options = {}){
            options.parameter = this;
            if (this.collection)
                this.collection.asModal(options);
        }

    });
}(jQuery, this, document));