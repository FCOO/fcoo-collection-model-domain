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