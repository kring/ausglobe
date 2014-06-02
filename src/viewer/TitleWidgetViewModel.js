"use strict";

/*global require,Cesium*/

var defined = Cesium.defined;
var defineProperties = Cesium.defineProperties;
var createCommand = Cesium.createCommand;
var knockout = Cesium.knockout;

var TitleWidgetViewModel = function(options) {
    this.title = 'National Map';
    this.menuItems = options.menuItems.map(function(item) {
        return {
            label : item.label,
            uri : item.uri,
            target : item.target,
            callback : item.callback
        };
    });

    var that = this;
    this._selectMenuItem = createCommand(function(menuItem) {
        if (defined(menuItem.callback)) {
            return menuItem.callback();
        }
        return true;
    });

    knockout.track(this, ['title', 'menuItems']);
};

defineProperties(TitleWidgetViewModel.prototype, {
    selectMenuItem : {
        get : function() {
            return this._selectMenuItem;
        }
    }
});

module.exports = TitleWidgetViewModel;

