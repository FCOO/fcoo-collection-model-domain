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
                            bsPositionControl: true,
                            bsPositionOptions: {
                                isExtended: true,
                                mode      : options.timeRange ? 'MAPCENTER' : 'CURSOR'
                            }
                        })
                    );

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

            if (options.timeRange)
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

//HER               this.updateTimeRangeInfo();

            return result;
        },
    };


}(jQuery, L, this.i18next, this.moment, this, document));