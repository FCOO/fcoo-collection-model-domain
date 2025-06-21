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