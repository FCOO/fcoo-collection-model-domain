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


    //Status when collection and dataset info are shown in modal. mds = modal-display-status for the current map-center (latlng) and time in time-slider
    const mdsOk          = nsCollection.mdsOk        = 1, //Ok
          mdsTimeRange   = nsCollection.mdsTimeRange = 2, //Outside the time-range
          mdsOverOcean   = nsCollection.mdsOverOcean = 3, //LatLng is over water/ocean when only forecast for land
          mdsOverLand    = nsCollection.mdsOverLand  = 4, //LatLng is over land when only forecast for water/ocean
          mdsOutside     = nsCollection.mdsOutside   = 5; //LatLng is outside the dataset domain


    //colorNameList = []COLORNAME = different colors for domains - there has been many variations....
    //const colorNameList   = ["blue", "green", "cyan", "purple", "grey", "pink"],
    //const colorNameList   = ["red", "orange", "yellow", "green", "blue", "white", "grey", "black", "darkblue"],
    //const colorNameList   = ['chocolate', 'springgreen', 'olive', 'darkviolet', 'cyan', 'purple', 'grey', 'pink'],
    const colorNameList   = ['red', 'chartreuse', 'aqua', 'blueviolet', 'fuchsia', 'orange', 'lime', 'slateblue'],

    //globalColorName = "brown";
    globalColorName = "darkblue";

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
            //$.each( data.collections, function(id, options){
            ( data.collections || []).forEach( options => this.list.push( new nsCollection.Collection(options, this) ), this);
        },

        getCollection: function(id){
            return this.list ? this.list.find(collection => collection.id == id) : null;
        }
    };

    /****************************************************************************
    Collection
    ****************************************************************************/
    let Collection = nsCollection.Collection = function(options, collectionList) {
        this.id             = options.id;
        this.options        = options;
        this.collectionList = collectionList;
        this.list           = [];
        this.fullPath       = this.collectionList.options.path + '/' + this.id;
        this.firstTime      = true;

        this.onUpdate       = [];

        //Get meta-data
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
                let cp = data['varray:variables'] || []; //cp = collection-parameters
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
                this.hasDatasets = false;
                this.numOfDatasets = 0;
                this.datasets = {};

            }

            //Update datasets
            (data['varray:datasets'] || []).forEach( options => {
                let datasetId = options.attrs && options.attrs.name ? options.attrs.name.toUpperCase() : null,
                    dataset   = datasetId ? this.datasets[datasetId] : null;
                this.hasDatasets = this.hasDatasets || !!datasetId || !!dataset;

                if (dataset)
                    dataset.update(options);
                else
                    if (datasetId){
                        this.datasets[datasetId] = new nsCollection.Dataset( options, this );
                        this.datasets[datasetId].index = this.numOfDatasets;
                        this.numOfDatasets++;
                    }
            }, this);


            if (!this.hasDatasets)
                return;

            if (this.firstTime)
                this.collectionList.list.push( this );

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
                this.bsModal.close();
                this.modalOptions.mapCenter = this.mapCenter;
                this.modalOptions.mapZoom   = this.mapZoom;
                const dontFitBounds = this.modalOptions.dontFitBounds;
                this.modalOptions.dontFitBounds = true;

                this.asModal(this.modalOptions);

                this.modalOptions.dontFitBounds = dontFitBounds;
            }

            //Call on-update-func (if any)
            this.onUpdate.forEach( func => func(this), this);
        },




        /*********************************************
        asModal - Show info and status for the datasets in the Collection
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
                if (options.bounds && !options.dontFitBounds)
                    map.fitBounds(options.bounds);
            }

            this.updateModalDisplayStatus();
            this.updatePolygonIcons();
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
                map.remove();
            }

            this.accordionStatus = this.$accordion.bsAccordionStatus();
            this.elements = null;
            this.bsModal = null;

            if (this.timeSlider)
                this.timeSlider.destroy();
            this.timeSlider = null;

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
            //The 'open' domain (if any) is set in second or third status
            let currentIndex = null;
            let statusIndex = this.hasTimeRange ? 2 : 1;

            if (status && status[statusIndex])
                status[statusIndex].forEach( (open, index) => {
                    if (open)
                        currentIndex = index;
                });

            if (currentIndex != null )
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

            this.updateModalDisplayStatus();
        },

        /*********************************************
        _timeSlider_onBuild
        Connect the different datasets with there <span>
        with there color in the time-slider
        *********************************************/
        _timeSlider_onBuild: function( result ){
            let $grid = result.slider.cache.$grid;
            this.list.forEach( dataset => dataset._createGridSpan($grid) );
            this._updateModalDisplayStatus();
        },

        /*********************************************
        _timeSlider_onChange
        Hide/show the time-info for the different datasets
        *********************************************/
        _timeSlider_onChange: function( timeSlider ){
            if (!timeSlider) return;

            this.currentTimeValue = timeSlider.value;

            let currentDatasetFound = false;

            this.modalDisplayStatus = 99;
            for (var i=this.list.length-1; i>=0; i--){
                const dataset = this.list[i];
                if (currentDatasetFound)
                    dataset._toggleTimeInfo(false);
                else {
                    dataset._updateTimeInfo();
                    currentDatasetFound = dataset.modalDisplayStatus == mdsOk;
                }
                this.modalDisplayStatus = Math.min(this.modalDisplayStatus, dataset.modalDisplayStatus);
            }

            /*
            switch (this.displayStatus){
                case mdsOk          : console.log('Ok');                     break;
                case mdsTimeRange   : console.log('Outside the time-range'); break;
                case mdsOverOcean   : console.log('Over water');             break;
                case mdsOverLand    : console.log('Over land');              break;
                case mdsOutside     : console.log('Outside');                break;
            }
            //*/

            //Show/hide display-status for no-forecast
            $.each(this.modalDisplayStatusElement, (mdsId, $elem) => {
                $elem.toggleClass('d-none', mdsId != this.modalDisplayStatus);
            }, this);

        },



        /*********************************************
        updateModalDisplayStatus
        *********************************************/
        updateModalDisplayStatus: function(){
            if (this.timeoutId)
                window.clearTimeout(this.timeoutId);

            this.timeoutId = window.setTimeout(this._updateModalDisplayStatus.bind(this), 20);
        },

        /*********************************************
        _updateModalDisplayStatus
        Update the info above the time-slider with info
        on current dataset or "No forecast"-text
        *********************************************/
        _updateModalDisplayStatus: function(){
            this.timeoutId = null;

            if (!this.timeSlider) return;

            let map        = this.elements.map,
                latLng     = map ? map.getCenter() : null,
                isOverLand = map ? map.isOverLand(latLng) : null;


            if (map){
                this.list.forEach( dataset => {
                    dataset._setModalDisplayStatus(latLng, isOverLand);
                    dataset._updateGridSpan(latLng, isOverLand);
                }, this);

                //Use _timeSlider_onChange to update displayStatus
                this._timeSlider_onChange(this.timeSlider.result);
            }
        },


        /*********************************************
        updatePolygonIcons
        *********************************************/
        updatePolygonIcons: function(){
            if (this.bsModal)
                $.each( this.datasets, function(id, dataset){
                    //Find the accordion header of the dataset and toggle modernizr dataset-with-polygon-X
                    const $accordionHeader = this.bsModal.bsModal && !dataset.isGlobal ? this.bsModal.bsModal.$body.find('.show-for-dataset-with-polygon-'+dataset.index).parent() : null;
                    if ($accordionHeader)
                        $accordionHeader.modernizrToggle('dataset-with-polygon-'+dataset.index, dataset.hasPolygon);
                }.bind(this) );
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
            let backgroundId = options.backgroundId || 'standard';

            e.map.setBackground(backgroundId);

            e.map.isVisibleInMultiMaps = true; //Needed to fire 'color' event....
            if (options.timeRange)
                e.map.backgroundLandLayer.on('color', this.updateModalDisplayStatus.bind(this) );

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

            //Unknown to Niel sHolt, but this is the working way to sort the list correct
            this.list.sort( (ds1, ds2) => { return ds1.options.sequence_id - ds2.options.sequence_id; } );  //Regional -> local
            this.list.reverse();

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
            }, this);

            //Add polygon (if not disabled and not global) to the overview map
            this.list.forEach( dataset => {
                if (dataset.include)
                    dataset.addToMap();
             });

            let footer = null;
            if (options.bounds){
                //Construct a map-outline in the footer
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
                        handle          : 'down',
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

                //Create position and time info for the different no-forecast situations
                this.modalDisplayStatusElement = {};

                let noForecast = {icon: 'far fa-ban', text: {da:'Ingen prognoser', en: 'No forecasts'}},
                    overLand   = {icon: [['fas fa-square-full fa-map-'+backgroundId+'-land', 'far fa-square-full']], text: {da:'Over land', en: 'Over land'}},
                    overOcean  = {icon: [['fas fa-square-full fa-map-'+backgroundId+'-water', 'far fa-square-full']], text: {da:'Over hav', en: 'Over sea'}};
                //There is no dataset covering the position
                this.modalDisplayStatusElement[mdsOutside] = noForecast;

                //The map center is over land for a ocean parameter
                this.modalDisplayStatusElement[mdsOverLand] = this.isGlobal ? overLand : [noForecast, '/', overLand];

                //The map center is over the ocean for a land parameter
                this.modalDisplayStatusElement[mdsOverOcean] = this.isGlobal ? overOcean : [noForecast, '/', overOcean];

                //The time-range do not include the current time
                this.modalDisplayStatusElement[mdsTimeRange] = {icon: 'far fa-clock', text: {da:'Ingen prognoser for valgte tidspunkt', en: 'No forecasts for selected time'}};

                $.each(this.modalDisplayStatusElement, (mdsId, opt) => {
                    this.modalDisplayStatusElement[mdsId] = $('<div></div>')
                                                .addClass('d-inline-block')
                                                ._bsAddHtml(opt)
                                                .appendTo($timeInfoContainer);
                }, this);


                if (options.timeColor){
                    //Add past, now and future colors
                    if (options.timeColor.past)
                        gridColors.push( {fromValue: options.timeRange[0], value: 0, color: options.timeColor.past});
                    if (options.timeColor.now)
                        timeSliderOptions.labelColors = [{value:0, backgroundColor: options.timeColor.now, color: options.timeColor.nowText || 'black'}];
                    if (options.timeColor.future)
                        gridColors.push( {fromValue: 0, value: options.timeRange[1], color: options.timeColor.future });
                }


                if (gridColors.length)
                    timeSliderOptions.gridColors = gridColors;

                this.timeSlider = $input.timeSlider(timeSliderOptions).data('timeSlider');

                accordionChildren.push({
                    icon   : 'fas fa-plus-large',
                    text   : {da:'Prognoser der dækker kortets midtpunkt', en: 'Forecasts covering the map center'},
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

                    remove    : true,
                    helpId    : this.options.helpId,
                    helpButton: true
                };

            return result;
        },
    };


}(jQuery, L, this.i18next, this.moment, this, document));