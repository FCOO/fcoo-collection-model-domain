/****************************************************************************
fcoo-collection-model-domain.js,

Objects and methods to create and manages list of models
****************************************************************************/
(function ($, i18next, moment, window/*, document, undefined*/) {
    "use strict";

    //Create fcoo-namespace
    var ns = window.fcoo = window.fcoo || {},
        nsModel = ns.model = ns.model || {};

    nsModel.options = $.extend(true, nsModel.options, {
        includeModel      : false,    //If true all Models and Domains are loaded and created

//HER           model: {
//HER               roundEpochMomentTo  : 15 //minutes
//HER           },

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
        createDetailContent: function( $container, status ){
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
                let $div = $('<div></div>').addClass('align-items-stretch row row'),
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


            if (hasDynamicContent){
                if (status.disabled)
                    content.push({
                        type     : 'textarea',
                        center   : true,
                        icon     : 'far fa-eye-slash',
                        iconClass: 'font-weight-bold text-danger',
                        text     : [
                            {da: replaceSpace('VISES IKKE'), en: replaceSpace('NOT SHOWN')},
                            {da: replaceSpace('Prognosen er ikke tilgængelig'), en: replaceSpace('The forecast is not available')}
                        ],
                        textClass: ['font-weight-bold text-danger', 'text-danger']
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
                    if (status.delayed)
                        subContent.push({
                            label : label,
                            class : 'info-box',
                            type  : 'textarea',
                            center: true,
                            middle: true,
                            textClass: 'font-weight-bold text-warning',
                            text: {da: 'FORSINKET', en: 'DELAYED'}
                        });
                    else
                        subContent.push(
                            momentAsText({
                                label          : label,
                                date           : status.expectedNextUpdate,
                                furtureRelative: true
                            })
                        );

                    subContent.push(
                        momentAsText({
                            label          : {da: 'Prognosen går frem til', en:'The forecast ends at'},
                            date           : status.end,
                            furtureRelative: true,
                            exactRelative  : true,
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

    //Create fcoo-namespace
    let ns = window.fcoo = window.fcoo || {},
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
            'width'             : '100%',
            'background-color'  : '#C9E9F7',
            'border'            : '3px solid transparent'
        },

        //getMapLayers - Return a array of layers for the map in the modal
        getMapLayers: function(){
            return [
                L.tileLayer.wms('https://{s}.fcoo.dk/mapproxy/service', {
                    layers: "land-iho_latest",
                    styles: "",
                    errorTileUrl: "https://tiles.fcoo.dk/tiles/empty_512.png",
                    format: "image/png",
                    subdomains: ["wms01", "wms02", "wms03", "wms04"],
                    tileSize: 512,
                    transparent: true,
                    zIndex: 800
                }),

                // Top layer (coastline + place names)
                L.tileLayer.wms('https://{s}.fcoo.dk/mapproxy/service', {
                    layers: 'top-dark_latest',
                    styles: "",
                    errorTileUrl: "https://tiles.fcoo.dk/tiles/empty_512.png",
                    format: "image/png",
                    subdomains: ["wms01", "wms02", "wms03", "wms04"],
                    tileSize: 512,
                    transparent: true,
                    zIndex: 1000
                })
            ];
        }

    }, nsCollection.options || {} );

    //Var and methods for state
    nsCollection.stateOk   = 1,
    nsCollection.stateWarn = 2,
    nsCollection.stateFail = 3;


    nsCollection.getWarningIcon = function(){
        return $.getHeaderIcons(false).warning.icon;
    };


    nsCollection.getStateIcon = function(state){
        let result = 'far fa-check-circle';
        switch (state){
          //case nsCollection.stateOk  : Part of default
            case nsCollection.stateWarn: result = nsCollection.getWarningIcon(); break;
            case nsCollection.stateFail: result = ['fas fa-circle text-danger', 'far fa-exclamation-circle']; break;
        }
        return result;
    };



    //colorNameList = []COLORNAME = different colors for domains
    var colorNameList = ["blue"/*"red"*/, "green", "orange", "cyan", "purple", "brown", "black", "grey", "pink", "yellow", "blue", "white"],
        globalColorName = "red";//"darkblue";


    const timeUnit = 'hour';
    nsCollection.globalStart = null;
    nsCollection.globalEnd   = null;

    /****************************************************************************
    nsCollection.setTimeRange(start, end)
    Set the globale time-range and update all collections
    ****************************************************************************/
    let timeRange = null;

    nsCollection.setTimeRange = function(start, end){
        timeRange = [start, end];
        if (typeof start == 'number')
            nsCollection.globalStart = window.__jbs_getNowMoment().add(start, 'hour');
        else
            nsCollection.globalStart = moment.utc(start);
        if (typeof end == 'number')
            nsCollection.globalEnd = window.__jbs_getNowMoment().add(end, 'hour');
        else
            nsCollection.globalEnd = moment.utc(end);

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

        //Get meta-data
        ns.promiseList.appendLast({
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
        update
        *********************************************/
        update: function(){
            $.each(this.datasets, (id, dataset) => dataset.update() );

            //Detect the status of the hole collection based on the status of its datasets
            this.state = nsCollection.stateFail;

            //First: Lowest state from all included datasets
            $.each(this.datasets, function(id, dataset){
                this.state = Math.min( this.state, dataset.displayStatus.state );
            }.bind(this) );

            //@todo: Next: Some method to Prioritise between datasets


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

        },


        /*********************************************
        asModal - Show info and status for the datasetss in the Collection
        options = {
            header    : {icon, text}
            asStatic  : BOOLEAN   - if true only static model/domain info are shown
            mapCenter : LATLNG    - The initial center of the map (optional)
            mapZoom   : NUMBER    - The initial zoom of the map (optional)
            parameter : PARAMETER - The Parameter that are being displayed (optional)
        *********************************************/
        asModal: function(options = {}){
            this.modalOptions = options;
            this.modalAsStatic = !!options.asStatic;
            this.modalParameter = options.parameter;

            if (this.modalParameter)
                this.modalHeaderText = this.modalParameter.getName();
            else
                this.modalHeaderText = options.header ? options.header.text : this.options.title || '';


            if (this.bsModal)
                this.bsModal.update( this._modalContent(options) );
            else
                this.bsModal = $.bsModal( this._modalContent(options) );

            this.$accordion = this.bsModal.bsModal.$body.find('.BSACCORDION');

            if (this.map){
                if (options.mapCenter)
                    this.map.setView(options.mapCenter);
                if (options.mapZoom)
                    this.map.setZoom(options.mapZoom);
            }

            this.bsModal.show();
            if (this.map)
                this.map.invalidateSize();

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
            if (status && status[1])
                status[1].forEach( (open, index) => {
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
        _modalContent
        *********************************************/
        _modalContent: function(options = {}){
            this.accordionStatus = this.accordionStatus || [true, true];

            let e = this.elements = {}; //Object holding different elements in the modal

            //Detect device and screen-size and set
            let extraWidth = window.fcoo.modernizrDevice.isDesktop || window.fcoo.modernizrDevice.isTablet,
                megaWidth  = extraWidth && (Math.min(ns.modernizrMediaquery.screen_height, ns.modernizrMediaquery.screen_width) >= 920),
                mapHeight  = 300 + (extraWidth ? 100 : 0) + (megaWidth ? 100 : 0);


            //Create map-container and map-element
            //Create the info-map. NB: Hard-coded color for the sea!!!
            e.$mapContainer = $('<div/>').css(nsCollection.options.mapContainerCss).height(mapHeight);
            e.map = L.map(e.$mapContainer.get(0), nsCollection.options.modalMapOptions);

            e.$mapContainer.resize( e.map.invalidateSize.bind(e.map) );

            e.map.setView(options.mapCenter || this.mapCenter || [56.2, 11.5], options.mapZoom || this.mapZoom || 6);





            //Gets the layers for the map in the modal
            let layerList = nsCollection.options.getMapLayers();
            layerList = Array.isArray(layerList) ? layerList : [layerList];
            layerList.forEach( layer => layer.addTo(e.map) );


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
            this.list.forEach( (dataset, index) => {
                dataset.include = true;
                if (this.modalParameter){
                    //@todo Check if the dataset contains data from Parameter (if any)
                }
                if (dataset.include){
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
                        children: [{
                            header  : {icon:'fa-map', text:{da: 'Oversigtskort', en:'Overview map'}},
                            isOpen  : this.accordionStatus[0],
                            content : e.$mapContainer
                        }, {
                            header  : {icon:'far fa-circle-info', text: {da:'Prognoser', en:'Forecasts'}},
                            isOpen  : this.accordionStatus[1],
                            content: {
                                type     : 'accordion',
                                children: accordionItems
                            }
                        }]
                    },
                    helpId    : this.options.helpId,
                    helpButton: true
                };
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
    let ns = window.fcoo = window.fcoo || {},
        nsModel      = ns.model = ns.model || {},
        nsCollection = ns.collection = ns.collection || {};

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
        this.isOcean = this.domain.options.type == 'ocean';

        this.update( options );
    };

    Dataset.prototype = {
        /*********************************************
        update
        Sets status and displayStatus = {
            sequence_id         : NUMBER
            lastModified        : moment
            epoch               : moment
            start               : moment
            end                 : moment
            expectedNextUpdate  : moment
            delayed             : BOOLEAN
            state               : STRING (only range check for displayStatus) =
                stateOk    = On time and start-end cover hole globalStart-globalEnd-range
                stateWarn  = Is delayed or start-end do not cover hole globalStart-globalEnd-range
                stateFail  = start-end is outside globalStart-globalEnd. Also sets disabled = false
        }
        *********************************************/
        update: function(options = {}){
            let o = this.options = $.extend(true, {}, this.options || {}, options);
            let s = this.status = this.status || {};
            let d = this.domain.options;

            s.sequence_id   = o.sequence_id;
            s.lastModified  = moment(o.attrs.created);
            s.epoch         = moment(o.attrs.epoch);

            //Bounty-box in o.extent.spatial.bbox - not used

            //Time-ranges in o.extent.temporal.interval = [][start,end]
            let timeRangeList = o.extent && o.extent.temporal ? o.extent.temporal.interval : null;
            let start, end;
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

            //expectedNextUpdate
            if (s.epoch && d.period){
                let nextEpoch = moment(s.epoch).add(d.period, 'hour');
                s.expectedNextUpdate = nextEpoch
                                            .add(d.process || 0, 'hour')  //Expected process-time
                                            .add(45, 'minutes')           //Rounding
                                            .startOf('hour');
                s.delayed = s.expectedNextUpdate.isBefore( window.__jbs_getNowMoment() );
            }
            else {
                s.expectedNextUpdate = null;
                s.delayed = false;
            }

            s.state = s.disabled ? nsCollection.stateFail :
                      s.delayed  ? nsCollection.stateWarn :
                      nsCollection.stateOk;


            //Create displayStatus = status but with correction relative to globalStart and globalEnd
            let ds = this.displayStatus = {};

            $.each(s, (id, value) => {
                ds[id] = value instanceof moment ? moment(value) : value;
            });

            if (nsCollection.globalStart || nsCollection.globalEnd){
                //Check relation between dastaset.start -> dataset.end and globalStart -> globalEnd
                //1: start-end do not cover globalStart-globalEnd
                if (
                    (nsCollection.globalStart && ds.start && ds.start.isAfter(nsCollection.globalStart) ) ||
                    (nsCollection.globalEnd   && ds.end   && ds.end.isBefore(nsCollection.globalEnd)    )
                   )
                    ds.state = Math.max(ds.state, nsCollection.stateWarn);

                //2: start-end is outside globalStart-globalEnd
                if (
                    (nsCollection.globalStart && ds.end   && ds.end.isBefore(nsCollection.globalStart)) ||
                    (nsCollection.globalEnd   && ds.start && ds.start.isAfter(nsCollection.globalEnd) )
                   ) {
                    ds.state = nsCollection.stateFail;
                    ds.disabled = true;
                }

                //Adjust start and end to globalStart and globalEnd
                if (nsCollection.globalStart && ds.start && ds.start.isBefore(nsCollection.globalStart))
                    ds.start = moment(nsCollection.globalStart);

                if (nsCollection.globalEnd && ds.end && ds.end.isAfter(nsCollection.globalEnd))
                    ds.end = moment(nsCollection.globalEnd);
            }
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
                else {
                    //Global: square, not Global: full square
                    if (this.isGlobal)
                        icons.push('far fa-square-full text-'+this.colorName);
                    else
                        icons.push([
                            'fas fa-square-full text-'+this.colorName,
                            'fal fa-square-full'
                        ]);
                }
            }
            else
                icons.push('far fa-eye-slash');

            return {
                header: {
                    icon: icons,
                    text: this.domain.fullNameSimple()
                },
                content: function( $container) {
                    this.domain.createDetailContent( $container, this.displayStatus );
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
            else
                if (!this.errorLoadingMask)
                    //Load polygons from json-file
                    Promise.getJSON(
                        ns.dataFilePath({subDir: 'model-domain', fileName: this.domain.options.mask}), {
                        useDefaultErrorHandler: false,
                        resolve: this.addPolygon.bind(this),
                        reject : this.rejectPolygon.bind(this)
                    });
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
                pane            : this.isOcean ? 'oceanPane' : 'overlayPane',
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
        }





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
        data: {},
        resolve: function(){
            if (nsModel.options.includeModel || nsCollection.options.includeCollections)
                nsModel.createModels();
        }
    });
    ns.promiseList.appendFirst({
        data: {},
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