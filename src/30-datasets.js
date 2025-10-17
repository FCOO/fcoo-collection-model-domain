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
                        'z-index': 1000 - this.options.sequence_id,
'top': '-' + this.$colorSpan.height() + 'px'
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