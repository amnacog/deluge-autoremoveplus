/*
Script: autoremoveplus.js
    The client-side javascript code for the AutoRemove plugin.

Copyright:
    (C) 2014-2016 Omar Alvarez <osurfer3@hotmail.com>
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3, or (at your option)
    any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, write to:
        The Free Software Foundation, Inc.,
        51 Franklin Street, Fifth Floor
        Boston, MA  02110-1301, USA.

    In addition, as a special exception, the copyright holders give
    permission to link the code of portions of this program with the OpenSSL
    library.
    You must obey the GNU General Public License in all respects for all of
    the code used other than OpenSSL. If you modify file(s) with this
    exception, you may extend this exception to your version of the file(s),
    but you are not obligated to do so. If you do not wish to do so, delete
    this exception statement from your version. If you delete this exception
    statement from all source files in the program, then also delete it here.
*/

Ext.namespace('Deluge.plugins.autoremoveplus.ui');
Ext.namespace('Deluge.plugins.autoremoveplus.util');

if (typeof(console) === 'undefined') {
  console = {
    log: function() {}
  };
}

Deluge.plugins.autoremoveplus.PLUGIN_NAME = 'AutoRemovePlus';
Deluge.plugins.autoremoveplus.MODULE_NAME = 'autoremoveplus';
Deluge.plugins.autoremoveplus.DISPLAY_NAME = _('AutoRemovePlus');
Deluge.plugins.autoremoveplus.CHECK_PRECISION = 4;

Deluge.plugins.autoremoveplus.util.isNumber = function(obj) {

  return !isNaN(parseFloat(obj))

};

Deluge.plugins.autoremoveplus.util.setdefault = function(obj, prop, deflt) {

  return obj.hasOwnProperty(prop) ? obj[prop] : (obj[prop] = deflt);

};

Deluge.plugins.autoremoveplus.util.arrayEquals = function(a, b) {

    if (a.length != b.length)
        return false;

    for (var i = 0; i < b.length; i++) {

      // recurse into the nested arrays
      if (a[i] instanceof Array && b[i] instanceof Array)
        if (!Deluge.plugins.autoremoveplus.util.arrayEquals(a[i], b[i]))
          return false;
      else if(Deluge.plugins.autoremoveplus.util.isNumber(a[i])
        && Deluge.plugins.autoremoveplus.util.isNumber(b[i]))
          if (a[i].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION)
            !== b[i].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION))
            return  false;
        else if (a[i] !== b[i])
          return false;

    }

    return true;

};

Deluge.plugins.autoremoveplus.util.dictEquals = function(a, b) {

  var keysA = Ext.keys(a);
  var keysB = Ext.keys(b);

  if (keysA.length != keysB.length)
      return false;

  for (var i = 0; i < keysB.length; i++) {

    var key = keysA[i];

    if (key in b) {
      if (a[key] instanceof Array && b[key] instanceof Array)
        if (!Deluge.plugins.autoremoveplus.util.arrayEquals(a[key], b[key])) {
          return false;
        } else {
          if(Deluge.plugins.autoremoveplus.util.isNumber(a[key])
            && Deluge.plugins.autoremoveplus.util.isNumber(b[key]))
              if (a[key].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION)
                !== b[key].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION))
                return false;
            else if (a[key] !== b[key])
                return false;
        }
    } else {
      return false;
    }

  }

  return true;

};

Deluge.plugins.autoremoveplus.util.dictToArray = function(dict) {

  data = [];
  var keys = Ext.keys(dict);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    data.push([key,dict[key]]);
  }

  return data;

};

Deluge.plugins.autoremoveplus.ui.PreferencePage = Ext.extend(Ext.TabPanel, {

    title: Deluge.plugins.autoremoveplus.DISPLAY_NAME,

    activeTab: 0,

    initComponent: function() {

        Deluge.plugins.autoremoveplus.ui.PreferencePage.superclass.initComponent
          .call(this);

        // create reusable renderer
        Ext.util.Format.comboRenderer = function(combo){
          return function(value){
              var record = combo.findRecord(combo.valueField, value);
              return record ? record.get(combo.displayField) : combo.valueNotFoundText;
          }
        }

        this.genSettingsBox = this.add({
            title: 'General Settings',
            xtype: 'panel',
            layout: {
              type: 'vbox',
              align: 'stretch'
            }
        });

        this.specSettingsBox = this.add({
            title: 'Specific Remove Rules',
            xtype: 'panel',
            layout: {
              type: 'vbox',
              align: 'stretch'
            }
        });
        
        this.mediaSettingsBox = this.add({
            title: 'Media Servers',
            xtype: 'panel',
            layout: {
              type: 'vbox',
              align: 'stretch'
            }
        });
		
		this.mediaPanel = this.mediaSettingsBox.add({
              xtype: 'container',
              layout: 'hbox',
              margins: '5 5 8 5',
              items: [
				{
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('On this tab you can configure PVR-server integration, for now it supports sonarr, radarr and lidarr. If the corresponding server is enabled, removing a torrent from deluge will also blacklist it from the upstream server, so that it\'s not downloaded again. Do this with the Remove and Blacklist option in right-click menu. Don\'t want this: just don\'t enable any servers.')
				}],
          });
		
        this.sonarrContainer = this.mediaSettingsBox.add({
              xtype: 'container',
              layout: 'hbox',
              margins: '5 5 8 5',
              items: [{
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Sonarr: ')
              },
              {
                  xtype: 'checkbox',
                  name: 'chkSonarr',
                  margins: '5 0 0 5',
                  boxLabel: _('Enable')
              },
              {
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Endpoint URL: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtEndpointSonarr',
                  fieldLabel: _('sonarrEndpoint')
              },
              {
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('api-key: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtApiSonarr',
                  fieldLabel: _('sonarrApiKey')
              }]
          });

        this.radarrContainer = this.mediaSettingsBox.add({
              xtype: 'container',
              layout: 'hbox',
              margins: '5 5 8 5',
              items: [{
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Radarr: ')
              },
              {
                  xtype: 'checkbox',
                  name: 'radarrEnabled',
                  margins: '5 0 0 5',
                  boxLabel: _('Enable')
              },
              {
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Endpoint URL: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtEndpointRadarr',
                  fieldLabel: _('radarrEndpoint')
              },
              {
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('api-key: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtApiRadarr',
                  fieldLabel: _('radarrApiKey')
              }]
          });		
            
        this.lidarrContainer = this.mediaSettingsBox.add({
              xtype: 'container',
              layout: 'hbox',
              margins: '5 5 8 5',
              items: [{
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Lidarr: ')
              },
              {
                  xtype: 'checkbox',
                  name: 'lidarrEnabled',
                  margins: '5 0 0 5',
                  boxLabel: _('Enable')
              },
              {
                  xtype: 'label',
                  margins: '5 5 0 0',
                  text: _('Endpoint URL: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtEndpointLidarr',
                  fieldLabel: _('lidarrEndpoint')
              },
              {
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('api-key: ')
              },
              {
                  xtype: 'textfield',
                  name: 'txtApiLidarr',
                  fieldLabel: _('lidarrApiKey')
              }]
          });
        
        this.testButtonContainer = this.mediaSettingsBox.add({
                xtype: 'container',
                layout: 'hbox',
                margins: '4 0 0 5',
                items: [
                {
                    xtype: 'button',
                    text: '  Test  ',
                    margins: '0 5 0 0'
                },
                {
                    xtype: 'displayfield',
                    fieldLabel: _('testDisplay'),
                    name: 'testDisplay',
                    value: ''
                }
                ]
            });
            
        this.chkEnabled = this.genSettingsBox.add({
          xtype: 'checkbox',
          margins: '0 0 0 5',
          boxLabel: _('Enable')
        });

        this.intervalContainer = this.genSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '5 5 8 5',
            items: [{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Check interval (hours): '),
                flex: 0.4
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'checkInterval',
                fieldLabel: _('Check every'),
                value: 1.0,
                maxValue: 1000.0,
                minValue: 0.01,
                allowDecimals: true,
                decimalPrecision: 2,
                incrementValue: 0.1,
                alternateIncrementValue: 0.5,
                flex: 0.2
            }]
        });

        this.maxSeedsContainer = this.genSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '0 5 8 5',
            items: [{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Maximum torrents: '),
                flex: 0.4
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'maxseedtorrents',
                fieldLabel: _('Maximum Torrents'),
                value: 0,
                maxValue: 9999,
                minValue: 0,
                flex: 0.2
            }]
        });


        this.maxSeedTimePauseContainer = this.genSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '0 5 8 5',
            items: [{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Pause after seedtime (hours)'),
                flex: 0.4
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'seedtime_pause',
                fieldLabel: _('Pause after seedtime (h)'),
                value: 24,
                maxValue: 9999,
                minValue: 1,
                flex: 0.2
            }]
        });
        
        this.maxSeedTimeRemoveContainer = this.genSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '0 5 8 5',
            items: [{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Remove after seedtime (hours)'),
                flex: 0.4
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'seedtime_limit',
                fieldLabel: _('Remove after seedtime (h)'),
                value: 48,
                maxValue: 9999,
                minValue: 1,
                flex: 0.2
            }]
        });
        this.minHDDSpaceContainer = this.genSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '0 5 8 5',
            items: [{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Minimum drive space (GB, -1 for infinite): '),
                flex: 0.4
            },{
                xtype: 'spinnerfield',
                name: 'minHDDSpace',
                fieldLabel: _('Min. drive space'),
                value: -1.0,
                maxValue: 10000.0,
                minValue: -1.0,
                allowDecimals: true,
                decimalPrecision: 3,
                incrementValue: 0.5,
                alternateIncrementValue: 1.0,
                flex: 0.2
            }]
        });

        this.rule1Container = this.genSettingsBox.add({
          xtype: 'container',
          layout: {
            type: 'hbox',
            align: 'middle'
          },
          margins: '0 5 8 5',
          items: [{
            xtype: 'checkbox',
            //margins: '0 2 0 0',
            flex: 0.05
          }],
          autoHeight: true
        });

        this.removeByContainer = this.rule1Container.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '5 0 0 0',
            flex: 0.95,
            items: [{
                xtype: 'combo',
                margins: '0 8 0 0',
                mode: 'local',
                valueField: 'func_id',
                displayField: 'func_name',
                //value: 0,
                editable: false,
                disabled: true,
                triggerAction: 'all',
               // autoWidth: true,
                //boxMaxWidth: 20,
                flex: 0.24
            },{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Remove by: ')
            },{
                xtype: 'combo',
                margins: '0 8 0 0',
                mode: 'local',
                store: new Ext.data.ArrayStore({
	                autoDestroy: true,
	                idIndex: 0,
	                fields: ['func_id','func_name']
            	}),
            	valueField: 'func_id',
    			    displayField: 'func_name',
                //value: 0,
                editable: true,
                triggerAction: 'all',
               // autoWidth: true,
                //boxMaxWidth: 20,
                flex: 0.43
            },{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Under: ')
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'min',
                fieldLabel: _('Under'),
                value: 0.0,
                maxValue: 10000.0,
                minValue: 0.0,
                allowDecimals: true,
                decimalPrecision: 3,
                incrementValue: 0.5,
                alternateIncrementValue: 1.0,
                flex: 0.35
            }]
        });

        this.rule2Container = this.genSettingsBox.add({
          xtype: 'container',
          layout: {
            type: 'hbox',
            align: 'middle'
          },
          margins: '0 5 8 5',
          items: [{
            xtype: 'checkbox',
            //margins: '0 2 0 0',
            flex: 0.05
          }],
          autoHeight: true
        });

        this.removeByContainer2 = this.rule2Container.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '5 0 0 0',
            flex: 0.95,
            items: [{
                xtype: 'combo',
                margins: '0 8 0 0',
                mode: 'local',
                store: [
                    'and',
                    'or',
                    'xor'
                ],
                //valueField: 'func_id',
                //displayField: 'func_name',
                value: 0,
                editable: true,
                triggerAction: 'all',
               // autoWidth: true,
                //boxMaxWidth: 20,
                flex: 0.24
            },{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Remove by: ')
            },{
                xtype: 'combo',
                margins: '0 8 0 0',
                mode: 'local',
                store: new Ext.data.ArrayStore({
                    autoDestroy: true,
                    idIndex: 0,
                    fields: ['func_id','func_name']
                }),
                valueField: 'func_id',
                displayField: 'func_name',
                //value: 0,
                editable: true,
                triggerAction: 'all',
               // autoWidth: true,
                //boxMaxWidth: 20,
                flex: 0.43
            },{
                xtype: 'label',
                margins: '5 5 0 0',
                text: _('Over: ')
            },{
                xtype: 'spinnerfield',
                //anchor: '20%',
                //margins: '0 0 0 0',
                name: 'min2',
                fieldLabel: _('Over'),
                value: 0.0,
                maxValue: 10000.0,
                minValue: 0.5,
                allowDecimals: true,
                decimalPrecision: 3,
                incrementValue: 0.5,
                alternateIncrementValue: 1.0,
                flex: 0.35
            }]
        });

        this.labelExTrackers = this.specSettingsBox.add({
          xtype: 'label',
          margins: '5 0 0 5',
          text: _('Exemption Rules:')
        });

        this.tblTrackers = this.specSettingsBox.add({
            xtype: 'editorgrid',
            margins: '2 0 0 5',
            flex: 1,
            autoExpandColumn: 'name',

            viewConfig: {
                emptyText: _('Add a tracker to exempt...'),
                deferEmptyText: false
            },

            colModel: new Ext.grid.ColumnModel({
                columns: [{
                    id: 'type',
                    header: _('Type'),
                    dataIndex: 'type',
                    sortable: true,
                    hideable: false,
                    editable: true,
                    editor: {
                      xtype: 'combo',
                      store: ['Tracker','Label']
                    }
                },{
                    id: 'name',
                    header: _('Name'),
                    dataIndex: 'name',
                    sortable: true,
                    hideable: false,
                    editable: true,
                    editor: {
                      xtype: 'textfield'
                    }
                }]
            }),

            selModel: new Ext.grid.RowSelectionModel({
                singleSelect: false,
                moveEditorOnEnter: false
            }),

            store: new Ext.data.ArrayStore({
                autoDestroy: true,
                fields: [
                  {name: 'type'},
                  {name: 'name'}
                ]
            }),

            listeners: {
                afteredit: function(e) {
                    e.record.commit();
                }
            },

            setEmptyText: function(text) {
                if (this.viewReady) {
                  this.getView().emptyText = text;
                  this.getView().refresh();
                } else {
                  Ext.apply(this.viewConfig, {emptyText: text});
                }
            },

            loadData: function(data) {
                this.getStore().loadData(data);
                if (this.viewReady) {
                  this.getView().updateHeaders();
                }
            }

        });

        this.trackerButtonsContainer = this.specSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '4 0 0 5',
            items: [{
                xtype: 'button',
                text: ' Add Exemption ',
                margins: '0 5 0 0'
            }, {
                xtype: 'button',
                text: ' Delete Exemption '
            }]
        });

        this.chkExemptCount = this.specSettingsBox.add({
          xtype: 'checkbox',
          margins: '5 0 0 5',
          boxLabel: _('Exempted torrents count toward maximum')
        });

        this.chkRemove = this.genSettingsBox.add({
          xtype: 'checkbox',
          margins: '5 0 0 5',
          boxLabel: _('Remove torrents')
        });

        this.chkRemoveData = this.genSettingsBox.add({
          xtype: 'checkbox',
          margins: '5 0 0 5',
          boxLabel: _('Remove torrent data')
        });

        this.chkPause = this.genSettingsBox.add({
          xtype: 'checkbox',
          margins: '5 0 0 5',
          boxLabel: _('Pause torrents')
        });
        
        this.chkRemoveSeedData = this.genSettingsBox.add({
          xtype: 'checkbox',
          margins: '5 0 0 5',
          boxLabel: _('Remove torrent data also for completed torrents')
        });

        this.combo = new Ext.form.ComboBox({
          store: new Ext.data.ArrayStore({
              autoDestroy: true,
              idIndex: 0,
              fields: ['func_id','func_name']
              //data: this.rule_data
          }),
          mode: 'local',
          //store: this.rule_names,
          valueField: 'func_id',
          displayField: 'func_name',
          //value: 0,
          editable: true,
          triggerAction: 'all',
          listeners: {
              blur: function(combo) {
                combo.store.clearFilter();
              }
          }
        });

        this.tblRules = this.specSettingsBox.add({
            xtype: 'editorgrid',
            margins: '2 0 0 5',
            flex: 1,
            autoExpandColumn: 'name',

            viewConfig: {
                emptyText: _('Add a rule...'),
                deferEmptyText: false
            },

            colModel: new Ext.grid.ColumnModel({
                columns: [{
                    id: 'type',
                    header: _('Type'),
                    dataIndex: 'type',
                    sortable: true,
                    hideable: false,
                    editable: true,
                    editor: {
                      xtype: 'combo',
                      store: ['Tracker','Label']
                    }
                },{
                    id: 'name',
                    header: _('Name'),
                    dataIndex: 'name',
                    sortable: true,
                    hideable: false,
                    editable: true,
                    editor: {
                      xtype: 'textfield'
                    }
                },{
                  id: 'op',
                  header: _('Operator'),
                  dataIndex: 'op',
                  sortable: true,
                  hideable: false,
                  editable: true,
                  editor: {
                    xtype: 'combo',
                    store: ['and','or']
                  }
                },{
                  id: 'rule',
                  header: _('Remove Rule'),
                  dataIndex: 'rule',
                  sortable: true,
                  hideable: false,
                  editable: true,
                  editor: this.combo,
                  renderer: Ext.util.Format.comboRenderer(this.combo)
                },{
                  id: 'min',
                  header: _('Minimum'),
                  dataIndex: 'min',
                  sortable: true,
                  hideable: false,
                  editable: true,
                  editor: {
                    xtype: 'spinnerfield',
                    value: 0.0,
                    maxValue: 10000.0,
                    minValue: 0.0,
                    allowDecimals: true,
                    decimalPrecision: 3,
                    incrementValue: 0.5,
                    alternateIncrementValue: 1.0
                  }
                }]
            }),

            selModel: new Ext.grid.RowSelectionModel({
                singleSelect: false,
                moveEditorOnEnter: false
            }),

            store: new Ext.data.ArrayStore({
                autoDestroy: true,
                fields: [
                  {name: 'type'},
                  {name: 'name'},
                  {name: 'op'},
                  {name: 'rule'},
                  {name: 'min'}
                ]
            }),

            listeners: {
                afteredit: function(e) {
                    e.record.commit();
                }
            },

            setEmptyText: function(text) {
                if (this.viewReady) {
                  this.getView().emptyText = text;
                  this.getView().refresh();
                } else {
                  Ext.apply(this.viewConfig, {emptyText: text});
                }
            },

            loadData: function(data) {
                this.getStore().loadData(data);
                if (this.viewReady)
                  this.getView().updateHeaders();
            }

        });

        this.rulesButtonsContainer = this.specSettingsBox.add({
            xtype: 'container',
            layout: 'hbox',
            margins: '4 0 0 5',
            items: [{
                xtype: 'button',
                text: ' Add Rule ',
                margins: '0 5 0 0'
            }, {
                xtype: 'button',
                text: ' Delete Rule '
            }]
        });

        this.rulesButtonsContainer.getComponent(0).setHandler(this.addRule, this);
        this.rulesButtonsContainer.getComponent(1).setHandler(this.deleteRule, this);

        this.trackerButtonsContainer.getComponent(0).setHandler(this.addTracker, this);
        this.trackerButtonsContainer.getComponent(1).setHandler(this.deleteTracker, this);
        
        this.testButtonContainer.getComponent(0).setHandler(this.onClickTest, this);
        
        this.chkRemove.on('check', this.onClickRemove, this);
        //this.chkPause.on('check', this.onClickRemoveSeed, this);
        this.chkEnabled.on('check', this.onClickEnabled, this);
        this.rule1Container.getComponent(0).on('check', this.onClickChkRule1, this);
        this.rule2Container.getComponent(0).on('check', this.onClickChkRule2, this);
        
        this.sonarrContainer.getComponent(1).on('check', this.onClickSonarr, this);
        this.radarrContainer.getComponent(1).on('check', this.onClickRadarr, this);
        this.lidarrContainer.getComponent(1).on('check', this.onClickLidarr, this);
                        
        deluge.preferences.on('show', this.loadPrefs, this);
        deluge.preferences.buttons[1].on('click', this.savePrefs, this);
        deluge.preferences.buttons[2].on('click', this.savePrefs, this);
        
        this.waitForClient(10);

    },

    //TODO destroy
    onDestroy: function() {
        this.un('check', this.onClickRemove, this);
        //this.un('check', this.onClickRemoveSeed, this);
        this.un('check', this.onClickEnabled, this);
        this.rule1Container.getComponent(0).un('check', this.onClickChkRule1, this);
        this.rule2Container.getComponent(0).un('check', this.onClickChkRule2, this);
        deluge.preferences.un('show', this.loadPrefs, this);
        deluge.preferences.buttons[1].un('click', this.savePrefs, this);
        deluge.preferences.buttons[2].un('click', this.savePrefs, this);

        Deluge.plugins.autoremoveplus.ui.PreferencePage.superclass.onDestroy.call(this);
    },

    waitForClient: function(triesLeft) {
        if (triesLeft < 1) {
          this.tblTrackers.setEmptyText(_('Unable to load settings'));
          return;
        }

        if (deluge.login.isVisible() || !deluge.client.core ||
            !deluge.client.autoremoveplus) {
          var self = this;
          var t = deluge.login.isVisible() ? triesLeft : triesLeft-1;
          setTimeout(function() { self.waitForClient.apply(self, [t]); }, 1000);
        } else if (!this.isDestroyed) {
          this.loadPrefs();
        }
    },

    addTracker: function() {
        // access the Record constructor through the grid's store
        var store = this.tblTrackers.getStore();
        var Tracker = store.recordType;
        var t = new Tracker({
            name: ''
        });
        this.tblTrackers.stopEditing();
        store.insert(0, t);
        this.tblTrackers.startEditing(0, 0);
    },
    
    onClickTest: function() {
        console.log('onClickTest');
        
        //var server = 
    },
    
    deleteTracker: function() {
        var selections = this.tblTrackers.getSelectionModel().getSelections();
        var store = this.tblTrackers.getStore();

        this.tblTrackers.stopEditing();
        for (var i = 0; i < selections.length; i++)
            store.remove(selections[i]);
        store.commitChanges();
    },

    addRule: function() {
        // access the Record constructor through the grid's store
        var store = this.tblRules.getStore();
        var Rule = store.recordType;
        var t = new Rule({
            name: ''
        });
        this.tblRules.stopEditing();
        store.insert(0, t);
        this.tblRules.startEditing(0, 0);
    },

    deleteRule: function() {
        var selections = this.tblRules.getSelectionModel().getSelections();
        var store = this.tblRules.getStore();

        this.tblRules.stopEditing();
        for (var i = 0; i < selections.length; i++)
            store.remove(selections[i]);
        store.commitChanges();
    },

    onClickRemove: function(checkbox, checked) {
        if (checked)
          this.chkRemoveData.enable();
        else
          this.chkRemoveData.disable();
          console.log(checked);
          console.log('onClickRemove');
    },
    
    onClickRemoveSeed: function(checkbox, checked) {
        if (checked)
          this.chkRemoveSeedData.disable();
        else
          this.chkRemoveSeedData.enable();
          console.log(checked);
          console.log('onClickRemoveSeed');
    },

    enableAllWidgets: function() {

        this.intervalContainer.enable();
        this.maxSeedsContainer.enable();
        this.maxSeedTimeRemoveContainer.enable();
        this.maxSeedTimePauseContainer.enable();
        this.minHDDSpaceContainer.enable();
        this.rule1Container.enable();
        this.rule2Container.enable();
        this.labelExTrackers.enable();
        this.tblTrackers.enable();
        this.trackerButtonsContainer.enable();
        this.chkExemptCount.enable();
        this.chkRemove.enable();
        if (this.chkRemove.getValue())
          this.chkRemoveData.enable();
        else
          this.chkRemoveData.disable();
        this.chkPause.enable();
        this.chkRemoveSeedData.enable();
        this.sonarrContainer.enable();
        this.lidarrContainer.enable();
        this.radarrContainer.enable();
        this.testButtonContainer.enable();
    },

    disableAllWidgets: function() {

        this.intervalContainer.disable();
        this.maxSeedsContainer.disable();
        this.maxSeedTimeRemoveContainer.disable();
        this.maxSeedTimePauseContainer.disable();
        this.minHDDSpaceContainer.disable();
        this.rule1Container.disable();
        this.rule2Container.disable();
        this.labelExTrackers.disable();
        this.tblTrackers.disable();
        this.trackerButtonsContainer.disable();
        this.chkExemptCount.disable();
        this.chkRemove.disable();
        this.chkRemoveData.disable();
        this.chkPause.disable();
        this.chkRemoveSeedData.disable();
        this.sonarrContainer.disable();
        this.lidarrContainer.disable();
        this.radarrContainer.disable();
        this.testButtonContainer.disable();

    },

    onClickEnabled: function(checkbox, checked) {
        if (checked)
          this.enableAllWidgets();
        else
          this.disableAllWidgets();
          //console.log(checked);
          //console.log('onClickRemove');
    },
    
    onClickEnabled: function(checkbox, checked) {
        if (checked)
          this.enableAllWidgets();
        else
          this.disableAllWidgets();
          //console.log(checked);
          //console.log('onClickRemove');
    },

    onClickSonarr: function(checkbox, checked) {
        console.log('onClickSonarr:' + checked)
        
        if (checked){
          this.sonarrContainer.getComponent(2).enable();
          this.sonarrContainer.getComponent(3).enable();
          this.sonarrContainer.getComponent(4).enable();
          this.sonarrContainer.getComponent(5).enable();
        }
        else{
          this.sonarrContainer.getComponent(2).disable();
          this.sonarrContainer.getComponent(3).disable();
          this.sonarrContainer.getComponent(4).disable();
          this.sonarrContainer.getComponent(5).disable();
        }
        //console.log(checked);
        //console.log('onClickRemove');
    },
    
    onClickRadarr: function(checkbox, checked) {
        if (checked){
          this.radarrContainer.getComponent(2).enable();
          this.radarrContainer.getComponent(3).enable();
          this.radarrContainer.getComponent(4).enable();
          this.radarrContainer.getComponent(5).enable();
        }
        else
        {
          this.radarrContainer.getComponent(2).disable();
          this.radarrContainer.getComponent(3).disable();
          this.radarrContainer.getComponent(4).disable();
          this.radarrContainer.getComponent(5).disable();
        }
        //console.log(checked);
        //console.log('onClickRemove');
    },
    
    onClickLidarr: function(checkbox, checked) {
        if (checked){
          this.lidarrContainer.getComponent(2).enable();
          this.lidarrContainer.getComponent(3).enable();
          this.lidarrContainer.getComponent(4).enable();
          this.lidarrContainer.getComponent(5).enable();
        }
        else{
          this.lidarrContainer.getComponent(2).disable();
          this.lidarrContainer.getComponent(3).disable();
          this.lidarrContainer.getComponent(4).disable();
          this.lidarrContainer.getComponent(5).disable();
        }
        //console.log(checked);
        //console.log('onClickRemove');
    },
        
    onClickChkRule1: function(checkbox, checked) {
        if (checked)
          this.removeByContainer.enable();
        else
          this.removeByContainer.disable();
    },

    onClickChkRule2: function(checkbox, checked) {
        if (checked)
          this.removeByContainer2.enable();
        else
          this.removeByContainer2.disable();
    },

    loadPrefs: function() {
        if (deluge.preferences.isVisible()) {
          this._loadPrefs1();
        }
    },

    _loadPrefs1: function() {
        deluge.client.autoremoveplus.get_config({
          success: function(prefs) {
            this.preferences = prefs;
            this.chkExemptCount.setValue(prefs['count_exempt']);
            this.chkRemoveData.setValue(prefs['remove_data']);
            this.chkRemoveSeedData.setValue(prefs['seed_remove_data']);
            this.loadExemptions(prefs['trackers'], prefs['labels']);
            this.loadRules(prefs['tracker_rules'], prefs['label_rules']);
            this.intervalContainer.getComponent(1).setValue(prefs['interval']);
            this.maxSeedsContainer.getComponent(1).setValue(prefs['max_seeds']);
            this.maxSeedTimeRemoveContainer.getComponent(1).setValue(prefs['seedtime_limit']);
            this.maxSeedTimePauseContainer.getComponent(1).setValue(prefs['seedtime_pause']);
            this.minHDDSpaceContainer.getComponent(1).setValue(prefs['hdd_space']);
            this.removeByContainer.getComponent(4).setValue(prefs['min']);
            this.removeByContainer2.getComponent(4).setValue(prefs['min2']);
            this.removeByContainer2.getComponent(0).setValue(prefs['sel_func']);
            this.chkRemove.setValue(prefs['remove']);
            this.chkPause.setValue(prefs['pause_torrents']);
            var enabled = prefs['enabled'];
            this.chkEnabled.setValue(enabled);
            if(enabled)
              this.enableAllWidgets();
            else
              this.disableAllWidgets();
            var rule_1_enabled = prefs['rule_1_enabled'];
            this.rule1Container.getComponent(0).setValue(rule_1_enabled);
            if(rule_1_enabled)
              this.removeByContainer.enable();
            else
              this.removeByContainer.disable();
            var rule_2_enabled = prefs['rule_2_enabled'];
            this.rule2Container.getComponent(0).setValue(rule_2_enabled);
            if(rule_2_enabled)
              this.removeByContainer2.enable();
            else
              this.removeByContainer2.disable();
           //media servers
           this.sonarrContainer.getComponent(1).setValue(prefs['enable_sonarr']);
           this.sonarrContainer.getComponent(3).setValue(prefs['endpoint_sonarr']);
           this.sonarrContainer.getComponent(5).setValue(prefs['api_sonarr']);
           this.radarrContainer.getComponent(1).setValue(prefs['enable_radarr']);
           this.sonarrContainer.getComponent(3).setValue(prefs['endpoint_radarr']);
           this.radarrContainer.getComponent(5).setValue(prefs['api_radarr']);
           this.lidarrContainer.getComponent(1).setValue(prefs['enable_lidarr']);
           this.sonarrContainer.getComponent(3).setValue(prefs['endpoint_lidarr']);
           this.lidarrContainer.getComponent(5).setValue(prefs['api_lidarr']);
          },
          scope: this
        });

        deluge.client.autoremoveplus.get_remove_rules({
          success: function(rules) {

            var data = Deluge.plugins.autoremoveplus.util.dictToArray(rules);

            this.combo.store.loadData(data);

          	var removeBy = this.removeByContainer.getComponent(2);
            var removeBy2 = this.removeByContainer2.getComponent(2);
            var removeByStore = removeBy.getStore();
            var removeByStore2 = removeBy2.getStore();

            removeByStore.loadData(data);
            removeBy.setValue(this.preferences['filter']);
            removeByStore2.loadData(data);
            removeBy2.setValue(this.preferences['filter2']);

          },
          scope: this
        });

    },

    loadExemptions: function(trackers, labels) {
        var store = this.tblTrackers.getStore();

        var data = [];

        var keys = Ext.keys(trackers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            data.push(['Tracker',trackers[key]]);
        }

        keys = Ext.keys(labels);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            data.push(['Label',labels[key]]);
        }

        this.tblTrackers.loadData(data);
    },

    loadRules: function(tracker_rules, label_rules) {
        var store = this.tblRules.getStore();

        var data = [];
        var names = Ext.keys(tracker_rules);
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var keys = Ext.keys(tracker_rules[name]);
            for (var j = 0; j < keys.length; j++) {
              var key = keys[j];
              data.push([
                'Tracker',
                name,
                tracker_rules[name][key][0],
                tracker_rules[name][key][1],
                tracker_rules[name][key][2]
              ]);
            }
        }

        var names = Ext.keys(label_rules);
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var keys = Ext.keys(label_rules[name]);
            for (var j = 0; j < keys.length; j++) {
              var key = keys[j];
              data.push([
                'Label',
                name,
                label_rules[name][key][0],
                label_rules[name][key][1],
                label_rules[name][key][2]
              ]);
            }
        }

        this.tblRules.loadData(data);
        //this.tblRules.loadData(data);

        /*this.tblRules.doLayout();
        this.tblRules.render();*/

    },

    savePrefs: function() {
        var trackerList = [];
        var labelList = [];
        var store = this.tblTrackers.getStore();
        var apply = false;

        for (var i = 0; i < store.getCount(); i++) {
          var record = store.getAt(i);
          var type = record.get('type');
          var name = record.get('name');
          if(!type.localeCompare('Tracker'))
            trackerList.push(name);
          else
            labelList.push(name);
        }

        var trackerRules = {};
        var labelRules = {};
        store = this.tblRules.getStore();

        for (var i = 0; i < store.getCount(); i++) {
          var record = store.getAt(i);
          var type = record.get('type');
          var name = record.get('name');
          var op = record.get('op');
          var rule = record.get('rule');
          var min = record.get('min');
          if(!type.localeCompare('Tracker'))
            Deluge.plugins.autoremoveplus.util
              .setdefault(trackerRules, name, [])
              .push([op, rule, min]);
          else
            Deluge.plugins.autoremoveplus.util
              .setdefault(labelRules, name, [])
              .push([op, rule, min]);
        }

        var filterVal = this.removeByContainer.getComponent(2).getValue();
        var filterVal2 = this.removeByContainer2.getComponent(2).getValue();

        var prefs = {
          remove_data: this.chkRemoveData.getValue(),
          pause_torrents: this.chkPause.getValue(),
          seed_remove_data: this.chkRemoveSeedData.getValue(),
          count_exempt: this.chkExemptCount.getValue(),
          trackers: trackerList,
          labels: labelList,
          max_seeds: this.maxSeedsContainer.getComponent(1).getValue(),
          seedtime_limit: this.maxSeedTimeRemoveContainer.getComponent(1).getValue(),
          seedtime_pause: this.maxSeedTimePauseContainer.getComponent(1).getValue(),
          hdd_space: this.minHDDSpaceContainer.getComponent(1).getValue(),
          filter: filterVal,
          filter2: filterVal2,
          min: this.removeByContainer.getComponent(4).getValue(),
          min2: this.removeByContainer2.getComponent(4).getValue(),
          sel_func: this.removeByContainer2.getComponent(0).getValue(),
          interval: this.intervalContainer.getComponent(1).getValue(),
          remove: this.chkRemove.getValue(),
          enabled: this.chkEnabled.getValue(),
          tracker_rules: trackerRules,
          label_rules: labelRules,
          rule_1_enabled: this.rule1Container.getComponent(0).getValue(),
          rule_2_enabled: this.rule2Container.getComponent(0).getValue(),
          //media servers
          enable_sonarr:  this.sonarrContainer.getComponent(1).getValue(),
          endpoint_sonarr: this.sonarrContainer.getComponent(3).getValue(),
          api_sonarr: this.sonarrContainer.getComponent(5).getValue(),
          enable_radarr: this.radarrContainer.getComponent(1).getValue(),
          endpoint_radarr: this.radarrContainer.getComponent(3).getValue(),
          api_radarr: this.radarrContainer.getComponent(5).getValue(),
          enable_lidarr: this.lidarrContainer.getComponent(1).getValue(),
          endpoint_lidarr: this.sonarrContainer.getComponent(3).getValue(),
          api_lidarr: this.lidarrContainer.getComponent(5).getValue()
        };
        
        apply |= prefs['remove_data'] != this.preferences['remove_data'];
        apply |= prefs['seed_remove_data'] != this.preferences['seed_remove_data'];
        apply |= prefs['count_exempt'] != this.preferences['count_exempt'];
        apply |= prefs['max_seeds'] != this.preferences['max_seeds'];
        apply |= prefs['seedtime_limit'] != this.preferences['seedtime_limit'];
        apply |= prefs['seedtime_pause'] != this.preferences['seedtime_pause'];
        apply |= prefs['hdd_space'] != this.preferences['hdd_space'];
        apply |= prefs['filter'] != this.preferences['filter'];
        apply |= prefs['filter2'] != this.preferences['filter2'];
        apply |= prefs['min'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION)
          != this.preferences['min'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION);
        apply |= prefs['min2'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION)
          != this.preferences['min2'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION);
        apply |= prefs['sel_func'] != this.preferences['sel_func'];
        apply |= prefs['interval'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION)
          != this.preferences['interval'].toFixed(Deluge.plugins.autoremoveplus.CHECK_PRECISION);
        apply |= prefs['remove'] != this.preferences['remove'];
        apply |= prefs['pause_torrents'] != this.preferences['pause_torrents'];
        apply |= prefs['enabled'] != this.preferences['enabled'];
        apply |= prefs['rule_1_enabled'] != this.preferences['rule_1_enabled'];
        apply |= prefs['rule_2_enabled'] != this.preferences['rule_2_enabled'];
        //media servers
        apply |= prefs['enable_sonarr'] != this.preferences['enable_sonarr'];
        apply |= prefs['enable_radarr'] != this.preferences['enable_radarr'];
        apply |= prefs['enable_lidarr'] != this.preferences['enable_lidarr'];
        apply |= prefs['endpoint_sonarr'] != this.preferences['endpoint_sonarr'];
        apply |= prefs['endpoint_radarr'] != this.preferences['endpoint_radarr'];
        apply |= prefs['endpoint_lidarr'] != this.preferences['endpoint_lidarr'];
        apply |= prefs['api_sonarr'] != this.preferences['api_sonarr'];
        apply |= prefs['api_radarr'] != this.preferences['api_radarr'];
        apply |= prefs['api_lidarr'] != this.preferences['api_lidarr'];
        apply |= !Deluge.plugins.autoremoveplus.util.arrayEquals(prefs['trackers'],
            this.preferences['trackers']);
        apply |= !Deluge.plugins.autoremoveplus.util.arrayEquals(prefs['labels'],
            this.preferences['labels']);
        apply |= !Deluge.plugins.autoremoveplus.util.dictEquals(prefs['tracker_rules'],
            this.preferences['tracker_rules']);
        apply |= !Deluge.plugins.autoremoveplus.util.dictEquals(prefs['label_rules'],
            this.preferences['label_rules']);

        if (apply) {
          deluge.client.autoremoveplus.set_config(prefs, {
            success: this.loadPrefs,
            scope: this
          });
        }
    }

});

Deluge.plugins.autoremoveplus.Plugin = Ext.extend(Deluge.Plugin, {

    name: Deluge.plugins.autoremoveplus.PLUGIN_NAME,

    onEnable: function() {
        this.prefsPage = new Deluge.plugins.autoremoveplus.ui.PreferencePage();
        deluge.preferences.addPage(this.prefsPage);

        deluge.menus.torrent.add([{
            xtype: 'menucheckitem',
            text: 'AutoRemovePlus Exempt',
            id: 'exempt',

            listeners: {
                checkchange: function(checkitem,checked) {
                    //console.log('Torrent checked...');
                    console.log(checked);
                    deluge.client.autoremoveplus.set_ignore(deluge.torrents.getSelectedIds(),checked);
                }
            }
        }]);
		
		deluge.menus.torrent.on('show', this.updateExempt, this);
		
		deluge.menus.torrent.add([{
            xtype: 'menuitem',
			icon: 'bl.png',
            text: 'Remove and Blacklist',
            id: 'blacklist',
			handler: this.removeAndBlacklist
			//listeners: {
            //  deluge.client.autoremoveplus.blacklist(deluge.torrents.getSelectedIds())
            // }
            //}
        }]);

		//deluge.menus.torrent.on('show', this.removeAndBlacklist, this);

        console.log('%s enabled', Deluge.plugins.autoremoveplus.PLUGIN_NAME);
    },

    onDisable: function() {
        deluge.preferences.selectPage(_('Plugins'));
        deluge.preferences.removePage(this.prefsPage);
        this.prefsPage.destroy();

        deluge.menus.torrent.un('show', this.updateExempt, this);
		//deluge.menus.torrent.un('show', this.removeAndBlacklist, this);

        console.log('%s disabled', Deluge.plugins.autoremoveplus.PLUGIN_NAME);
    },

    //TODO block setChecked signal
    updateExempt: function() {
    	console.log('Updating checkitem...');
    	var checkitem = deluge.menus.torrent.getComponent('exempt');
    	deluge.client.autoremoveplus.get_ignore(deluge.torrents.getSelectedIds(), {
            success: function(ignored) {
                var checked = ignored.indexOf(false) < 0;
                checkitem.setChecked(checked);
            },
            scope: this
        });
    },
	
	removeAndBlacklist: function() {
    	console.log('Remove and blacklist function running...');
    	//var blacklistItem = deluge.menus.torrent.getComponent('blacklist');
    	result = deluge.client.autoremoveplus.blacklistCommand(deluge.torrents.getSelectedIds())
		console.log("Command returned:", result)
    }
});

Deluge.registerPlugin(Deluge.plugins.autoremoveplus.PLUGIN_NAME,Deluge.plugins.autoremoveplus.Plugin);
