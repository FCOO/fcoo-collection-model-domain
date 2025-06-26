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