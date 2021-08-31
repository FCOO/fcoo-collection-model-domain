/****************************************************************************
fcoo-metoc-load.js,

Method to load all data regarding models, domains, domain-groups

There are two ways to load and create models and domain-groups
1: Set fcoo.model.includeModel = true before the fcoo.promiseList is resolved, or
2: Call fcoo.model.create( options (optional) )

****************************************************************************/
(function ($, window/*, document, undefined*/) {
    "use strict";

    //Create fcoo-namespace
    var ns = window.fcoo = window.fcoo || {},
        nsModel = ns.model = ns.model || {},
        nsParameter = ns.parameter = ns.parameter || {};


    /****************************************************************************
    nsModel.create(options)
    Set options and creates and loads models and domain-groups
    ****************************************************************************/
    nsModel.create = function(options = {}){
        var nsModelOptions = nsModel.options = $.extend(true, nsModel.options, options);

        //Create and load modelList
        nsModel.modelList = new nsModel.ModelList();
        ns.promiseList.append({
            fileName: {subDir: nsModelOptions.modelList.dataSubDir, fileName: nsModelOptions.modelList.dataFileName},
            resolve : $.proxy(nsModel.ModelList.prototype.resolve, nsModel.modelList)
        });

        //Create and load domainGroupList
        nsModel.domainGroupList = nsModel.domainGroupList || new window.fcoo.model.DomainGroupList();
        ns.promiseList.append({
            fileName: {subDir: nsModelOptions.domainGroupList.dataSubDir, fileName: nsModelOptions.domainGroupList.dataFileName},
            resolve : $.proxy(nsModel.DomainGroupList.prototype.resolve, nsModel.domainGroupList)
        });

        //Load and update relations between parameters and domainGroups
        ns.promiseList.append({
            fileName: {subDir: nsModelOptions.domainGroupList.dataSubDir, fileName: nsModelOptions.domainGroupList.parameterFileName},
            resolve : function( data ){
                $.each(nsParameter, function(index, parameter){
                    if (parameter instanceof nsParameter.Parameter)
                        parameter._getDomainGroup(data);
                });
            }
        });
    };


    /****************************************************************************
    Adding a 'empty' promise to fcoo.promiseList to detect if models and
    domain-groups should be loaded
    ****************************************************************************/
    ns.promiseList.appendFirst({
        data: {},
        resolve: function(){
            if (nsModel.options.includeModel)
                nsModel.create();
        }
    });

}(jQuery, this, document));