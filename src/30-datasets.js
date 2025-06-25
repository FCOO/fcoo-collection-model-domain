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