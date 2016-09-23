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
		.directive('ngSortable', ['$parse', 'ngSortableConfig', '$rootScope', function ($parse, ngSortableConfig, $rootScope) {
			var removed,
				nextSibling,
        models = [],
				getSourceFactory = function getSourceFactory(el, scope, options, attr) {
          //console.log('getSourceFactory');
          if($rootScope.debugInfoEnabled === true) {
            var ngRepeat = [].filter.call(el.childNodes, function (node) {
              //console.log('ngRepeat filter node',node);
              return (
  								(node.nodeType === 8) &&
  								(node.nodeValue.indexOf('ngRepeat:') !== -1)
  							);
  					})[0];

  					if (!ngRepeat) {
  						// Without ng-repeat
  						return function () {
  							return null;
  						};
  					}

  					// tests: http://jsbin.com/kosubutilo/1/edit?js,output
  					ngRepeat = ngRepeat.nodeValue.match(/ngRepeat:\s*(?:\(.*?,\s*)?([^\s)]+)[\s)]+in\s+([^\s|]+)/);

            //console.log('ngRepeat',ngRepeat);

            var itemsExpr = $parse(ngRepeat[2]);

            // console.log('el', attr.listName);
            // console.log('itemsExpr',itemsExpr(scope.$parent));

            return function () {

  						return itemsExpr(scope.$parent) || [];
  					};
          }
          else {
            //console.log('el', attr.listName);

            if ( options.hasOwnProperty('getModels') ) {

              models = options.getModels();
              //console.log('getModels', options.getModels());
            }
            else {

              if ( models.length > 0 ) {

                var subList = [];

                models.map(function(list){

                  if ( list.name === attr.listName ) {
                    //console.log(list.cards);
                    subList = list.cards;
                    return false;
                  }
                });
                //console.log('subList', subList);
                return function () {
                  return subList;
                };

              }
              else {

                return function () {
                  return null;
                };
              }
            }
          }
				};


			// Export
			return {
				restrict: 'AC',
				scope: { ngSortable: "=?" },
				link: function (scope, $el, attr) {

					var options = angular.extend(scope.ngSortable || {}, ngSortableConfig);
          //console.log('options', options);
					if (options.disabled) {
						$el.addClass('sortable-disabled');
						return false;
					}


					var el = $el[0],
						watchers = [],
						getSource = getSourceFactory(el, scope, options, attr),
						sortable
					;


					el[expando] = getSource;

					function _emitEvent(/**Event*/evt, /*Mixed*/item) {

						var name = 'on' + evt.type.charAt(0).toUpperCase() + evt.type.substr(1);
						var source = getSource();

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
				}
			};
		}]);
});
