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