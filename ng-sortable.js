/**
 * @author RubaXa <trash@rubaxa.org>
 * @licence MIT
 */
(function (factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define(['angular', './Sortable'], factory);
  }
  else if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
    require('angular');
    factory(angular, require('./Sortable'));
    module.exports = 'ng-sortable';
  }
  else if (window.angular && window.Sortable) {
    factory(angular, Sortable);
  }
})(function (angular, Sortable) {
  'use strict';


  /**
   * @typedef   {Object}        ngSortEvent
   * @property  {*}             model      List item
   * @property  {Object|Array}  models     List of items
   * @property  {number}        oldIndex   before sort
   * @property  {number}        newIndex   after sort
   */

  var expando = 'Sortable:ng-sortable';

  angular.module('ng-sortable', [])
    .constant('ngSortableVersion', '0.4.0')
    .constant('ngSortableConfig', {})
    .directive('ngSortable', ['$parse', 'ngSortableConfig', '$rootScope', '$q', function ($parse, ngSortableConfig, $rootScope, $q) {
      var removed,
        nextSibling,
        models = [],
        curView = '',
        getSourceFactory = function getSourceFactory(el, scope, options, attr) {
          var deferred = $q.defer();
          //console.log('getSourceFactory: ', options);
          if ( $rootScope.debugInfoEnabled === true ) {

            var ngRepeat = [].filter.call(el.childNodes, function (node) {
              //console.log('ngRepeat filter node',node);
              return (
                (node.nodeType === 8) &&
                (node.nodeValue.indexOf('ngRepeat:') !== -1)
              );
            })[0];

            if (!ngRepeat) {
              //console.log('no ng repeat')
              // Without ng-repeat
              deferred.resolve(
                function () {
                  return null;
                }
              );
            }

            // tests: http://jsbin.com/kosubutilo/1/edit?js,output
            ngRepeat = ngRepeat.nodeValue.match(/ngRepeat:\s*(?:\(.*?,\s*)?([^\s)]+)[\s)]+in\s+([^\s|]+)/);


            var itemsExpr = $parse(ngRepeat[2]);
            var result = function () {
              return itemsExpr(scope.$parent) || [];
            };

            deferred.resolve(result);
          }
          else {

            var processModels = function() {

              if (options.hasOwnProperty('curView') ) {

                curView = options.curView;
              }

              if ( models.length > 0 ) {

                var subList = [];

                if (curView === 'tags') {

                  models.map(function(list){
                    if ( list.name === attr.listName ) {
                      subList = list.cards;
                      return false;
                    }
                  });
                }
                else if (
                  curView === 'grid'
                  || curView === 'list'
                  || curView === 'edit'
                ) {

                  //console.log('el',el);

                  models.map(function(card) {
                    subList.push(card);
                    return false;
                  });
                }

                //console.log('here A');
                return function () {

                  return subList;
                };

              }
              else {
                //console.log('here B');

                return function () {
                  return null;
                };
              }
            };

            if ( options.hasOwnProperty('getModels') ) {

              //console.log(options, el.children.length);

              options.getModels()
                .then(function(_models){
                  //console.log('it has $loaded',_models);
                  models = _models;
                  //console.log('models',models);
                })
                .then(function(){
                  deferred.resolve( processModels() );
                });
            }
            else {
              //console.log('no getModels found');

              deferred.resolve( processModels() );


            }
          }

          return deferred.promise;
        };


      // Export
      return {
        restrict: 'AC',
        scope: { ngSortable: "=?" },
        link: function (scope, $el, attr) {

          // console.log('ng-sortable',scope.ngSortable);
          // console.log('$el',$el);
          var options = angular.extend(scope.ngSortable || {}, ngSortableConfig);

          if (options.disabled) {

            $el.addClass('sortable-disabled');
            return false;
          }

          getSourceFactory($el[0], scope, options, attr)
            .then(function(_getSource){

            //var dbon = $rootScope.debugInfoEnabled === true;





            //console.log($el[0], options);
            var el = $el[0],
              watchers = [],
              getSource = _getSource,//getSourceFactory(el, scope, options, attr),
              sortable
            ;

            //console.log('getSource',getSource);
            el[expando] = getSource;

            function _emitEvent(/**Event*/evt, /*Mixed*/item) {
              var name = 'on' + evt.type.charAt(0).toUpperCase() + evt.type.substr(1);
              var source = getSource();
              //console.log('name',name);

              /* jshint expr:true */
              options[name] && options[name]({
                model: item || source[evt.newIndex],
                models: source,
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex,
                from: evt.from,
                to: evt.to,
                item: evt.item
              });

              //console.log('options[name]',options[name]);
            }

            function _sync(/**Event*/evt) {
              var items = getSource();
              if (!items) {
                // Without ng-repeat
                return;
              }


              var oldIndex = evt.oldIndex,
                newIndex = evt.newIndex;

              if (el !== evt.from) {
                var prevItems = evt.from[expando]();

                removed = prevItems[oldIndex];

                if (evt.clone) {
                  removed = angular.copy(removed);
                  prevItems.splice(Sortable.utils.index(evt.clone), 0, prevItems.splice(oldIndex, 1)[0]);
                  evt.from.removeChild(evt.clone);
                }
                else {
                  prevItems.splice(oldIndex, 1);
                }

                items.splice(newIndex, 0, removed);

                evt.from.insertBefore(evt.item, nextSibling); // revert element
              }
              else {
                items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);
              }

              scope.$apply();
            }


            sortable = Sortable.create(el, Object.keys(options).reduce(function (opts, name) {
              opts[name] = opts[name] || options[name];
              return opts;
            }, {
              onStart: function (/**Event*/evt) {
                nextSibling = evt.item.nextSibling;
                _emitEvent(evt);
                scope.$apply();
              },
              onEnd: function (/**Event*/evt) {
                _emitEvent(evt, removed);
                scope.$apply();
              },
              onAdd: function (/**Event*/evt) {
                _sync(evt);
                _emitEvent(evt, removed);
                scope.$apply();
              },
              onUpdate: function (/**Event*/evt) {
                _sync(evt);
                _emitEvent(evt);
              },
              onRemove: function (/**Event*/evt) {
                _emitEvent(evt, removed);
              },
              onSort: function (/**Event*/evt) {
                _emitEvent(evt);
              }
            }));

            $el.on('$destroy', function () {
              angular.forEach(watchers, function (/** Function */unwatch) {
                unwatch();
              });

              sortable.destroy();

              el[expando] = null;
              el = null;
              watchers = null;
              sortable = null;
              nextSibling = null;
            });

            angular.forEach([
              'sort', 'disabled', 'draggable', 'handle', 'animation', 'group', 'ghostClass', 'filter',
              'onStart', 'onEnd', 'onAdd', 'onUpdate', 'onRemove', 'onSort'
            ], function (name) {
              watchers.push(scope.$watch('ngSortable.' + name, function (value) {
                if (value !== void 0) {
                  options[name] = value;

                  if (!/^on[A-Z]/.test(name)) {
                    sortable.option(name, value);
                  }
                }
              }));
            });
          });
        }
      };
    }]);
});
